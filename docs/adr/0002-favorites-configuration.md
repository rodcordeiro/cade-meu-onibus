# ADR-0002 — Favoritos estáticos em arquivo empacotado

- **Status:** Aceito
- **Data:** 2026-10-22

## Contexto
Uso pessoal com poucos pontos não justifica interface administrativa nem persistência.

## Decisão
Manter JSON versionado com códigos oficiais de pontos, linhas e aliases; carregar e validar no startup da Lambda.

## Alternativas consideradas
DynamoDB, S3 dinâmico, interface web, geocodificação no runtime.

## Consequências
Baixo custo e simplicidade; cada mudança exige redeploy; não registrar endereço residencial em repositório público.

## Referência
[Spec do MVP](../specs/0001-alexa-bus-mvp.md)
