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
  it('interpreta p:null como nenhuma previsão', () => {
    expect(parseArrivals({ hr: '15:50', p: null }, '260016861', now)).toEqual([]);
  });
  it('resolve virada de dia', () => {
    expect(parseArrivals({ hr: '23:55', p: { cp: 1, l: [{ cl: 2, vs: [{ t: '00:10', ta: now.toISOString() }] }] } }, '1', now)[0]?.arrivalAt).toEqual(new Date('2026-10-23T03:10:00Z'));
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
