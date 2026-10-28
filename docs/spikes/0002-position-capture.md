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

Registre na issue #16 os códigos públicos, HTTP status, horário, estrutura real, presença/ausência de veículos, se previsão veio vazia, limitações e evidências sanitizadas.

## Evidência real (28/10/2026, 09:37 em São Paulo, dia útil de manhã)

Capturada com a sonda acima, usando o token do proprietário. O bruto ficou fora do repositório; as fixtures sanitizadas estão em `test/fixtures/sptrans/*-sem-previsao-{34974,1686}.json`.

| Linha (`cl`) | Endpoint | HTTP | Resultado |
| --- | --- | --- | --- |
| 34974 (575C-10, sentido Vila Prudente) | `Posicao/Linha` | 200 | `hr` + `vs` com 4 veículos; a observação mais recente tinha cerca de 12 s |
| 34974 | `Previsao/Linha` | 200 | `{"hr":"09:37","ps":[]}`: **nenhuma previsão** |
| 34974 | `Previsao/Parada` (8704768) | 200 | `p: null` |
| 1686 (407Y-10, sentido Vila Prudente) | `Posicao/Linha` | 200 | `hr` + `vs` com 2 veículos; a observação mais recente tinha cerca de 21 s |
| 1686 | `Previsao/Linha` | 200 | `{"hr":"09:37","ps":[]}`: **nenhuma previsão** |
| 1686 | `Previsao/Parada` (8704768) | 200 | `p: null` |

Formato de `Posicao/Linha`: `{ hr: "HH:mm", vs: [{ p: string, a: boolean, ta: ISO-8601 UTC, py: number, px: number, sv: null, is: null }] }`. É o mesmo formato de `vs[]` da previsão, sem `t`. Na fixture, `px`/`py` foram removidos pelo sanitizador.

Limitações:
- uma única amostra, no pico da manhã;
- a correspondência entre `cl` e letreiro/sentido foi informada pelo proprietário;
- `Previsao/Parada` com `p: null` também pode significar parada inexistente (spike 0001).

Ainda assim, a combinação de veículos com posição recente e `ps: []` na linha inteira confirma a ausência de previsão.

## Relatório de estrutura sem valores

O comando `sptrans-position-shape.mjs` mostra somente nomes de campos do contrato, tipos e contagens de uma captura **já sanitizada**. Ele ajuda a confirmar o contrato real antes do adaptador (#18), mas não substitui a revisão humana das fixtures nem demonstra que as linhas não têm previsão.

```bash
node scripts/sptrans-position-shape.mjs /tmp/sptrans-575c-safe/posicao-linha.json
```

**Garantias**

- Nenhum valor da captura é impresso: apenas `type` (`string`, `number`, `boolean`, `null`, `object`, `array`) e contagens.
- Só aparecem nomes da allowlist do contrato SPTrans (`Posicao/Linha`, `Previsao/Linha`, `Previsao/Parada` e `Message` de erro): `hr`, `p`, `l`, `ps`, `vs`, `cp`, `np`, `py`, `px`, `c`, `cl`, `sl`, `lt0`, `lt1`, `qv`, `a`, `ta`, `t`, `sv`, `is`, `Message`. Qualquer outro campo é contado em `unknownFields`, sem nome, valor ou subestrutura; o resultado é determinístico (não depende da ordem das chaves).
- Arrays informam `count` (total), `inspected` e `elementShapes`: cada formato distinto dos elementos inspecionados, com `occurrences`. Formatos além do limite são contados em `omittedShapes`.
- Erros de entrada usam mensagens fixas; o CLI responde apenas `Não foi possível inspecionar a captura` e código de saída 1, sem conteúdo do arquivo.

**Limites** (`SHAPE_LIMITS`)

| Limite | Valor | Efeito ao exceder |
| --- | --- | --- |
| Profundidade | 8 níveis | nó vira `{ "type": "depth-limit" }` |
| Elementos inspecionados por array | 100 | restantes entram só em `count` |
| Formatos por array | 5 | excedente em `omittedShapes` |
| Nós inspecionados no total | 50.000 | nó vira `truncated` e o relatório traz `"truncated": true` |
| Tamanho do relatório | 64.000 caracteres | `bodyShape` vira `truncated` e `"truncated": true` |

**Limitações:** campos desconhecidos são ocultados, então o relatório não revela campos novos do contrato — se `unknownFields` aparecer, investigue o arquivo sanitizado localmente. Elementos além do centésimo não são inspecionados. A inspeção não detecta dados pessoais em **valores** de campos permitidos (ex.: `np`); por isso a revisão humana das fixtures antes de versioná-las continua obrigatória.
