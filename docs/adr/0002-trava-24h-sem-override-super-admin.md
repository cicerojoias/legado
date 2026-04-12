# ADR-0002: Trava de 24h Sem Override de SUPER_ADMIN (MVP)

**Status:** Aceito
**Data:** 2026-03-07
**Fase:** 6.1 — Motor Financeiro Avançado

---

## Contexto

A regra de negócio define que lançamentos só podem ser editados/excluídos dentro de 24h após a criação e pelo próprio criador. A questão é: SUPER_ADMIN (Richard) deve ter poder de bypass dessa trava?

## Decisão

**No MVP, SUPER_ADMIN NÃO tem override da janela de 24h.** A mesma regra se aplica a todos os roles.

## Racional

1. **Simplicidade de implementação:** Uma única regra reduz branches de código e superfície de ataque.
2. **Princípio do menor privilégio:** Poder de bypass irrestrito é um vetor de risco — um SUPER_ADMIN comprometido poderia alterar registros financeiros retroativamente sem limitação.
3. **Estágio MVP:** O volume de lançamentos é pequeno. Casos extremos (erro após 24h) podem ser tratados por SQL direta pelo desenvolvedor no Supabase Studio durante o MVP.
4. **Conformidade financeira:** Dados além de 24h são considerados "fechados" — qualquer correção nesse ponto deveria gerar um lançamento de estorno, não uma edição silenciosa.

## Alternativas Consideradas

| Opção | Prós | Contras |
|---|---|---|
| **SUPER_ADMIN bypassa 24h** | Flexibilidade operacional | Risco de abuso, código mais complexo, superfície de ataque maior |
| **SUPER_ADMIN cria "estorno"** | Trilha de auditoria completa | Requer feature extra (Fase 7) |
| **Mesma trava para todos (escolhida)** | Simples, seguro, auditável | Menos flexível |

## Consequências

**Positivas:**
- Código de autorização uniforme sem branches por role
- Trilha de auditoria imutável após 24h

**Negativas:**
- Correções de erros após 24h exigem intervenção manual no banco

**Revisão futura:** Na Fase 7 (Relatórios), considerar implementar "Lançamento de Estorno" como mecanismo formal de correção retroativa com aprovação dupla.
