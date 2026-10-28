#!/usr/bin/env node
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const secret = new Set(['px','py','lat','lon','latitude','longitude','cookie','set-cookie','token','authorization']);
export function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !secret.has(key.toLowerCase())).map(([key, v]) => [key, sanitize(v)]));
  if (typeof value === 'string') return value.replace(/token=[^&\s]+/gi, 'token=<redacted>');
  return value;
}
export function sanitizeDirectory(source, target) {
  if (resolve(source) === resolve(target)) throw new Error('Origem e destino devem ser diferentes');
  const files = readdirSync(source).filter(name => /^(posicao-linha|previsao-linha|previsao-parada)\.json$/.test(name));
  if (!files.length) throw new Error('Nenhuma captura encontrada');
  mkdirSync(target, { recursive: true });
  for (const name of files) {
    const data = sanitize(JSON.parse(readFileSync(join(source, name), 'utf8')));
    writeFileSync(join(target, name), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
    console.log('Sanitizado: ' + name);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [source, target] = process.argv.slice(2);
  if (!source || !target) { console.error('Uso: node scripts/sptrans-position-sanitize.mjs <bruto> <sanitizado>'); process.exitCode = 1; }
  else try { sanitizeDirectory(source, target); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
