# ADR-0005 — Agregação global de previsões

- **Status:** Aceito (limite revisado de três para cinco em 2026-10-22, decisão do proprietário)
- **Data:** 2026-10-22

## Contexto
Favoritos podem cruzar linhas e vários pontos; leitura de uma lista extensa não é útil.

## Decisão
Consultar todos os pontos elegíveis, filtrar par ponto–linha e janela de 0–30 minutos, agregar e ordenar por chegada; anunciar até cinco, com desempate determinístico. O limite foi revisado de três para cinco para cobrir mais opções sem consulta adicional, ao custo de uma resposta de voz mais longa.

## Alternativas consideradas
Retornar resultados por ponto; ordenar por prioridade fixa; mostrar todas as previsões.

## Consequências
Resposta curta e relevante; exige cuidado com duplicatas, timezone, direção e atualidade.

## Referência
[Spec do MVP](../specs/0001-alexa-bus-mvp.md)
