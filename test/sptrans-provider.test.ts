import { describe, expect, it, vi } from 'vitest';
import { parseArrivals, SptransTransportProvider } from '../src/infrastructure/transport/sptrans-provider';

const now = new Date('2026-10-22T18:50:00Z');
const sample = { hr: '15:50', p: { cp: 260016861, l: [{ cl: 609, sl: 1, vs: [{ p: '64488', t: '16:11', ta: '2026-10-22T18:50:37Z' }] }] } };

describe('SPTrans previsão', () => {
  it('normaliza códigos por sentido, horários de São Paulo e observação UTC', () => {
    expect(parseArrivals(sample, '260016861', now)).toEqual([{
      stopId: '260016861', lineId: '609', direction: '1', vehicleId: '64488',
      arrivalAt: new Date('2026-10-22T19:11:00Z'), observedAt: new Date('2026-10-22T18:50:37Z'),
    }]);
  });
  it('descarta previsão com observação antiga sem inventar disponibilidade', () => {
    const stale = structuredClone(sample);
    stale.p.l[0]!.vs[0]!.ta = new Date(now.getTime() - 5 * 60_000 - 1).toISOString();
    expect(parseArrivals(stale, '260016861', now)).toEqual([]);
  });
  it('aceita observação exatamente no limite de cinco minutos', () => {
    const boundary = structuredClone(sample);
    boundary.p.l[0]!.vs[0]!.ta = new Date(now.getTime() - 5 * 60_000).toISOString();
    expect(parseArrivals(boundary, '260016861', now)).toHaveLength(1);
  });
  it('descarta observação com relógio mais de um minuto no futuro', () => {
    const future = structuredClone(sample);
    future.p.l[0]!.vs[0]!.ta = new Date(now.getTime() + 60_001).toISOString();
    expect(parseArrivals(future, '260016861', now)).toEqual([]);
  });
  it('interpreta p:null como nenhuma previsão', () => {
    expect(parseArrivals({ hr: '15:50', p: null }, '260016861', now)).toEqual([]);
  });
  it('resolve virada de dia', () => {
    expect(parseArrivals({ hr: '23:55', p: { cp: 1, l: [{ cl: 2, vs: [{ t: '00:10', ta: now.toISOString() }] }] } }, '1', now)[0]?.arrivalAt).toEqual(new Date('2026-10-23T03:10:00Z'));
  });
  it('usa o deslocamento vigente em São Paulo na data (horário de verão histórico, UTC-02)', () => {
    const dstNow = new Date('2018-12-01T17:50:00Z'); // 15:50 em São Paulo (UTC-02)
    const raw = { hr: '15:50', p: { cp: 1, l: [{ cl: 2, vs: [{ t: '16:11', ta: dstNow.toISOString() }] }] } };
    expect(parseArrivals(raw, '1', dstNow)[0]?.arrivalAt).toEqual(new Date('2018-12-01T18:11:00Z'));
  });
  it('ancora a data no dia de hr quando o relógio local já virou a meia-noite', () => {
    const afterMidnight = new Date('2026-10-23T03:01:00Z'); // 00:01 em São Paulo
    const raw = { hr: '23:59', p: { cp: 1, l: [{ cl: 2, vs: [{ t: '00:05', ta: afterMidnight.toISOString() }] }] } };
    expect(parseArrivals(raw, '1', afterMidnight)[0]?.arrivalAt).toEqual(new Date('2026-10-23T03:05:00Z'));
  });
  it('não joga a previsão 24 h para trás quando o relógio do servidor está à frente de hr', () => {
    const serverAhead = new Date('2026-10-23T03:00:30Z'); // 00:00 em São Paulo; SPTrans ainda em 23:59
    const raw = { hr: '23:59', p: { cp: 1, l: [{ cl: 2, vs: [{ t: '23:59', ta: serverAhead.toISOString() }] }] } };
    expect(parseArrivals(raw, '1', serverAhead)[0]?.arrivalAt).toEqual(new Date('2026-10-23T02:59:00Z'));
  });
  it('ignora veículo com horário t inválido sem inventar previsão', () => {
    const raw = { hr: '15:50', p: { cp: 1, l: [{ cl: 2, vs: [{ t: '24:10', ta: now.toISOString() }, { t: '16:00', ta: now.toISOString() }] }] } };
    expect(parseArrivals(raw, '1', now).map(p => p.arrivalAt)).toEqual([new Date('2026-10-22T19:00:00Z')]);
  });
  it('faz login lazy e reutiliza cookie', async () => {
    const fetcher = vi.fn(async (url: string) => url.includes('/Login/')
      ? { ok: true, text: async () => 'true', headers: { getSetCookie: () => ['session=abc; Path=/'] } }
      : { ok: true, status: 200, json: async () => sample });
    const provider = new SptransTransportProvider('secret', fetcher as unknown as typeof fetch);
    await provider.getArrivals('260016861', { now });
    await provider.getArrivals('260016861', { now });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[0]?.[0]).toContain('/Login/Autenticar');
  });
  it('renova sessão após HTTP 401 uma vez', async () => {
    let login = 0;
    let calls = 0;
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes('/Login/')) { login++; return { ok: true, text: async () => 'true', headers: { getSetCookie: () => ['session=' + login] } }; }
      calls++;
      if (calls === 1) return { ok: false, status: 401 };
      return { ok: true, status: 200, json: async () => sample };
    });
    const provider = new SptransTransportProvider('secret', fetcher as unknown as typeof fetch);
    expect(await provider.getArrivals('260016861', { now })).toHaveLength(1);
    expect(login).toBe(2);
  });
  it('não faz requisição com código inválido', async () => {
    const fetcher = vi.fn();
    const provider = new SptransTransportProvider('secret', fetcher as unknown as typeof fetch);
    await expect(provider.getArrivals('abc', { now })).rejects.toThrow('inválido');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
