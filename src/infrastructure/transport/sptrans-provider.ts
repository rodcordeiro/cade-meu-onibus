import { isFreshObservation } from '../../domain/observation-freshness';
import type { ArrivalPrediction, RequestContext, TransportProvider, VehiclePosition } from '../../domain/types';

const BASE = 'https://api.olhovivo.sptrans.com.br/v2.1';
const ZONE = 'America/Sao_Paulo';
type Fetcher = typeof fetch;

export class SptransTransportProvider implements TransportProvider {
  private cookie?: string;
  private loginPromise?: Promise<string>;

  constructor(
    private readonly token: string,
    private readonly fetcher: Fetcher = fetch,
    private readonly timeoutMs = 4000,
  ) {
    if (!token) throw new Error('SPTRANS_API_TOKEN ausente');
  }

  async getArrivals(stopId: string, { now }: RequestContext): Promise<ArrivalPrediction[]> {
    if (!/^\d+$/.test(stopId)) throw new Error('Código de parada inválido');
    const payload = await this.request('/Previsao/Parada?codigoParada=' + stopId);
    return parseArrivals(payload, stopId, now);
  }

  /** Consulta `Posicao/Linha` com a mesma sessão, renovação após 401 e timeout da previsão. */
  async getVehiclePositions(lineId: string, _context: RequestContext): Promise<VehiclePosition[]> {
    if (!/^\d+$/.test(lineId)) throw new Error('Código de linha inválido');
    const payload = await this.request('/Posicao/Linha?codigoLinha=' + lineId);
    return parseVehiclePositions(payload, lineId);
  }

  private async request(path: string): Promise<unknown> {
    const usedCookie = await this.ensureLogin();
    let response = await this.http(BASE + path, { headers: { cookie: usedCookie } });
    if (response.status === 401) {
      // Uma única nova tentativa; a renovação só ocorre se ninguém já trocou o cookie usado.
      const renewedCookie = await this.renewSession(usedCookie);
      response = await this.http(BASE + path, { headers: { cookie: renewedCookie } });
    }
    if (!response.ok) throw new Error('SPTrans consulta falhou: HTTP ' + response.status);
    return response.json();
  }

  private async ensureLogin(): Promise<string> {
    if (this.cookie) return this.cookie;
    return this.sharedLogin();
  }

  /** Renova a sessão após 401, sem invalidar um cookie mais novo obtido por outra consulta. */
  private async renewSession(staleCookie: string): Promise<string> {
    if (this.cookie && this.cookie !== staleCookie) return this.cookie;
    if (this.loginPromise) return this.loginPromise;
    this.cookie = undefined;
    return this.sharedLogin();
  }

  /** Uma única promessa de login compartilhada por todas as consultas concorrentes. */
  private sharedLogin(): Promise<string> {
    if (!this.loginPromise) this.loginPromise = this.login().finally(() => { this.loginPromise = undefined; });
    return this.loginPromise;
  }

  private async login(): Promise<string> {
    const response = await this.http(BASE + '/Login/Autenticar?token=' + encodeURIComponent(this.token), {
      method: 'POST',
      headers: { 'Content-Length': '0' },
    });
    if (!response.ok || (await response.text()).trim() !== 'true') throw new Error('SPTrans autenticação recusada');
    const cookies = response.headers.getSetCookie?.() ?? [];
    const session = cookies.map(c => c.split(';')[0]).filter(Boolean).join('; ');
    if (!session) throw new Error('SPTrans não forneceu cookie de sessão');
    this.cookie = session;
    return session;
  }

  private async http(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetcher(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }
}

interface RawVehicle { p?: unknown; t?: unknown; ta?: unknown; px?: unknown; py?: unknown }
interface RawLine { cl?: unknown; sl?: unknown; vs?: unknown }
interface RawStop { cp?: unknown; l?: unknown }
interface RawResponse { hr?: unknown; p?: unknown }
interface RawPositionResponse { hr?: unknown; vs?: unknown }

/**
 * Normaliza a resposta de `Posicao/Linha` (`{ hr, vs: [{ p, ta, py, px }] }`, py = latitude, px = longitude).
 * Veículos sem prefixo, instante ou coordenadas válidos são ignorados, nunca completados.
 */
export function parseVehiclePositions(raw: unknown, lineId: string): VehiclePosition[] {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as RawPositionResponse).vs)) {
    throw new Error('Resposta SPTrans inválida');
  }
  const positions: VehiclePosition[] = [];
  for (const vehicle of (raw as RawPositionResponse).vs as unknown[]) {
    const position = toVehiclePosition(vehicle, lineId);
    if (position) positions.push(position);
  }
  return positions;
}

