# Plano de otimização — Legado (Cícero Joias)

Início: 21/10/2026 · versão do app: 0.18.85 · site: https://legadocicerojoias.vercel.app (Vercel)

Método: investigar tudo → etapas por risco → um item por vez (medir antes, corrigir, build, medir depois, commit próprio). Push por etapa.

## Linha de base (21/10/2026)

O app é interno: só `/login` é pública. As telas logadas não dá para medir no Lighthouse sem sessão, então nelas a medida é o **JS que cada tela baixa** (calculado do build local, gzip) e o **número de chamadas de rede** ao abrir.

| Medida | Valor |
|---|---|
| `/login` celular — Desempenho / Acessib. / Boas práticas / SEO | 96 / 93 / 100 / 92 |
| `/login` — LCP / TBT / CLS / peso | 2,5 s / 110 ms / 0 / 281 KB |
| JS por tela (build, gzip, estimativa) | 313–327 KB na maioria; relatórios 424 KB; dashboard 416 KB; inbox 336–343 KB |
| Peças grandes presentes em **todas** as telas | cliente Supabase ~53 KB, Framer Motion ~41 KB, Zod ~39 KB |
| `npm audit` (produção) | 25 alertas (1 crítico: Next 16.1.6) |

## Diagnóstico

Severidade: 🔴 crítica · 🟠 alta · 🟡 média · ⚪ baixa

### Segurança (S)
- **S1 🔴 (confirmado 21/10)** — A chave pública do Supabase (vai no JS do site) tem permissão total em todas as 14 tabelas; 8 estão com RLS desligado (`users`, `lancamentos`, `logs`, `custos_fixos`, `conversation_tags`, `wa_conversation_notes`, `wa_settings`, `wa_tags`) e `wa_messages`/`wa_conversations` têm política liberando leitura **sem login**. Ensaio na cópia: sem login dá para ler 8 usuários (com `pin_hash`), 3 286 lançamentos, 3 605 logs, 7 002 mensagens e promover todos a SUPER_ADMIN. Nenhuma tabela guarda chave de API. Sem sinal de alteração indevida (nenhuma conta nova em 60 dias; papéis conferem), mas leitura não deixa rastro. Correção pronta: `prisma/sql/rls-seguranca.sql` (desfazer: `rls-rollback.sql`), ensaiada numa cópia restaurada do backup: tudo negado para quem não deve, gerente segue vendo o inbox, Prisma intacto, idempotente, rollback volta ao estado original.
- **S1b 🔴** — Cadastro público do Supabase Auth está **ligado** (`disable_signup: false`): qualquer um cria conta e vira "logado". O app cria usuários manualmente, então dá para desligar sem efeito colateral.
- **S1c 🟠** — Depois de fechar S1: todos trocam o PIN (o `pin_hash` de 4 dígitos ficou legível e é fácil de quebrar).
- **S2 🟠** — Webhook do WhatsApp (`/api/whatsapp/webhook`) não confere a assinatura da Meta. A função `validate-signature.ts` existe mas nunca é chamada, e ela deixa passar se `META_APP_SECRET` faltar (que hoje falta). Qualquer um pode enviar mensagens falsas para o inbox, disparar push para a equipe, resposta da IA (custo OpenAI) e boas-vindas automáticas.
- **S3 🟠** — Next 16.1.6 com alerta crítico (request smuggling, cache do next/image) + sharp/postcss. Correção: atualizar para 16.4.x.
- **S4 🟡** — Seis rotas devolvem o erro técnico ao navegador (`details: err.message`): cron, migrate-media, send, send-template, validate-template, forward.
- **S5 🟡** — Faltam cabeçalhos de segurança (impedir o site dentro de iframe, `nosniff`, `Referrer-Policy`, `Permissions-Policy`).
- **S6 🟡** — Usuário desativado (`ativo=false`) continua usando as telas e as APIs do WhatsApp até o cookie do PIN vencer (12 h): o proxy e essas rotas não olham `ativo`.
- **S7 ⚪** — Alertas em dependências de desenvolvimento (ferramentas do Prisma etc.): `npm audit fix` sem `--force`.

