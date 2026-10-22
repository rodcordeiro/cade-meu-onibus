# ADR-0005 — Agregação global de previsões

- **Status:** Aceito
- **Data:** 2026-10-22

## Contexto
Favoritos podem cruzar linhas e vários pontos; leitura de uma lista extensa não é útil.

## Decisão
Consultar todos os pontos elegíveis, filtrar par ponto–linha e janela de 0–30 minutos, agregar e ordenar por chegada; anunciar até três, com desempate determinístico.

## Alternativas consideradas
Retornar resultados por ponto; ordenar por prioridade fixa; mostrar todas as previsões.

## Consequências
Resposta curta e relevante; exige cuidado com duplicatas, timezone, direção e atualidade.

## Referência
[Spec do MVP](../specs/0001-alexa-bus-mvp.md)
