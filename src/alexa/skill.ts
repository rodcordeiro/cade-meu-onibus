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
import { QUERY_WINDOW_MINUTES } from '../domain/arrival-policy';
import type { FavoritesConfig, TransportProvider } from '../domain/types';
import { SpeechPresenter } from './speech-presenter';

/** Dependências injetadas na skill; o relógio permite testes determinísticos. */
export interface SkillDependencies {
  favorites: FavoritesConfig;
  provider: TransportProvider;
  now: () => Date;
  /** Quando informado, rejeita requisições de outras skills. */
  skillId?: string;
}

const HELP_SPEECH =
  `Você pode perguntar: quais são os próximos ônibus? Eu digo até três chegadas nos próximos ${QUERY_WINDOW_MINUTES} minutos nos seus pontos favoritos.`;
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
  const nextBusHandler: RequestHandler = { canHandle: isIntent('NextBusIntent'), handle: answerGeneralQuery };

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
    .addRequestHandlers(launchHandler, nextBusHandler, helpHandler, stopHandler, fallbackHandler, sessionEndedHandler)
    .addErrorHandlers(errorHandler)
    .create();
}
