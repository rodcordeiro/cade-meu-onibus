# ADR-0001 — SPTrans como provedor inicial

- **Status:** Aceito
- **Data:** 2026-10-22

## Contexto
Previsões em São Paulo exigem identificadores e dados oficiais; Google Maps não garante acesso a ETAs reutilizáveis.

## Decisão
Integrar primeiro com a API Olho Vivo por códigos de ponto e linha SPTrans; isolar via TransportProvider. Atraso só com horário programado confiável.

## Alternativas consideradas
Usar Google Maps como fonte de ETA; agregar vários operadores já no MVP.

## Consequências
Reduz escopo e dependências; cobertura da API e contratos devem ser validados; troca de provedor exige apenas novo adaptador.

## Referência
[Spec do MVP](../specs/0001-alexa-bus-mvp.md)
