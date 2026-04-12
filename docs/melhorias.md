# Melhorias Identificadas — Legado Cicero Joias

> Auditoria realizada em 2026-04-11. Ordenada por impacto.

---

## Crítico

### ~~1. Rate limiter efêmero (memória volátil)~~ ✅ concluído em 2026-04-11
**Arquivo:** `src/lib/rate-limit.ts`

O store é um `Map` em memória que zera a cada cold start serverless. Um atacante pode fazer 4 tentativas de PIN, aguardar reinício da instância e repetir indefinidamente — contornando o bloqueio de `User.bloqueado_ate`.

**Fix:** Migrar para Upstash Redis (disponível no Vercel Marketplace). A chave de lock já existe no DB (`bloqueado_ate`), mas o rate limiter intermediário precisa de persistência.

---

### 2. Race condition na mensagem de boas-vindas
**Arquivo:** `src/app/api/whatsapp/webhook/route.ts`

A deduplicação usa `updateMany` com guard condicional, mas o `sendTextMessage` fica no bloco `after()` — fora da transação. Dois webhooks simultâneos para a mesma conversa podem ambos passar pelo guard e enviar mensagem duplicada.

**Fix:** Mover o `sendTextMessage` para dentro da transação principal, antes do `after()`.

---

### 3. Sem limite de tokens no AI responder
**Arquivo:** `src/lib/whatsapp/ai-responder.ts`

`generateCatchUpReplies()` envia até 20 mensagens de contexto para OpenAI com `max_tokens: 550` por chamada, sem budget por conversa, tracking de custo ou rate limit. Uma conta comprometida pode gerar gasto ilimitado em segundos.

**Fix:**
- Definir budget máximo de tokens por conversa por hora
- Adicionar cost tracking (log com estimativa de tokens consumidos)
- Exigir aprovação explícita para modo "catch-up" acima de N mensagens

---

## Alto Impacto

### 4. Índice não cobre queries por `created_at`
**Arquivo:** `prisma/schema.prisma`

O índice composto em `Lancamento` é `[loja, data_ref, deletado_at]`, mas queries em `hoje-content.tsx` ordenam por `created_at DESC`. O query planner do Postgres pode ignorar o índice e fazer seq scan.

**Fix:** Adicionar índice cobrindo a ordenação usada:
```prisma
@@index([deletado_at, created_at(sort: Desc)])
```

---

### 5. Dois full scans onde um basta
**Arquivo:** `src/components/financeiro/hoje-content.tsx:33-66`

O código faz duas queries separadas para o mesmo intervalo de datas: uma busca todos os lançamentos e outra faz `groupBy` para os totais. São dois full table scans desnecessários.

**Fix:** Usar uma query `groupBy` para os totais e uma segunda query somente para a lista detalhada (apenas os campos exibidos). Ou consolidar com raw SQL em um único aggregate + detail join.

---

### 6. Unread count não é atômico
**Arquivo:** `src/app/api/whatsapp/webhook/route.ts`

`incrementUnreadForConversation()` é chamado no bloco `after()`, fora da transação que salva a mensagem. Se o processo morrer entre o save e o increment, o badge de não lidos fica desatualizado permanentemente.

**Fix:** Mover o increment para dentro da transação principal (mesmo bloco do `WaMessage` create).

---

## Médio Impacto

### 7. Sem virtualização na lista de conversas
**Arquivo:** `src/app/(protected)/inbox/_components/ConversationList.tsx`

Com 50+ conversas, a lista renderiza todos os itens de uma vez. Em mobile causa layout thrashing visível. `@tanstack/react-virtual` já está no `package.json` mas não está sendo usado.

**Fix:** Implementar `useVirtualizer` do `@tanstack/react-virtual` na lista ou adicionar paginação com "carregar mais".

---

### 8. `loadMore` do ChatWindow sem rollback de estado
**Arquivo:** `src/app/(protected)/inbox/_components/ChatWindow.tsx:84-131`

Duas queries paralelas carregam mensagens antigas. Se a segunda falha após a primeira ter retornado, o usuário vê mensagens em estado parcial sem feedback de erro e sem possibilidade de retry.

**Fix:** Envolver as duas queries em try/catch com rollback do estado local de mensagens em caso de falha parcial.

---

### 9. OpenAI key validada tarde demais
**Arquivo:** `src/lib/whatsapp/ai-responder.ts`

`new OpenAI({ apiKey: process.env.OPENAI_API_KEY })` é instanciado a cada chamada sem verificar se a key existe. A ausência da variável explode somente na geração — após queries Prisma já terem rodado.

**Fix:** Validar a env var no topo do módulo (module-level guard) e lançar erro descritivo imediatamente se ausente.

---

## Baixo Impacto / Housekeeping

### 10. Pool PG sem graceful shutdown
**Arquivo:** `src/lib/prisma.ts`

`pool.end()` e `prisma.$disconnect()` nunca são chamados em SIGTERM. Conexões podem ficar abertas até o pooler do Supabase atingir o limite de conexões simultâneas, especialmente após deploys frequentes.

**Fix:**
```ts
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  await pool.end();
});
```

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

| # | Item | Risco | Esforço |
|---|------|-------|---------|
| 1 | Rate limiter persistente (Upstash) | Segurança crítica | Médio |
| 2 | Race condition boas-vindas | Bug de produção | Baixo |
| 3 | Budget de tokens OpenAI | Financeiro crítico | Médio |
| 4 | Índice `created_at` | Performance | Baixo |
| 5 | Dois full scans em hoje | Performance | Baixo |
| 6 | Unread count atômico | Consistência de dados | Baixo |
| 7 | Virtualização da lista | UX mobile | Médio |
| 8 | Rollback no loadMore | Robustez | Baixo |
| 9 | Validação da OpenAI key | DX / debug | Baixo |
| 10 | Graceful shutdown pool | Estabilidade | Baixo |
| 11 | Type guard Supabase errors | Type safety | Baixo |
