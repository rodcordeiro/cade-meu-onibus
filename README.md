# Cadê Meu Ônibus?

Skill pessoal para Amazon Alexa que anuncia previsões de ônibus de pontos e linhas favoritos em São Paulo, usando dados da SPTrans Olho Vivo.

Consulte [a spec do MVP](docs/specs/0001-alexa-bus-mvp.md), [o glossário de domínio](CONTEXT.md) e [os ADRs](docs/adr/README.md).

## Premissas
- Skill de uso pessoal; configuração estática de pontos e linhas com IDs oficiais da SPTrans.
- Node.js + TypeScript + Alexa Skills Kit SDK em AWS Lambda, deploy manual no MVP.
- Até cinco chegadas nos próximos 30 minutos, ordenadas globalmente; consultas por linha e por ponto; conversação durante a sessão.
- Previsões em tempo real sujeitas à disponibilidade da API. Atrasos apenas com referência programada confiável.
- Não incluir tokens reais nem endereço residencial no repositório público.

## Estado atual
Consulta geral ponta a ponta ([#4](https://github.com/rodcordeiro/cade-meu-onibus/issues/4)): evento Alexa → favoritos JSON → provedor de transporte → seleção → fala pt-BR.

- Ainda **não há adaptador SPTrans** ([#5](https://github.com/rodcordeiro/cade-meu-onibus/issues/5)). Por isso o handler Lambda usa um provedor não configurado e responde "não consegui consultar as previsões", sem inventar dados.
- `config/favorites.json` é a **configuração operacional** do proprietário e ainda tem códigos de ponto provisórios e linhas `position` sem `approaches`: `npm run build` falha até ser preenchido com códigos oficiais ([#1](https://github.com/rodcordeiro/cade-meu-onibus/issues/1)/[#34](https://github.com/rodcordeiro/cade-meu-onibus/issues/34)). Testes e `invoke:local` usam `config/favorites.example.json` (não operacional). Veja [docs/favorites.md](docs/favorites.md).
- Fora deste incremento: consultas por linha/ponto (#6), sessão (#7), deadlines/concorrência e previsões desatualizadas (#8).

## Desenvolvimento
Requer Node.js 22+.

```bash
npm install
npm run typecheck
npm test
npm run validate:favorites                 # valida config/favorites.json como operacional
npm run build                              # compila e valida favoritos; falha se inválidos
npm run invoke:local                       # LaunchRequest com provedor de demonstração
npm run invoke:local -- AMAZON.HelpIntent  # outra intent
```

`invoke:local` usa previsões **fictícias** geradas a partir do horário atual e o exemplo `config/favorites.example.json`, apenas para ver a fala.

## Estrutura
| Caminho | Responsabilidade |
| --- | --- |
| `src/domain` | Tipos e políticas de seleção (janela 0–30 min, par ponto–linha, sentido, ordenação, duplicatas, limite 5). |
| `src/application` | `ArrivalService`: consulta todos os pontos, isola falhas e calcula o status de cobertura. |
| `src/infrastructure/config` | Carregamento e validação integral dos favoritos e guarda de build (`validate-favorites`). |
| `src/alexa` | Handlers, fala pt-BR (`SpeechPresenter`) e montagem da skill. |
| `src/index.ts`, `src/alexa/lambda-handler.ts` | Handler AWS Lambda e sua composição. |
| `skill-package/interactionModels/custom/pt-BR.json` | Modelo de interação (intent geral + intents nativas). |

## Configuração de favoritos
`config/favorites.json` (versão de esquema `1`):

```json
{
  "version": 1,
  "lines": [{ "id": "<código cl da SPTrans, um por sentido>", "label": "875A sentido Aeroporto", "aliases": ["..."] }],
  "stops": [{ "id": "<código SPTrans>", "alias": "ponto da padaria", "lineIds": ["<código da linha>"] }]
}
```

- `lines[].id` é o código `cl` da SPTrans, que já identifica o sentido ([ADR-0008](docs/adr/0008-line-identity-per-direction.md)); para os dois sentidos, cadastre duas linhas.
- `stops[].lineIds` precisa referenciar `lines[].id`. IDs não numéricos ou duplicados, campos vazios, referências inexistentes e linhas `position` sem `approaches` falham no build e na inicialização, com todos os problemas listados.
- Passo a passo, privacidade e exemplo: [docs/favorites.md](docs/favorites.md).
- A fala usa "`<linha>` no `<alias>`", então escreva o alias como "ponto da padaria", e não apenas "padaria".
- Não use endereço residencial nos aliases.

## Variáveis de ambiente
| Variável | Uso |
| --- | --- |
| `ALEXA_SKILL_ID` | Opcional. Quando definida, requisições de outras skills são rejeitadas. |
| `SPTRANS_API_TOKEN` | Reservada para o adaptador SPTrans (#5). Ainda não é lida. |
