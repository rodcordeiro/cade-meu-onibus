import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = join(__dirname, 'fixtures', 'sptrans');
const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
const load = (name: string) => JSON.parse(readFileSync(join(DIR, name), 'utf8'));

const collectCoordinates = (value: unknown, found: number[] = []): number[] => {
  if (Array.isArray(value)) value.forEach((v) => collectCoordinates(v, found));
  else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      if (key === 'px' || key === 'py') found.push(v as number);
      else collectCoordinates(v, found);
    }
  }
  return found;
};

describe('fixtures SPTrans sanitizadas', () => {
  it('existem as fixtures do contrato de previsão', () => {
    expect(files).toEqual(
      expect.arrayContaining([
        'previsao-parada.json',
        'previsao-parada-linha.json',
        'previsao-parada-inexistente.json',
        'erro-401-sem-sessao.json',
        'erro-400-parada-invalida.json',
        'login-token-invalido.json',
        'paradas-por-linha.json',
        'previsao-linha.json',
      ]),
    );
  });

  it.each(files)('%s não contém token, cookie nem coordenadas', (name) => {
    const text = readFileSync(join(DIR, name), 'utf8');
    expect(text).not.toMatch(/token=(?!<redacted>)/i);
    expect(text).not.toMatch(/cookie|apiCredentials|set-cookie/i);
    expect(collectCoordinates(load(name)).every((c) => c === 0)).toBe(true);
  });

  it('previsão por parada segue o formato documentado (hr, p.cp, l[].cl/sl/c, vs[].p/t/ta)', () => {
    const { body } = load('previsao-parada.json');

    expect(body.hr).toMatch(/^\d{2}:\d{2}$/);
    expect(typeof body.p.cp).toBe('number');
    for (const line of body.p.l) {
      expect(line).toMatchObject({ c: expect.any(String), cl: expect.any(Number), sl: expect.any(Number) });
      for (const vehicle of line.vs) {
        expect(vehicle.p).toEqual(expect.any(String));
        expect(vehicle.t).toMatch(/^\d{2}:\d{2}$/);
        expect(vehicle.ta).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      }
    }
  });

  it('parada inexistente e linha sem previsão na parada retornam p: null', () => {
    expect(load('previsao-parada-inexistente.json').body).toEqual({ hr: expect.any(String), p: null });
    expect(load('previsao-parada-linha-sentido-oposto.json').body).toEqual({ hr: expect.any(String), p: null });
  });
});
