#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const base = 'https://api.olhovivo.sptrans.com.br/v2.1';
export const validateOutput = (dir) => {
  const path = resolve(dir), root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const rel = relative(root, path);
  if (rel === '' || (!rel.startsWith('..') && !rel.startsWith('/'))) throw new Error('Saída deve ficar fora do repositório');
  return path;
};
export async function capture({ directory, lineId, stopId, token, fetcher = fetch }) {
  if (!token) throw new Error('SPTRANS_API_TOKEN ausente');
  if (!/^\d+$/.test(lineId) || (stopId && !/^\d+$/.test(stopId))) throw new Error('Código deve ser numérico');
  const output = validateOutput(directory);
  const login = await fetcher(base + '/Login/Autenticar?token=' + encodeURIComponent(token), { method: 'POST', headers: { 'Content-Length': '0' } });
  if (!login.ok || (await login.text()).trim() !== 'true') throw new Error('Autenticação SPTrans recusada');
  const cookie = (login.headers.getSetCookie?.() ?? []).map(x => x.split(';')[0]).join('; ');
  if (!cookie) throw new Error('Cookie de sessão ausente');
  mkdirSync(output, { recursive: true });
  const endpoints = [['posicao-linha', '/Posicao/Linha?codigoLinha=' + lineId], ['previsao-linha', '/Previsao/Linha?codigoLinha=' + lineId]];
  if (stopId) endpoints.push(['previsao-parada', '/Previsao/Parada?codigoParada=' + stopId]);
  for (const [name, path] of endpoints) {
    const start = Date.now();
    const response = await fetcher(base + path, { headers: { cookie } });
    const raw = await response.text();
    let body;
    try { body = JSON.parse(raw); } catch { body = { parseError: true }; }
    const result = { request: { method: 'GET', path }, status: response.status, elapsedMs: Date.now() - start, capturedAt: new Date().toISOString(), body };
    writeFileSync(join(output, name + '.json'), JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
    console.log(name + ': HTTP ' + response.status);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [directory, lineId, stopId] = process.argv.slice(2);
  if (!directory || !lineId) { console.error('Uso: node --env-file=.env scripts/sptrans-position-probe.mjs <diretorio-externo> <codigoLinha> [codigoParada]'); process.exitCode = 1; }
  else await capture({ directory, lineId, stopId, token: process.env.SPTRANS_API_TOKEN }).catch(e => { console.error(e.message); process.exitCode = 1; });
}
