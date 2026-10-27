# ADR-0009 — Avistamento por posição para linhas sem previsão

- **Status:** Aceito
- **Data:** 2026-10-27

## Contexto
O [ADR-0001](0001-transport-provider.md), o [ADR-0005](0005-arrival-selection.md) e o [spike 0001](../spikes/0001-sptrans-olho-vivo.md) partiram do pressuposto de que toda linha favorita tem previsão por parada no Olho Vivo. Esse pressuposto não se confirmou para as linhas principais do proprietário: **575C-10** e **407Y-10**, sentido Vila Prudente. Segundo o relato do proprietário em 27/10/2026, elas respondem `200` sem previsão em nenhuma parada, mas a posição dos veículos (`px`/`py`) continua disponível. Hoje a skill responderia "nenhuma previsão disponível" justamente para as linhas mais importantes.

Restrições que seguem valendo:
- [SPEC-0001](../specs/0001-alexa-bus-mvp.md) e invariante 4 do [CONTEXT](../../CONTEXT.md): nunca inventar ETA; ausência de dados não equivale a ausência de ônibus.
- Regras 6 e 7 do [AGENTS.md](../../AGENTS.md): sem banco de dados; nunca expor endereço residencial.

## Decisão
1. **Origem explícita por linha.** `FavoriteLine` ganha `arrivalSource: "forecast" | "position"`, com `forecast` como padrão. Linhas marcadas como `position` não passam pela consulta de previsão: a skill busca a posição dos veículos da linha (no Olho Vivo, `Posicao/Linha?codigoLinha={cl}`). A escolha manual torna o comportamento determinístico e evita chamadas extras para descobrir a origem a cada consulta.
2. **Pontos de referência de aproximação.** Para cada associação ponto–linha em modo `position`, a configuração lista, **em ordem de aproximação**, alguns pontos de referência públicos já percorridos antes do ponto monitorado (paradas oficiais com nome e coordenadas). O último item é o próprio ponto. Não usar residência nem coordenadas pessoais.
3. **Avistamento.** Um veículo só gera avistamento quando:
   - a observação é recente (`ta` dentro do limite de frescor);
   - o veículo está dentro do raio de algum ponto de referência da lista.

   Quando a associação tem mais de um avistamento, vale o mais próximo do ponto monitorado, isto é, o de maior índice na lista, que tem menos referências até chegar lá. Veículos fora de todos os raios são ignorados, porque podem já ter passado do ponto, estar em outro trecho ou fora da rota.
4. **Fala sem ETA.** O avistamento informa a linha, o ponto monitorado, a referência mais próxima, quantas referências faltam e há quanto tempo o veículo foi visto. Exemplo: "575C sentido Vila Prudente, sem previsão da SPTrans: o ônibus mais próximo foi visto há 1 minuto perto da parada X, a 3 paradas do Ponto Casa." A fala **nunca** traz minutos até a chegada.
5. **Seleção.** Avistamentos não entram na ordenação por chegada nem no limite de 5 previsões ([ADR-0005](0005-arrival-selection.md)). A resposta anuncia no máximo um avistamento por associação, depois das previsões.
6. **Falhas.** Uma falha na consulta de posição de uma linha conta como falha parcial, com o mesmo isolamento do [ADR-0006](0006-partial-failure.md). Sem avistamento elegível, a resposta é "sem previsão e sem ônibus visto perto", nunca "não há ônibus".

### Hipóteses a validar
Os valores abaixo ainda não foram medidos.
- Frescor: 5 minutos, o mesmo valor proposto no spike.
- Raio: 300 m.
- Lista de referência: de 3 a 6 pontos.
- Formato da resposta de `Posicao/Linha`: não capturado em fixture até agora.

## Alternativas consideradas
- **A — Previsão de uma parada vizinha:** descartada, porque essas linhas não têm previsão em nenhuma parada.
- **C — Frequência programada (GTFS estático):** não é tempo real e exige empacotar e atualizar o GTFS. Pode ser revista depois como complemento da fala.
- **D — Estimativa por tempo de trajeto histórico:** fica **mapeada como evolução futura** (ver abaixo).
- **E — Provedor terceiro (Google, Moovit):** custo e termos de uso incertos, e o ADR-0001 já recusou o Google como fonte de ETA.
- **Delta ingênuo de distância/velocidade até o ponto:** gera um ETA sem base confiável e viola o "nunca inventar ETA".
- **Fallback automático** (consultar a posição sempre que a previsão vier vazia): custa chamadas extras em toda consulta e confunde "linha sem previsão na API" com "nenhum ônibus agora".

## Consequências
- As linhas principais passam a ter uma resposta útil e honesta sem adicionar persistência.
- O contrato cresce:
  - `TransportProvider` ganha a consulta de posições por linha;
  - `ArrivalResult` ganha os avistamentos;
  - os favoritos ganham `arrivalSource` e as listas de referência.
- O proprietário mantém as listas de referência à mão. Se o trajeto mudar, os avistamentos somem sem dar erro, então a validação de configuração deve no mínimo exigir lista ordenada e não vazia.
- A fala fica mais longa quando há previsões e avistamentos juntos; o tamanho precisa ser validado em dispositivo (#11).
- Se a SPTrans passar a publicar previsão dessas linhas, basta trocar `arrivalSource` para `forecast`, sem mudar código.

## Evolução futura: estimativa por tempo de trajeto histórico (opção D)
Fora do MVP. Registrada para não se perder.
- **Ideia:** coletar periodicamente as posições das linhas em modo `position` e aprender o tempo típico entre cada referência e o ponto monitorado por faixa horária e tipo de dia. Assim um avistamento viraria uma **estimativa** de chegada, rotulada como estimativa e nunca como previsão em tempo real.
- **Pré-requisitos:**
  - nova spec aprovada;
  - persistência e job de coleta (hoje proibidos pelas regras 6 e 7 do AGENTS.md);
  - critério de qualidade mínima (amostras e erro aceitável) antes de anunciar qualquer número;
  - revisão dos invariantes do CONTEXT para separar "estimativa histórica" de "previsão de chegada".
- **Dependências:** o avistamento deste ADR, que já define as referências e a associação ponto–linha que a coleta reutilizaria.

## Referência
[Spec do MVP](../specs/0001-alexa-bus-mvp.md) · [Spike 0001](../spikes/0001-sptrans-olho-vivo.md) · [ADR-0005](0005-arrival-selection.md) · [ADR-0006](0006-partial-failure.md) · [ADR-0008](0008-line-identity-per-direction.md)
