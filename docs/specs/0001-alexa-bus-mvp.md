# SPEC-0001 — MVP Cadê Meu Ônibus? (Alexa + SPTrans)

Status: **Ready for implementation, pending provider feasibility verification**  
Data: 2026-10-22  
Origem: quatro rodadas de Grill with Docs; consolidado com to-spec.

## Problema
Uma pessoa que usa ônibus em São Paulo precisa saber, sem abrir um aplicativo, quais veículos de suas linhas favoritas chegarão primeiro aos pontos cadastrados, com estimativas atualizadas e indicação de falhas ou incertezas.

## Solução
Skill pessoal Alexa que interpreta perguntas gerais ou filtradas, consulta a API SPTrans Olho Vivo por códigos oficiais de paradas, agrega previsões, seleciona até cinco chegadas nos próximos trinta minutos e responde em português. A skill mantém contexto durante a sessão para perguntas de acompanhamento.

## Objetivos e métricas de aceite
- Consulta geral cobre **todos** os pontos favoritos configurados e apenas suas linhas favoritas.
- Ordenação crescente por previsão de chegada; máximo de **5** resultados após agregação e filtro; janela **0–30 minutos**.
- Consultas por linha, ponto ou ambos; resolução por apelidos e códigos configurados, com resposta apropriada para entrada ambígua ou desconhecida.
- Resultado parcial sempre que existir ao menos uma previsão válida e algum ponto falhar; mencionar cobertura incompleta sem prometer completude.
- Nunca inventar ETA, atraso ou adiantamento; ausência de referência programada confiável implica não informar pontualidade.
- Linhas favoritas sem previsão no provedor são anunciadas por **avistamento** (referência próxima e idade da observação), sem tempo de chegada ([ADR-0009](../adr/0009-position-fallback.md)).
- Sem infraestrutura persistente ou interface de gerenciamento para o MVP.

## Histórias de usuário
1. As a commuter, I want to ask for the next buses, so that I can decide when to leave home.
2. As a commuter, I want to hear no more than five arrivals ordered by imminence, so that the answer stays short.
3. As a commuter, I want each arrival to name its stop and line, so that I do not go to the wrong stop.
4. As a commuter, I want to ask about a favorite line, so that I can ignore unrelated services.
5. As a commuter, I want to ask about a saved stop, so that I can compare arrivals at that location.
6. As a commuter, I want to combine line and stop filters, so that the answer is specific.
7. As a commuter, I want follow-up questions to preserve conversational context, so that I do not repeat a line or stop in the same session.
8. As a commuter, I want estimates beyond thirty minutes excluded, so that the reply stays actionable.
9. As a commuter, I want to know when no valid real-time estimates exist, so that I do not mistake missing data for punctual service.
10. As a commuter, I want available arrivals even when one stop fails, so that a partial outage does not block my whole request.
11. As a commuter, I want to know when the information is partial or stale, so that I can judge its reliability.
12. As a commuter, I want punctuality information only when substantiated, so that I do not hear invented delays.
13. As a skill owner, I want to register stops and favorite lines manually, so that I can control what is monitored without a web interface.
14. As a skill owner, I want the skill to run in AWS Lambda, so that I can use Alexa without operating a permanent server.
15. As a skill owner, I want local automated tests and device validation, so that I can confidently deploy changes.
16. As a commuter, I want understandable guidance when the spoken point or line is ambiguous, so that I can retry my request.
17. As a commuter, I want to hear where the nearest approaching bus of a line without official predictions was last seen, so that I can still decide when to leave without hearing an invented arrival time.

## Escopo funcional
### Entrada e interação de voz
- Modelo de interação em pt-BR com intent geral, consulta de linha, consulta de ponto, consulta combinada, help, cancel/stop e fallback.
- Nome de invocação configurável, validado no console Alexa; não assumir interceptação de “Alexa, qual o próximo ônibus” sem nome da skill.
- Slots resolvidos contra aliases do JSON; linhas homônimas ou sentidos distintos exigem desambiguação.
- Atributos de sessão preservam o último ponto e a última linha; não manter estado conversacional entre sessões.
- Respostas curtas e claras; jamais pronunciar códigos internos no lugar de nomes amigáveis quando existirem.

### Seleção de previsões
1. Carregar e validar favoritos na inicialização; IDs oficiais de ponto/linha e sentido quando necessário.
2. Determinar filtros a partir da intent e do contexto atual da sessão.
3. Selecionar pontos configurados aplicáveis e linhas associadas.
4. Obter previsões com concorrência limitada e deadline total compatível com resposta Alexa; erros isolados por ponto.
5. Normalizar timestamps na referência temporal de São Paulo e rejeitar dados inválidos, antigos ou fora de 0–30 minutos.
6. Filtrar pelo par ponto–linha e, quando aplicável, pelo sentido configurado; não confundir diferentes viagens/veículos.
7. Consolidar, eliminar duplicatas por identidade inequívoca de passagem/veículo/ponto se disponível, ordenar por instante de chegada, com desempate estável por ponto e linha; retornar até cinco.
8. Responder com tempo relativo calculado na hora de formular a fala; se houver falha de cobertura, mencionar resultado parcial.
9. Se não houver previsões, distinguir “nenhuma previsão disponível”, “nenhuma na janela” e “serviço indisponível”, conforme a evidência.

