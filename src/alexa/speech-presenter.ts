import { QUERY_WINDOW_MINUTES } from '../domain/arrival-policy';
import type { ArrivalPrediction, ArrivalResult, FavoritesConfig, StopLineAssociation, VehicleSighting } from '../domain/types';

/** Traduz um resultado de chegadas em fala pt-BR, sem consultar serviços externos. */
export class SpeechPresenter {
  constructor(private readonly favorites: FavoritesConfig) {}

  /**
   * Formula a fala com o tempo relativo calculado em `now`.
   * `filter` identifica linha/ponto pedidos, usados para explicar consultas sem associação favorita.
   */
  present(result: ArrivalResult, now: Date, filter: { lineId?: string; stopId?: string } = {}): string {
    if (result.status === 'unavailable') return 'Não consegui consultar as previsões agora. Tente novamente em instantes.';
    if (result.status === 'no-associations') return this.describeMissingAssociation(filter);
    // Previsões primeiro; avistamentos depois, sem entrar no limite de cinco chegadas (ADR-0009).
    const parts = [
      ...(result.queriedStopIds.length > 0 ? [this.describeArrivals(result, now)] : []),
      ...result.positionAssociations.map((association) => this.describeSighting(association, result.sightings, now)),
    ];
    if (result.status === 'partial') {
      parts.push(`Não consegui consultar ${this.joinFailures(result)}, então a lista pode estar incompleta.`);
    }
    return parts.join(' ');
  }

  /**
   * Avistamento nunca vira tempo de chegada (invariante 7): fala só referência,
   * referências restantes e idade da observação.
   */
  private describeSighting(association: StopLineAssociation, sightings: VehicleSighting[], now: Date): string {
    const subject = `${this.lineLabel(association.lineId)} no ${this.stopAlias(association.stopId)}`;
    const sighting = sightings.find((s) => s.stopId === association.stopId && s.lineId === association.lineId);
    if (!sighting) return `${subject}: sem previsão e sem ônibus visto perto.`;
    const age = Math.floor((now.getTime() - sighting.observedAt.getTime()) / 60_000);
    const remaining = sighting.referencesRemaining === 0 ? 'já junto ao ponto'
      : sighting.referencesRemaining === 1 ? 'faltando 1 referência até o ponto'
        : `faltando ${sighting.referencesRemaining} referências até o ponto`;
    return `${subject}, sem previsão da SPTrans: ônibus visto há ${formatMinutes(age)} perto de ${sighting.referenceName}, ${remaining}.`;
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

  /** Nada foi consultado: a fala não pode afirmar que não há ônibus (#36). */
  private describeMissingAssociation({ lineId, stopId }: { lineId?: string; stopId?: string }): string {
    const suffix = 'então não consultei previsões.';
    if (lineId && stopId) {
      return `A ${this.lineLabel(lineId)} não está entre as linhas favoritas do ${this.stopAlias(stopId)}, ${suffix}`;
    }
    if (lineId) return `A ${this.lineLabel(lineId)} não está associada a nenhum ponto favorito, ${suffix}`;
    return `Não há pontos favoritos configurados para essa consulta, ${suffix}`;
  }

  private lineLabel(lineId: string): string {
    return this.favorites.lines.find((l) => l.id === lineId)?.label ?? lineId;
  }

  private describe(prediction: ArrivalPrediction, now: Date): string {
    const line = this.lineLabel(prediction.lineId);
    const minutes = Math.floor((prediction.arrivalAt.getTime() - now.getTime()) / 60_000);
    return `${line} no ${this.stopAlias(prediction.stopId)} em ${formatMinutes(minutes)}`;
  }

  private joinFailures(result: ArrivalResult): string {
    const items = [
      ...result.failedStopIds.map((id) => `o ${this.stopAlias(id)}`),
      ...result.failedLineIds.map((id) => `a posição da ${this.lineLabel(id)}`),
    ];
    return joinSpoken(items, ', ', ' e ');
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
