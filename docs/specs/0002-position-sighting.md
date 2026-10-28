# SPEC-0002 — Avistamento por posição para linhas sem previsão

Status: **Ready for implementation, pending position fixture**  
Data: 2026-10-27  
Origem: [ADR-0009](../adr/0009-position-fallback.md); complementa a [SPEC-0001](0001-alexa-bus-mvp.md) sem alterar as regras de previsão.

## Problema
As linhas mais importantes do proprietário são a 575C-10 e a 407Y-10, sentido Vila Prudente. Segundo relato dele em 27/10/2026, nenhuma parada dessas linhas recebe previsão da SPTrans, embora a posição dos veículos continue publicada. Com a SPEC-0001, a skill responderia "nenhuma previsão disponível" justamente para essas linhas. A pessoa fica sem informação útil e continua abrindo outro aplicativo para ver onde o ônibus está.

## Solução
O proprietário marca no arquivo de favoritos as linhas que só têm posição. Para cada uma, cadastra algumas paradas públicas que vêm antes do ponto monitorado, em ordem de aproximação. Quando a consulta envolve essas linhas, a skill diz onde o ônibus mais próximo **foi visto**, quantas paradas de referência faltam até o ponto e há quanto tempo foi a observação. A fala **nunca** traz minutos até a chegada. As previsões das outras linhas continuam iguais, e os avistamentos vêm depois delas.

## Histórias de usuário
1. As a commuter, I want to hear where the nearest approaching bus of a position-only line was last seen, so that I can decide when to leave even without official predictions.
2. As a commuter, I want the sighting to name a public stop I recognize, so that I can picture how far the bus is.
3. As a commuter, I want to hear how many reference stops remain until my stop, so that I can gauge the distance without an invented time.
4. As a commuter, I want to hear how long ago the bus was seen, so that I can judge how current the information is.
5. As a commuter, I want the skill to say explicitly that the line has no SPTrans prediction, so that I do not mistake a sighting for an arrival estimate.
6. As a commuter, I want never to hear "minutes until arrival" for position-only lines, so that I am not misled by invented ETAs.
7. As a commuter, I want buses that have already passed my stop to be ignored, so that I do not run for a bus that is gone.
8. As a commuter, I want buses that are far away or off the route to be ignored, so that the answer stays relevant.
9. As a commuter, I want old positions to be ignored, so that stale data is not presented as current.
10. As a commuter, I want only the bus closest to my stop to be announced per line and stop, so that the answer stays short.
11. As a commuter, I want regular predictions announced first and sightings afterwards, so that the most precise information comes first.
12. As a commuter, I want sightings not to push predictions out of the five-arrival limit, so that the general query keeps its behavior.
13. As a commuter, I want a clear "no prediction and no bus seen nearby" message when nothing qualifies, so that I do not conclude that there is no bus.
14. As a commuter, I want a failure to fetch positions of one line not to hide predictions or sightings of other lines, so that a partial outage does not block my request.
15. As a commuter, I want to know when the answer is partial because a line's positions failed, so that I can judge its reliability.
16. As a commuter, I want to ask about a position-only line by name, so that I hear only that line's sighting.
17. As a commuter, I want to ask about a stop and hear both its predictions and its sightings, so that I see everything relevant to that stop.
18. As a commuter, I want follow-up questions in the same session to keep working for position-only lines, so that I do not repeat the line or stop.
19. As a commuter, I want each sighting to identify line and stop, so that I do not confuse the same line at different stops.
20. As a skill owner, I want to mark a line as position-only in the favorites file, so that I control which lines use sightings without code changes.
21. As a skill owner, I want to switch a line back to predictions by changing one field, so that the skill benefits if SPTrans starts publishing forecasts.
22. As a skill owner, I want to list public reference stops per line and stop in approach order, so that sightings are relative to my route.
23. As a skill owner, I want the skill to refuse to start when a position-only line lacks a valid reference list, so that misconfiguration fails loudly instead of silently returning nothing.
24. As a skill owner, I want reference stops limited to public stops, so that no residential coordinates are stored.
25. As a skill owner, I want sanitized fixtures of the position endpoint, so that the adapter is verified without real credentials.
26. As a skill owner, I want freshness and radius thresholds kept as named, documented values, so that I can tune them after field measurements.

## Decisões de implementação
- **Origem por linha:** `FavoriteLine` ganha `arrivalSource: "forecast" | "position"`, com padrão `forecast`. Linhas `position` não entram na consulta de previsão. Não há fallback automático ([ADR-0009](../adr/0009-position-fallback.md)).
- **Configuração de aproximação:** `MonitoredStop` ganha `approaches`, uma lista de `{ lineId, references }`. `references` lista `ReferencePoint { name, lat, lon }` em ordem de aproximação e termina no próprio ponto monitorado. O carregamento de favoritos rejeita a configuração quando:
  - uma linha `position` associada ao ponto não tem `approaches`;
  - a lista de referências está vazia;
  - `lineId` não pertence ao ponto;
  - há coordenadas inválidas.
- **Porta do provedor:** `TransportProvider` ganha `getVehiclePositions(lineId, context)`, que devolve `VehiclePosition { lineId, vehicleId, lat, lon, observedAt }`. A consulta é uma por linha, e não por ponto, porque a posição vem por linha. O adaptador SPTrans usa `Posicao/Linha?codigoLinha={cl}`, reaproveitando a sessão e cookie, o novo login após 401, o timeout e a regra de não registrar credenciais em log já definidos para a previsão.
- **Política de avistamento (domínio, pura e sem I/O):** recebe as posições, a lista de referências e o `now`, e devolve no máximo um `VehicleSighting { stopId, lineId, vehicleId, referenceName, referencesRemaining, observedAt }` por associação. As regras são:
  - descartar observações além do limite de frescor;
  - relacionar cada veículo à referência mais próxima dentro do raio;
  - ignorar veículos fora de todos os raios;
  - eleger o veículo com menor `referencesRemaining` e, no empate, o de `observedAt` mais recente e depois o menor `vehicleId`, para a ordem ser determinística.

  A distância é calculada por haversine, sem nenhuma dependência nova.
