# Contexto de domínio — Cadê Meu Ônibus?

## Objetivo

Consultar por voz a chegada prevista de ônibus em pontos previamente escolhidos na cidade de São Paulo.

## Linguagem ubíqua

| Termo                  | Definição                                                                                                                              | Distinção                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Ponto monitorado       | Parada específica cadastrada para acompanhamento, com identificador oficial e apelido amigável.                                        | Não é qualquer coordenada do mapa.                             |
| Linha favorita         | Serviço de ônibus escolhido para acompanhamento em um ou mais pontos monitorados.                                                      | Identidade e sentido devem ser distinguidos quando necessário. |
| Associação ponto–linha | Vínculo que determina quais linhas consultar em um ponto monitorado.                                                                   | Uma linha pode aparecer em vários pontos.                      |
| Previsão de chegada    | Estimativa temporal de passagem de determinado veículo por um ponto monitorado.                                                        | Não é horário programado nem confirmação de chegada.           |
| Janela de consulta     | Intervalo futuro elegível de zero a trinta minutos a partir da referência temporal da consulta.                                        | Previsões fora da janela não são anunciadas.                   |
| Consulta geral         | Pergunta sem filtro explícito de linha ou de ponto, abrangendo todos os favoritos.                                                     | Resposta contém até cinco previsões globalmente ordenadas.     |
| Consulta específica    | Pergunta que restringe o resultado a uma linha, a um ponto ou a ambos.                                                                 | Continua submetida às regras da janela e do limite.            |
| Contexto de conversa   | Referências a linha e ponto mencionados na sessão atual.                                                                               | Não se confunde com preferências permanentes.                  |
| Resultado parcial      | Resposta com previsões válidas de alguns pontos mesmo se outros não puderam ser consultados.                                           | Não equivale a disponibilidade total.                          |
| Previsão desatualizada | Estimativa cuja atualidade não pode ser assegurada.                                                                                    | Não deve ser anunciada como tempo real.                        |
| Atraso/adiantamento    | Desvio entre referência programada confiável e passagem estimada.                                                                      | Não pode ser inferido apenas do tempo restante.                |
| Ponto de referência    | Parada pública do trajeto de uma linha favorita, anterior a um ponto monitorado, usada para localizar veículos em aproximação.         | Não é ponto monitorado nem endereço pessoal.                   |
| Avistamento            | Última posição observada e recente de um veículo de linha favorita, próxima de um ponto de referência que antecede o ponto monitorado. | Não é previsão de chegada: não tem instante de chegada.        |

## Regras invariantes

1. Uma previsão elegível precisa ser válida, futura (ou de passagem iminente) e estar no horizonte de 30 minutos.
2. Agregar previsões elegíveis dos pontos selecionados, ordenar pelo instante de chegada e limitar a cinco; empates devem ter ordenação estável e determinística.
3. Cada previsão anunciada identifica linha e ponto, inclusive quando linhas iguais aparecem em pontos distintos.
4. Falha de um ponto não apaga previsões válidas de outros; ausência de dados não equivale a ausência de ônibus.
5. Contexto da conversa vale somente na sessão corrente; um novo pedido sem contexto explícito volta à consulta geral.
6. Não anunciar atraso ou adiantamento sem horário programado confiável para a mesma linha, sentido e passagem.
7. Avistamento nunca é convertido em tempo de chegada nem anunciado como previsão; a fala informa a referência próxima e há quanto tempo o veículo foi visto. Sem avistamento recente, não se conclui que não há ônibus.

## Limites semânticos

A descoberta geográfica de paradas não faz parte da consulta rotineira do MVP. A interpretação de códigos e a disponibilidade de dados são responsabilidades do provedor de transporte.
