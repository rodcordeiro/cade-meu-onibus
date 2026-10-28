/**
 * Indica se o texto é um código oficial SPTrans de linha (`CodigoLinha`) ou ponto (`CodigoParada`):
 * inteiro não negativo, mantido como texto. Regra única para a validação de favoritos e o adaptador.
 */
export function isOfficialSptransCode(code: string): boolean {
  return /^\d+$/.test(code);
}
