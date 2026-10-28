/**
 * Frescor de observações do provedor (previsões e posições), regra de negócio comum.
 * Hipóteses de campo: revisar após medições reais.
 */

/** Idade máxima de uma observação para ainda ser anunciada como atual. */
export const MAX_OBSERVATION_AGE_MINUTES = 5;
export const MAX_OBSERVATION_AGE_MS = MAX_OBSERVATION_AGE_MINUTES * 60_000;
/** Tolerância para relógio do provedor adiantado: observações até 60 s no futuro são aceitas. */
export const MAX_CLOCK_SKEW_MS = 60_000;

/**
 * Indica se a observação feita em `observedAt` ainda é atual em `now`:
 * no máximo {@link MAX_OBSERVATION_AGE_MS} no passado e {@link MAX_CLOCK_SKEW_MS} no futuro.
 */
export function isFreshObservation(observedAt: Date, now: Date): boolean {
  const ageMs = now.getTime() - observedAt.getTime();
  return Number.isFinite(ageMs) && ageMs >= -MAX_CLOCK_SKEW_MS && ageMs <= MAX_OBSERVATION_AGE_MS;
}
