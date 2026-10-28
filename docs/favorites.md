# Favoritos: preenchimento e validação

Referências: [ADR-0002](adr/0002-favorites-configuration.md), [ADR-0009](adr/0009-position-fallback.md), [SPEC-0002](specs/0002-position-sighting.md), issue [#34](https://github.com/rodcordeiro/cade-meu-onibus/issues/34).

## Dois arquivos, papéis distintos

| Arquivo | Papel | Quem usa |
| --- | --- | --- |
| `config/favorites.json` | **Configuração operacional** do proprietário, empacotada com a Lambda. | `src/index.ts` (Lambda) e `npm run build` / `npm run validate:favorites`. |
| `config/favorites.example.json` | **Exemplo não operacional** (`"example": true`), com códigos e coordenadas fictícios. | Testes e `npm run invoke:local`. |

- O carregamento operacional **recusa** qualquer documento com `"example": true`; o exemplo nunca é usado em produção silenciosamente.
- Enquanto `config/favorites.json` estiver inválido, `npm run build` falha listando todos os problemas e a Lambda falharia na inicialização. Isso é intencional.

## Como preencher `config/favorites.json`

1. Obtenha os códigos oficiais na API Olho Vivo (token do proprietário, issue [#1](https://github.com/rodcordeiro/cade-meu-onibus/issues/1)), por exemplo com `scripts/sptrans-probe.mjs`:
   - `lines[].id`: código numérico `cl` da linha, um por sentido ([ADR-0008](adr/0008-line-identity-per-direction.md)).
   - `stops[].id`: código numérico `cp` do ponto.
2. Associe em `stops[].lineIds` apenas linhas cadastradas em `lines`, sem repetição.
3. Para cada linha com `"arrivalSource": "position"`, **todo** ponto que a referencia precisa de `approaches` com `lineId` e ao menos uma referência pública ordenada (`name`, `lat`, `lon`).
4. Não use `"example": true` (ou use `false`).

## Privacidade

- Aliases e nomes de referência são **públicos** (cruzamentos, estações, praças, comércios). Nunca use endereço residencial, número de casa ou apelidos que identifiquem pessoas.
- Coordenadas de `approaches` devem ser de **pontos públicos** ao longo do trajeto, nunca da residência.
- Não registre token, cookies ou payloads brutos da SPTrans no repositório, issues ou logs.

## Validação

```bash
npm run validate:favorites   # compila e valida config/favorites.json como operacional
npm run build                # compila e executa a mesma validação; falha se inválido
```

Regras verificadas (todas reportadas de uma vez, com caminho do campo): esquema `version: 1`; listas não vazias; `lines[].id` e `stops[].id` numéricos, não vazios e únicos; `lineIds` existentes e sem repetição; `arrivalSource` `forecast` ou `position`; `approaches` obrigatórias para linhas `position`, apenas para linhas associadas, sem repetição e com coordenadas válidas; marcador `example` booleano e recusado na configuração operacional.