### Desempenho (P)
- **P1 🟠** — A navegação (presente em todas as telas) descobre o papel do usuário **no navegador**: `auth.getUser()` (ida ao Supabase Auth) + consulta na tabela `users`. São 2 idas à rede a cada abertura, o menu aparece incompleto até responder, e é o principal motivo do cliente Supabase (~53 KB) estar em todas as telas. Correção: ler o papel no servidor (já existe cookie assinado) e passar pronto para o menu.
- **P2 🟡** — Zod (~39 KB) vai para todas as telas: `use-permissions.ts` importa o pacote só por causa de um tipo, e o modal "Registrar" (no menu) usa o Zod completo.
- **P3 🟡** — Gráficos (Recharts, ~98 KB) carregam junto com relatórios e dashboard. Carregar o gráfico sob demanda deixa os números aparecerem antes.
- **P4 ⚪** — Fonte Geist Mono é pré-carregada em todas as telas, mas só aparece nos modelos de mensagem do inbox (~23 KB).
- **P5 ⚪** — Logo do login é o maior elemento da tela (LCP) e não tem prioridade de carregamento.

### Acessibilidade / SEO (A)
- **A1 🟡** — Zoom bloqueado no celular (`user-scalable=no`). Os campos já usam 16 px no celular, então o iPhone não dá zoom automático ao tocar — dá para liberar sem efeito colateral (D3).
- **A2 ⚪** — Sem `robots.txt` (vira redirecionamento para o login). App interno: `robots.txt` bloqueando tudo + `noindex`.

### Organização (I)
- **I1 ⚪** — `/sandbox`: página de teste da Fase 4 ainda publicada (protegida por login) + código `isSandbox` no menu.
- **I2 ⚪** — `src/lib/whatsapp/webhook-parser.ts` sem uso.
- **I3 ⚪** — Raiz com 4 prints `Snipaste_*.png` (fora do git) e 2 documentos soltos (`LIMPEZA_OTIMIZACAO_RESUMO.md`, `CHECKLIST-CRON.md`) → prints para `Documentos\Cicero Joias - prints`, documentos para `docs/`.
- **I4 ⚪** — Aviso no build: `previewFeatures = ["driverAdapters"]` já não é necessário no Prisma 7.
- **I5 ⚪** — Dois `favicon.ico` iguais (`src/app` e `public`) geram duas tags de ícone.

## Decisões pendentes

