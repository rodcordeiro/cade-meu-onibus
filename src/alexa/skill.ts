import {
  SkillBuilders,
  getIntentName,
  getRequestType,
  type ErrorHandler,
  type HandlerInput,
  type RequestHandler,
  type Skill,
} from 'ask-sdk-core';
import type { Response } from 'ask-sdk-model';
import { ArrivalService } from '../application/arrival-service';
import { MAX_ANNOUNCED_ARRIVALS, QUERY_WINDOW_MINUTES } from '../domain/arrival-policy';
import type { FavoritesConfig, TransportProvider } from '../domain/types';
import { SpeechPresenter } from './speech-presenter';
import { resolveFilter } from './filter-resolution';

/** Dependências injetadas na skill; o relógio permite testes determinísticos. */
export interface SkillDependencies {
  favorites: FavoritesConfig;
  provider: TransportProvider;
  now: () => Date;
  /** Quando informado, rejeita requisições de outras skills. */
  skillId?: string;
}

const HELP_SPEECH =
  `Você pode perguntar: quais são os próximos ônibus? Eu digo até ${MAX_ANNOUNCED_ARRIVALS} chegadas nos próximos ${QUERY_WINDOW_MINUTES} minutos nos seus pontos favoritos.`;
const HELP_REPROMPT = 'Quer saber quais são os próximos ônibus?';
const FALLBACK_SPEECH = 'Não entendi. Você pode perguntar: quais são os próximos ônibus?';
const ERROR_SPEECH = 'Desculpe, algo deu errado. Tente novamente em instantes.';

const isIntent =
  (...names: string[]) =>
  ({ requestEnvelope }: HandlerInput): boolean =>
    getRequestType(requestEnvelope) === 'IntentRequest' && names.includes(getIntentName(requestEnvelope));

const isRequestType =
  (type: string) =>
  ({ requestEnvelope }: HandlerInput): boolean =>
    getRequestType(requestEnvelope) === type;

/** Texto livre (nomes vindos dos favoritos) precisa ser escapado antes de virar SSML. */
const escapeSsml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Monta a skill Alexa com as dependências injetadas (favoritos, provedor e relógio). */
export function createSkill({ favorites, provider, now, skillId }: SkillDependencies): Skill {
  const service = new ArrivalService(favorites, provider);
  const presenter = new SpeechPresenter(favorites);

  const answerGeneralQuery = async ({ responseBuilder }: HandlerInput): Promise<Response> => {
    const result = await service.query({ now: now() });
    // Tempo relativo calculado no momento de formular a fala, não no início da consulta.
    return responseBuilder.speak(escapeSsml(presenter.present(result, now()))).withShouldEndSession(true).getResponse();
  };

  const launchHandler: RequestHandler = { canHandle: isRequestType('LaunchRequest'), handle: answerGeneralQuery };
  const filteredHandler: RequestHandler = {
    canHandle: isIntent('NextBusIntent', 'NextBusByLineIntent', 'NextBusByStopIntent', 'NextBusByLineAndStopIntent'),
    handle: async (input) => {
      const request = input.requestEnvelope.request;
      if (request.type !== 'IntentRequest') return answerGeneralQuery(input);
      const slots = request.intent.slots;
      const line = slots?.line?.value?.trim();
      const stop = slots?.stop?.value?.trim();
      const attributes = input.attributesManager.getSessionAttributes();
      const previous = input.requestEnvelope.session?.new ? {} : attributes;
      const lineResolution = line ? resolveFilter(favorites, 'line', line) : undefined;
      const stopResolution = stop ? resolveFilter(favorites, 'stop', stop) : undefined;
      for (const [dimension, resolution] of [['linha', lineResolution], ['ponto', stopResolution]] as const) {
        if (!resolution || resolution.kind === 'resolved') continue;
        const message = resolution.kind === 'ambiguous'
          ? `Encontrei mais de uma opção para ${dimension}: ${resolution.options.join(' ou ')}. Qual você quer?`
          : `Não reconheci ${dimension} informado. Tente um nome dos seus favoritos.`;
        return input.responseBuilder.speak(escapeSsml(message)).reprompt('Qual linha ou ponto dos seus favoritos?').getResponse();
      }
      const lineId = lineResolution?.kind === 'resolved' ? lineResolution.id
        : typeof previous.lineId === 'string' ? previous.lineId : undefined;
      const stopId = stopResolution?.kind === 'resolved' ? stopResolution.id
        : typeof previous.stopId === 'string' ? previous.stopId : undefined;
      // Alexa session attributes belong to this session only, never to a process-global cache.
      input.attributesManager.setSessionAttributes({
        ...(lineId && { lineId }),
        ...(stopId && { stopId }),
      });
      const result = await service.query({ now: now(), ...(lineId && { lineId }), ...(stopId && { stopId }) });
      return input.responseBuilder.speak(escapeSsml(presenter.present(result, now())))
        .reprompt('Quer consultar outra linha ou ponto?')
        .withShouldEndSession(false).getResponse();
    },
  };

  const helpHandler: RequestHandler = {
    canHandle: isIntent('AMAZON.HelpIntent'),
    handle: ({ responseBuilder }) => responseBuilder.speak(HELP_SPEECH).reprompt(HELP_REPROMPT).getResponse(),
  };

  const stopHandler: RequestHandler = {
    canHandle: isIntent('AMAZON.StopIntent', 'AMAZON.CancelIntent', 'AMAZON.NavigateHomeIntent'),
    handle: ({ responseBuilder }) => responseBuilder.speak('Até logo.').withShouldEndSession(true).getResponse(),
  };

  const fallbackHandler: RequestHandler = {
    canHandle: isIntent('AMAZON.FallbackIntent'),
    handle: ({ responseBuilder }) => responseBuilder.speak(FALLBACK_SPEECH).reprompt(HELP_REPROMPT).getResponse(),
  };

  const sessionEndedHandler: RequestHandler = {
    canHandle: isRequestType('SessionEndedRequest'),
    handle: ({ responseBuilder }) => responseBuilder.getResponse(),
  };

  const errorHandler: ErrorHandler = {
    canHandle: () => true,
    handle: ({ requestEnvelope, responseBuilder }, error) => {
      // Somente nome do erro e tipo da requisição: mensagens podem carregar URLs ou payloads sensíveis.
      console.error(JSON.stringify({ event: 'skill_error', error: error.name, requestType: getRequestType(requestEnvelope) }));
      return responseBuilder.speak(ERROR_SPEECH).withShouldEndSession(true).getResponse();
    },
  };

  const builder = SkillBuilders.custom();
  if (skillId) builder.withSkillId(skillId);
  return builder
    .addRequestHandlers(launchHandler, filteredHandler, helpHandler, stopHandler, fallbackHandler, sessionEndedHandler)
    .addErrorHandlers(errorHandler)
    .create();
}
