# Vocabulário de triagem de issues

Este documento define os papéis canônicos de labels. **O mapeamento não confirma a existência dessas labels no GitHub**; criá-las ou mapeá-las para labels existentes exige verificação no tracker.

| Papel | Label recomendada | Uso |
| --- | --- | --- |
| Triagem pendente | `needs-triage` | Issue ainda não classificada. |
| Informação ausente | `needs-info` | Falta requisito, dado ou evidência. |
| Pronta para agente | `ready-for-agent` | Todos os bloqueadores resolvidos. |
| Ação humana | `ready-for-human` | Cadastro, conta, autorização, credencial ou teste físico. |
| Não planejada | `wontfix` | Decisão explícita de não implementar. |

## Regras
- Não aplicar `ready-for-agent` a tickets com `Blocked by` ainda aberto.
- Não substituir ou apagar labels preexistentes sem análise.
- Para o MVP, issues #1 e #2 são candidatas a `ready-for-human`; #4 é candidata a `ready-for-agent`; #11 requer ação humana, mas continua bloqueada por #9 e #10.
- O uso de triagem automatizada só será ativado quando houver workflow de triagem no repositório.
