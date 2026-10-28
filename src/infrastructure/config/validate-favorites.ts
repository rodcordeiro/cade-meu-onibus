/**
 * Guarda de build: valida a configuração operacional de favoritos (`config/favorites.json`).
 * Uso: `npm run validate:favorites` (também executado por `npm run build`).
 * Opcionalmente recebe outro caminho: `node dist/infrastructure/config/validate-favorites.js <arquivo>`.
 */
import { resolve } from 'node:path';
import { FavoritesConfigError, loadFavorites } from './favorites-loader';

/** Resultado da validação operacional dos favoritos. */
export interface FavoritesCheckResult {
  ok: boolean;
  message: string;
}

/** Valida o arquivo como configuração operacional (recusa o exemplo versionado) sem lançar exceção. */
export function checkOperationalFavorites(path: string): FavoritesCheckResult {
  try {
    const config = loadFavorites(path);
    return { ok: true, message: `Favoritos operacionais válidos em ${path}: ${config.stops.length} ponto(s), ${config.lines.length} linha(s).` };
  } catch (error) {
    if (error instanceof FavoritesConfigError) {
      return { ok: false, message: `${error.message}\nCorrija o arquivo antes de empacotar (veja docs/favorites.md).` };
    }
    throw error;
  }
}

if (require.main === module) {
  const target = resolve(process.argv[2] ?? 'config/favorites.json');
  const result = checkOperationalFavorites(target);
  if (result.ok) {
    console.log(result.message);
  } else {
    console.error(result.message);
    process.exitCode = 1;
  }
}
