import { describe, expect, it } from 'vitest';
import type { FavoritesConfig } from '../src/domain/types';
import { resolveFilter } from '../src/alexa/filter-resolution';
import { alexaRequest, invoke, NOW, minutesFromNow } from './support/alexa';
import { FakeTransportProvider } from './support/fake-provider';

const favorites: FavoritesConfig = {
  version: 1,
  lines: [
    { id: '100', label: 'Linha azul', aliases: ['azul'] },
    { id: '200', label: 'Linha verde', aliases: ['verde'] },
  ],
  stops: [
    { id: '1', alias: 'ponto central', lineIds: ['100', '200'], aliases: ['central'] },
    { id: '2', alias: 'ponto sul', lineIds: ['100'] },
  ],
};
const prediction = (stopId: string, lineId: string) => ({
  stopId, lineId, arrivalAt: minutesFromNow(5), observedAt: NOW,
});
const request = (name: string, line?: string, stop?: string) =>
  alexaRequest({ type: 'IntentRequest', intent: {
    name, confirmationStatus: 'NONE',
    slots: {
      ...(line && { line: { name: 'line', value: line, confirmationStatus: 'NONE' } }),
      ...(stop && { stop: { name: 'stop', value: stop, confirmationStatus: 'NONE' } }),
    },
  } });

describe('consultas filtradas Alexa (#6)', () => {
  it('filtra por linha e não anuncia outra linha', async () => {
    const provider = new FakeTransportProvider({
      '1': [prediction('1', '100'), prediction('1', '200')],
      '2': [prediction('2', '100')],
    });
    const result = await invoke({ favorites, provider }, request('NextBusByLineIntent', 'verde'));
    expect(result.speech).toContain('Linha verde');
    expect(result.speech).not.toContain('Linha azul');
    expect(provider.calls).toEqual(['1']);
  });
  it('filtra por ponto e linha combinados', async () => {
    const provider = new FakeTransportProvider({
      '1': [prediction('1', '100'), prediction('1', '200')],
      '2': [prediction('2', '100')],
    });
    const result = await invoke({ favorites, provider }, request('NextBusByLineAndStopIntent', 'azul', 'central'));
    expect(result.speech).toContain('Linha azul no ponto central');
    expect(result.speech).not.toContain('Linha verde');
    expect(provider.calls).toEqual(['1']);
  });
  // #36: zero associações ponto–linha não é cobertura completa nem prova de que não há ônibus.
  it('linha e ponto sem associação favorita não consultam o provedor nem afirmam ausência de ônibus', async () => {
    const provider = new FakeTransportProvider();
    const result = await invoke({ favorites, provider }, request('NextBusByLineAndStopIntent', 'verde', 'ponto sul'));
    expect(provider.calls).toEqual([]);
    expect(result.speech).toBe('A Linha verde não está entre as linhas favoritas do ponto sul, então não consultei previsões.');
    expect(result.speech).not.toMatch(/Nenhum ônibus|Não encontrei previsões/);
    expect(result.shouldEndSession).toBe(false);
  });
  it('linha nova incompatível com o ponto guardado na sessão explica a falta de associação', async () => {
    const provider = new FakeTransportProvider();
    const envelope = request('NextBusByLineIntent', 'verde');
    if (!envelope.session) throw new Error('Sessão de teste ausente');
    envelope.session.new = false;
    envelope.session.attributes = { stopId: '2' };
    const result = await invoke({ favorites, provider }, envelope);
    expect(provider.calls).toEqual([]);
    expect(result.speech).toBe('A Linha verde não está entre as linhas favoritas do ponto sul, então não consultei previsões.');
  });
  it('orienta nome desconhecido sem consultar o provedor', async () => {
    const provider = new FakeTransportProvider();
    const result = await invoke({ favorites, provider }, request('NextBusByLineIntent', 'desconhecida'));
    expect(result.speech).toContain('Não reconheci linha');
    expect(provider.calls).toEqual([]);
    expect(result.shouldEndSession).not.toBe(true);
  });
  it('solicita esclarecimento quando alias é ambíguo', async () => {
    const config: FavoritesConfig = { ...favorites, lines: [...favorites.lines, { id: '300', label: 'Linha vermelha', aliases: ['azul'] }] };
    expect(resolveFilter(config, 'line', 'azul').kind).toBe('ambiguous');
    const result = await invoke({ favorites: config, provider: new FakeTransportProvider() }, request('NextBusByLineIntent', 'azul'));
    expect(result.speech).toContain('mais de uma opção');
  });
  it('normaliza acentos e espaços', () => {
    expect(resolveFilter(favorites, 'stop', '  PONTO   CENTRAL ')).toEqual({ kind: 'resolved', id: '1' });
  });
});
