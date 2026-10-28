import { isWithinWindow, matchesFavoritePair, selectArrivals } from '../domain/arrival-policy';
import type { ArrivalResult, ArrivalStatus, FavoriteLine, FavoritesConfig, TransportProvider } from '../domain/types';

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
   * Consulta os pontos favoritos, isolando a falha de cada ponto,
   * e devolve as previsões elegíveis agregadas com o status de cobertura.
   */
  async query({ now, lineId, stopId }: ArrivalQuery): Promise<ArrivalResult> {
    const stops = this.favorites.stops.filter(stop =>
      (stopId === undefined || stop.id === stopId) &&
      (lineId === undefined || stop.lineIds.includes(lineId))
    );
    const maxConcurrency = Math.max(1, Math.floor(this.options.maxConcurrency ?? DEFAULT_CONCURRENCY));
    const deadlineMs = Math.max(1, this.options.deadlineMs ?? DEFAULT_DEADLINE_MS);
    const deadline = Date.now() + deadlineMs;
    let cursor = 0;
    const settled: PromiseSettledResult<Awaited<ReturnType<TransportProvider['getArrivals']>>>[] = new Array(stops.length);
    const worker = async (): Promise<void> => {
      while (cursor < stops.length) {
        const index = cursor++;
        const stop = stops[index]!;
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          settled[index] = { status: 'rejected', reason: new Error('Deadline excedido') };
          continue;
        }
        try {
          const value = await withTimeout(this.provider.getArrivals(stop.id, { now }), remaining);
          settled[index] = { status: 'fulfilled', value };
        } catch (reason) {
          settled[index] = { status: 'rejected', reason };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(maxConcurrency, stops.length) }, () => worker()));

    const failedStopIds: string[] = [];
    const favoritePredictions = settled.flatMap((outcome, index) => {
      const stop = stops[index]!;
      if (outcome.status === 'rejected') {
        failedStopIds.push(stop.id);
        return [];
      }
      return outcome.value.filter((p) => matchesFavoritePair(p, stop, this.lines) && (lineId === undefined || p.lineId === lineId));
    });
    const eligible = favoritePredictions.filter((p) => isWithinWindow(p, now));

    return {
      predictions: selectArrivals(eligible),
      queriedStopIds: stops.map((stop) => stop.id),
      failedStopIds,
      status: coverageStatus(failedStopIds.length, stops.length),
      outsideWindowCount: favoritePredictions.length - eligible.length,
    };
  }
}

function coverageStatus(failed: number, total: number): ArrivalStatus {
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
