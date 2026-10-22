import { readFileSync } from 'node:fs';
import type { FavoriteLine, FavoritesConfig, MonitoredStop } from '../../domain/types';

/** Erro de configuração dos favoritos, com a lista completa de problemas encontrados. */
export class FavoritesConfigError extends Error {
  constructor(
    readonly source: string,
    readonly issues: string[],
  ) {
    super(`Configuração de favoritos inválida em ${source}:\n- ${issues.join('\n- ')}`);
    this.name = 'FavoritesConfigError';
  }
}

/** Lê e valida integralmente o JSON de favoritos; lança `FavoritesConfigError` se inválido. */
export function loadFavorites(path: string): FavoritesConfig {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    throw new FavoritesConfigError(path, ['arquivo não encontrado ou ilegível']);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new FavoritesConfigError(path, ['arquivo não contém JSON válido']);
  }

  const issues: string[] = [];
  const config = parseFavorites(raw, issues);
  if (issues.length > 0 || !config) throw new FavoritesConfigError(path, issues);
  return config;
}

function parseFavorites(raw: unknown, issues: string[]): FavoritesConfig | undefined {
  if (!isRecord(raw)) {
    issues.push('documento deve ser um objeto');
    return undefined;
  }
  if (raw.version !== 1) issues.push('version deve ser 1');

  const lines = parseList(raw.lines, 'lines', issues, parseLine);
  const stops = parseList(raw.stops, 'stops', issues, parseStop);

  // Unicidade e referências usam os ids brutos, para não perder itens que falharam em outro campo.
  const lineIds = checkUniqueIds(raw.lines, 'lines', issues);
  checkUniqueIds(raw.stops, 'stops', issues);
  stops.forEach((stop, index) => {
    if (!stop) return;
    const repeated = new Set<string>();
    stop.lineIds.forEach((lineId, position) => {
      if (stop.lineIds.indexOf(lineId) !== position && !repeated.has(lineId)) {
        repeated.add(lineId);
        issues.push(`stops[${index}].lineIds repete a linha "${lineId}"`);
      }
    });
    for (const lineId of stop.lineIds) {
      if (!lineIds.has(lineId)) issues.push(`stops[${index}].lineIds referencia linha inexistente "${lineId}"`);
    }
  });

  return { version: 1, lines: lines.filter(isDefined), stops: stops.filter(isDefined) };
}

/** Valida uma lista não vazia, preservando o índice original de cada item (inválidos viram `undefined`). */
function parseList<T>(
  value: unknown,
  path: string,
  issues: string[],
  parseItem: (item: unknown, path: string, issues: string[]) => T | undefined,
): (T | undefined)[] {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push(`${path} deve ser uma lista não vazia`);
    return [];
  }
  return value.map((item, index) => parseItem(item, `${path}[${index}]`, issues));
}

function checkUniqueIds(value: unknown, path: string, issues: string[]): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(value)) return ids;
  value.forEach((item, index) => {
    const id = isRecord(item) ? item.id : undefined;
    if (typeof id !== 'string' || id.trim() === '') return;
    if (ids.has(id)) issues.push(`${path}[${index}].id "${id}" duplicado`);
    ids.add(id);
  });
  return ids;
}

const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

function parseLine(item: unknown, path: string, issues: string[]): FavoriteLine | undefined {
  if (!isRecord(item)) {
    issues.push(`${path} deve ser um objeto`);
    return undefined;
  }
  const id = requireText(item.id, `${path}.id`, issues);
  const label = requireText(item.label, `${path}.label`, issues);
  const aliases = optionalTextList(item.aliases, `${path}.aliases`, issues);
  const direction = optionalText(item.direction, `${path}.direction`, issues);
  if (id === undefined || label === undefined) return undefined;
  return { id, label, ...(aliases && { aliases }), ...(direction !== undefined && { direction }) };
}

function parseStop(item: unknown, path: string, issues: string[]): MonitoredStop | undefined {
  if (!isRecord(item)) {
    issues.push(`${path} deve ser um objeto`);
    return undefined;
  }
  const id = requireText(item.id, `${path}.id`, issues);
  const alias = requireText(item.alias, `${path}.alias`, issues);
  const lineIds = parseList(item.lineIds, `${path}.lineIds`, issues, (value, itemPath, itemIssues) =>
    requireText(value, itemPath, itemIssues),
  );
  const aliases = optionalTextList(item.aliases, `${path}.aliases`, issues);
  if (id === undefined || alias === undefined) return undefined;
  return { id, alias, lineIds: lineIds.filter(isDefined), ...(aliases && { aliases }) };
}

function requireText(value: unknown, path: string, issues: string[]): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') return value;
  issues.push(`${path} deve ser um texto não vazio`);
  return undefined;
}

function optionalText(value: unknown, path: string, issues: string[]): string | undefined {
  return value === undefined ? undefined : requireText(value, path, issues);
}

function optionalTextList(value: unknown, path: string, issues: string[]): string[] | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value) && value.every((v) => typeof v === 'string' && v.trim() !== '')) return value as string[];
  issues.push(`${path} deve ser uma lista de textos não vazios`);
  return undefined;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
