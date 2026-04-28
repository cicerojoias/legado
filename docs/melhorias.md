# Melhorias Identificadas — Legado Cicero Joias

> Auditoria realizada em 2026-04-11. Ordenada por impacto.

---

## Crítico

### ~~1. Rate limiter efêmero (memória volátil)~~ ✅ concluído em 2026-04-11
**Arquivo:** `src/lib/rate-limit.ts`

O store é um `Map` em memória que zera a cada cold start serverless. Um atacante pode fazer 4 tentativas de PIN, aguardar reinício da instância e repetir indefinidamente — contornando o bloqueio de `User.bloqueado_ate`.

**Fix:** Migrar para Upstash Redis (disponível no Vercel Marketplace). A chave de lock já existe no DB (`bloqueado_ate`), mas o rate limiter intermediário precisa de persistência.

---

### ~~2. Race condition na mensagem de boas-vindas~~ ✅ concluído em 2026-04-27
**Arquivo:** `src/app/api/whatsapp/webhook/route.ts`

A deduplicação usa `updateMany` com guard condicional, mas o `sendTextMessage` fica no bloco `after()` — fora da transação. Dois webhooks simultâneos para a mesma conversa podem ambos passar pelo guard e enviar mensagem duplicada.

**Fix:** Extraída função `trySendWelcomeMessage()` executada sincronamente no fluxo principal do webhook (antes dos blocos `after()`), garantindo que `updateMany` + `sendTextMessage` ocorram no mesmo contexto de execução.

---

### ~~3. Sem limite de tokens no AI responder~~ ✅ concluído em 2026-04-27
**Arquivo:** `src/lib/whatsapp/ai-responder.ts`

`generateCatchUpReplies()` enviava até 20 mensagens de contexto para OpenAI com `max_tokens: 550` por chamada, sem budget por conversa, tracking de custo ou rate limit. Uma conta comprometida podia gerar gasto ilimitado em segundos.

