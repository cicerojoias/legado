# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (Turbopack) at localhost:3000
npm run build      # Production build
npm run lint       # ESLint
npx tsc --noEmit   # TypeScript check (run after every implementation)
npx prisma db push # Sync schema changes to Supabase (no migration files — project uses db push)
npx prisma generate # Regenerate Prisma client after schema changes
npx prisma studio  # Local DB browser
```

No test runner is configured. Type-checking with `npx tsc --noEmit` is the verification step.

## Architecture

### Route Groups
- `src/app/(auth)/` — Public auth routes: `/login`, `/pin`, `/setup-pin`, logout action
- `src/app/(protected)/` — All guarded routes: `/hoje`, `/lancamentos` (ADMIN+), `/relatorios` (ADMIN+), `/dashboard` (SUPER_ADMIN), `/custos-fixos` (SUPER_ADMIN), `/usuarios` (SUPER_ADMIN), `/logs` (SUPER_ADMIN), `/perfil`, `/sandbox`
- `src/app/layout.tsx` — Root layout with Geist font and Sonner toaster

### Auth Flow (two-layer)
1. **Supabase session** — validated in `src/lib/supabase/middleware.ts` via `updateSession()`. Unauthenticated users redirect to `/login`.
2. **PIN cookie** — `pin_verified_{userId}` (httpOnly, 12h TTL). Set in `src/app/(auth)/pin/actions.ts` after bcrypt comparison. Middleware checks this cookie on every protected request. The cookie name includes `userId` to prevent session collision between users on the same device.

`src/middleware.ts` delegates entirely to `updateSession`. PIN-less users with a valid Supabase session are redirected to `/pin`.

### Server Actions pattern
All mutations live in `actions.ts` files co-located with their route. The security chain for financial mutations is:
```
Auth (supabase.auth.getUser) → Rate limit → Zod validation → dbUser.ativo check
→ prisma.$transaction(Serializable) { read → authorize → write → audit log }
```

`MutacaoError` class (in `hoje/actions.ts`) is thrown inside `$transaction` to trigger rollback while preserving typed error codes. P2034 (serialization conflict) is caught explicitly and returned as `CONFLITO_CONCORRENTE`.

### Data Layer
- **Prisma** with `pg.Pool` + `PrismaPg` adapter (driver adapter pattern). Connection string from `DATABASE_URL` env var pointing to Supabase pooler.
- **Schema sync:** `npx prisma db push` (no `migrate dev` — no migration history).
- **Soft-delete:** `Lancamento.deletado_at DateTime?` — null = active, timestamp = deleted (ADR-0001). All queries must filter `{ deletado_at: null }`.
- **Audit log:** Every financial mutation writes a `Log` record with a JSON snapshot inside the same `$transaction`.

### RBAC
- Roles: `SUPER_ADMIN` (Richard) | `ADMIN` (Cícero) | `OPERADOR` (staff)
- `User.lojaAutorizada`: `JOAO_PESSOA` | `SANTA_RITA` | `AMBAS`
- Middleware handles view-level RBAC: `/lancamentos` and `/relatorios` = ADMIN+, `/dashboard`, `/custos-fixos`, `/usuarios` and `/logs` = SUPER_ADMIN only. Server Actions enforce action-level RBAC by reading `dbUser.role` and `dbUser.lojaAutorizada` from the DB — never from the client.
- Users with `lojaAutorizada = AMBAS` must select a store in the UI; the server validates and rejects if omitted.

### Rate Limiting
`src/lib/rate-limit.ts` — in-memory `Map`, not persistent across restarts. Auth uses defaults (5/min, 15min lockout). Financial mutations use `rateLimit(key, 30, 15)`. PIN lockout is stored in `User.bloqueado_ate` (database) — not in-memory.

### Key Files
| File | Purpose |
|---|---|
| `src/lib/supabase/middleware.ts` | Full auth + PIN middleware logic |
| `src/lib/prisma.ts` | Singleton Prisma client with pg.Pool adapter |
| `src/lib/validations/index.ts` | All Zod schemas (`CriarLancamentoSchema`, `EditarLancamentoSchema`, `DeleteQuerySchema`, etc.) |
| `src/lib/rate-limit.ts` | Parametrized in-memory rate limiter |
| `src/app/(protected)/hoje/actions.ts` | `createLancamento`, `deletarLancamento`, `editarLancamento` with `MutacaoError` pattern |
| `src/app/(auth)/pin/actions.ts` | `setupPinAction`, `verifyPinAction` with DB-backed lockout |
| `src/components/financeiro/lancamento-modal.tsx` | Modal for creating lancamentos |
| `src/components/financeiro/editar-lancamento-modal.tsx` | Modal for editing/deleting lancamentos |
| `src/hooks/use-permissions.ts` | Client-side role check for UI visibility |
| `src/app/(protected)/relatorios/relatorios-content.tsx` | Relatórios data fetching + metrics + chart |
| `src/app/(protected)/dashboard/page.tsx` | SUPER_ADMIN desktop dashboard |
| `src/app/(protected)/custos-fixos/actions.ts` | CRUD for fixed costs (SUPER_ADMIN) |
| `src/app/(protected)/perfil/actions.ts` | Trocar PIN, alterar senha, encerrar sessão, notificações |
| `src/app/(protected)/usuarios/actions.ts` | Toggle loja e ativo por usuário (SUPER_ADMIN) |
| `src/app/(protected)/logs/page.tsx` | Audit log viewer with filters + pagination (SUPER_ADMIN) |
| `src/lib/pin-utils.ts` | Shared `hashPin`/`comparePin` (scrypt + timing-safe) |

### UI Conventions
- **Color system:** Background `#F7F5F0` (creme), Primary `#184434` (dark green), Accent `#C79A34` (gold). ENTRADA = emerald, SAIDA = rose.
- **Tailwind v4** CSS-first config in `src/app/globals.css` (`@theme` block). No `tailwind.config.ts`.
- **Framer Motion** for list/card animations.
- **Streaming:** Heavy data pages use `<Suspense>` with `key` prop for dynamic invalidation.
- `revalidatePath('/lancamentos', 'layout')` — use `'layout'` scope to invalidate all query-param variants.

