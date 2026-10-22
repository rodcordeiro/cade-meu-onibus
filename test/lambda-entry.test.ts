import { describe, expect, it } from 'vitest';
import { handler } from '../src/index';
import { alexaRequest } from './support/alexa';

describe('handler Lambda', () => {
  it('carrega os favoritos empacotados e, sem provedor real, informa indisponibilidade sem inventar previsões', async () => {
    const response = await handler(alexaRequest({ type: 'LaunchRequest' }));

    expect(response.response.outputSpeech).toMatchObject({
      ssml: '<speak>Não consegui consultar as previsões agora. Tente novamente em instantes.</speak>',
    });
  });
});
