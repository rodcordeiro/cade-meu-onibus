import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { summarizeCapture, summarizeShape } from '../scripts/sptrans-position-shape.mjs';

test('relatório preserva somente tipos, campos e contagem, sem valores sensíveis', () => {
  const summary = summarizeCapture({
    status: 200,
    body: { hr: '12:30', l: [{ cl: 33822, vs: [{ p: 'veiculo-privado', px: -46.1, py: -23.5, ta: '2026-10-28T12:00:00Z' }] }], token: 'secret' },
  });
  const serialized = JSON.stringify(summary);
  assert.equal(summary.status, 200);
  assert.doesNotMatch(serialized, /veiculo-privado|secret|33822|-46\.1|-23\.5|12:30|2026-10-28T12:00:00Z/);
  assert.doesNotMatch(serialized, /"token"/);
  assert.equal(summary.bodyShape.fields.l.count, 1);
  assert.equal(summary.bodyShape.fields.l.sampleShape.fields.vs.count, 1);
});
test('não aceita captura sem status e body', () => {
  assert.throws(() => summarizeCapture({ body: {} }), /Status HTTP/);
  assert.throws(() => summarizeCapture({ status: 200 }), /Body/);
});
test('limita profundidade e representa arrays vazios', () => {
  assert.deepEqual(summarizeShape([]), { type: 'array', count: 0, sampleShape: null });
  let nested = 'value';
  for (let i = 0; i < 20; i++) nested = { child: nested };
  assert.match(JSON.stringify(summarizeShape(nested)), /depth-limit/);
});
