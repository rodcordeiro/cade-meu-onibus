# Cadê Meu Ônibus?

Skill pessoal para Amazon Alexa que anuncia previsões de ônibus de pontos e linhas favoritos em São Paulo, usando dados da SPTrans Olho Vivo.

Projeto em fase de especificação, sem implementação. Consulte [a spec do MVP](docs/specs/0001-alexa-bus-mvp.md), [o glossário de domínio](CONTEXT.md) e [os ADRs](docs/adr/README.md).

## Premissas
- Skill de uso pessoal; configuração estática de pontos e linhas com IDs oficiais da SPTrans.
- Node.js + TypeScript + Alexa Skills Kit SDK em AWS Lambda, deploy manual no MVP.
- Até três chegadas nos próximos 30 minutos, ordenadas globalmente; consultas por linha e por ponto; conversação durante a sessão.
- Previsões em tempo real sujeitas à disponibilidade da API. Atrasos apenas com referência programada confiável.
- Não incluir tokens reais nem endereço residencial no repositório público.

## Próximos passos
Validar autenticação e cobertura do Olho Vivo, cadastrar IDs oficiais, criar o modelo de interação da Alexa, implementar a integração e testar em dispositivo real.
