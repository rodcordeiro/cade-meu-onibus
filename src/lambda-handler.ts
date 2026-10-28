import type { RequestEnvelope, ResponseEnvelope } from 'ask-sdk-model';
import { createSkill } from './alexa/skill';
import { loadFavorites } from './infrastructure/config/favorites-loader';
import { SptransTransportProvider } from './infrastructure/transport/sptrans-provider';
import { UnconfiguredTransportProvider } from './infrastructure/transport/unconfigured-provider';

/** Dependências de composição do handler Lambda. */
export interface LambdaHandlerOptions {
  /** Caminho do JSON de favoritos, validado na criação do handler. */
  favoritesPath: string;
  /** Aceita o exemplo versionado (`"example": true`); apenas testes e execução local. */
  allowExampleFavorites?: boolean;
  /** Variáveis de ambiente (`SPTRANS_API_TOKEN`, `ALEXA_SKILL_ID`). */
  env: Record<string, string | undefined>;
}

/** Handler AWS Lambda da skill Alexa. */
export type LambdaHandler = (event: RequestEnvelope, context?: unknown) => Promise<ResponseEnvelope>;

/**
 * Compõe o handler da Lambda. Os favoritos são carregados e validados aqui (inicialização):
 * configuração inválida lança `FavoritesConfigError` antes de qualquer requisição ser atendida.
 */
export function createLambdaHandler({ favoritesPath, allowExampleFavorites = false, env }: LambdaHandlerOptions): LambdaHandler {
  const favorites = loadFavorites(favoritesPath, { allowExample: allowExampleFavorites });
  const skill = createSkill({
    favorites,
    provider: env.SPTRANS_API_TOKEN ? new SptransTransportProvider(env.SPTRANS_API_TOKEN) : new UnconfiguredTransportProvider(),
    now: () => new Date(),
    skillId: env.ALEXA_SKILL_ID,
  });
  return (event, context) => skill.invoke(event, context);
}
