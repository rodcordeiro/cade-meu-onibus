import { describe, expect, it } from 'vitest';
import type { FavoritesConfig } from '../src/domain/types';
import { NOW, intentRequest, invoke, minutesFromNow } from './support/alexa';
import { FakeTransportProvider } from './support/fake-provider';

const favorites: FavoritesConfig = {
  version: 1,
  lines: [{ id: '1001', label: '875A-10' }],
  stops: [
    { id: '9001', alias: 'ponto da padaria', lineIds: ['1001'] },
    { id: '9002', alias: 'ponto do metrô', lineIds: ['1001'] },
  ],
};

const at = (stopId: string, minutes: number) => ({
  stopId,
  lineId: '1001',
  arrivalAt: minutesFromNow(minutes),
  observedAt: NOW,
});

describe('resultados sem previsões e falhas por ponto', () => {
  it('diz que não há previsões disponíveis sem afirmar que não há ônibus', async () => {
    const { speech } = await invoke({ favorites, provider: new FakeTransportProvider() }, intentRequest('NextBusIntent'));

    expect(speech).toBe(
      'Não encontrei previsões disponíveis para suas linhas favoritas agora. Isso não garante que não haja ônibus a caminho.',
    );
  });

  it('distingue previsões existentes apenas fora da janela de 30 minutos', async () => {
    const provider = new FakeTransportProvider({ '9001': [at('9001', 45)] });

    const { speech } = await invoke({ favorites, provider }, intentRequest('NextBusIntent'));

    expect(speech).toBe('Nenhum ônibus das suas linhas favoritas tem previsão para os próximos 30 minutos.');
  });

  it('mantém previsões válidas e avisa sobre cobertura incompleta quando um ponto falha', async () => {
    const provider = new FakeTransportProvider({ '9001': [at('9001', 8)], '9002': new Error('timeout') });

    const { speech } = await invoke({ favorites, provider }, intentRequest('NextBusIntent'));

    expect(speech).toBe(
      'Próximo ônibus: 875A-10 no ponto da padaria em 8 minutos. ' +
        'Não consegui consultar o ponto do metrô, então a lista pode estar incompleta.',
    );
  });

  it('informa indisponibilidade quando nenhum ponto pôde ser consultado', async () => {
    const provider = new FakeTransportProvider({ '9001': new Error('500'), '9002': new Error('500') });

    const { speech } = await invoke({ favorites, provider }, intentRequest('NextBusIntent'));

    expect(speech).toBe('Não consegui consultar as previsões agora. Tente novamente em instantes.');
  });
});
