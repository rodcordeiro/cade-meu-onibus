import { describe, expect, it } from 'vitest';
import type { FavoritesConfig } from '../src/domain/types';
import { NOW, alexaRequest, intentRequest, invoke, minutesFromNow } from './support/alexa';
import { FakeTransportProvider } from './support/fake-provider';

const favorites: FavoritesConfig = {
  version: 1,
  lines: [{ id: '1001', label: '875A-10' }],
  stops: [{ id: '9001', alias: 'ponto da padaria', lineIds: ['1001'] }],
};

const provider = () =>
  new FakeTransportProvider({
    '9001': [{ stopId: '9001', lineId: '1001', arrivalAt: minutesFromNow(6), observedAt: NOW }],
  });

describe('ciclo de vida da skill', () => {
  it('abrir a skill responde com a consulta geral e encerra a sessão', async () => {
    const { speech, shouldEndSession } = await invoke({ favorites, provider: provider() }, alexaRequest({ type: 'LaunchRequest' }));

    expect(speech).toBe('Próximo ônibus: 875A-10 no ponto da padaria em 6 minutos.');
    expect(shouldEndSession).toBe(true);
  });

  it('a consulta geral encerra a sessão após responder', async () => {
    const { shouldEndSession } = await invoke({ favorites, provider: provider() }, intentRequest('NextBusIntent'));

    expect(shouldEndSession).toBe(true);
  });

  it('ajuda explica como perguntar e mantém a sessão aberta', async () => {
    const { speech, shouldEndSession, raw } = await invoke({ favorites, provider: provider() }, intentRequest('AMAZON.HelpIntent'));

    expect(speech).toContain('quais são os próximos ônibus');
    expect(shouldEndSession).toBe(false);
    expect(raw.response.reprompt).toBeDefined();
  });

  it.each(['AMAZON.StopIntent', 'AMAZON.CancelIntent', 'AMAZON.NavigateHomeIntent'])('%s encerra a sessão', async (intent) => {
    const { speech, shouldEndSession } = await invoke({ favorites, provider: provider() }, intentRequest(intent));

    expect(speech).toBe('Até logo.');
    expect(shouldEndSession).toBe(true);
  });

  it('fallback orienta a tentar de novo e mantém a sessão aberta', async () => {
    const { speech, shouldEndSession } = await invoke({ favorites, provider: provider() }, intentRequest('AMAZON.FallbackIntent'));

    expect(speech).toContain('Não entendi');
    expect(shouldEndSession).toBe(false);
  });

  it('requisição não tratada recebe resposta genérica de erro', async () => {
    const { speech } = await invoke({ favorites, provider: provider() }, intentRequest('IntentDesconhecida'));

    expect(speech).toBe('Desculpe, algo deu errado. Tente novamente em instantes.');
  });

  it('fim de sessão é aceito sem fala', async () => {
    const { speech } = await invoke(
      { favorites, provider: provider() },
      alexaRequest({ type: 'SessionEndedRequest', reason: 'USER_INITIATED' }),
    );

    expect(speech).toBe('');
  });
});

describe('verificação de skill ID', () => {
  it('rejeita requisição de outra skill quando o skill ID está configurado', async () => {
    const outraSkill = invoke({ favorites, provider: provider(), skillId: 'amzn1.ask.skill.outra' }, intentRequest('NextBusIntent'));

    await expect(outraSkill).rejects.toThrow(/skill/i);
  });
});
