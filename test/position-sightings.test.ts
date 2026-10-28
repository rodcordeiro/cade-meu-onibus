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

describe('fala de avistamentos sem ETA (#21)', () => {
  it('anuncia referência, referências restantes, idade e ausência de previsão; sem elegível diz que não viu ônibus perto', async () => {
    const provider = new FakeTransportProvider({}, { '2001': [vehicle('2001', 'v1', -23.58, 2)] });

    const { speech } = await invoke({ favorites, provider }, filtered('NextBusByLineIntent', { line: '575C-10' }));

    expect(speech).toBe(
      '575C-10 no ponto da padaria, sem previsão da SPTrans: ônibus visto há 2 minutos perto de Parada Beta, faltando 1 referência até o ponto. ' +
        '575C-10 no ponto do metrô: sem previsão e sem ônibus visto perto.',
    );
  });

  it('anuncia previsões antes dos avistamentos, preservando as cinco chegadas', async () => {
    const provider = new FakeTransportProvider(
      { '9001': [2, 4, 6, 8, 10, 12].map((m) => prediction('9001', '1001', m)) },
      { '2001': [vehicle('2001', 'v1', -23.59, 0)], '2002': [vehicle('2002', 'v9', -23.64, 3)] },
    );

    const { speech } = await invoke({ favorites, provider }, intentRequest('NextBusIntent'));

    expect(speech).toBe(
      'Próximos ônibus: 875A-10 no ponto da padaria em 2 minutos; 875A-10 no ponto da padaria em 4 minutos; ' +
        '875A-10 no ponto da padaria em 6 minutos; 875A-10 no ponto da padaria em 8 minutos; ' +
        'e 875A-10 no ponto da padaria em 10 minutos. ' +
        '575C-10 no ponto da padaria, sem previsão da SPTrans: ônibus visto há menos de 1 minuto perto de ponto da padaria, já junto ao ponto. ' +
        '575C-10 no ponto do metrô: sem previsão e sem ônibus visto perto. ' +
        '407Y-10 no ponto do metrô, sem previsão da SPTrans: ônibus visto há 3 minutos perto de Parada Delta, faltando 1 referência até o ponto.',
    );
  });

  it('comunica parcialidade quando a posição de uma linha falha, mantendo os demais resultados', async () => {
    const provider = new FakeTransportProvider(
      { '9001': [prediction('9001', '1001', 5)] },
      { '2001': new Error('timeout'), '2002': [vehicle('2002', 'v9', -23.64, 1)] },
    );

    const { speech } = await invoke({ favorites, provider }, intentRequest('NextBusIntent'));

    expect(speech).toBe(
      'Próximo ônibus: 875A-10 no ponto da padaria em 5 minutos. ' +
        '407Y-10 no ponto do metrô, sem previsão da SPTrans: ônibus visto há 1 minuto perto de Parada Delta, faltando 1 referência até o ponto. ' +
        'Não consegui consultar a posição da 575C-10, então a lista pode estar incompleta.',
    );
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

