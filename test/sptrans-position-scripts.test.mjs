import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitize, sanitizeDirectory } from '../scripts/sptrans-position-sanitize.mjs';
import { capture, validateOutput } from '../scripts/sptrans-position-probe.mjs';

test('remove coordenadas e segredos, mantendo campos do contrato', () => {
  assert.deepEqual(sanitize({ vs: [{ p: '123', px: -46, py: -23, ta: '2026-10-28T11:00:00Z' }], token: 'segredo' }),
    { vs: [{ p: '123', ta: '2026-10-28T11:00:00Z' }] });
});

test('sanitização não sobrescreve fixture existente', () => {
  const root = mkdtempSync(join(tmpdir(), 'position-sanitize-'));
  const source = join(root, 'raw'), target = join(root, 'safe');
  mkdirSync(source);
  writeFileSync(join(source, 'posicao-linha.json'), JSON.stringify({ body: { vs: [{ px: 1, p: '123' }] } }));
  sanitizeDirectory(source, target);
  assert.deepEqual(JSON.parse(readFileSync(join(target, 'posicao-linha.json'), 'utf8')), { body: { vs: [{ p: '123' }] } });
  assert.throws(() => sanitizeDirectory(source, target), /EEXIST/);
});

test('recusa saída dentro do repositório e código inválido', async () => {
  assert.throws(() => validateOutput(fileURLToPath(new URL('../test/fixtures', import.meta.url))), /fora do repositório/);
  await assert.rejects(capture({ directory: '/tmp/position', lineId: 'abc', token: 'fake', fetcher: () => { throw Error('não chamar rede'); } }), /numérico/);
});

test('captura posição e previsão com cookie, sem persistir credenciais', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'position-capture-'));
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/Login/')) return { ok: true, text: async () => 'true', headers: { getSetCookie: () => ['session=secret; Path=/'] } };
    return { status: 200, text: async () => JSON.stringify({ hr: '08:00', l: [] }) };
  };
  await capture({ directory, lineId: '123', token: 'test-secret', fetcher });
  assert.equal(calls.length, 3);
  assert.match(calls[1].url, /Posicao\/Linha\?codigoLinha=123/);
  assert.match(calls[2].url, /Previsao\/Linha\?codigoLinha=123/);
  assert.equal(calls[1].options.headers.cookie, 'session=secret');
  assert.doesNotMatch(readFileSync(join(directory, 'posicao-linha.json'), 'utf8'), /test-secret|session=secret/);
});
