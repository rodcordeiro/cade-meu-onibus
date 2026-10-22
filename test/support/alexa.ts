import type { RequestEnvelope, ResponseEnvelope } from 'ask-sdk-model';
import { createSkill, type SkillDependencies } from '../../src/alexa/skill';

const NOW = new Date('2026-10-22T18:00:00.000Z');

/** Monta um envelope Alexa mínimo para o tipo de requisição informado. */
export function alexaRequest(request: Record<string, unknown>): RequestEnvelope {
  return {
    version: '1.0',
    session: {
      new: true,
      sessionId: 'amzn1.echo-api.session.test',
      application: { applicationId: 'amzn1.ask.skill.test' },
      user: { userId: 'amzn1.ask.account.test' },
      attributes: {},
    },
    context: {
      System: {
        application: { applicationId: 'amzn1.ask.skill.test' },
        user: { userId: 'amzn1.ask.account.test' },
        device: { deviceId: 'device', supportedInterfaces: {} },
        apiEndpoint: 'https://api.amazonalexa.com',
      },
    },
    request: {
      requestId: 'amzn1.echo-api.request.test',
      timestamp: NOW.toISOString(),
      locale: 'pt-BR',
      ...request,
    },
  } as unknown as RequestEnvelope;
}

export function intentRequest(name: string): RequestEnvelope {
  return alexaRequest({ type: 'IntentRequest', intent: { name, confirmationStatus: 'NONE', slots: {} } });
}

export const minutesFromNow = (minutes: number, seconds = 0): Date =>
  new Date(NOW.getTime() + minutes * 60_000 + seconds * 1000);

export async function invoke(
  deps: Partial<SkillDependencies> & Pick<SkillDependencies, 'favorites' | 'provider'>,
  envelope: RequestEnvelope,
): Promise<{ speech: string; shouldEndSession: boolean | undefined; raw: ResponseEnvelope }> {
  const skill = createSkill({ now: () => NOW, ...deps });
  const raw = await skill.invoke(envelope);
  const ssml = raw.response.outputSpeech && 'ssml' in raw.response.outputSpeech ? raw.response.outputSpeech.ssml : '';
  const speech = ssml.replace(/<\/?speak>/g, '').trim();
  return { speech, shouldEndSession: raw.response.shouldEndSession, raw };
}

export { NOW };