- **D1 — RLS (S1).** ✅ Aplicado na produção em 21/10/2026 com ok do usuário. Conferido: 14 tabelas com RLS, só 5 políticas novas, API pública sem login nega leitura e escrita em tudo (401). Backup feito e restaurado com sucesso numa cópia (`Documentos\Cícero Joias - Backups\banco-2026-10-21-antes-rls`, 14 tabelas, contagens iguais).
- **D2 — Segredo do app Meta (S2).** ✅ `META_APP_SECRET` criado (Secret, Production + Preview). Falta ligar a checagem no código.
- **D3 — Zoom (A1).** ✅ Decidido: **manter bloqueado**. A1 cancelado.
- **D4 — Next 16.1 → 16.4 (S3).** ✅ Aprovado, etapa 5.
- **D5 — Variáveis da Vercel.** ✅ Feito: 7 segredos recriados como Secret (Production + Preview), 5 variáveis do Redis sem uso removidas, cadastro público do Supabase desligado (S1b), redeploy Ready. Texto original: As 3 marcadas "Needs Attention" (`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `WHATSAPP_TOKEN`) + `DIRECT_URL` estão em "All Environments" e não são "Sensitive" (qualquer membro do time lê o valor). Recriar como Sensitive, só Production + Preview. Não precisam ser trocadas (nenhuma estava no banco). A lista enviada tem 4 variáveis, mas o código usa ~18 (ver tabela abaixo): conferir a aba *Shared* ou o resto da lista.

### Variáveis que o código usa

| Variável | Para quê | Secreta? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | login | não (vão no navegador) |
| `DATABASE_URL` | banco (app) | sim |
| `DIRECT_URL` | banco (só `prisma db push`) | sim |
| `SUPABASE_SERVICE_ROLE_KEY` | Storage + assinatura dos cookies | sim |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID` | WhatsApp | token sim |
| `WHATSAPP_VERIFY_TOKEN` (ou `WHATSAPP_WEBHOOK_VERIFY_TOKEN`) | cadastro do webhook | sim |
| `META_APP_SECRET` | **novo** — assinatura do webhook | sim |
| `OPENAI_API_KEY` | resposta automática / gerar conversa | sim |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | notificações push | privada sim |
| `CRON_SECRET` | resumo diário (Vercel Cron manda sozinho) | sim |
| `CLOUDFLARE_R2_ACCESS_KEY_ID`, `..._SECRET_ACCESS_KEY`, `..._ENDPOINT`, `..._BUCKET_NAME` | guardar mídias do WhatsApp | chaves sim |

## Etapas

| Etapa | Itens | Risco |
|---|---|---|
| 0 Preparação | build local ✅, linha de base ✅ | — |
| 1 Limpeza ✅ | I1, I2, I3, I4, I5 | baixo |
| 2 Segurança urgente ✅ | S1, S2, S4, S5, S6 | médio |
| 3 Ganhos rápidos ✅ | P4, P5, A2 (A1 cancelado) | baixo |
| 4 JavaScript ✅ | P1, P2, P3 | médio |
| 5 Dependências | S3 (após D4), S7 | médio |
| 6 Vigilância | medir de novo tudo, tabela final | — |

## Registro

| Data | Item | Resultado |
|---|---|---|
| 21/10/2026 | Investigação | Linha de base, 20 itens, 4 decisões |
| 21/10/2026 | S1 verificação | Confirmado: banco aberto pela chave pública; cadastro público ligado |
| 21/10/2026 | S1 preparo | Backup (14 tabelas) restaurado numa cópia; correção + rollback ensaiados |
| 21/10/2026 | S1b + D5 | Cadastro público desligado; segredos como Secret; Redis removido; redeploy ok |
| 21/10/2026 | S1 aplicado | Produção protegida: sem login → 401 em todas as tabelas. Próximo: todos trocam o PIN (S1c) |
| 21/10/2026 | Etapa 1 (I1–I5) | /sandbox, webhook-parser e favicon duplicado removidos; prints fora do repo (`Documentos\Cícero Joias - Prints`); aviso do Prisma sumiu; v0.18.86 publicada |
| 21/10/2026 | S2 | Webhook confere a assinatura da Meta; 7 casos testados. Publicado: sem assinatura → 401; WhatsApp real chegou no inbox |
| 21/10/2026 | S4 | 6 rotas sem `details` técnico; erros comuns da Meta (24 h, modelo, limite, token) viram mensagem clara |
| 21/10/2026 | S5 | X-Frame-Options, nosniff, Referrer-Policy e Permissions-Policy (microfone liberado só para o site) |
| 21/10/2026 | S6 | Proxy lê `ativo` (cache 10 min) em todas as telas e APIs; PIN recusa desativado. v0.18.87 publicada; deploy e testes públicos ok |
| 21/10/2026 | Achado (fontes) | A Geist era baixada (2 arquivos, 53 KB, prioridade alta) mas nunca aplicada: `layout.tsx` criava `--font-sans`/`--font-mono` e o `@theme` lia `--font-geist-sans`/`--font-geist-mono`. Decisão do usuário: consertar e usar a Geist |
| 21/10/2026 | P4 | Variáveis corrigidas (Geist aparece); Geist Mono com `preload: false` → 1 fonte pré-carregada em vez de 2 |
| 21/10/2026 | P5 | Causa real: `<Suspense fallback={null}>` em volta da página inteira deixava o HTML do login vazio (logo só depois do JS). Agora só os avisos da URL ficam no Suspense; logo e formulário vêm no HTML, logo pré-carregado. Logo chega em 389 ms (antes 1 063 ms) |
| 21/10/2026 | A2 | `robots.txt` (Disallow: /) + `noindex`; proxy libera `/robots.txt`. SEO do Lighthouse cai para 66 de propósito (ele penaliza bloquear buscadores) |
| 21/10/2026 | Correção da medida | O script de "JS por tela" da linha de base somava bibliotecas de outras telas (o login não baixa Supabase nem Framer Motion, segundo o Lighthouse). Nova medida: o JS que cada componente puxa logo de início (esbuild, gzip), antes × depois no mesmo script |
| 21/10/2026 | P1 + P2 | Layout protegido lê papel/lojas no servidor (contexto); menu não faz mais `getUser()` + consulta em `users`; contador do WhatsApp só para GERENTE+ e com Supabase sob demanda; modal Registrar via `next/dynamic`. Barra inferior 203 → 51 KB; lateral 62 → 12 KB |
| 21/10/2026 | P3 | Recharts sob demanda com espaço reservado: gráfico de Relatórios 114 → 1 KB e do Dashboard 115 → 1 KB logo de início. v0.18.89 publicada |
| 21/10/2026 | Medição etapa 3 | `/login` celular: 96/93/100/92 → 97/93/100/66; LCP simulado 2,5 → 2,4 s (medido sem simulação: 1,4 s antes e depois); TBT 110 → 80 ms; peso 281 → 260 KB. v0.18.88 |
