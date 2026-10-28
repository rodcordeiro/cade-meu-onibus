import type { FavoritesConfig } from '../domain/types';

export type FilterDimension = 'line' | 'stop';
export type Resolution =
  | { kind: 'resolved'; id: string }
  | { kind: 'ambiguous'; options: string[] }
  | { kind: 'unknown' };

const normalize = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim().replace(/\s+/g, ' ');

/** Resolve somente nomes e códigos configurados, sem adivinhar correspondências parciais. */
export function resolveFilter(config: FavoritesConfig, dimension: FilterDimension, spoken: string): Resolution {
  const value = normalize(spoken);
  if (!value) return { kind: 'unknown' };
  const items = dimension === 'line'
    ? config.lines.map(line => ({ id: line.id, label: line.label, names: [line.id, line.label, ...(line.aliases ?? [])] }))
    : config.stops.map(stop => ({ id: stop.id, label: stop.alias, names: [stop.id, stop.alias, ...(stop.aliases ?? [])] }));
  const matches = items.filter(item => item.names.some(name => normalize(name) === value));
  if (matches.length === 1) return { kind: 'resolved', id: matches[0]!.id };
  if (matches.length > 1) return { kind: 'ambiguous', options: matches.map(item => item.label) };
  return { kind: 'unknown' };
}
