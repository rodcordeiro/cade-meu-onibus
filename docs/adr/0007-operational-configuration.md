# ADR-0007 — Deploy manual e segredos via ambiente

- **Status:** Aceito
- **Data:** 2026-10-22

## Contexto
O MVP prioriza operação simples, credenciais seguras e custo controlado sem CI/CD ou IaC inicial.

## Decisão
Empacotar JSON de favoritos com a Lambda, fornecer token Olho Vivo como variável de ambiente protegida, efetuar deploy manual no console; testes automatizados com fixtures e smoke test em dispositivo.

## Alternativas consideradas
Secrets Manager, S3, IaC/SAM/CDK, pipelines de entrega já no MVP.

## Consequências
Menos serviços e setup; updates manuais aumentam risco operacional, mitigado por checklist; não incluir segredos ou dados residenciais no Git.

## Referência
[Spec do MVP](../specs/0001-alexa-bus-mvp.md)
