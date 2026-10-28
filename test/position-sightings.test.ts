import { describe, expect, it } from 'vitest';
import type { FavoritesConfig, VehiclePosition } from '../src/domain/types';
import { NOW, alexaRequest, intentRequest, invoke, minutesFromNow } from './support/alexa';
import { FakeTransportProvider } from './support/fake-provider';

// Referências fictícias (~1,1 km entre si), sempre terminando no próprio ponto monitorado.
const ref = (name: string, lat: number) => ({ name, lat, lon: -46.6 });
const favorites: FavoritesConfig = {
  version: 1,
  lines: [
    { id: '1001', label: '875A-10' },
    { id: '2001', label: '575C-10', arrivalSource: 'position' },
    { id: '2002', label: '407Y-10', arrivalSource: 'position' },
  ],
  stops: [
    {
      id: '9001', alias: 'ponto da padaria', lineIds: ['1001', '2001'],
      approaches: [{ lineId: '2001', references: [ref('Parada Alfa', -23.57), ref('Parada Beta', -23.58), ref('ponto da padaria', -23.59)] }],
    },
    {
      id: '9002', alias: 'ponto do metrô', lineIds: ['2001', '2002'],
      approaches: [
        { lineId: '2001', references: [ref('Parada Gama', -23.61), ref('ponto do metrô', -23.62)] },
        { lineId: '2002', references: [ref('Parada Delta', -23.64), ref('ponto do metrô', -23.62)] },
      ],
    },
  ],
};

const prediction = (stopId: string, lineId: string, minutes: number) =>
  ({ stopId, lineId, arrivalAt: minutesFromNow(minutes), observedAt: NOW });
const vehicle = (lineId: string, vehicleId: string, lat: number, ageMinutes = 1): VehiclePosition =>
  ({ lineId, vehicleId, lat, lon: -46.6, observedAt: minutesFromNow(-ageMinutes) });

describe('consulta com linhas position (SPEC-0002, #20)', () => {
  it('consulta previsão só de linhas forecast e posição uma vez por linha position', async () => {
    const provider = new FakeTransportProvider({ '9001': [prediction('9001', '1001', 5)] });

    await invoke({ favorites, provider }, intentRequest('NextBusIntent'));

    expect(provider.calls).toEqual(['9001']);
    expect([...provider.positionCalls].sort()).toEqual(['2001', '2002']);
  });

  it('filtro por linha position consulta só a posição dessa linha, sem previsão', async () => {
    const provider = new FakeTransportProvider();

    await invoke({ favorites, provider }, filtered('NextBusByLineIntent', { line: '407Y-10' }));

    expect(provider.calls).toEqual([]);
    expect(provider.positionCalls).toEqual(['2002']);
  });

  it('filtro por ponto consulta previsão do ponto e posição só das linhas position dele', async () => {
    const provider = new FakeTransportProvider();

    await invoke({ favorites, provider }, filtered('NextBusByStopIntent', { stop: 'ponto da padaria' }));

    expect(provider.calls).toEqual(['9001']);
    expect(provider.positionCalls).toEqual(['2001']);
  });

  it('falha de posição não esconde as previsões de outras linhas', async () => {
    const provider = new FakeTransportProvider(
      { '9001': [prediction('9001', '1001', 5)] },
      { '2001': new Error('timeout'), '2002': new Error('timeout') },
    );

    const { speech } = await invoke({ favorites, provider }, intentRequest('NextBusIntent'));

    expect(speech).toContain('875A-10 no ponto da padaria em 5 minutos');
  });

  it('todas as consultas falhando resultam em indisponibilidade', async () => {
    const provider = new FakeTransportProvider(
      { '9001': new Error('500') },
      { '2001': new Error('timeout'), '2002': new Error('timeout') },
    );

    const { speech } = await invoke({ favorites, provider }, intentRequest('NextBusIntent'));

    expect(speech).toBe('Não consegui consultar as previsões agora. Tente novamente em instantes.');
  });
});

function filtered(name: string, slots: { line?: string; stop?: string }) {
  return alexaRequest({
    type: 'IntentRequest',
    intent: {
      name, confirmationStatus: 'NONE', slots: {
        ...(slots.line && { line: { name: 'line', value: slots.line } }),
        ...(slots.stop && { stop: { name: 'stop', value: slots.stop } }),
      },
    },
  });
}