**Fix:**
- Budget de tokens por conversa/hora (`TOKEN_BUDGET_PER_CONVERSATION = 5000`) com tracking in-memory
- Estimativa de tokens de input antes da chamada, bloqueio se exceder budget
- Log detalhado com tokens consumidos (input/output) por chamada
- Singleton `openaiClient` — evita recriar instância a cada chamada
- Validação da `OPENAI_API_KEY` no topo do módulo (fix #9) — erro imediato se ausente

---

## Alto Impacto

### ~~4. Índice não cobre queries por `created_at`~~ ✅ concluído em 2026-04-27
**Arquivo:** `prisma/schema.prisma`

O índice composto em `Lancamento` era `[loja, data_ref, deletado_at]`, mas queries em `hoje-content.tsx` ordenam por `created_at DESC`. O query planner do Postgres podia ignorar o índice e fazer seq scan.

**Fix:** Adicionado índice cobrindo a ordenação usada:
```prisma
@@index([deletado_at, created_at(sort: Desc)])
```

---

### ~~5. Dois full scans onde um basta~~ ✅ concluído em 2026-04-27
**Arquivo:** `src/components/financeiro/hoje-content.tsx:33-66`

O código fazia duas queries separadas para o mesmo intervalo de datas: uma `findMany` com todos os campos e uma `groupBy` para os totais. Dois full table scans desnecessários para o mesmo conjunto de registros.

**Fix:** Eliminado o `groupBy`. Os totais são agora calculados a partir dos resultados da query `findMany` via `reduce()`, já que o volume de registros de um dia é baixo (~dezenas/centenas). Um único scan substitui os dois anteriores.

---

### ~~6. Unread count não é atômico~~ ✅ concluído em 2026-04-27
**Arquivo:** `src/app/api/whatsapp/webhook/route.ts`

`incrementUnreadForConversation()` era chamado no bloco `after()`, fora da transação que salva a mensagem. Se o processo morresse entre o save e o increment, o badge de não lidos ficava desatualizado permanentemente.

**Fix:** Movido `await incrementUnreadForConversation()` para dentro do fluxo principal (antes dos blocos `after()`), garantindo que o incremento de unread é atômico com a criação da mensagem.

---

## Médio Impacto

### ~~7. Sem virtualização na lista de conversas~~ ✅ concluído em 2026-04-27
**Arquivo:** `src/app/(protected)/inbox/_components/ConversationList.tsx` / `VirtualizedConversationList.tsx`

Com 50+ conversas, a lista renderizava todos os itens de uma vez. Em mobile causava layout thrashing visível. `@tanstack/react-virtual` já estava no `package.json` mas não estava sendo usado.

**Fix:** Criado componente `VirtualizedConversationList` (`'use client'`) usando `useVirtualizer` do `@tanstack/react-virtual` com `overscan: 5` e altura estimada de 72px por item. O `ConversationList` (Server Component) agora delega a renderização ao componente virtualizado. Scroll para conversa ativa integrado via `scrollToIndex`.

---

### ~~8. `loadMore` do ChatWindow sem rollback de estado~~ ✅ concluído em 2026-04-27
**Arquivo:** `src/app/(protected)/inbox/_components/ChatWindow.tsx:108-148`

A função `loadMore` silenciava erros de rede com `catch {}` vazio, sem restaurar o estado pré-load. Se o fetch falhasse, o estado `isLoadingMore` resetava mas `hasMore` podia ficar inconsistente. Além disso, usava closure stale de `isLoadingMore`.

**Fix:**
- `isLoadingMoreRef` (ref) substitui `isLoadingMore` (state) como guarda — elimina stale closure
- Snapshot de `prevHasMore` e `prevMessages` antes do fetch
- Rollback completo em caso de erro (`setHasMore(prevHasMore)` + `setMessages(prevMessages)`)
- Estado `loadError` exposto com botão de retry na UI
- Erro de HTTP (status !== ok) agora propaga para o catch ao invés de retornar silenciosamente

---

### ~~9. OpenAI key validada tarde demais~~ ✅ concluído em 2026-04-27
**Arquivo:** `src/lib/whatsapp/ai-responder.ts`

`new OpenAI({ apiKey: process.env.OPENAI_API_KEY })` era instanciado a cada chamada sem verificar se a key existe. A ausência da variável explodia somente na geração — após queries Prisma já terem rodado.

**Fix:** Validação movida para o topo do módulo (module-level guard): `if (!OPENAI_API_KEY) throw new Error(...)`. Singleton `openaiClient` reutilizado em todas as chamadas em vez de recriar a instância. (Combinado com fix #3)

---

## Baixo Impacto / Housekeeping

### ~~10. Pool PG sem graceful shutdown~~ ✅ concluído em 2026-04-27
**Arquivo:** `src/lib/prisma.ts`

`pool.end()` e `prisma.$disconnect()` nunca eram chamados em SIGTERM. Conexões podiam ficar abertas até o pooler do Supabase atingir o limite de conexões simultâneas, especialmente após deploys frequentes.

**Fix:** Adicionados handlers para `SIGTERM` e `SIGINT` que executam `prisma.$disconnect()` → `pool.end()` em sequência, com log e tratamento de erro em cada etapa.

---

### 11. Type bypass nos erros Supabase
**Arquivo:** `src/app/(protected)/usuarios/actions.ts`

```ts
(authError as any).status !== 404
```

Uso de `as any` para acessar `.status` contorna o sistema de tipos e pode mascarar erros reais de autenticação.

**Fix:** Criar um type guard:
```ts
function isAuthError(e: unknown): e is { status: number } {
  return typeof e === 'object' && e !== null && 'status' in e;
}
```

---

## Resumo de Prioridades

| # | Item | Risco | Esforço | Status |
|---|------|-------|---------|--------|
| 1 | Rate limiter persistente (Upstash) | Segurança crítica | Médio | ✅ concluído 2026-04-11 |
| 2 | Race condition boas-vindas | Bug de produção | Baixo | ✅ concluído 2026-04-27 |
| 3 | Budget de tokens OpenAI | Financeiro crítico | Médio | ✅ concluído 2026-04-27 |
| 4 | Índice `created_at` | Performance | Baixo | ✅ concluído 2026-04-27 |
| 5 | Dois full scans em hoje | Performance | Baixo | ✅ concluído 2026-04-27 |
| 6 | Unread count atômico | Consistência de dados | Baixo | ✅ concluído 2026-04-27 |
| 7 | Virtualização da lista | UX mobile | Médio | ✅ concluído 2026-04-27 |
| 8 | Rollback no loadMore | Robustez | Baixo | ✅ concluído 2026-04-27 |
| 9 | Validação da OpenAI key | DX / debug | Baixo | ✅ concluído 2026-04-27 |
| 10 | Graceful shutdown pool | Estabilidade | Baixo | ✅ concluído 2026-04-27 |
| 11 | Type guard Supabase errors | Type safety | Baixo | ❌ Pendente |
