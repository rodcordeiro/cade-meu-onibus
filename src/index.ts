import { join } from 'node:path';
import type { RequestEnvelope, ResponseEnvelope } from 'ask-sdk-model';
import { createSkill } from './alexa/skill';
import { loadFavorites } from './infrastructure/config/favorites-loader';
import { SptransTransportProvider } from './infrastructure/transport/sptrans-provider';
import { UnconfiguredTransportProvider } from './infrastructure/transport/unconfigured-provider';

// Carregado e validado na inicialização da Lambda: configuração inválida falha antes de atender requisições.
const favorites = loadFavorites(join(__dirname, '..', 'config', 'favorites.json'));

const skill = createSkill({
  favorites,
  provider: process.env.SPTRANS_API_TOKEN
    ? new SptransTransportProvider(process.env.SPTRANS_API_TOKEN)
    : new UnconfiguredTransportProvider(),
  now: () => new Date(),
  skillId: process.env.ALEXA_SKILL_ID,
});

/** Handler AWS Lambda da skill Alexa. */
export const handler = (event: RequestEnvelope, context?: unknown): Promise<ResponseEnvelope> => skill.invoke(event, context);
