# ADR-0004 — Intents com filtros e contexto de sessão

- **Status:** Aceito
- **Data:** 2026-10-22

## Contexto
O usuário quer consultas gerais, específicas e perguntas de acompanhamento sem repetir filtros.

## Decisão
Criar intents gerais e por linha/ponto, aliases para resolução, contexto restrito aos atributos da sessão Alexa e clarificação de ambiguidades.

## Alternativas consideradas
Uma única intent rígida; persistência global do diálogo.

## Consequências
Melhora experiência de voz; exige modelo pt-BR, testes reais e gerenciamento explícito de sessão.

## Referência
[Spec do MVP](../specs/0001-alexa-bus-mvp.md)
