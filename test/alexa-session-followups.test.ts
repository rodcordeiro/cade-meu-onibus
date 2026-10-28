import { describe, expect, it } from 'vitest';
import type { FavoritesConfig } from '../src/domain/types';
import { alexaRequest, invoke, NOW, minutesFromNow } from './support/alexa';
import { FakeTransportProvider } from './support/fake-provider';

const favorites: FavoritesConfig = {
  version: 1,
  lines: [{ id: '100', label: 'Azul' }, { id: '200', label: 'Verde' }],
  stops: [
    { id: '1', alias: 'central', lineIds: ['100', '200'] },
    { id: '2', alias: 'sul', lineIds: ['100', '200'] },
  ],
};
const prediction = (stopId: string, lineId: string) => ({ stopId, lineId, arrivalAt: minutesFromNow(4), observedAt: NOW });
const provider = () => new FakeTransportProvider({
  '1': [prediction('1', '100'), prediction('1', '200')],
  '2': [prediction('2', '100'), prediction('2', '200')],
});
function request(name: string, attrs: Record<string, unknown>, fresh: boolean, line?: string, stop?: string) {
  const envelope = alexaRequest({
    type: 'IntentRequest',
    intent: { name, confirmationStatus: 'NONE', slots: {
      ...(line && { line: { name: 'line', value: line } }),
      ...(stop && { stop: { name: 'stop', value: stop } }),
    } },
  });
  if (!envelope.session) throw new Error('Sessão de teste ausente');
  envelope.session.new = fresh;
  envelope.session.attributes = attrs;
  return envelope;
}
describe('continuidade de sessão (#7)', () => {
  it('reutiliza linha e ponto na pergunta seguinte', async () => {
    const transport = provider();
    const first = await invoke({ favorites, provider: transport }, request('NextBusByLineAndStopIntent', {}, true, 'Azul', 'central'));
    expect(first.shouldEndSession).toBe(false);
    expect(first.raw.sessionAttributes).toEqual({ lineId: '100', stopId: '1' });
    transport.calls.length = 0;
    const followup = await invoke({ favorites, provider: transport }, request('NextBusIntent', first.raw.sessionAttributes ?? {}, false));
    expect(followup.speech).toContain('Azul no central');
    expect(followup.speech).not.toContain('Verde');
    expect(transport.calls).toEqual(['1']);
  });
  it('altera apenas a dimensão explicitamente informada', async () => {
    const transport = provider();
    const response = await invoke({ favorites, provider: transport }, request('NextBusByLineIntent', { lineId: '100', stopId: '1' }, false, 'Verde'));
    expect(response.raw.sessionAttributes).toEqual({ lineId: '200', stopId: '1' });
    expect(response.speech).toContain('Verde no central');
    expect(transport.calls).toEqual(['1']);
  });
  it('nova sessão ignora atributos anteriores', async () => {
    const transport = provider();
    const response = await invoke({ favorites, provider: transport }, request('NextBusIntent', { lineId: '100', stopId: '1' }, true));
    expect(response.raw.sessionAttributes).toEqual({});
    expect(transport.calls).toEqual(['1', '2']);
  });
  it('help e stop não consultam previsões', async () => {
    const transport = provider();
    const help = await invoke({ favorites, provider: transport }, request('AMAZON.HelpIntent', {}, false));
    const stop = await invoke({ favorites, provider: transport }, request('AMAZON.StopIntent', {}, false));
    expect(help.speech).toContain('Você pode perguntar');
    expect(stop.shouldEndSession).toBe(true);
    expect(transport.calls).toEqual([]);
  });
});