### Hydration — regras obrigatórias
Erros de hidratação quebram a UX e são difíceis de debugar. Siga estas regras ao criar/editar componentes:

1. **`useSearchParams()` exige `<Suspense>`** — Todo componente `'use client'` que chama `useSearchParams()` DEVE ser envolvido em `<Suspense>` no ponto onde é renderizado. Sem isso, o Next.js faz fallback para client-side rendering e gera mismatch. Exemplo correto:
   ```tsx
   <Suspense fallback={null}>
     <MeuComponenteQueUsaSearchParams />
   </Suspense>
   ```
2. **`toLocaleDateString` / `Intl.DateTimeFormat`** — Formatação de datas pode diferir entre Node.js (server) e browser (client). Use `suppressHydrationWarning` no elemento que exibe a data formatada, ou formate no server e passe como prop.
3. **shadcn/ui `ChartContainer`** — O default inclui classes que podem conflitar com classes passadas via `className` (ex: `aspect-video` vs `aspect-auto`). O `tailwind-merge` no Tailwind v4 resolve esses conflitos de forma inconsistente entre server e client. Já removemos `aspect-video` do default — ao atualizar o componente via shadcn CLI, verificar se o conflito volta.
4. **Renderização condicional com dados async** — Hooks como `usePermissions()` que fazem fetch em `useEffect` começam com estado default (`isLoading: true`). Nunca renderize conteúdo diferente baseado no estado carregado sem proteger com `<Suspense>` ou mostrar o mesmo layout skeleton no server e client.
5. **Ao criar novo componente client** — Pergunte: "Este componente usa `useSearchParams`, `usePathname`, ou dados que mudam entre server/client?" Se sim, envolva em `<Suspense>` onde for renderizado.

### Adding New Users
New users must exist in **both** Supabase Auth (`auth.users`) and the app's `public.users` table. The UUID must match exactly. Insert manually:
```sql
INSERT INTO users (id, email, nome, role, "lojaAutorizada", ativo, created_at, updated_at)
VALUES ('UUID_FROM_SUPABASE_AUTH', 'email', 'Nome', 'OPERADOR', 'JOAO_PESSOA', true, NOW(), NOW());
```

### ADRs
- `docs/adr/0001-soft-delete-lancamentos.md` — why soft-delete
- `docs/adr/0002-trava-24h-sem-override-super-admin.md` — 24h edit window, no role override in MVP
