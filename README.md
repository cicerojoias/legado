# 💎 Projeto Legado — Cícero Joias

Este é o **Módulo Financeiro Oficial** da Cícero Joias, construído para substituir o registro financeiro em cadernos de papel por um ecossistema digital inteligente, rápido e seguro. A aplicação é desenhada com foco na experiência *mobile-first* para os operadores nas lojas físicas (João Pessoa e Santa Rita).

## 🚀 Status do Projeto

Em produção em https://legadocicerojoias.vercel.app (versão atual na tela Perfil e no `package.json`).

### O que já existe
* **Financeiro:** tela Hoje (registrar entradas e saídas, edição em até 24 h), Lançamentos, Relatórios com gráficos, Dashboard, Custos fixos e resumo financeiro diário por notificação.
* **Atendimento WhatsApp (WAB):** inbox com mídias (imagem, áudio, vídeo, documento), gravação de voz, modelos de mensagem da Meta, etiquetas, notas, encaminhamento, menu automático de boas-vindas e resposta com IA.
* **Segurança:** login + PIN de 4 dígitos com cookie assinado, permissões por papel (SUPER_ADMIN, ADMIN, GERENTE, OPERADOR), banco fechado para acesso de fora (RLS), webhook com assinatura da Meta, log de auditoria de toda mudança financeira.
* **Administração:** Usuários (papel, loja, ativo) e Logs de auditoria.
* **App no celular (PWA):** instalável, com notificações push.

### Próximos passos
Ver `docs/LEGADO_roadmap.md` e `docs/melhorias.md`.

## 🛠️ Stack Tecnológica

* **Framework:** [Next.js](https://nextjs.org/) 16 (App Router + React 19), hospedado na Vercel
* **Estilização:** Tailwind CSS v4 + [Framer Motion](https://www.framer.com/motion/), fonte Geist
* **Componentes UI:** [Shadcn UI](https://ui.shadcn.com/) (Radix) + Recharts nos gráficos
* **Banco de Dados e login:** [Supabase](https://supabase.com/) (PostgreSQL + Auth + Realtime + Storage)
* **ORM:** [Prisma](https://www.prisma.io/) 7 com adaptador `pg`
* **Validação:** Zod / React Hook Form
* **Integrações:** WhatsApp Cloud API (Meta), OpenAI, Cloudflare R2 (mídias), Web Push (Serwist)

## 📖 Documentação Adicional

Índice completo em [`docs/README.md`](docs/README.md). Os principais:
- `CLAUDE.md` (raiz): arquitetura, regras de segurança e convenções do código.
- `docs/LEGADO_soul.md`: princípios do projeto.
- `docs/LEGADO_roadmap.md`: roteiro estratégico do negócio para 2026.
- `docs/LEGADO_atendimento.md`: padrão de respostas para a IA de atendimento via WhatsApp.
- `docs/PLANO-OTIMIZACAO.md`: otimização de outubro/2026 (velocidade e segurança, com antes/depois).
- `docs/adr/`: decisões de arquitetura.
- `CHANGELOG.md` (raiz, só no computador, fora do git): histórico de versões.

---

### Scripts de Desenvolvimento

Para rodar este projeto em sua máquina local:

```bash
# Instalar as dependências
npm install

# Iniciar o servidor de desenvolvimento
npm run dev
```

> **Aviso de Segurança (Prisma + Supabase):** 
> Certifique-se de configurar o arquivo `.env` com as chaves locais do Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL` e `DIRECT_URL`) para o correto funcionamento do Auth e do Prisma Client antes da compilação.
