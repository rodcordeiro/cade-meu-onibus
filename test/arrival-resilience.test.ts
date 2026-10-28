import { describe, expect, it } from 'vitest';
import { ArrivalService } from '../src/application/arrival-service';
import type { ArrivalPrediction, FavoritesConfig, RequestContext, TransportProvider } from '../src/domain/types';

const now = new Date('2026-10-28T12:00:00Z');
const favorites: FavoritesConfig = {
  version: 1,
  lines: [{ id: '100', label: 'Linha 100' }],
  stops: Array.from({ length: 5 }, (_, i) => ({ id: String(i + 1), alias: 'Ponto ' + (i + 1), lineIds: ['100'] })),
};
const prediction = (stopId: string): ArrivalPrediction => ({
  stopId, lineId: '100', arrivalAt: new Date(now.getTime() + 60000), observedAt: now,
});

describe('limites de consulta', () => {
  it('respeita concorrência máxima sem perder resultados', async () => {
    let active = 0, peak = 0;
    const provider: TransportProvider = {
      getArrivals: async (id: string, _ctx: RequestContext) => {
        active++; peak = Math.max(peak, active);
        await new Promise(resolve => setTimeout(resolve, 5));
        active--;
        return [prediction(id)];
      },
    };
    const result = await new ArrivalService(favorites, provider, { maxConcurrency: 2 }).query({ now });
    expect(peak).toBeLessThanOrEqual(2);
    expect(result.predictions).toHaveLength(5);
    expect(result.status).toBe('complete');
  });

  it('responde com falha parcial quando uma consulta excede deadline', async () => {
    const provider: TransportProvider = {
      getArrivals: async id => id === '2' ? new Promise<ArrivalPrediction[]>(() => {}) : [prediction(id)],
    };
    const result = await new ArrivalService(favorites, provider, { maxConcurrency: 2, deadlineMs: 30 }).query({ now });
    expect(result.status).toBe('partial');
    expect(result.failedStopIds).toContain('2');
    expect(result.predictions.length).toBeGreaterThan(0);
  });

  it('distingue indisponibilidade total de ausência de previsão', async () => {
    const unavailable: TransportProvider = { getArrivals: async () => { throw Error('falha'); } };
    const empty: TransportProvider = { getArrivals: async () => [] };
    expect((await new ArrivalService(favorites, unavailable).query({ now })).status).toBe('unavailable');
    expect((await new ArrivalService(favorites, empty).query({ now })).status).toBe('complete');
  });

  it('zero associações ponto–linha não é cobertura completa (#36)', async () => {
    const empty: TransportProvider = { getArrivals: async () => [] };
    const result = await new ArrivalService(favorites, empty).query({ now, lineId: '999' });
    expect(result.status).toBe('no-associations');
    expect(result.queriedStopIds).toEqual([]);
  });
});
