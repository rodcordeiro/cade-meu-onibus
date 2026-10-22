import { isWithinWindow, matchesFavoritePair, selectArrivals } from '../domain/arrival-policy';
import type { ArrivalResult, ArrivalStatus, FavoriteLine, FavoritesConfig, TransportProvider } from '../domain/types';

/** Parâmetros de uma consulta geral; janela e limite vêm da política de domínio. */
export interface ArrivalQuery {
  now: Date;
}

/** Orquestra a consulta de chegadas sobre os pontos e linhas favoritos. */
export class ArrivalService {
  private readonly lines: ReadonlyMap<string, FavoriteLine>;

  constructor(
    private readonly favorites: FavoritesConfig,
    private readonly provider: TransportProvider,
  ) {
    this.lines = new Map(favorites.lines.map((line) => [line.id, line]));
  }

  /**
   * Consulta os pontos favoritos, isolando a falha de cada ponto,
   * e devolve as previsões elegíveis agregadas com o status de cobertura.
   */
  async query({ now }: ArrivalQuery): Promise<ArrivalResult> {
    const stops = this.favorites.stops;
    const settled = await Promise.allSettled(stops.map((stop) => this.provider.getArrivals(stop.id, { now })));

    const failedStopIds: string[] = [];
    const favoritePredictions = settled.flatMap((outcome, index) => {
      const stop = stops[index]!;
      if (outcome.status === 'rejected') {
        failedStopIds.push(stop.id);
        return [];
      }
      return outcome.value.filter((p) => matchesFavoritePair(p, stop, this.lines));
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
