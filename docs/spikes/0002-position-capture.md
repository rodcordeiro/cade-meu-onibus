# Captura de evidências de posição (SPEC-0002 / #16)

Pré-requisito: `SPTRANS_API_TOKEN` válido em `.env`, nunca versionado. Execute com Node.js 22+.

```bash
node --env-file=.env scripts/sptrans-position-probe.mjs /tmp/sptrans-575c-raw <codigoLinha575C> [codigoParadaPublica]
node scripts/sptrans-position-sanitize.mjs /tmp/sptrans-575c-raw /tmp/sptrans-575c-safe
node --env-file=.env scripts/sptrans-position-probe.mjs /tmp/sptrans-407y-raw <codigoLinha407Y> [codigoParadaPublica]
node scripts/sptrans-position-sanitize.mjs /tmp/sptrans-407y-raw /tmp/sptrans-407y-safe
node scripts/sptrans-position-shape.mjs /tmp/sptrans-575c-safe/posicao-linha.json
node scripts/sptrans-position-shape.mjs /tmp/sptrans-407y-safe/posicao-linha.json
node --test test/sptrans-position-scripts.test.mjs test/sptrans-position-shape.test.mjs
```

Substitua os placeholders por **códigos internos oficiais `cl` do sentido Vila Prudente**; não use o letreiro como ID. A sonda usa login com `Content-Length: 0`, cookie de sessão e consulta `Posicao/Linha`, `Previsao/Linha` e opcionalmente `Previsao/Parada`. Não imprime token ou cookie. Capturas brutas devem ficar fora do repositório e não devem ser publicadas.

O sanitizador remove `px`, `py`, latitude/longitude e credenciais de qualquer nível. Isso preserva formato, identificação e timestamps, mas **não serve para validar cálculos geográficos**; crie fixtures sintéticas separadas para a política de distância. Revise manualmente os arquivos sanitizados antes de versionar, verificando campos inesperados e dados pessoais. Nunca copie o diretório bruto.

Registre na issue #16 os códigos públicos, HTTP status, horário, estrutura real, presença/ausência de veículos, se previsão veio vazia, limitações e evidências sanitizadas. **Nenhuma resposta real foi capturada por este PR.** Não conclua #16 nem desbloqueie #18 antes da captura real.

## Relatório de estrutura sem valores

O comando `sptrans-position-shape.mjs` mostra apenas os nomes dos campos, tipos e quantidades de elementos de arrays de uma captura **já sanitizada**. Não imprime códigos, horários, veículos ou coordenadas. Esse relatório ajuda a confirmar o contrato real antes de implementar o adaptador (#18), mas não substitui a revisão humana dos arquivos nem demonstra que as linhas não têm previsão.
