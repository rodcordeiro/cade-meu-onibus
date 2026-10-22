import { QUERY_WINDOW_MINUTES } from '../domain/arrival-policy';
import type { ArrivalPrediction, ArrivalResult, FavoritesConfig } from '../domain/types';

/** Traduz um resultado de chegadas em fala pt-BR, sem consultar serviços externos. */
export class SpeechPresenter {
  constructor(private readonly favorites: FavoritesConfig) {}

  /** Formula a fala com o tempo relativo calculado em `now`. */
  present(result: ArrivalResult, now: Date): string {
    if (result.status === 'unavailable') return 'Não consegui consultar as previsões agora. Tente novamente em instantes.';
    const main = this.describeArrivals(result, now);
    if (result.status === 'partial') {
      return `${main} Não consegui consultar ${this.joinStops(result.failedStopIds)}, então a lista pode estar incompleta.`;
    }
    return main;
  }

  private describeArrivals(result: ArrivalResult, now: Date): string {
    const items = result.predictions.map((p) => this.describe(p, now));
    if (items.length === 0) {
      return result.outsideWindowCount > 0
        ? `Nenhum ônibus das suas linhas favoritas tem previsão para os próximos ${QUERY_WINDOW_MINUTES} minutos.`
        : 'Não encontrei previsões disponíveis para suas linhas favoritas agora. Isso não garante que não haja ônibus a caminho.';
    }
    return items.length === 1 ? `Próximo ônibus: ${items[0]}.` : `Próximos ônibus: ${joinSpoken(items, '; ', '; e ')}.`;
  }

  private describe(prediction: ArrivalPrediction, now: Date): string {
    const line = this.favorites.lines.find((l) => l.id === prediction.lineId)?.label ?? prediction.lineId;
    const minutes = Math.floor((prediction.arrivalAt.getTime() - now.getTime()) / 60_000);
    return `${line} no ${this.stopAlias(prediction.stopId)} em ${formatMinutes(minutes)}`;
  }

  private joinStops(stopIds: string[]): string {
    return joinSpoken(stopIds.map((id) => `o ${this.stopAlias(id)}`), ', ', ' e ');
  }

  private stopAlias(stopId: string): string {
    return this.favorites.stops.find((s) => s.id === stopId)?.alias ?? stopId;
  }
}

function formatMinutes(minutes: number): string {
  if (minutes < 1) return 'menos de 1 minuto';
  return minutes === 1 ? '1 minuto' : `${minutes} minutos`;
}

/** Junta itens para fala: "a, b e c" (separadores configuráveis). */
function joinSpoken(items: string[], separator: string, lastSeparator: string): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(separator)}${lastSeparator}${items[items.length - 1]}`;
}