### Avistamento para linhas sem previsão ([ADR-0009](../adr/0009-position-fallback.md))
Resumo; o detalhamento, as histórias e os critérios de teste estão na [SPEC-0002](0002-position-sighting.md).

1. Linhas com `arrivalSource = "position"` não são consultadas por previsão; obter as posições dos veículos da linha, com o mesmo isolamento de falhas e deadline das paradas.
2. Descartar posições com observação além do limite de frescor (hipótese: 5 min).
3. Para cada associação ponto–linha, relacionar cada veículo ao ponto de referência mais próximo dentro do raio (hipótese: 300 m); ignorar veículos fora de todos os raios.
4. Eleger por associação o avistamento mais próximo do ponto monitorado, ou seja, o que tem menos referências restantes até ele.
5. Anunciar até um avistamento por associação, depois das previsões e fora do limite de 5. A fala informa a linha, o ponto, a referência, quantas referências faltam e a idade da observação, **sem minutos até a chegada**.
6. Sem avistamento elegível: “sem previsão e sem ônibus visto perto”, nunca “não há ônibus”.

### Fonte de dados
- Integração inicial: SPTrans Olho Vivo; autenticação por token, sessão e cookie conforme contrato oficial vigente.
- IDs oficiais são cadastrados manualmente; Google Maps não é a fonte de ETA nem dependência operacional do MVP.
- Verificar em prova de viabilidade os endpoints disponíveis para cada ponto e a cobertura real de linhas e sentidos. Resultado: [spike 0001](../spikes/0001-sptrans-olho-vivo.md) (contrato, fuso, casos vazios, ausência de horário programado).
- Cobertura de previsão não é universal: 575C-10 e 407Y-10 (sentido Vila Prudente) só expõem posição de veículos (relato do proprietário, 27/10/2026); ver [ADR-0009](../adr/0009-position-fallback.md).
- O retorno de previsão **não garante** indicação de atraso; habilitar pontualidade apenas após comprovar acesso a tabela oficial e associação confiável de viagens.
- Nunca registrar credenciais, endereço residencial ou payloads sensíveis em logs.

## Contratos de domínio (conceituais, TypeScript)
- `MonitoredStop`: `id: string` (código oficial); `alias: string`; `lineIds: string[]` (referências favoritas); atributos opcionais de direção/aliases conforme validação do provedor; `approaches?: { lineId: string; references: ReferencePoint[] }[]`, obrigatório para cada linha em modo `position`, com as referências em ordem de aproximação e não vazias.
- `ReferencePoint`: `name: string` (nome falado); `lat: number`; `lon: number`; somente paradas públicas.
- `FavoriteLine`: `id: string` (código `cl` do provedor, que identifica linha **e sentido**; ver [ADR-0008](../adr/0008-line-identity-per-direction.md)); `label: string`; `aliases?: string[]`; `direction?: string` (opcional e redundante); `arrivalSource?: "forecast" | "position"` (padrão `forecast`; ver [ADR-0009](../adr/0009-position-fallback.md)).
- `FavoritesConfig`: `stops: MonitoredStop[]`; `lines: FavoriteLine[]`; revisão de esquema `version`.
- `ArrivalPrediction`: `stopId: string`; `lineId: string`; `vehicleId?: string`; `arrivalAt: Date`; `observedAt: Date`; `direction?: string`; `scheduledAt?: Date` apenas se confiável.
- `ArrivalQuery`: `stopId?: string`; `lineId?: string`; `now: Date`; parâmetros de janela e limite definidos por política de aplicação.
- `VehiclePosition`: `lineId: string`; `vehicleId: string`; `lat: number`; `lon: number`; `observedAt: Date`.
- `VehicleSighting`: `stopId: string`; `lineId: string`; `vehicleId: string`; `referenceName: string`; `referencesRemaining: number`; `observedAt: Date`. Sem `arrivalAt`, por definição.
- `ArrivalResult`: `predictions: ArrivalPrediction[]`; `sightings: VehicleSighting[]`; `failedStopIds: string[]`; `failedLineIds: string[]`; `queriedStopIds: string[]`; `status: complete|partial|unavailable`.
- `TransportProvider`: operações `getArrivals(stopId, requestContext)` e `getVehiclePositions(lineId, requestContext)` com resultados normalizados; interface independente de SDK Alexa e AWS.
- `FavoritesRepository`: operação `load()` e validação integral do documento; falhar explicitamente se inválido.
- `ArrivalService`: operação `query(ArrivalQuery)` com ordenação, filtro e agregação independentes do provedor.
- `SpeechPresenter`: traduz `ArrivalResult` e contexto em resposta pt-BR sem consultar serviços externos.

