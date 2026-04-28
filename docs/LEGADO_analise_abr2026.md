# LEGADO — Análise de Melhorias (Abril/2026)

> Auditoria estratégica realizada em 2026-04-28, ao final da v0.18.39.
> Base: `LEGADO_soul.md`, `LEGADO_roadmap.md`, `melhorias.md` e estrutura atual do código.

---

## Contexto atual

| Frente | Status |
|---|---|
| Fase 1 — MVP Financeiro | ✅ Concluída, em produção |
| WhatsApp Pro (Fases 1–4) | ✅ Inbox, mídias, IA responder, long-press desktop (v0.18.39) |
| Auditoria `melhorias.md` | 10/11 itens fechados (item 11 feito na v0.18.38, falta marcar) |
| Próxima fase planejada | Operação Visível (Mai–Jun/2026) — Ordens de Serviço |

**Diagnóstico:** dívida técnica saudável. O risco agora não é técnico, é de negócio — o sistema registra, mas ainda não responde à pergunta-chave do `LEGADO_soul.md`: *"por que sobra zero no fim do ano?"*.

---

## Ranking de Melhorias

### 🔴 Prioridade 1 — Fechar o loop financeiro antes de novos módulos

#### 1. Conciliação Mercado Pago via API
- **Esforço:** Alto
- **Impacto:** Crítico
- **Impacto financeiro:** Alto — torna visível em qual categoria o dinheiro vaza
- **Justificativa:** O extrato MP é a fonte da verdade do problema central. Hoje os lançamentos no app são manuais e podem divergir do extrato. Sem conciliação automática, Cícero continua "achando" — não sabendo. Resolve a causa-raiz documentada em `LEGADO_soul.md`.
- **Dependências:** API Mercado Pago, mapeamento categorias MP → categorias do app

#### 2. Pró-labore + alerta de retirada pessoal
- **Esforço:** Baixo
- **Impacto:** Alto
- **Impacto financeiro:** É o ROI do projeto inteiro. Sem isso, o sistema é um caderno bonito
- **Justificativa:** Já está no escopo do MVP (`LEGADO_soul.md` linha 144) mas não foi implementado. Categoria `Retirada Pessoal` existe; falta o limite mensal configurável e o alerta quando ultrapassa. É a feature que literalmente separa "dinheiro da empresa" de "dinheiro do Cícero".
- **Escopo mínimo:** campo `proLaboreMensal` em `User`/configuração, soma mensal de `Retirada Pessoal` por usuário, badge no `/hoje` quando passa do limite

#### 3. Relatório de margem por categoria de serviço
- **Esforço:** Médio
- **Impacto:** Alto
- **Impacto financeiro:** Direciona mix de serviço para o que realmente lucra
- **Justificativa:** A Fase 4 do roadmap já prevê isso (`"Banho de ouro tem margem 3x maior que venda — priorize"`). Não precisa esperar até set/2026 — os dados já estão sendo coletados desde abril. Antecipar para maio dá munição para decisões de mix de serviço.
- **Escopo mínimo:** página em `/relatorios` agrupando entradas por categoria, comparando com saídas alocáveis (matéria-prima, etc.)

---

### 🟡 Prioridade 2 — Iniciar Módulo 2 (Ordens de Serviço) com escopo enxuto

#### 4. Módulo OS — versão mínima
- **Esforço:** Médio
- **Impacto:** Alto
- **Impacto financeiro:** Reduz "peças esquecidas" e clientes perdidos por atraso
- **Justificativa:** Começar com o mínimo: cliente (telefone), peça, prazo, valor, status (4 estados: Aguardando → Em andamento → Pronto → Entregue). Crítico: integrar com a inbox WhatsApp — quando vira OS, salvar `conversationId` para vincular histórico. Sem essa integração, vira mais um silo. Hoje é memória do Richard.
- **Modelo enxuto:** `OrdemServico { id, clienteId?, conversationId?, descricaoPeca, servico, valor, prazo, status, criada_at }`

#### 5. Vínculo Conversa ↔ Cliente
- **Esforço:** Baixo
- **Impacto:** Médio
- **Impacto financeiro:** Indireto — base para CRM (fase 4) e fidelização
- **Justificativa:** Hoje a inbox tem `Conversation` mas não há entidade `Cliente`. Antes do CRM completo (Módulo 3, fase 4), criar uma tabela `Cliente` simples (nome, telefone, primeira_compra) já permite o histórico que o Richard hoje gerencia "na cabeça" — problema explícito no `soul.md` linha 95.
- **Escopo mínimo:** tabela `Cliente`, FK opcional em `Conversation` e `OrdemServico`, botão "Vincular cliente" no header do chat

