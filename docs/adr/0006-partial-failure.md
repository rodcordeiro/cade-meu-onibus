# ADR-0006 — Falhas isoladas por parada

- **Status:** Aceito
- **Data:** 2026-10-22

## Contexto
Um ponto sem resposta não deve impedir outros de fornecer previsões.

## Decisão
Executar consultas com concorrência limitada, deadlines e tratamento independente por ponto; retornar previsões válidas e sinalizar falhas parciais.

## Alternativas consideradas
Fail-fast global; processamento sequencial sem deadline.

## Consequências
Melhor disponibilidade percebida; cobertura parcial precisa ser explicitada; valores de timeout serão validados empiricamente.

## Referência
[Spec do MVP](../specs/0001-alexa-bus-mvp.md)
