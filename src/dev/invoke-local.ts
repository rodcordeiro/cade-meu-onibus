/**
 * Execução local do handler com evento Alexa simulado e provedor de demonstração.
 * Uso: npm run invoke:local [-- LaunchRequest|NextBusIntent|AMAZON.HelpIntent|...]
 * As previsões são fictícias e geradas relativas ao horário atual; nunca use este provedor em produção.
 */
import { join } from 'node:path';
import type { RequestEnvelope } from 'ask-sdk-model';
import { createSkill } from '../alexa/skill';
import type { ArrivalPrediction, RequestContext, TransportProvider } from '../domain/types';
import { loadFavorites } from '../infrastructure/config/favorites-loader';

// Execução local usa o exemplo versionado (não operacional), independente de config/favorites.json.
const favorites = loadFavorites(join(__dirname, '..', '..', 'config', 'favorites.example.json'), { allowExample: true });

class DemoTransportProvider implements TransportProvider {
  async getArrivals(stopId: string, { now }: RequestContext): Promise<ArrivalPrediction[]> {
    const stop = favorites.stops.find((s) => s.id === stopId);
    return (stop?.lineIds ?? []).flatMap((lineId, index) =>
      [3 + index * 4, 18 + index * 9, 41].map((minutes) => ({
        stopId,
        lineId,
        arrivalAt: new Date(now.getTime() + minutes * 60_000 + stopId.length * 1000),
        observedAt: now,
      })),
    );
  }
}

const name = process.argv[2] ?? 'LaunchRequest';
const request =
  name === 'LaunchRequest'
    ? { type: 'LaunchRequest' }
    : { type: 'IntentRequest', intent: { name, confirmationStatus: 'NONE', slots: {} } };

const envelope = {
  version: '1.0',
  session: {
    new: true,
    sessionId: 'local-session',
    application: { applicationId: 'local-skill' },
    user: { userId: 'local-user' },
  },
  context: { System: { application: { applicationId: 'local-skill' }, user: { userId: 'local-user' }, apiEndpoint: '' } },
  request: { requestId: 'local-request', timestamp: new Date().toISOString(), locale: 'pt-BR', ...request },
} as unknown as RequestEnvelope;

createSkill({ favorites, provider: new DemoTransportProvider(), now: () => new Date() })
  .invoke(envelope)
  .then((response) => console.log(JSON.stringify(response.response, null, 2)))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
