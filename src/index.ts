import { join } from 'node:path';
import { createLambdaHandler } from './alexa/lambda-handler';

// Configuração operacional: carregada e validada na inicialização da Lambda; inválida ou marcada como
// exemplo, falha antes de atender requisições. O build (`npm run build`) aplica a mesma validação.
/** Handler AWS Lambda da skill Alexa. */
export const handler = createLambdaHandler({
  favoritesPath: join(__dirname, '..', 'config', 'favorites.json'),
  env: process.env,
});
