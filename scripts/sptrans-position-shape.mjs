#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Campos do contrato SPTrans Olho Vivo cujos nomes podem aparecer no relatório
 * (`Posicao/Linha`, `Previsao/Linha`, `Previsao/Parada` e corpo de erro `Message`).
 * Qualquer outro nome é contado em `unknownFields`, sem nome nem valor.
 */
export const ALLOWED_FIELDS = Object.freeze(new Set([
  'hr', 'p', 'l', 'ps', 'vs', 'cp', 'np', 'py', 'px', 'c', 'cl', 'sl', 'lt0', 'lt1', 'qv', 'a', 'ta', 't', 'sv', 'is', 'Message',
]));

/** Limites explícitos de processamento e de tamanho do relatório. */
export const SHAPE_LIMITS = Object.freeze({
  /** Profundidade máxima de aninhamento inspecionada; abaixo dela vira `depth-limit`. */
  maxDepth: 8,
  /** Elementos inspecionados por array; o restante só entra em `count`. */
  maxArrayElements: 100,
  /** Formatos distintos listados por array; o excedente vira `omittedShapes`. */
  maxShapeVariants: 5,
  /** Nós (valores) inspecionados no total; o excedente vira `truncated`. */
  maxNodes: 50_000,
  /** Tamanho máximo, em caracteres, do relatório serializado. */
  maxReportChars: 64_000,
});

/**
 * Resume a estrutura de um valor JSON sem expor valores nem nomes de campos fora do contrato.
 * Arrays agregam os formatos distintos dos elementos inspecionados, com contagem de ocorrências.
 * @param {unknown} value valor JSON já desserializado.
 * @returns {object} forma do valor (`type`, `fields`, `unknownFields`, `count`, `inspected`, `elementShapes`, `omittedShapes`).
 */
export function summarizeShape(value) {
  return shapeOf(value, 0, { nodes: 0, truncated: false });
}

function shapeOf(value, depth, state) {
  if (depth > SHAPE_LIMITS.maxDepth) return { type: 'depth-limit' };
  if (state.nodes >= SHAPE_LIMITS.maxNodes) {
    state.truncated = true;
    return { type: 'truncated' };
  }
  state.nodes += 1;
  if (value === null) return { type: 'null' };
  if (Array.isArray(value)) return arrayShape(value, depth, state);
  if (typeof value !== 'object') return { type: typeof value };

  const fields = {};
  let unknownFields = 0;
  for (const key of Object.keys(value).sort()) {
    if (ALLOWED_FIELDS.has(key)) fields[key] = shapeOf(value[key], depth + 1, state);
    else unknownFields += 1;
  }
  return unknownFields ? { type: 'object', fields, unknownFields } : { type: 'object', fields };
}

function arrayShape(items, depth, state) {
  const inspected = Math.min(items.length, SHAPE_LIMITS.maxArrayElements);
  const variants = new Map();
  let omittedShapes = 0;
  for (let i = 0; i < inspected; i++) {
    const shape = shapeOf(items[i], depth + 1, state);
    const signature = JSON.stringify(shape);
    const known = variants.get(signature);
    if (known) known.occurrences += 1;
    else if (variants.size < SHAPE_LIMITS.maxShapeVariants) variants.set(signature, { occurrences: 1, shape });
    else omittedShapes += 1;
  }
  const result = { type: 'array', count: items.length, inspected, elementShapes: [...variants.values()] };
  if (omittedShapes) result.omittedShapes = omittedShapes;
  return result;
}

/**
 * Resume uma captura sanitizada (`{ status, body }`) sem imprimir valores.
 * Erros usam mensagens fixas, sem conteúdo da captura.
 * @param {unknown} data captura desserializada.
 * @returns {{ status: number, truncated: boolean, bodyShape: object }} relatório limitado a `SHAPE_LIMITS.maxReportChars`.
 * @throws {Error} quando a captura, o status ou o body são inválidos.
 */
export function summarizeCapture(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Captura inválida');
  if (!Number.isInteger(data.status)) throw new Error('Status HTTP ausente ou inválido');
  if (!Object.prototype.hasOwnProperty.call(data, 'body')) throw new Error('Body ausente');
  const state = { nodes: 0, truncated: false };
  const report = { status: data.status, truncated: false, bodyShape: shapeOf(data.body, 0, state) };
  report.truncated = state.truncated;
  if (JSON.stringify(report).length > SHAPE_LIMITS.maxReportChars) {
    return { status: data.status, truncated: true, bodyShape: { type: 'truncated' } };
  }
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = process.argv[2];
  if (!path) { console.error('Uso: node scripts/sptrans-position-shape.mjs <arquivo-sanitizado.json>'); process.exitCode = 1; }
  else try {
    const capture = JSON.parse(readFileSync(path, 'utf8'));
    console.log(JSON.stringify(summarizeCapture(capture), null, 2));
  } catch {
    console.error('Não foi possível inspecionar a captura (arquivo inválido ou ausente)');
    process.exitCode = 1;
  }
}
