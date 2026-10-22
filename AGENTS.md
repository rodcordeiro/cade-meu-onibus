# AGENTS.md — Cadê Meu Ônibus?

Instruções canônicas para agentes de desenvolvimento neste repositório. Leia os documentos referenciados antes de modificar código, contratos ou tickets.

## Projeto e fontes de verdade

O projeto é uma skill pessoal para Amazon Alexa que consulta previsões de ônibus de pontos e linhas favoritos de São Paulo via SPTrans Olho Vivo. O MVP utiliza Node.js + TypeScript, Alexa Skills Kit SDK e AWS Lambda, com deploy manual.

- **Requisitos e critérios de aceite:** [SPEC-0001](docs/specs/0001-alexa-bus-mvp.md).
- **Linguagem de domínio e invariantes:** [CONTEXT.md](CONTEXT.md).
- **Decisões e trade-offs arquiteturais:** [ADRs](docs/adr/README.md).
- **Processo de issues e dependências:** [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md).
- **Regras de domínio e atualização de documentação:** [docs/agents/domain.md](docs/agents/domain.md).
- **Vocabulário de triagem:** [docs/agents/triage-labels.md](docs/agents/triage-labels.md).

Em caso de conflito, não invente comportamento: identifique a divergência entre spec, ADR e implementação, documente-a no ticket e solicite decisão quando necessário.

## Agent skills

### Issue tracker
O tracker oficial é o [GitHub Issues](https://github.com/rodcordeiro/cade-meu-onibus/issues). Antes de trabalhar, leia o issue, seus critérios de aceite e `Blocked by: #N`; não comece tarefas com bloqueadores abertos. Produza incrementos verticais pequenos e verificáveis. Não feche issues-pai ou dependentes automaticamente. Consulte [issue-tracker.md](docs/agents/issue-tracker.md).

### Domain docs
Há um único contexto de domínio. Use os termos do [CONTEXT.md](CONTEXT.md), que deve conter somente definições e invariantes de negócio, sem escolhas de frameworks ou persistência. Registre decisões arquiteturais significativas em `docs/adr/NNNN-<slug>.md` com contexto, status, decisão, alternativas e consequências. Consulte [domain.md](docs/agents/domain.md).

### Triage
Consulte [triage-labels.md](docs/agents/triage-labels.md) para os papéis `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human` e `wontfix`. Não presuma que essas labels já estejam criadas no GitHub nem aplique `ready-for-agent` enquanto houver bloqueadores abertos.

## Regras de implementação

1. **Spec-first:** trace cada mudança até histórias e critérios de aceite da [SPEC-0001](docs/specs/0001-alexa-bus-mvp.md) ou uma spec aprovada posterior; evite expandir o escopo do MVP.
2. **Separação de responsabilidades:** mantenha regras de domínio e aplicação independentes de AWS, Alexa SDK e detalhes HTTP; a integração SPTrans deve ficar atrás do contrato de provedor.
3. **Dados corretos:** consulte apenas associações ponto–linha favoritas; agregue todos os pontos elegíveis, filtre a janela de 0 a 30 minutos, ordene globalmente por chegada e anuncie no máximo três resultados com linha e ponto.
4. **Incerteza explícita:** nunca invente ETA, atraso, adiantamento ou cobertura de pontos; falhas parciais não devem ocultar resultados válidos, e dados desatualizados não podem ser apresentados como tempo real.
5. **Sessão Alexa:** perguntas de acompanhamento podem reutilizar filtros na sessão corrente; não persista contexto de uma sessão para outra.
6. **Configuração:** favoritos em JSON empacotado, com códigos oficiais SPTrans; não adicione banco de dados, API Gateway, painel ou CI/CD sem mudança aprovada de escopo.
7. **Segurança:** token SPTrans via `SPTRANS_API_TOKEN` no ambiente da Lambda; nunca inclua credenciais, cookies, endereços residenciais, dados pessoais ou payloads sensíveis em commits, issues, fixtures ou logs.
8. **Validação:** priorize testes comportamentais no handler/intent com eventos Alexa simulados e HTTP falso nas bordas; use fixtures sanitizadas para o adaptador SPTrans. Testes reais são opt-in e dependem de contas e credenciais do proprietário.
9. **Entrega:** documente comandos executados, testes e resultados no PR/issue; se um teste ou dependência externa não estiver disponível, declare claramente a limitação.
10. **Mudanças arquiteturais:** revise a spec, o glossário e os ADRs pertinentes quando alterar contratos, termos ou decisões já aceitas.

## Dependências humanas do MVP

- [Issue #1](https://github.com/rodcordeiro/cade-meu-onibus/issues/1): conta/token SPTrans e pontos oficiais para validação.
- [Issue #2](https://github.com/rodcordeiro/cade-meu-onibus/issues/2): conta AWS e Alexa Developer Console.
- [Issue #11](https://github.com/rodcordeiro/cade-meu-onibus/issues/11): teste de voz em dispositivo Alexa real.

A [issue #4](https://github.com/rodcordeiro/cade-meu-onibus/issues/4) pode ser desenvolvida com mocks sem aguardar essas credenciais.
