import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHAPE_LIMITS, summarizeCapture, summarizeShape } from '../scripts/sptrans-position-shape.mjs';

const script = fileURLToPath(new URL('../scripts/sptrans-position-shape.mjs', import.meta.url));

test('relatório preserva somente tipos, campos do contrato e contagem, sem valores', () => {
  const summary = summarizeCapture({
    status: 200,
    body: { hr: '12:30', l: [{ cl: 33822, vs: [{ p: 'veiculo-privado', px: -46.1, py: -23.5, ta: '2026-10-28T12:00:00Z' }] }], token: 'secret' },
  });
  const serialized = JSON.stringify(summary);
  assert.equal(summary.status, 200);
  assert.doesNotMatch(serialized, /veiculo-privado|secret|33822|-46\.1|-23\.5|12:30|2026-10-28T12:00:00Z/);
  assert.doesNotMatch(serialized, /token/);
  assert.equal(summary.bodyShape.fields.l.count, 1);
  assert.equal(summary.bodyShape.fields.l.elementShapes[0].shape.fields.vs.count, 1);
  assert.deepEqual(summary.bodyShape.fields.l.elementShapes[0].shape.fields.vs.elementShapes[0].shape.fields.px, { type: 'number' });
});

test('chaves dinâmicas sensíveis ou desconhecidas não têm nome nem valor expostos', () => {
  const body = {
    hr: '10:00',
    'Bearer abc123token': 'x',
    'rua-das-flores-123': { cpf: '123.456.789-00', nested: { deep: 'segredo' } },
    'session=cafebabe': 1,
    vs: [{ p: '1', 'user@example.com': true }],
  };
  const serialized = JSON.stringify(summarizeShape(body));
  assert.doesNotMatch(serialized, /Bearer|abc123|rua-das-flores|cpf|123\.456|nested|deep|segredo|session|cafebabe|example\.com/);
  const shape = summarizeShape(body);
  assert.equal(shape.unknownFields, 3);
  assert.equal(shape.fields.vs.elementShapes[0].shape.unknownFields, 1);
});

test('anonimização de campos desconhecidos é determinística', () => {
  const a = summarizeShape({ zzz: 1, aaa: 'x', hr: 'y' });
  const b = summarizeShape({ hr: 'z', aaa: 2, zzz: 'w' });
  assert.deepEqual(a, b);
  assert.deepEqual(a, { type: 'object', fields: { hr: { type: 'string' } }, unknownFields: 2 });
});

test('arrays heterogêneos agregam todos os formatos, não só o primeiro elemento', () => {
  const shape = summarizeShape([
    { p: '1', a: true },
    { p: '2', a: true },
    { p: 3, a: null, ta: 'x' },
    'texto',
  ]);
  assert.equal(shape.type, 'array');
  assert.equal(shape.count, 4);
  assert.equal(shape.inspected, 4);
  assert.deepEqual(shape.elementShapes, [
    { occurrences: 2, shape: { type: 'object', fields: { a: { type: 'boolean' }, p: { type: 'string' } } } },
    { occurrences: 1, shape: { type: 'object', fields: { a: { type: 'null' }, p: { type: 'number' }, ta: { type: 'string' } } } },
    { occurrences: 1, shape: { type: 'string' } },
  ]);
});

test('arrays grandes respeitam limites de elementos inspecionados e de formatos', () => {
  const many = Array.from({ length: SHAPE_LIMITS.maxArrayElements + 50 }, (_, i) => ({ p: i % 2 ? 'a' : 1, [`campo${i}`]: i, ...(i % 7 ? {} : { a: i }) }));
  const shape = summarizeShape(many);
  assert.equal(shape.count, SHAPE_LIMITS.maxArrayElements + 50);
  assert.equal(shape.inspected, SHAPE_LIMITS.maxArrayElements);
  assert.ok(shape.elementShapes.length <= SHAPE_LIMITS.maxShapeVariants);

  const variants = Array.from({ length: 50 }, (_, i) => Array.from({ length: i }, () => 1).reduce((acc) => [acc], 0));
  const capped = summarizeShape(variants);
  assert.equal(capped.elementShapes.length, SHAPE_LIMITS.maxShapeVariants);
  assert.ok(capped.omittedShapes > 0);
});

test('objetos e arrays vazios são representados', () => {
  assert.deepEqual(summarizeShape({}), { type: 'object', fields: {} });
  assert.deepEqual(summarizeShape([]), { type: 'array', count: 0, inspected: 0, elementShapes: [] });
});

test('limita profundidade excessiva', () => {
  let nested = 'value';
  for (let i = 0; i < 1000; i++) nested = { p: [nested] };
  const serialized = JSON.stringify(summarizeShape(nested));
  assert.match(serialized, /depth-limit/);
  assert.doesNotMatch(serialized, /value/);
});

test('limita o tamanho total do relatório', () => {
  const wide = { l: Array.from({ length: 50 }, (_, i) => ({ vs: Array.from({ length: 50 }, (_, j) => ({ p: [[[[[i * j]]]]] , a: [[[[i]]]], t: [[j]] })) })) };
  const summary = summarizeCapture({ status: 200, body: wide });
  assert.ok(JSON.stringify(summary).length <= SHAPE_LIMITS.maxReportChars);
});

test('relatório que excede o limite de nós é marcado como truncado', () => {
  const body = { ps: Array.from({ length: 200 }, (_, i) => ({ vs: Array.from({ length: 200 }, (_, j) => (j % 5 === i % 5 ? { p: 'x' } : { [`k${j}`]: [[[j]]], p: [[[[i]]]] })) })) };
  const summary = summarizeCapture({ status: 200, body });
  assert.equal(typeof summary.truncated, 'boolean');
  assert.ok(JSON.stringify(summary).length <= SHAPE_LIMITS.maxReportChars);
});

test('erros de entrada não incluem valores da captura', () => {
  assert.throws(() => summarizeCapture({ body: {} }), /Status HTTP/);
  assert.throws(() => summarizeCapture({ status: 200 }), /Body/);
  assert.throws(() => summarizeCapture(null), /Captura inválida/);
  assert.throws(() => summarizeCapture([1, 2]), /Captura inválida/);
  assert.throws(() => summarizeCapture('token-secreto'), (error) => !/token-secreto/.test(error.message));
  assert.throws(() => summarizeCapture({ status: 'sessao-abc', body: {} }), (error) => !/sessao-abc/.test(error.message));
});

test('CLI imprime apenas o relatório e falha sem expor conteúdo de arquivo inválido', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shape-'));
  try {
    const valid = join(dir, 'ok.json');
    writeFileSync(valid, JSON.stringify({ status: 200, body: { hr: '09:41', 'cookie-xyz': 'abc' } }));
    const ok = spawnSync(process.execPath, [script, valid], { encoding: 'utf8' });
    assert.equal(ok.status, 0);
    assert.equal(JSON.parse(ok.stdout).bodyShape.unknownFields, 1);
    assert.doesNotMatch(ok.stdout + ok.stderr, /09:41|cookie-xyz|abc/);

    const invalid = join(dir, 'bad.json');
    writeFileSync(invalid, '{"token":"segredo-123"');
    const bad = spawnSync(process.execPath, [script, invalid], { encoding: 'utf8' });
    assert.equal(bad.status, 1);
    assert.equal(bad.stdout, '');
    assert.doesNotMatch(bad.stderr, /segredo-123|token/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
