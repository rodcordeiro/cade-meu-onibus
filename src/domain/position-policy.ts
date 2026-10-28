import { isFreshObservation, MAX_OBSERVATION_AGE_MINUTES, MAX_OBSERVATION_AGE_MS } from './observation-freshness';
import type { ReferencePoint, VehiclePosition, VehicleSighting } from './types';

/** Hipóteses de campo: revisar após medições reais, sem derivar ETA de posição. */
export const MAX_POSITION_AGE_MINUTES = MAX_OBSERVATION_AGE_MINUTES;
export const MAX_POSITION_AGE_MS = MAX_OBSERVATION_AGE_MS;
export const MAX_REFERENCE_DISTANCE_METERS = 300;
const EARTH_RADIUS_METERS = 6_371_000;

/** Distância geodésica aproximada em metros, sem dependências externas. */
export function haversineMeters(a: Pick<ReferencePoint, 'lat' | 'lon'>, b: Pick<ReferencePoint, 'lat' | 'lon'>): number {
  const radians = (degrees: number): number => degrees * Math.PI / 180;
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const dLat = lat2 - lat1;
  const dLon = radians(b.lon - a.lon);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, h)));
}

/**
 * Seleciona um único avistamento para a associação ponto–linha.
 * As referências estão em ordem de aproximação e a última representa o ponto monitorado.
 * Nenhuma distância ou velocidade é convertida em tempo de chegada.
 */
export function selectVehicleSighting(
  stopId: string,
  lineId: string,
  references: readonly ReferencePoint[],
  positions: readonly VehiclePosition[],
  now: Date,
): VehicleSighting | undefined {
  if (references.length === 0 || !Number.isFinite(now.getTime())) return undefined;
  const candidates: VehicleSighting[] = [];

  for (const vehicle of positions) {
    if (vehicle.lineId !== lineId || !vehicle.vehicleId) continue;
    if (!isFreshObservation(vehicle.observedAt, now)) continue;
    if (!Number.isFinite(vehicle.lat) || !Number.isFinite(vehicle.lon) ||
      Math.abs(vehicle.lat) > 90 || Math.abs(vehicle.lon) > 180) continue;

    let nearestIndex = -1;
    let nearestDistance = Infinity;
    for (let index = 0; index < references.length; index++) {
      const reference = references[index]!;
      const distance = haversineMeters(vehicle, reference);
      if (distance <= MAX_REFERENCE_DISTANCE_METERS && distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }
    if (nearestIndex < 0) continue;
    candidates.push({
      stopId, lineId, vehicleId: vehicle.vehicleId,
      referenceName: references[nearestIndex]!.name,
      referencesRemaining: references.length - nearestIndex - 1,
      observedAt: vehicle.observedAt,
    });
  }

  candidates.sort((a, b) =>
    a.referencesRemaining - b.referencesRemaining ||
    b.observedAt.getTime() - a.observedAt.getTime() ||
    (a.vehicleId < b.vehicleId ? -1 : a.vehicleId > b.vehicleId ? 1 : 0),
  );
  return candidates[0];
}
