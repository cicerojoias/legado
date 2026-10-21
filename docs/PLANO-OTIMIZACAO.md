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
- **S1 🔴 (a confirmar)** — O navegador fala direto com o banco pelo Supabase (chave pública vai no JS). A tabela `users` é lida pelo navegador (`use-permissions.ts`) e o inbox escuta mudanças em tempo real. Não há nenhuma política RLS documentada no repositório e o schema é aplicado por `prisma db push` (que não liga RLS). Se o RLS estiver desligado, **qualquer pessoa com a chave pública** pode ler/alterar `users` (incluindo `pin_hash` e `role`), lançamentos e mensagens. Precisa verificar no banco (D1).
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

- **D1 — Verificar o RLS (S1).** Recomendo deixar eu rodar uma consulta **só de leitura** no banco (lista tabelas, se o RLS está ligado e as políticas). O modo automático bloqueou; precisa do seu ok. Alternativa pelo celular: Supabase › projeto › *Advisors › Security Advisor* e me dizer se aparece "RLS disabled in public". Se confirmar, a correção mexe no banco de produção → backup verificado + ensaio + seu ok.
- **D2 — Segredo do app Meta (S2).** Preciso do `META_APP_SECRET` na Vercel. Passo a passo no celular: developers.facebook.com › Meus apps › (app do WhatsApp) › Configurações do app › Básico › *Chave secreta do app* › Mostrar → copiar; depois vercel.com › projeto › Settings › Environment Variables › `META_APP_SECRET` (Production) › Save. Eu faço o código já pronto: confere a assinatura quando o segredo existir e rejeita quando não bater.
- **D3 — Liberar o zoom (A1).** Recomendo liberar. Pró: acessibilidade (93 → 100), quem enxerga pouco consegue ampliar. Contra: em telas com gesto de pinça pode haver zoom acidental.
- **D4 — Atualizar Next 16.1 → 16.4 (S3).** Recomendo fazer numa etapa própria, depois das outras, com build + teste das telas principais. Pró: fecha o alerta crítico. Contra: atualização de versão intermediária pode exigir ajustes.

## Etapas

| Etapa | Itens | Risco |
|---|---|---|
| 0 Preparação | build local ✅, linha de base ✅ | — |
| 1 Limpeza | I1, I2, I3, I4, I5 | baixo |
| 2 Segurança urgente | S2 (código), S4, S5, S6; S1 após D1 | médio — pedir ok antes do push |
| 3 Ganhos rápidos | P4, P5, A2, A1 (após D3) | baixo |
| 4 JavaScript | P1, P2, P3 | médio |
| 5 Dependências | S3 (após D4), S7 | médio |
| 6 Vigilância | medir de novo tudo, tabela final | — |

## Registro

| Data | Item | Resultado |
|---|---|---|
| 21/10/2026 | Investigação | Linha de base, 20 itens, 4 decisões |
