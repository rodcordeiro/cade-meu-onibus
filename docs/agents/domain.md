# Convenções de domínio

## Contexto único
Este projeto utiliza um único domínio de transporte/consulta de chegada. O glossário canônico fica no [CONTEXT.md](../../CONTEXT.md). Não criar `CONTEXT-MAP.md` sem evidência de múltiplos contextos independentes.

## Como evoluir o modelo
- Antes de introduzir nomes como ponto, linha, previsão, atraso ou sessão, consultar `CONTEXT.md`.
- Registrar termos e invariantes de negócio no glossário, sem mencionar frameworks, persistência ou SDKs.
- Decisões arquiteturais difíceis de reverter, surpreendentes e com trade-offs devem gerar ADR em `docs/adr/NNNN-<slug>.md`.
- ADRs devem registrar status, contexto, decisão, alternativas e consequências; não substituir especificações ou tickets.
- Mudanças de comportamento devem atualizar a spec, os testes e os termos relevantes, preservando histórico de decisões.
- Verificar os identificadores de ponto, linha e sentido contra a API SPTrans antes de tratá-los como contrato validado.

## Fontes de verdade
- [CONTEXT.md](../../CONTEXT.md): linguagem de domínio e invariantes.
- [SPEC-0001](../specs/0001-alexa-bus-mvp.md): requisitos, contratos e critérios de aceite.
- [ADRs](../adr/README.md): justificativas de escolhas arquiteturais.
- [GitHub Issues](issue-tracker.md): execução e bloqueadores.
