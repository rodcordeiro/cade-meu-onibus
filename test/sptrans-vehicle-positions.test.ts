import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { SptransTransportProvider } from '../src/infrastructure/transport/sptrans-provider';

const now = new Date('2026-10-28T12:37:20Z');

type FakeResponse = { ok: boolean; status: number; json?: () => Promise<unknown> };
const loginOk = (cookie: string) => ({ ok: true, text: async () => 'true', headers: { getSetCookie: () => [cookie + '; Path=/'] } });
const ok = (body: unknown): FakeResponse => ({ ok: true, status: 200, json: async () => body });

/** Servidor HTTP falso: login sempre aceito; consultas respondidas por `respond`. */
function server(respond: (url: string, cookie: string) => FakeResponse | Promise<FakeResponse>) {
  let logins = 0;
  const queries: Array<{ url: string; cookie: string }> = [];
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('/Login/')) return loginOk('session=' + ++logins);
    const cookie = (init?.headers as Record<string, string>).cookie ?? '';
    queries.push({ url, cookie });
    return respond(url, cookie);
  });
  return { fetcher, queries, logins: () => logins };
}

describe('SPTrans posição por linha', () => {
  it('normaliza veículos de Posicao/Linha em VehiclePosition (py = latitude, px = longitude)', async () => {
    const http = server(() => ok({
      hr: '09:37',
      vs: [
        { p: '48800', a: true, ta: '2026-10-28T12:37:05Z', py: -23.5871, px: -46.5812, sv: null, is: null },
        { p: '48080', a: true, ta: '2026-10-28T12:36:35Z', py: -23.5902, px: -46.5799, sv: null, is: null },
      ],
    }));
    const provider = new SptransTransportProvider('secret-token', http.fetcher as unknown as typeof fetch);

    expect(await provider.getVehiclePositions('34974', { now })).toEqual([
      { lineId: '34974', vehicleId: '48800', lat: -23.5871, lon: -46.5812, observedAt: new Date('2026-10-28T12:37:05Z') },
      { lineId: '34974', vehicleId: '48080', lat: -23.5902, lon: -46.5799, observedAt: new Date('2026-10-28T12:36:35Z') },
    ]);
    expect(http.queries.map(q => q.url)).toEqual(['https://api.olhovivo.sptrans.com.br/v2.1/Posicao/Linha?codigoLinha=34974']);
  });

  it('ignora veículos sem prefixo, instante ou coordenadas válidos, sem fabricar observação', async () => {
    const valid = { p: '48800', a: true, ta: '2026-10-28T12:37:05Z', py: -23.5871, px: -46.5812 };
    const http = server(() => ok({
      hr: '09:37',
      vs: [
        { ...valid, p: undefined },
        { ...valid, p: '' },
        { ...valid, p: 48800 },
        { ...valid, ta: undefined },
        { ...valid, ta: 'ontem' },
        { ...valid, py: undefined },
        { ...valid, px: null },
        { ...valid, py: '-23.5' },
        { ...valid, px: Number.NaN },
        { ...valid, py: -91 },
        { ...valid, px: 181 },
        null,
        'lixo',
        valid,
      ],
    }));
    const provider = new SptransTransportProvider('secret-token', http.fetcher as unknown as typeof fetch);

    expect(await provider.getVehiclePositions('34974', { now })).toEqual([
      { lineId: '34974', vehicleId: '48800', lat: -23.5871, lon: -46.5812, observedAt: new Date('2026-10-28T12:37:05Z') },
    ]);
  });

  it('vs vazio significa nenhum veículo observado', async () => {
    const http = server(() => ok({ hr: '09:37', vs: [] }));
    const provider = new SptransTransportProvider('secret-token', http.fetcher as unknown as typeof fetch);
    expect(await provider.getVehiclePositions('34974', { now })).toEqual([]);
  });

  it('fixture real sanitizada sem coordenadas não gera posição inventada', async () => {
    const fixture = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'sptrans', 'posicao-linha-sem-previsao-34974.json'), 'utf8'));
    expect(fixture.body.vs.length).toBeGreaterThan(0);
    const http = server(() => ok(fixture.body));
    const provider = new SptransTransportProvider('secret-token', http.fetcher as unknown as typeof fetch);
    expect(await provider.getVehiclePositions('34974', { now })).toEqual([]);
  });

  it('resposta sem lista vs é falha do provedor, não ausência de veículos', async () => {
    const http = server(() => ok({ hr: '09:37' }));
    const provider = new SptransTransportProvider('secret-token', http.fetcher as unknown as typeof fetch);
    await expect(provider.getVehiclePositions('34974', { now })).rejects.toThrow('Resposta SPTrans inválida');
  });

  it('reaproveita a sessão já aberta pela previsão (um único login)', async () => {
    const http = server(url => url.includes('/Previsao/')
      ? ok({ hr: '09:37', p: null })
      : ok({ hr: '09:37', vs: [] }));
    const provider = new SptransTransportProvider('secret-token', http.fetcher as unknown as typeof fetch);
    await provider.getArrivals('8704768', { now });
    await provider.getVehiclePositions('34974', { now });
    expect(http.logins()).toBe(1);
    expect(http.queries.map(q => q.cookie)).toEqual(['session=1', 'session=1']);
  });

  it('renova a sessão uma vez após HTTP 401 e repete a consulta', async () => {
    const http = server((_url, cookie) => cookie === 'session=1'
      ? { ok: false, status: 401 }
      : ok({ hr: '09:37', vs: [{ p: '48800', ta: '2026-10-28T12:37:05Z', py: -23.5871, px: -46.5812 }] }));
    const provider = new SptransTransportProvider('secret-token', http.fetcher as unknown as typeof fetch);
    expect(await provider.getVehiclePositions('34974', { now })).toHaveLength(1);
    expect(http.logins()).toBe(2);
    expect(http.queries.map(q => q.cookie)).toEqual(['session=1', 'session=2']);
  });

  it('falha HTTP propaga erro sem expor token nem cookie', async () => {
    const http = server(() => ({ ok: false, status: 500 }));
    const provider = new SptransTransportProvider('secret-token', http.fetcher as unknown as typeof fetch);
    const error = await provider.getVehiclePositions('34974', { now }).then(() => undefined, (e: Error) => e);
    expect(error?.message).toContain('HTTP 500');
    expect(error?.message).not.toMatch(/secret-token|session=/);
  });

  it('aborta a consulta de posição que excede o timeout', async () => {
    let signal: AbortSignal | undefined;
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/Login/')) return loginOk('session=1');
      signal = init?.signal ?? undefined;
      return new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
    });
    const provider = new SptransTransportProvider('secret-token', fetcher as unknown as typeof fetch, 20);
    await expect(provider.getVehiclePositions('34974', { now })).rejects.toThrow('aborted');
    expect(signal?.aborted).toBe(true);
  });

  it('não faz requisição com código de linha inválido', async () => {
    const fetcher = vi.fn();
    const provider = new SptransTransportProvider('secret-token', fetcher as unknown as typeof fetch);
    await expect(provider.getVehiclePositions('575C-10', { now })).rejects.toThrow('inválido');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
