# Spike 0001: contrato real da API SPTrans Olho Vivo

- **Issue:** [#3](https://github.com/rodcordeiro/cade-meu-onibus/issues/3)
- **Data da captura:** 2026-10-22, por volta das 15:50 (horário de São Paulo), dia útil à tarde
- **Base:** `https://api.olhovivo.sptrans.com.br/v2.1`
- **Evidência:** fixtures sanitizadas em [`test/fixtures/sptrans/`](../../test/fixtures/sptrans/), validadas por `test/sptrans-fixtures.test.ts`
- **Reprodução:** `node --env-file=.env scripts/sptrans-probe.mjs <dir-fora-do-repo>`, depois `node scripts/sptrans-sanitize.mjs <dir>`. A sonda escolhe as paradas pela busca (`Paulista`, `875A`); outra execução pode capturar paradas diferentes das citadas aqui.

Paradas usadas: públicas, na região da Av. Paulista e da Consolação (`260015039` PAULISTA B/C e `260016861` CAIO PRADO B/C). Nenhuma tem relação com endereço residencial.

## Autenticação

| Situação | Resposta |
| --- | --- |
| `POST /Login/Autenticar?token=<válido>` | `200`, corpo `true`, e `Set-Cookie` com a credencial de sessão (não versionado de propósito; evidência no log da sonda) |
| `POST /Login/Autenticar?token=<inválido>` | `200`, corpo `false` (**não** retorna 401); fixture `login-token-invalido.json` |
| Consulta sem cookie de sessão | `401` com `{"Message":"Authorization has been denied for this request."}` |

Consequências para o adaptador (#5):
- Login bem-sucedido é corpo `true`, não status HTTP.
- Todas as consultas precisam reenviar o cookie.
- 401 em consulta deve disparar um novo login, com uma única tentativa.
- A duração da sessão **não foi medida**: trate como desconhecida e use o 401 como sinal de expiração.
- O cookie e o token nunca devem aparecer em logs.

## Previsão por parada (`GET /Previsao/Parada?codigoParada={cp}`)

Uma chamada retorna **todas as linhas** com veículos previstos na parada. A linha 875A, por exemplo, aparece igual na consulta por parada e na consulta combinada parada+linha. Por isso basta uma chamada por ponto monitorado, o que é compatível com `TransportProvider.getArrivals(stopId)`.

```json
{
  "hr": "15:50",
  "p": {
    "cp": 260016861, "np": "CAIO PRADO B/C", "py": 0, "px": 0,
    "l": [
      {
        "c": "875A-10", "cl": 609, "sl": 1, "lt0": "PERDIZES", "lt1": "AEROPORTO", "qv": 6,
        "vs": [{ "p": "64488", "t": "16:11", "a": true, "ta": "2026-10-22T18:50:37Z", "py": 0, "px": 0, "sv": null, "is": null }]
      }
    ]
  }
}
```

### Campos e mapeamento para `ArrivalPrediction`

| Campo | Significado observado | Mapeamento |
| --- | --- | --- |
| `hr` | Hora da geração da resposta, `HH:mm`, no fuso de São Paulo, **sem data e sem segundos** | Referência para resolver a data de `t` |
| `p.cp` | Código da parada (número) | `stopId` (como string) |
| `p.np` | Nome da parada | Não usado (o apelido vem dos favoritos) |
| `l[].cl` | Código interno da linha, **um por sentido** (875A: `609` no sentido 1, `33377` no sentido 2) | `lineId` |
| `l[].sl` | Sentido: `1` (terminal principal → secundário) ou `2` (volta) | `direction` |
| `l[].c` | Letreiro completo, ex.: `875A-10` | Rótulo sugerido para `FavoriteLine.label` |
| `l[].lt0` / `l[].lt1` | Terminais de origem e destino | Não usado |
| `l[].qv` | Quantidade de veículos | Não usado |
| `vs[].p` | Prefixo do veículo | `vehicleId` |
| `vs[].t` | Horário previsto de chegada, `HH:mm`, fuso de São Paulo, **sem data e sem segundos** | `arrivalAt`, depois de resolver a data |
| `vs[].ta` | Instante da última posição do veículo, ISO 8601 em UTC | `observedAt` |
| `vs[].a` | Veículo acessível | Não usado |
| `vs[].px` / `vs[].py` | Posição do veículo | Não usado (zerado nas fixtures) |
| `vs[].sv` / `vs[].is` | Sempre `null` na amostra; significado não documentado | Ignorar |

### Fuso e resolução de horário
- `hr = 15:50` com cabeçalho `Date: 18:50 GMT` confirma o fuso de São Paulo (UTC−3, sem horário de verão desde 2019).
- `t` só tem hora e minuto. A precisão é de minuto, então o tempo anunciado pode errar até cerca de 1 minuto.
- **Virada de dia:** o horário não vem com data. Hipótese para o #5: se `t` estiver mais de 12 h antes de `hr`, considerar o dia seguinte. Esse caso não foi observado e precisa de teste com fixture sintética.
- As previsões chegam a cerca de 75 min à frente, então o filtro de janela de 0 a 30 min é necessário.

### Atualidade
`ta` variou de 0 a 90 s antes da captura. Isso permite detectar previsão desatualizada (#8). O **limite de frescor não está definido**: a hipótese é rejeitar `ta` com mais de 5 min, a validar com mais amostras.

## Previsão combinada (`GET /Previsao?codigoParada={cp}&codigoLinha={cl}`)
- Tem o mesmo formato, filtrado para uma linha.
- Com o `cl` do sentido oposto, retorna `{"hr":"15:50","p":null}`. Isso confirma que o `cl` já identifica o sentido.

## Casos vazios e falhas

| Caso | Resposta |
| --- | --- |
| Parada inexistente (`999999999`) | `200` com `p: null` |
| Linha que não passa na parada, ou sentido oposto | `200` com `p: null` (fixture `previsao-parada-linha-sentido-oposto.json`) |
| Parada real sem nenhuma previsão | **Não capturado.** Inferência: `p: null`, como nos casos acima |
| Código não numérico (`abc`) | `400` com `{"Message":"The request is invalid."}` |
| Sem sessão | `401` |

**Atenção:** "parada inexistente" e "linha sem previsão na parada" são **indistinguíveis** (ambas `p: null`); para "parada real sem previsões" isso é inferência, a confirmar de madrugada. Para a SPEC, `p: null` deve virar "nenhuma previsão disponível", nunca "não há ônibus". Um código de parada errado nos favoritos fica silencioso; a mitigação é validar os códigos na configuração com `Parada/Buscar` ou com este spike.

## Latência e limites
- **Latência:** de 20 a 300 ms por chamada (campo `elapsedMs` das fixtures) a partir de São Paulo (uma única rodada; a Lambda ficará em outra rede). Isso é compatível com um deadline total de poucos segundos, mas o valor concreto fica para o #8.
- **Limite de taxa:** não há cabeçalhos de limite e não foi observado. A API não foi estressada de propósito.

## Cobertura
- `Parada/BuscarParadasPorLinha` (linha 609) retornou só 6 paradas (`paradas-por-linha.json`), enquanto `Previsao/Linha` retornou 15 (`previsao-linha.json`). Portanto, a lista de paradas por linha **não é exaustiva**.
- Use o código da parada vindo da previsão ou da busca, não dessa lista.
- Uma única amostra, em horário de pico da tarde. Madrugada, fim de semana e outros pontos não foram avaliados.

## Horário programado e atraso
**Não há fonte confiável no Olho Vivo.**
- A previsão não traz horário programado.
- `sv` e `is` vieram nulos e não têm documentação.
- O GTFS estático da SPTrans existe, mas não foi comprovada uma associação confiável entre a viagem programada e o veículo (`p`).
- Conforme o invariante 6 do CONTEXT e o ADR-0001, **o MVP não anuncia atraso nem adiantamento**, e `scheduledAt` fica sempre ausente.

## Recomendações para o #5
1. **Decisão pendente (exige ADR no #5):** a identidade de linha do provedor é por sentido (`cl`). Opções:
   - (a) `lines[].id = cl`, uma entrada por sentido, e `direction` redundante. É simples no adaptador, mas exige aliases por sentido para a voz.
   - (b) `id` = letreiro `c` + `direction = sl`. Mantém o contrato atual, mas o adaptador precisa mapear `cl` → (`c`, `sl`).
   Isso altera a semântica de `FavoriteLine` (SPEC, ADR-0002), então não está decidido aqui.
2. Adaptador:
   - fazer login lazy;
   - guardar o cookie em memória durante a vida da Lambda;
   - repetir uma vez em caso de 401;
   - tratar 400 e erros de rede como falha da parada;
   - tratar `p: null` como lista vazia.
3. Monte `arrivalAt` a partir de `hr` + `t`, no fuso de São Paulo e com a regra de virada de dia, e `observedAt` a partir de `ta`.
4. Antes de usar os códigos reais em `config/favorites.json`, confira cada um com este spike.
