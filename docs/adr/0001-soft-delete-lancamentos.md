# ADR-0001: Soft-Delete para Lançamentos Financeiros

**Status:** Aceito
**Data:** 2026-03-07
**Fase:** 6.1 — Motor Financeiro Avançado

---

## Contexto

O sistema precisa permitir que usuários removam lançamentos incorretos. A questão arquitetural é: o registro deve ser fisicamente deletado do banco ou marcado como inativo?

O módulo financeiro tem requisito implícito de auditoria — dados financeiros não devem desaparecer sem rastro, mesmo que sejam erros.

## Decisão

Adotar **soft-delete** via coluna `deletado_at DateTime?` no model `Lancamento`.

- `deletado_at = null` → registro ativo (aparece em todas as listagens)
- `deletado_at = timestamp` → registro excluído (invisível nas listagens, rastreável nos logs)

## Opções Consideradas

| Opção | Prós | Contras |
|---|---|---|
| **Hard delete** (DELETE SQL) | Simples, sem colunas extras | Sem auditoria, irrecuperável, viola conformidade financeira |
| **Soft-delete com `deletado_at`** | Auditabilidade, recuperável, sem perda de dados | Requer filtro `WHERE deletado_at IS NULL` em todas as queries |
| **Tabela `lancamentos_deletados`** | Separação limpa | Complexidade de sincronização, 2 tabelas para gerenciar |

## Consequências

**Positivas:**
- Dados financeiros históricos preservados mesmo após "exclusão"
- Registro de `deleted_at` no `Log` com snapshot completo do registro
- Conformidade com auditoria financeira e possível LGPD (direito de retificação, não de apagamento de dados contábeis)
- Recuperação possível por SUPER_ADMIN via SQL direta se necessário

**Negativas:**
- Todas as queries devem incluir `WHERE deletado_at IS NULL` — esquecimento gera bug silencioso
- Índice composto `[loja, data_ref, deletado_at]` adicionado para compensar o custo de filtragem

**Riscos:**
- Queries sem o filtro retornam dados "deletados" — mitigado pelo code review e pelo índice que torna o padrão explícito
