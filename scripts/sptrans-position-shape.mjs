#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Inspeciona somente estrutura e tipos; nunca imprime valores, coordenadas ou credenciais. */
export function summarizeShape(value, depth = 0) {
  if (depth > 8) return { type: 'depth-limit' };
  if (Array.isArray(value)) {
    return { type: 'array', count: value.length, sampleShape: value.length ? summarizeShape(value[0], depth + 1) : null };
  }
  if (value === null) return { type: 'null' };
  if (typeof value !== 'object') return { type: typeof value };
  const sensitive = /token|cookie|authorization|secret|password|key|session/i;
  const fields = {};
  for (const key of Object.keys(value).sort()) {
    if (sensitive.test(key)) continue;
    fields[key] = summarizeShape(value[key], depth + 1);
  }
  return { type: 'object', fields };
}

export function summarizeCapture(data) {
  if (!data || typeof data !== 'object') throw new Error('Captura inválida');
  if (!Number.isInteger(data.status)) throw new Error('Status HTTP ausente');
  if (!Object.prototype.hasOwnProperty.call(data, 'body')) throw new Error('Body ausente');
  return { status: data.status, bodyShape: summarizeShape(data.body) };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
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