---

### 🟢 Prioridade 3 — Quick wins técnicos

#### 6. Instrumentação de custo da OpenAI no painel
- **Esforço:** Baixo
- **Impacto:** Médio
- **Impacto financeiro:** Previne surpresas na fatura OpenAI conforme o uso cresce
- **Justificativa:** Já existe `TOKEN_BUDGET_PER_CONVERSATION` (in-memory) em `ai-responder.ts`. Falta persistir no DB e expor um card no `/dashboard` com gasto mensal projetado. Sem isso, o budget é invisível para o Richard.
- **Escopo mínimo:** tabela `OpenAIUsage { conversationId, inputTokens, outputTokens, cost, created_at }`, card no dashboard SUPER_ADMIN

#### 7. Marcar item 11 da `melhorias.md` como concluído
- **Esforço:** Trivial
- **Impacto:** Higiene
- **Justificativa:** O type guard `isAuthError` foi feito na v0.18.38 mas o checklist segue como ❌ Pendente.

#### 8. Backup automatizado do Supabase
- **Esforço:** Baixo
- **Impacto:** Alto (latente)
- **Impacto financeiro:** Seguro contra perda total de dados financeiros
- **Justificativa:** Sistema agora é fonte da verdade financeira. Se o DB morrer, perde-se mais que o caderno. Configurar `pg_dump` agendado (Vercel Cron + Supabase Storage ou bucket externo).

---

### ⚪ Prioridade 4 — Adiar (contradiz "simples primeiro" do roadmap)

| Item | Por que adiar |
|---|---|
| Módulo 3 CRM completo | Esperar Fase 4 — cliente simples (item 5) já cobre |
| Migração / refactor de schema | Schema atual está adequado |
| PWA / app nativo | Mobile-first responsivo já cobre o caso de uso do Cícero |
| Migração para AI Gateway / múltiplos providers | Só vale se OpenAI ficar caro/instável |
| Upload de foto do caderno + Gemini OCR | Pós-conciliação MP — eventualmente perde sentido |

---

## Recomendação Executiva

**Não começar o Módulo 2 ainda.** Os 3 itens da Prioridade 1 fecham a promessa original do MVP (*"sobrar mais que zero no fim do ano"*). Eles são pequenos individualmente e juntos transformam o sistema de **"registro digital"** em **"ferramenta de decisão financeira"** — que é o que o `LEGADO_soul.md` define como sucesso.

### Sequência sugerida (próximas 2–3 semanas)

| Ordem | Item | Tempo estimado | Resultado |
|---|---|---|---|
| 1 | Pró-labore + alerta de retirada (#2) | 2 dias | ROI imediato visível |
| 2 | Marcar item 11 + backup (#7, #8) | 1 dia | Housekeeping |
| 3 | Conciliação MP — read-only → automática (#1) | 1 semana | Visão real do caixa |
| 4 | Relatório de margem por categoria (#3) | 3 dias | Decisão de mix |
| 5 | Cliente + vínculo conversa (#5) | 2 dias | Base para OS |
| 6 | OS — versão mínima (#4) | 1 semana | Início Fase 2 |
| 7 | Instrumentação OpenAI (#6) | 2 dias | Custo visível |

Isso entrega *"Cícero sabe quanto pode retirar por mês"* — métrica explícita da Fase 2 do roadmap — antes de adicionar superfície nova.

---

## Critérios de Avaliação Aplicados

| Critério | Como foi avaliado |
|---|---|
| Dificuldade técnica | Trivial / Baixo / Médio / Alto, considerando complexidade e dependências externas |
| Impacto / importância | Higiene / Médio / Alto / Crítico, ancorado nos objetivos de `LEGADO_soul.md` |
| Impacto financeiro | Direto (ROI mensurável) ou indireto (habilitador) |
| Necessidade de novos módulos | Avaliada vs. Módulos 1–4 já planejados — só item 4 (OS) é módulo novo, no escopo previsto |
| Performance / escalabilidade | Item separado em `melhorias.md` — quase tudo já fechado |
| Manutenibilidade | Itens 7 e 8 cobrem; refactors maiores adiados |

---

*Documento criado em: 2026-04-28 — base para revisão no início de Mai/2026.*
*Atualizar ao final de cada sprint conforme itens forem entregues.*
