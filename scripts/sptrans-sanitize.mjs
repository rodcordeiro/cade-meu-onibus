#!/usr/bin/env node
/**
 * Converte respostas brutas da sonda (scripts/sptrans-probe.mjs) em fixtures versionáveis.
 *
 * Uso: node scripts/sptrans-sanitize.mjs <dir-bruto> [dir-saida=test/fixtures/sptrans]
 *
 * Sanitização: coordenadas (px/py) zeradas, só o cabeçalho `date` é mantido e o caminho
 * já vem com o token redigido pela sonda. O login válido não vira fixture (só o inválido, corpo `false`).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [rawDir, outDir = 'test/fixtures/sptrans'] = process.argv.slice(2);
if (!rawDir) throw new Error('Informe o diretório com as respostas brutas.');

/** Arquivo bruto → nome da fixture. */
const FIXTURES = {
  '00-previsao-sem-auth.json': 'erro-401-sem-sessao.json',
  '01-login-token-invalido.json': 'login-token-invalido.json',
  '03-linha-buscar.json': 'linha-buscar-875a.json',
  '05-paradas-por-linha.json': 'paradas-por-linha.json',
  '06-previsao-parada.json': 'previsao-parada-paulista.json',
  '08-previsao-linha.json': 'previsao-linha.json',
  '07-previsao-parada-linha.json': 'previsao-parada-linha.json',
  '07b-previsao-parada-do-trajeto.json': 'previsao-parada.json',
  '07c-previsao-parada-linha-sentido-oposto.json': 'previsao-parada-linha-sentido-oposto.json',
  '09-previsao-parada-inexistente.json': 'previsao-parada-inexistente.json',
  '10-previsao-parada-invalida.json': 'erro-400-parada-invalida.json',
};

const zeroCoordinates = (value) => {
  if (Array.isArray(value)) return value.map(zeroCoordinates);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [key, key === 'px' || key === 'py' ? 0 : zeroCoordinates(v)]),
    );
  }
  return value;
};

mkdirSync(outDir, { recursive: true });
for (const [source, target] of Object.entries(FIXTURES)) {
  const raw = JSON.parse(readFileSync(join(rawDir, source), 'utf8'));
  const fixture = {
    capturedAt: raw.headers?.date ? new Date(raw.headers.date).toISOString() : null,
    request: raw.request,
    status: raw.status,
    elapsedMs: raw.elapsedMs,
    body: zeroCoordinates(raw.body),
  };
  writeFileSync(join(outDir, target), `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`${source} -> ${join(outDir, target)}`);
}
