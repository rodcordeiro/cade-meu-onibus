import type { ArrivalPrediction, FavoriteLine, MonitoredStop } from "./types";

/** Máximo de chegadas anunciadas por resposta. */
export const MAX_ANNOUNCED_ARRIVALS = 5;

/** Horizonte da janela de consulta, inclusivo nas duas pontas. */
export const QUERY_WINDOW_MINUTES = 30;
export const QUERY_WINDOW_MS = QUERY_WINDOW_MINUTES * 60_000;

/**
 * Indica se a previsão pertence a uma associação ponto–linha favorita
 * e, quando a linha tem sentido configurado, se a previsão informa esse mesmo sentido
 * (sentido ausente é rejeitado: melhor omitir do que anunciar o sentido errado).
 */
export function matchesFavoritePair(
  prediction: ArrivalPrediction,
  stop: MonitoredStop,
  lines: ReadonlyMap<string, FavoriteLine>,
): boolean {
  if (
    prediction.stopId !== stop.id ||
    !stop.lineIds.includes(prediction.lineId)
  )
    return false;
  const direction = lines.get(prediction.lineId)?.direction;
  return direction === undefined || prediction.direction === direction;
}

/** Indica se a chegada tem instante válido e está entre 0 e 30 minutos a partir de `now`. */
export function isWithinWindow(
  prediction: ArrivalPrediction,
  now: Date,
): boolean {
  const delta = prediction.arrivalAt.getTime() - now.getTime();
  return Number.isFinite(delta) && delta >= 0 && delta <= QUERY_WINDOW_MS;
}

/**
 * Ordena por instante de chegada (desempate por ponto, linha e veículo), remove duplicatas
 * do mesmo veículo no mesmo par ponto–linha e limita o total, após a agregação de todos os pontos.
 */
export function selectArrivals(
  predictions: ArrivalPrediction[],
): ArrivalPrediction[] {
  const seen = new Set<string>();
  return [...predictions]
    .sort(compareArrivals)
    .filter((p) => {
      if (p.vehicleId === undefined) return true;
      const key = `${p.stopId}|${p.lineId}|${p.vehicleId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_ANNOUNCED_ARRIVALS);
}

function compareArrivals(a: ArrivalPrediction, b: ArrivalPrediction): number {
  return (
    a.arrivalAt.getTime() - b.arrivalAt.getTime() ||
    compareText(a.stopId, b.stopId) ||
    compareText(a.lineId, b.lineId) ||
    compareText(a.vehicleId ?? "", b.vehicleId ?? "")
  );
}

const compareText = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;
