import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FavoritesConfigError, loadFavorites } from '../src/infrastructure/config/favorites-loader';

const writeConfig = (content: unknown): string => {
  const dir = mkdtempSync(join(tmpdir(), 'favorites-'));
  const file = join(dir, 'favorites.json');
  writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  return file;
};

const valid = {
  version: 1,
  lines: [{ id: '1001', label: '875A-10', aliases: ['oitocentos e setenta e cinco'], direction: '1' }],
  stops: [{ id: '9001', alias: 'ponto da padaria', lineIds: ['1001'] }],
};

const issuesOf = (content: unknown): string[] => {
  try {
    loadFavorites(writeConfig(content));
  } catch (error) {
    if (error instanceof FavoritesConfigError) return error.issues;
    throw error;
  }
  throw new Error('esperava FavoritesConfigError');
};

describe('carregamento dos favoritos', () => {
  it('carrega um documento válido', () => {
    expect(loadFavorites(writeConfig(valid))).toEqual(valid);
  });

  it('rejeita favoritos empacotados com IDs provisórios duplicados e sem referências position', () => {
    const issues = issuesOf(JSON.parse(require('node:fs').readFileSync(join(__dirname, '..', 'config', 'favorites.json'), 'utf8')));
    expect(issues.some(issue => issue.includes('duplicado'))).toBe(true);
    expect(issues.some(issue => issue.includes('exige referências'))).toBe(true);
  });

  it('falha explicitamente quando o arquivo não existe', () => {
    expect(() => loadFavorites(join(tmpdir(), 'nao-existe', 'favorites.json'))).toThrow(FavoritesConfigError);
  });

  it('falha explicitamente com JSON malformado', () => {
    expect(issuesOf('{ "version": 1,')).toEqual(['arquivo não contém JSON válido']);
  });

  it('rejeita versão de esquema desconhecida', () => {
    expect(issuesOf({ ...valid, version: 2 })).toContain('version deve ser 1');
  });

  it('exige ao menos um ponto e uma linha', () => {
    expect(issuesOf({ version: 1, lines: [], stops: [] })).toEqual([
      'lines deve ser uma lista não vazia',
      'stops deve ser uma lista não vazia',
    ]);
  });

  it('reporta todos os problemas de uma vez, com caminho do campo', () => {
    const issues = issuesOf({
      version: 1,
      lines: [{ id: '1001', label: '' }, { id: '1001', label: 'Duplicada' }],
      stops: [
        { id: '9001', alias: 'ponto da padaria', lineIds: ['1001', '7777'] },
        { id: ' ', alias: 'sem código', lineIds: [] },
      ],
    });

    expect([...issues].sort()).toEqual([
      'lines[0].label deve ser um texto não vazio',
      'lines[1].id "1001" duplicado',
      'stops[0].lineIds referencia linha inexistente "7777"',
      'stops[1].id deve ser um texto não vazio',
      'stops[1].lineIds deve ser uma lista não vazia',
    ].sort());
  });

  it('rejeita linha repetida no mesmo ponto', () => {
    expect(issuesOf({ ...valid, stops: [{ id: '9001', alias: 'ponto da padaria', lineIds: ['1001', '1001'] }] })).toEqual([
      'stops[0].lineIds repete a linha "1001"',
    ]);
  });

  it('rejeita aliases que não são lista de textos', () => {
    expect(issuesOf({ ...valid, lines: [{ id: '1001', label: '875A-10', aliases: 'x' }] })).toEqual([
      'lines[0].aliases deve ser uma lista de textos não vazios',
    ]);
  });

  it('a mensagem do erro lista os problemas', () => {
    expect(() => loadFavorites(writeConfig({ ...valid, version: 2 }))).toThrow(/version deve ser 1/);
  });
});


describe('SPEC-0002: configuração position', () => {
  const position = { ...valid, lines: [{ id: '1001', label: 'Linha', arrivalSource: 'position' }], stops: [{ id: '9001', alias: 'Ponto público', lineIds: ['1001'], approaches: [{ lineId: '1001', references: [{ name: 'Referência pública', lat: -23.5, lon: -46.6 }] }] }] };
  it('aceita referências ordenadas e a origem position', () => { expect(loadFavorites(writeConfig(position))).toEqual(position); });
  it('preserva forecast implícito', () => { expect(loadFavorites(writeConfig(valid))).toEqual(valid); });
  it('rejeita position sem approaches', () => { expect(issuesOf({ ...position, stops: [{ id: '9001', alias: 'Ponto', lineIds: ['1001'] }] }).join(' ')).toContain('exige referências'); });
  it('rejeita referências vazias', () => { expect(issuesOf({ ...position, stops: [{ ...position.stops[0], approaches: [{ lineId: '1001', references: [] }] }] }).join(' ')).toContain('lista não vazia'); });
  it('rejeita coordenadas fora do intervalo', () => { expect(issuesOf({ ...position, stops: [{ ...position.stops[0], approaches: [{ lineId: '1001', references: [{ name: 'Público', lat: 91, lon: -181 }] }] }] }).filter(x => x.includes('coordenada'))).toHaveLength(2); });
  it('rejeita approach de linha não associada', () => { expect(issuesOf({ ...position, stops: [{ ...position.stops[0], approaches: [{ lineId: '999', references: [{ name: 'Público', lat: 0, lon: 0 }] }] }] }).join(' ')).toContain('linha não associada'); });
  it('rejeita origem desconhecida', () => { expect(issuesOf({ ...valid, lines: [{ id: '1001', label: 'Linha', arrivalSource: 'other' }] }).join(' ')).toContain('forecast ou position'); });
  it('rejeita IDs de pontos duplicados', () => { expect(issuesOf({ ...valid, stops: [valid.stops[0], valid.stops[0]] }).join(' ')).toContain('duplicado'); });
});
