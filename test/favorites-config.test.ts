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

  it('o arquivo empacotado em config/favorites.json é válido', () => {
    expect(() => loadFavorites(join(__dirname, '..', 'config', 'favorites.json'))).not.toThrow();
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
