import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FavoritesConfigError } from '../src/infrastructure/config/favorites-loader';
import { createLambdaHandler } from '../src/alexa/lambda-handler';
import { alexaRequest } from './support/alexa';

const examplePath = join(__dirname, '..', 'config', 'favorites.example.json');

describe('handler Lambda', () => {
  it('carrega os favoritos e, sem provedor real, informa indisponibilidade sem inventar previsões', async () => {
    const handler = createLambdaHandler({ favoritesPath: examplePath, allowExampleFavorites: true, env: {} });

    const response = await handler(alexaRequest({ type: 'LaunchRequest' }));

    expect(response.response.outputSpeech).toMatchObject({
      ssml: '<speak>Não consegui consultar as previsões agora. Tente novamente em instantes.</speak>',
    });
  });

  it('falha na inicialização, antes de atender requisições, quando os favoritos são inválidos', () => {
    const dir = mkdtempSync(join(tmpdir(), 'favorites-'));
    const file = join(dir, 'favorites.json');
    writeFileSync(file, JSON.stringify({ version: 1, lines: [{ id: '1001', label: 'L', arrivalSource: 'position' }], stops: [{ id: '9001', alias: 'a', lineIds: ['1001'] }, { id: '9001', alias: 'b', lineIds: ['1001'] }] }));

    expect(() => createLambdaHandler({ favoritesPath: file, env: {} })).toThrow(FavoritesConfigError);
  });

  it('por padrão recusa o exemplo versionado como configuração operacional', () => {
    expect(() => createLambdaHandler({ favoritesPath: examplePath, env: {} })).toThrow(/exemplo/);
  });
});
