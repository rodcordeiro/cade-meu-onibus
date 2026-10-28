/** Conversões entre instantes UTC e o relógio de parede de São Paulo, pelas regras de fuso do runtime (Intl). */
const ZONE = 'America/Sao_Paulo';

const zoneFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONE, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

export interface LocalDateTime { year: number; month: number; day: number; hour: number; minute: number }

/** Data/hora de parede em America/Sao_Paulo (precisão de minuto) do instante dado. */
export function saoPauloLocalParts(date: Date): LocalDateTime {
  const parts = zoneFormatter.formatToParts(date);
  const get = (name: string) => Number(parts.find(p => p.type === name)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

/** Diferença (ms) entre o relógio de São Paulo e o UTC no instante dado. */
function zoneOffsetMs(instantMs: number): number {
  const l = saoPauloLocalParts(new Date(instantMs));
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