function toVehiclePosition(raw: unknown, lineId: string): VehiclePosition | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const { p, ta, py, px } = raw as RawVehicle;
  if (typeof p !== 'string' || !p.trim()) return undefined;
  if (typeof ta !== 'string') return undefined;
  const observedAt = new Date(ta);
  if (!Number.isFinite(observedAt.getTime())) return undefined;
  if (!isCoordinate(py, 90) || !isCoordinate(px, 180)) return undefined;
  return { lineId, vehicleId: p, lat: py, lon: px, observedAt };
}

function isCoordinate(value: unknown, limit: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;
}

export function parseArrivals(raw: unknown, requestedStopId: string, now: Date): ArrivalPrediction[] {
  if (!raw || typeof raw !== 'object') throw new Error('Resposta SPTrans inválida');
  const data = raw as RawResponse;
  if (data.p === null) return [];
  if (typeof data.hr !== 'string' || !/^\d{2}:\d{2}$/.test(data.hr)) throw new Error('Hora SPTrans inválida');
  if (!data.p || typeof data.p !== 'object') throw new Error('Parada SPTrans inválida');
  const stop = data.p as RawStop;
  if (String(stop.cp) !== requestedStopId || !Array.isArray(stop.l)) throw new Error('Parada SPTrans não corresponde à consulta');
  const predictions: ArrivalPrediction[] = [];
  for (const line of stop.l as RawLine[]) {
    if (typeof line.cl !== 'number' || !Array.isArray(line.vs)) continue;
    for (const vehicle of line.vs as RawVehicle[]) {
      if (typeof vehicle.t !== 'string' || typeof vehicle.ta !== 'string') continue;
      const observedAt = new Date(vehicle.ta);
      const arrivalAt = resolveArrivalDate(data.hr, vehicle.t, now);
      // Frescor é regra de domínio compartilhada com posições: telemetria antiga não vira previsão atual.
      if (!isFreshObservation(observedAt, now) || !arrivalAt) continue;
      predictions.push({
        stopId: requestedStopId,
        lineId: String(line.cl),
        ...(typeof vehicle.p === 'string' && { vehicleId: vehicle.p }),
        ...(typeof line.sl === 'number' && { direction: String(line.sl) }),
        arrivalAt,
        observedAt,
      });
    }
  }
  return predictions;
}

const zoneFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONE, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

interface LocalDateTime { year: number; month: number; day: number; hour: number; minute: number }

function localParts(date: Date): LocalDateTime {
  const parts = zoneFormatter.formatToParts(date);
  const get = (name: string) => Number(parts.find(p => p.type === name)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

/** Diferença (ms) entre o relógio de São Paulo e o UTC no instante dado. */
function zoneOffsetMs(instantMs: number): number {
  const l = localParts(new Date(instantMs));
  const asUtc = Date.UTC(l.year, l.month - 1, l.day, l.hour, l.minute);
  return asUtc - Math.floor(instantMs / 60_000) * 60_000;
}

/**
 * Converte uma data/hora de parede em America/Sao_Paulo para o instante UTC,
 * usando as regras de fuso do runtime (Intl), sem deslocamento fixo.
 * `day` pode extrapolar o mês; `Date.UTC` normaliza.
 */
export function saoPauloLocalToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let instant = wall - zoneOffsetMs(wall);
  const corrected = wall - zoneOffsetMs(instant);
  if (corrected !== instant) instant = corrected;
  return new Date(instant);
}

function parseHHmm(value: string): { hour: number; minute: number } | undefined {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return undefined;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function resolveArrivalDate(reference: string, target: string, now: Date): Date | undefined {
  const ref = parseHHmm(reference);
  const tgt = parseHHmm(target);
  if (!ref || !tgt) return undefined;
  // 1) Dia de `hr`: entre ontem/hoje/amanhã (relógio local de `now`), o `hr` mais próximo de `now`.
  //    Tolera relógio do servidor adiantado/atrasado em torno da meia-noite.
  const { year, month, day } = localParts(now);
  let refDay = day;
  let bestDistance = Infinity;
  for (const candidate of [day - 1, day, day + 1]) {
    const distance = Math.abs(saoPauloLocalToUtc(year, month, candidate, ref.hour, ref.minute).getTime() - now.getTime());
    if (distance < bestDistance) { bestDistance = distance; refDay = candidate; }
  }
  // 2) `t` relativo a `hr` (regra de ±12 h do spike 0001): o dia que deixa `t` mais próximo de `hr`.
  const diffMinutes = tgt.hour * 60 + tgt.minute - (ref.hour * 60 + ref.minute);
  const dayShift = diffMinutes < -720 ? 1 : diffMinutes > 720 ? -1 : 0;
  return saoPauloLocalToUtc(year, month, refDay + dayShift, tgt.hour, tgt.minute);
}
