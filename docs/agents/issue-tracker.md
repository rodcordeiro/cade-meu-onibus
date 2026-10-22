# Issue tracker — Cadê Meu Ônibus?

## Tracker canônico
GitHub Issues no repositório [rodcordeiro/cade-meu-onibus](https://github.com/rodcordeiro/cade-meu-onibus/issues).

## Convenções
- Cada issue deve ser pequena, verificável e associada à [SPEC-0001](../specs/0001-alexa-bus-mvp.md) ou a uma spec futura.
- Descrever objetivo, critérios de aceite em checklist, dependências com `Blocked by: #N`, testes/evidências e requisitos humanos.
- Criar bloqueadores antes de dependentes e referenciar números reais de issues; não fechar issues-pai automaticamente.
- Usar incrementos verticais (fluxo observável de ponta a ponta) e não separar arbitrariamente tickets por camada.
- Não inserir tokens SPTrans, credenciais AWS ou endereços residenciais em issues, commits ou logs.
- Issues [#1](https://github.com/rodcordeiro/cade-meu-onibus/issues/1) e [#2](https://github.com/rodcordeiro/cade-meu-onibus/issues/2) exigem intervenção do proprietário; [#11](https://github.com/rodcordeiro/cade-meu-onibus/issues/11) exige teste em dispositivo Alexa.

## Fluxo
1. `needs-info`: bloqueio de definição ou evidência.
2. `ready-for-human`: ação de conta, autorização, credencial ou dispositivo exigida do proprietário.
3. `ready-for-agent`: issue sem bloqueadores pendentes e com critérios verificáveis.
4. Em execução: registrar progresso no issue/PR; verificar dependências antes de iniciar.
5. Encerramento: testes, evidências, revisão e critérios de aceite concluídos.

## Referências
- [Spec do MVP](../specs/0001-alexa-bus-mvp.md)
- [Mapa de labels](triage-labels.md)
- [ADRs](../adr/README.md)
