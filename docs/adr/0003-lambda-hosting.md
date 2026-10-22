# ADR-0003 — AWS Lambda com núcleo independente

- **Status:** Aceito
- **Data:** 2026-10-22

## Contexto
Skill pessoal precisa estar disponível sem servidor próprio contínuo; possível migração posterior.

## Decisão
Usar Node.js/TypeScript com Alexa Skills Kit SDK e AWS Lambda; manter application/domain livres de dependências AWS/Alexa.

## Alternativas consideradas
VPS/Docker e backend HTTP próprio.

## Consequências
Operação simples e escala sob demanda; exige configurar AWS, permissões, endpoint e limites; futura migração troca adaptador.

## Referência
[Spec do MVP](../specs/0001-alexa-bus-mvp.md)