- **Limites como hipótese:** frescor de 5 min (com tolerância de 60 s para relógio adiantado, compartilhada com a previsão), raio de 300 m e folga de 50 m para o ônibus que já passou do ponto, como constantes nomeadas do domínio. Os valores serão revistos depois da captura de campo.
- **Serviço de aplicação:**
  - aplica os mesmos filtros de linha, ponto e sessão às associações `forecast` e `position`;
  - consulta os pontos (previsão) e as linhas (posição) com a mesma concorrência limitada e o mesmo deadline total;
  - registra falhas por linha em `failedLineIds`;
  - calcula `status` considerando falhas de pontos e de linhas.
- **Resultado:** `ArrivalResult` ganha `sightings`, `positionAssociations` e `failedLineIds`. `positionAssociations` é uma lista de `StopLineAssociation { stopId, lineId }` com as associações `position` no escopo da consulta cujas posições foram obtidas, com ou sem avistamento elegível; associações de linhas em `failedLineIds` ficam de fora. A fala usa essa lista para dizer "sem previsão e sem ônibus visto perto" quando a linha respondeu sem veículo elegível, distinguindo esse caso da falha de consulta. Faz parte do contrato do resultado, tanto quanto `sightings`. Previsões, janela, limite de 5 e `outsideWindowCount` continuam como estão. Avistamentos não têm `arrivalAt` e não entram na ordenação de chegadas.
- **Fala:** depois das previsões, uma frase por avistamento com linha, ponto, referência, referências restantes e idade da observação, além da menção explícita de que a linha não tem previsão da SPTrans. Sem avistamento elegível, a frase é "sem previsão e sem ônibus visto perto". O texto exato é definido no ticket da fala e validado em dispositivo.
- **Sessão:** não muda. Os filtros de linha e ponto da sessão valem para avistamentos do mesmo jeito que para previsões.

## Decisões de teste
- **Seam único: o handler Alexa** com eventos simulados e um provedor fake, como em `general-arrivals` e `arrival-outcomes`. O fake ganha respostas de posição por linha, incluindo falhas, e registra essas chamadas. Os testes verificam só o texto falado e as consultas feitas, nunca detalhes internos.
- O adaptador SPTrans usa o seam já existente de HTTP falso com fixtures sanitizadas (padrão de `sptrans-fixtures`), agora com a resposta de `Posicao/Linha`.
- A validação de favoritos segue o padrão de `favorites-config`.
- Casos obrigatórios no handler:
  - avistamento com referência e idade;
  - nenhum veículo elegível;
  - posição antiga;
  - veículo fora de todos os raios;
  - vários veículos, anunciando o mais próximo do ponto;
  - empate;
  - falha de posição com outras linhas íntegras (resultado parcial);
  - todas as consultas falhando;
  - linha `position` filtrada por voz;
  - ponto com linhas `forecast` e `position` juntas (previsões primeiro, limite de 5 preservado);
  - continuação na mesma sessão;
  - nenhuma fala de avistamento contendo "minutos" como tempo até a chegada.
- Testes contra a API real são opt-in, como na SPEC-0001.

## Fora de escopo
- Qualquer ETA calculado a partir de posição, seja por distância e velocidade ou por tempo de trajeto histórico. Este último está mapeado como evolução futura no [ADR-0009](../adr/0009-position-fallback.md).
- Fallback automático de previsão para posição.
- Usar o GTFS em tempo de execução, por exemplo para shapes, `stop_times` ou frequência programada.
- Descoberta automática das paradas de referência, persistência, coleta periódica, mapa e notificações.
- Atraso ou adiantamento, que continuam bloqueados pelo invariante 6 do [CONTEXT](../../CONTEXT.md).

## Notas adicionais
- **Pré-requisito de evidência:** ainda não existe fixture de `Posicao/Linha` nem de previsão vazia das duas linhas. A captura vem antes do adaptador (risco 6 da SPEC-0001).
- **Estado atual da configuração:** `config/favorites.json` já declara `arrivalSource` em linhas locais, mas ainda não tem `approaches`. Há dois pontos com o mesmo id provisório (`EXEMPLO-PONTO-2`), o que deve falhar quando a validação de favoritos for aplicada. Preencha os códigos reais antes do deploy.
- **Escolha das referências:** o GTFS local em `assets/gtfs/`, ignorado pelo git, pode ajudar o proprietário a escolher paradas e coordenadas **fora** do runtime (`stops.txt`, `shapes.txt`). O artefato da Lambda continua sem o GTFS.
- **Fixtures de `Posicao/Linha` (#16):** as fixtures capturadas não têm `px`/`py` de propósito, porque as posições reais ficam perto do ponto do proprietário e revelariam um endereço residencial. O mapeamento `py` → latitude e `px` → longitude foi validado com payloads sintéticos; a primeira captura de campo com coordenadas deve confirmá-lo, sem versionar coordenadas reais.
- **Responsabilidade do proprietário sobre as referências:** o carregamento de favoritos não consegue verificar que a lista de referências termina no ponto monitorado, porque `MonitoredStop` não tem coordenadas. Cabe ao proprietário garantir que a última referência seja o próprio ponto; caso contrário, "já junto ao ponto" e a heurística de ônibus que já passou ficam incorretas.
- **Linguagem:** os termos "Avistamento" e "Ponto de referência" e o invariante 7 estão no [CONTEXT.md](../../CONTEXT.md).
