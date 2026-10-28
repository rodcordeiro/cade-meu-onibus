import { isWithinWindow, matchesFavoritePair, selectArrivals } from '../domain/arrival-policy';
import { selectVehicleSighting } from '../domain/position-policy';
import type {
  ArrivalPrediction, ArrivalResult, ArrivalStatus, FavoriteLine, FavoritesConfig, MonitoredStop,
  StopLineAssociation, TransportProvider, VehiclePosition, VehicleSighting,
} from '../domain/types';

/** Parâmetros de uma consulta geral; janela e limite vêm da política de domínio. */
export interface ArrivalQuery {
  now: Date;
  lineId?: string;
  stopId?: string;
}

export interface ArrivalQueryOptions {
  maxConcurrency?: number;
  deadlineMs?: number;
}

const DEFAULT_CONCURRENCY = 3;
const DEFAULT_DEADLINE_MS = 7000;

type Outcome<T> = { ok: true; value: T } | { ok: false };

/** Orquestra a consulta de chegadas sobre os pontos e linhas favoritos. */
export class ArrivalService {
  private readonly lines: ReadonlyMap<string, FavoriteLine>;

  constructor(
    private readonly favorites: FavoritesConfig,
    private readonly provider: TransportProvider,
    private readonly options: ArrivalQueryOptions = {},
  ) {
    this.lines = new Map(favorites.lines.map((line) => [line.id, line]));
  }

  /**
   * Consulta previsões por ponto (linhas `forecast`) e posições por linha (linhas `position`),
   * com a mesma concorrência limitada e o mesmo deadline total, isolando a falha de cada consulta.
   * Linhas `position` nunca passam pela previsão e não há fallback automático (ADR-0009).
   */
  async query({ now, lineId, stopId }: ArrivalQuery): Promise<ArrivalResult> {
    const inScope = (stop: MonitoredStop, line: string): boolean =>
      (stopId === undefined || stop.id === stopId) && (lineId === undefined || line === lineId);
    const forecastStops = this.favorites.stops.filter(stop =>
      stop.lineIds.some(line => inScope(stop, line) && !this.isPosition(line)));
    const positionAssociations: StopLineAssociation[] = this.favorites.stops.flatMap(stop =>
      stop.lineIds.filter(line => inScope(stop, line) && this.isPosition(line)).map(line => ({ stopId: stop.id, lineId: line })));
    // Posição vem por linha: uma única consulta mesmo quando a linha aparece em vários pontos.
    const positionLineIds = [...new Set(positionAssociations.map(a => a.lineId))];

    const tasks: Array<() => Promise<unknown>> = [
      ...forecastStops.map(stop => () => this.provider.getArrivals(stop.id, { now })),
      ...positionLineIds.map(line => () => this.provider.getVehiclePositions(line, { now })),
    ];
    const outcomes = await runBounded(tasks, this.options);
    const stopOutcomes = outcomes.slice(0, forecastStops.length) as Outcome<ArrivalPrediction[]>[];
    const lineOutcomes = new Map(positionLineIds.map((line, index) =>
      [line, outcomes[forecastStops.length + index] as Outcome<VehiclePosition[]>]));

    const failedStopIds: string[] = [];
    const favoritePredictions = stopOutcomes.flatMap((outcome, index) => {
      const stop = forecastStops[index]!;
      if (!outcome.ok) {
        failedStopIds.push(stop.id);
        return [];
      }
      return outcome.value.filter((p) => matchesFavoritePair(p, stop, this.lines) &&
        !this.isPosition(p.lineId) && (lineId === undefined || p.lineId === lineId));
    });
    const eligible = favoritePredictions.filter((p) => isWithinWindow(p, now));

    const failedLineIds = positionLineIds.filter(line => !lineOutcomes.get(line)!.ok);
    const answeredAssociations = positionAssociations.filter(a => !failedLineIds.includes(a.lineId));
    const sightings = answeredAssociations.flatMap((association): VehicleSighting[] => {
      const outcome = lineOutcomes.get(association.lineId)!;
      if (!outcome.ok) return [];
      const references = this.favorites.stops.find(s => s.id === association.stopId)
        ?.approaches?.find(a => a.lineId === association.lineId)?.references ?? [];
      const sighting = selectVehicleSighting(association.stopId, association.lineId, references, outcome.value, now);
      return sighting ? [sighting] : [];
    });

    return {
      predictions: selectArrivals(eligible),
      queriedStopIds: forecastStops.map((stop) => stop.id),
      failedStopIds,
      status: coverageStatus(failedStopIds.length + failedLineIds.length, tasks.length),
      outsideWindowCount: favoritePredictions.length - eligible.length,
      sightings,
      positionAssociations: answeredAssociations,
      failedLineIds,
    };
  }

  private isPosition(lineId: string): boolean {
    return this.lines.get(lineId)?.arrivalSource === 'position';
  }
}

/** Executa as consultas com concorrência limitada e deadline total compartilhados. */
async function runBounded(tasks: Array<() => Promise<unknown>>, options: ArrivalQueryOptions): Promise<Outcome<unknown>[]> {
  const maxConcurrency = Math.max(1, Math.floor(options.maxConcurrency ?? DEFAULT_CONCURRENCY));
  const deadline = Date.now() + Math.max(1, options.deadlineMs ?? DEFAULT_DEADLINE_MS);
  const outcomes: Outcome<unknown>[] = new Array(tasks.length);
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < tasks.length) {
      const index = cursor++;
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        outcomes[index] = { ok: false };
        continue;
      }
      try {
        outcomes[index] = { ok: true, value: await withTimeout(tasks[index]!(), remaining) };
      } catch {
        outcomes[index] = { ok: false };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(maxConcurrency, tasks.length) }, () => worker()));
  return outcomes;
}

function coverageStatus(failed: number, total: number): ArrivalStatus {
  // Nenhuma consulta feita (ponto ou linha) não é cobertura completa (#36).
  if (total === 0) return 'no-associations';
  if (failed === 0) return 'complete';
  return failed === total ? 'unavailable' : 'partial';
}

/** Impede que uma consulta pendurada bloqueie a resposta; o provedor deve cancelar a rede por timeout próprio. */
function withTimeout<T>(task: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Deadline excedido')), timeoutMs);
    task.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}