## Limites de módulos
- `src/domain`: tipos, identidades, políticas de previsão.
- `src/application`: orquestração, seleção e resultado de consultas.
- `src/infrastructure/sptrans`: autenticação HTTP, adaptação dos campos, erros e timeout.
- `src/infrastructure/config`: carregamento e validação de JSON empacotado.
- `src/alexa`: intents, slots, estado de sessão, respostas de voz e handler Lambda.
- Dependências apontam da infraestrutura para contratos do domínio/aplicação; regras não importam SDK da Alexa nem AWS.
- Sem banco de dados e sem API Gateway no MVP.

## Configuração e segurança
- `config/favorites.json` empacotado no artefato de deploy, sem coordenadas residenciais, quando desnecessárias; não publicar dados pessoais em repo público.
- `SPTRANS_API_TOKEN` fornecido por variável de ambiente da Lambda; não incluir em arquivos versionados, exemplos com valores reais ou logs.
- IAM mínimo e logs estruturados sem PII/credenciais; controles de custo CloudWatch adequados a uso pessoal.
- Deploy manual inicial por console AWS, documentado e reproduzível; futura migração é permitida sem reescrever regras.

## Estratégia de testes
- Verificar prioritariamente o comportamento da intent/handler Alexa com eventos simulados e um transporte HTTP falso nas bordas; evitar mocks de cada módulo interno.
- Casos: seleção global intercalada; cinco resultados; limites exatos 0/30 min; fora do horizonte; sentido diferente; mesmo veículo em pontos distintos; duplicata; empate; horário inválido ou desatualizado; falha de uma/todas as paradas; ausência de previsões; input ambíguo; acompanhamento na mesma sessão; reinício de sessão; token ausente; API lenta e deadline; linha em modo `position` com avistamento, sem avistamento, com posição antiga, com veículo fora de todos os raios, com vários veículos (eleger o mais próximo do ponto) e com falha na consulta de posição; fala de avistamento nunca contém minutos até a chegada.
- Contratos de integração com fixtures sanitizadas para o adaptador Olho Vivo; teste real opt-in com credencial protegida e pontos conhecidos.
- Smoke test manual no simulador da Alexa e em dispositivo real em pt-BR antes de declarar o MVP aceito.

## Definição de pronto
- Implementação compatível com todos os critérios; testes de comportamento automatizados aprovados.
- Token permanece secreto e os favoritos de produção não expõem endereço residencial.
- Evidência de consulta funcional em pelo menos um ponto real com cobertura validada.
- Resposta clara em falha parcial/total e em ausência de dados; perguntas de acompanhamento testadas em sessão.
- Instruções documentadas para criar skill, configurar endpoint Lambda, variáveis e deploy manual.

## Fora de escopo
- Multiusuário, account linking, cadastro por voz, painel web/mobile e banco de dados.
- Descoberta dinâmica de paradas próximas da residência, geocodificação e integração de runtime com Google Maps.
- Notificações proativas, rotinas automatizadas, rastreamento em mapa, rotas, conexões entre ônibus e histórico de pontualidade.
- Infraestrutura IaC, deploy contínuo, publicação na loja pública de skills e suporte a outras cidades/provedores no MVP.
- Cálculo de atrasos sem fonte de horários programados verificável.
- ETA derivado de posição, seja por distância/velocidade ou por tempo de trajeto histórico. Este último está mapeado como evolução futura no [ADR-0009](../adr/0009-position-fallback.md#evolução-futura-estimativa-por-tempo-de-trajeto-histórico-opção-d).

## Riscos e verificações antes da implementação
1. **Viabilidade SPTrans:** validar token, login, payload, fuso, códigos, cobertura de paradas e limitação de taxa (não presumir cobertura total).
2. **Compatibilidade Alexa:** confirmar regras atuais de invocação, testes com conta/dispositivo e lifecycle de sessão.
3. **Latência:** medir respostas reais, estabelecer valores concretos de timeout, concorrência e frescor após uma rodada de testes; não inventar SLA.
4. **Direção/identidade:** verificar mapeamento dos códigos de linha e sentido nos resultados do provedor.
5. **Privacidade:** evitar registrar coordenadas de residência em repositório público; preferir alias e identificadores oficiais.
6. **Posição de veículos:** capturar fixture sanitizada da consulta de posição por linha (575C-10 e 407Y-10) e validar as hipóteses de frescor, raio e tamanho da lista de referências do [ADR-0009](../adr/0009-position-fallback.md).

## Dependências de execução (sequência sugerida)
1. Prova de viabilidade SPTrans e captura de fixtures sanitizadas.
2. Modelagem/validação de favoritos e casos de consulta.
3. Serviço de chegada com fixtures e testes.
4. Adaptador HTTP SPTrans com tratamento de falhas e limites.
5. Intents/handler Alexa com contexto da sessão e resposta de voz.
6. Empacotamento, documentação de deploy manual e testes de ponta a ponta.

## Referências de decisão
[ADRs](../adr/README.md) · [Glossário](../../CONTEXT.md).
