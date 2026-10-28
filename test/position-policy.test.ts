import { describe, expect, it } from 'vitest';
import { haversineMeters, MAX_POSITION_AGE_MS, selectVehicleSighting } from '../src/domain/position-policy';
import { MAX_CLOCK_SKEW_MS } from '../src/domain/observation-freshness';
import type { ReferencePoint, VehiclePosition } from '../src/domain/types';

const now = new Date('2026-10-28T12:00:00Z');
const refs: ReferencePoint[] = [
  { name: 'Primeira parada pública', lat: -23.5, lon: -46.6 },
  { name: 'Segunda parada pública', lat: -23.5, lon: -46.59 },
  { name: 'Ponto monitorado', lat: -23.5, lon: -46.58 },
];
const vehicle = (vehicleId: string, index: number, ageMs = 10_000): VehiclePosition => ({
  lineId: '100', vehicleId, lat: refs[index]!.lat, lon: refs[index]!.lon,
  observedAt: new Date(now.getTime() - ageMs),
});
const select = (positions: VehiclePosition[]) => selectVehicleSighting('900', '100', refs, positions, now);

describe('seleção de avistamento por posição (#19)', () => {
  it('retorna a referência mais próxima do ponto e quantas faltam', () => {
    expect(select([vehicle('A', 0), vehicle('B', 1)])).toEqual({
      stopId: '900', lineId: '100', vehicleId: 'B', referenceName: 'Segunda parada pública',
      referencesRemaining: 1, observedAt: vehicle('B', 1).observedAt,
    });
  });
  it('não inventa ETA no contrato de avistamento', () => {
    expect(select([vehicle('A', 2)])).toMatchObject({ referencesRemaining: 0, referenceName: 'Ponto monitorado' });
    expect(select([vehicle('A', 2)])).not.toHaveProperty('arrivalAt');
  });
  it('descarta observações antigas e futuras', () => {
    expect(select([vehicle('old', 0, MAX_POSITION_AGE_MS + 1)])).toBeUndefined();
    expect(select([vehicle('future', 0, -61_000)])).toBeUndefined();
    expect(select([vehicle('boundary', 0, MAX_POSITION_AGE_MS)])?.vehicleId).toBe('boundary');
  });
  it('tolera relógio do provedor adiantado em até 60 s', () => {
    expect(MAX_CLOCK_SKEW_MS).toBe(60_000);
    expect(select([vehicle('skew', 0, -30_000)])?.vehicleId).toBe('skew');
    expect(select([vehicle('edge', 0, -60_000)])?.vehicleId).toBe('edge');
  });
  it('não anuncia como junto ao ponto o ônibus que já passou dele (história 7)', () => {
    // ~150 m depois do ponto monitorado, no prolongamento do trajeto; ~1 grau de longitude ≈ 102 km nesta latitude.
    const passed = { ...vehicle('passed', 2), lon: -46.58 + 150 / 102_000 };
    expect(haversineMeters(passed, refs[2]!)).toBeGreaterThan(140);
    expect(select([passed])).toBeUndefined();
    const approaching = { ...vehicle('approaching', 2), lon: -46.58 - 150 / 102_000 };
    expect(select([approaching])).toMatchObject({ vehicleId: 'approaching', referencesRemaining: 0 });
  });
  it('com uma única referência, mantém o casamento só por distância', () => {
    const only = [refs[2]!];
    const passed = { ...vehicle('passed', 2), lon: -46.58 + 150 / 102_000 };
    expect(selectVehicleSighting('900', '100', only, [passed], now)?.vehicleId).toBe('passed');
  });
  it('descarta veículo distante e de outra linha', () => {
    expect(select([{ ...vehicle('far', 0), lat: 0, lon: 0 }, { ...vehicle('other', 0), lineId: '200' }])).toBeUndefined();
  });
  it('desempata por observação mais recente e depois por ID menor', () => {
    expect(select([vehicle('B', 1, 2000), vehicle('A', 1, 1000)])?.vehicleId).toBe('A');
    expect(select([vehicle('B', 1, 1000), vehicle('A', 1, 1000)])?.vehicleId).toBe('A');
  });
  it('usa a referência geograficamente mais próxima', () => {
    expect(haversineMeters(refs[0]!, refs[0]!)).toBe(0);
    expect(haversineMeters(refs[0]!, refs[1]!)).toBeGreaterThan(300);
  });
  it('retorna vazio para lista de referências vazia e coordenadas inválidas', () => {
    expect(selectVehicleSighting('900', '100', [], [vehicle('A', 0)], now)).toBeUndefined();
    expect(select([{ ...vehicle('A', 0), lat: Number.NaN }])).toBeUndefined();
  });
});
