import { describe, expect, it } from 'vitest';
import type { FavoritesConfig } from '../src/domain/types';
import { NOW, intentRequest, invoke, minutesFromNow } from './support/alexa';
import { FakeTransportProvider } from './support/fake-provider';

const favorites: FavoritesConfig = {
  version: 1,
  lines: [
    { id: '1001', label: '875A-10' },
    { id: '1002', label: '701U-10' },
  ],
  stops: [
    { id: '9001', alias: 'ponto da padaria', lineIds: ['1001', '1002'] },
    { id: '9002', alias: 'ponto do metrô', lineIds: ['1001'] },
  ],
};

const prediction = (stopId: string, lineId: string, arrivalAt: Date, extra: Record<string, unknown> = {}) => ({
  stopId,
  lineId,
  arrivalAt,
  observedAt: NOW,
  ...extra,
});

describe('consulta geral (NextBusIntent)', () => {
  it('anuncia linha, ponto e minutos de uma previsão', async () => {
    const provider = new FakeTransportProvider({ '9001': [prediction('9001', '1001', minutesFromNow(5))] });

    const { speech } = await invoke({ favorites, provider }, intentRequest('NextBusIntent'));

    expect(speech).toBe('Próximo ônibus: 875A-10 no ponto da padaria em 5 minutos.');
  });

  it('consulta todos os pontos favoritos e anuncia as 5 chegadas mais próximas em ordem global', async () => {
    const provider = new FakeTransportProvider({
      '9001': [
        prediction('9001', '1001', minutesFromNow(12)),
        prediction('9001', '1002', minutesFromNow(2)),
        prediction('9001', '1001', minutesFromNow(25)),
        prediction('9001', '1002', minutesFromNow(20)),
      ],
      '9002': [prediction('9002', '1001', minutesFromNow(7)), prediction('9002', '1001', minutesFromNow(15))],
    });

    const { speech } = await invoke({ favorites, provider }, intentRequest('NextBusIntent'));

    expect(provider.calls.sort()).toEqual(['9001', '9002']);
    expect(speech).toBe(
      'Próximos ônibus: 701U-10 no ponto da padaria em 2 minutos; ' +
        '875A-10 no ponto do metrô em 7 minutos; ' +
        '875A-10 no ponto da padaria em 12 minutos; ' +
        '875A-10 no ponto do metrô em 15 minutos; ' +
        'e 701U-10 no ponto da padaria em 20 minutos.',
    );
  });

  it('aplica a janela inclusiva de 0 a 30 minutos', async () => {
    const provider = new FakeTransportProvider({
      '9001': [
        prediction('9001', '1001', minutesFromNow(-1)),
        prediction('9001', '1001', minutesFromNow(0)),
        prediction('9001', '1002', minutesFromNow(30)),
        prediction('9001', '1002', minutesFromNow(30, 1)),
      ],
    });

    const { speech } = await invoke({ favorites, provider }, intentRequest('NextBusIntent'));

    expect(speech).toBe(
      'Próximos ônibus: 875A-10 no ponto da padaria em menos de 1 minuto; e 701U-10 no ponto da padaria em 30 minutos.',
    );
  });

  it('ignora linhas que não são favoritas naquele ponto', async () => {
    const provider = new FakeTransportProvider({
      '9002': [
        prediction('9002', '1002', minutesFromNow(3)),
        prediction('9002', '5555', minutesFromNow(4)),
        prediction('9002', '1001', minutesFromNow(1)),
      ],
    });

    const { speech } = await invoke({ favorites, provider }, intentRequest('NextBusIntent'));

    expect(speech).toBe('Próximo ônibus: 875A-10 no ponto do metrô em 1 minuto.');
  });

  it('desempata chegadas simultâneas de forma determinística por ponto e linha', async () => {
    const provider = new FakeTransportProvider({
      '9001': [prediction('9001', '1002', minutesFromNow(5)), prediction('9001', '1001', minutesFromNow(5))],
      '9002': [prediction('9002', '1001', minutesFromNow(5))],
    });

    const { speech } = await invoke({ favorites, provider }, intentRequest('NextBusIntent'));

    expect(speech).toBe(
      'Próximos ônibus: 875A-10 no ponto da padaria em 5 minutos; ' +
        '701U-10 no ponto da padaria em 5 minutos; ' +
        'e 875A-10 no ponto do metrô em 5 minutos.',
    );
  });

  it('remove duplicatas do mesmo veículo no mesmo ponto, mas mantém o veículo em pontos distintos', async () => {
    const provider = new FakeTransportProvider({
      '9001': [
        prediction('9001', '1001', minutesFromNow(4), { vehicleId: 'v1' }),
        prediction('9001', '1001', minutesFromNow(4), { vehicleId: 'v1' }),
      ],
      '9002': [prediction('9002', '1001', minutesFromNow(9), { vehicleId: 'v1' })],
    });

    const { speech } = await invoke({ favorites, provider }, intentRequest('NextBusIntent'));

    expect(speech).toBe('Próximos ônibus: 875A-10 no ponto da padaria em 4 minutos; e 875A-10 no ponto do metrô em 9 minutos.');
  });

  it('escapa caracteres especiais de SSML nos nomes', async () => {
    const special: FavoritesConfig = { version: 1, lines: [{ id: '1001', label: 'A<B' }], stops: [{ id: '9001', alias: 'ponto R&B', lineIds: ['1001'] }] };
    const provider = new FakeTransportProvider({ '9001': [prediction('9001', '1001', minutesFromNow(2))] });

    const { speech } = await invoke({ favorites: special, provider }, intentRequest('NextBusIntent'));

    expect(speech).toBe('Próximo ônibus: A&lt;B no ponto R&amp;B em 2 minutos.');
  });

  it('ignora previsões de sentido diferente ou desconhecido quando a linha tem sentido configurado', async () => {
    const withDirection: FavoritesConfig = {
      ...favorites,
      lines: [{ id: '1001', label: '875A-10', direction: '1' }, favorites.lines[1]!],
    };
    const provider = new FakeTransportProvider({
      '9002': [
        prediction('9002', '1001', minutesFromNow(2), { direction: '2' }),
        prediction('9002', '1001', minutesFromNow(4)),
        prediction('9002', '1001', minutesFromNow(6), { direction: '1' }),
      ],
    });

    const { speech } = await invoke({ favorites: withDirection, provider }, intentRequest('NextBusIntent'));

    expect(speech).toBe('Próximo ônibus: 875A-10 no ponto do metrô em 6 minutos.');
  });
});
