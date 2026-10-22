# ADR-0008 — Identidade de linha favorita por sentido

- **Status:** Aceito
- **Data:** 2026-10-22

## Contexto
O [spike 0001](../spikes/0001-sptrans-olho-vivo.md) mostrou que o Olho Vivo identifica a linha **por sentido**: o código interno `cl` muda conforme o sentido (875A: `609` no sentido 1 e `33377` no sentido 2). As previsões trazem `cl`, `sl` (sentido) e `c` (letreiro, ex.: `875A-10`). Uma consulta combinada com o `cl` do sentido oposto retorna vazio.

## Decisão
`FavoriteLine.id` passa a ser o código `cl` do provedor, ou seja, **uma entrada por sentido**. O `label` deve usar o letreiro `c`, complementado pelo destino quando os dois sentidos forem favoritos (ex.: "875A sentido Aeroporto"). O campo `direction` torna-se opcional e redundante: o sentido já está implícito em `id`. O adaptador SPTrans (#5) mapeia `cl` → `lineId` sem tradução.

## Alternativas consideradas
- `id` = letreiro + `direction = sl`. Mantém o contrato anterior, mas exige que o adaptador traduza `cl` → (`c`, `sl`), um mapeamento frágil que duplica a identidade do provedor.

## Consequências
- O adaptador fica mais simples, e o filtro par ponto–linha já garante o sentido correto.
- Para monitorar os dois sentidos de uma linha são necessárias duas entradas em `lines`, cada uma com rótulo e aliases distintos. A resolução por voz (#6) precisa desambiguar o sentido quando o usuário disser só o letreiro.
- Os códigos `cl` precisam ser obtidos com `Linha/Buscar` (ou com o spike) e conferidos antes do uso.
- A remoção do campo `direction` do código fica para quando o #5 confirmar que nenhum fluxo depende dele.

## Referência
[Spec do MVP](../specs/0001-alexa-bus-mvp.md) · [Spike 0001](../spikes/0001-sptrans-olho-vivo.md) · [ADR-0002](0002-favorites-configuration.md)
