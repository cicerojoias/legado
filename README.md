# 💎 Projeto Legado — Cícero Joias

Este é o **Módulo Financeiro Oficial** da Cícero Joias, construído para substituir o registro financeiro em cadernos de papel por um ecossistema digital inteligente, rápido e seguro. A aplicação é desenhada com foco na experiência *mobile-first* para os operadores nas lojas físicas (João Pessoa e Santa Rita).

## 🚀 Status do Projeto

Atualmente, o projeto concluiu as Fases de Fundação, Estruturação de Banco de Dados, Segurança e o **Módulo de Atendimento WhatsApp Pro** (Fases 1-4 do atendimento).

### Fases Concluídas
* **Fase 1 (Fundação e Setup):** Next.js App Router, Tailwind CSS v4, Componentes Shadcn.
* **Fase 2 (Banco de Dados):** Supabase + Prisma. Modelagem de Financeiro e WhatsApp.
* **Fase 3 (Autenticação e Segurança):** Auth SSR, Middleware PIN e Proteção de Rotas.
* **Módulo WhatsApp Pro (Fases 1-4):** 
    - Inbox completa com suporte a mídias (Imagens, Áudios, Vídeos, Documentos).
    - Webhook assíncrono com processamento de mídias e status de entrega.
    - Sistema de exclusão/limpeza de conversas e integração com Supabase Storage.

### Próximas Fases (Roadmap)
* **Fase 5 (Motor Financeiro):** Módulo Hoje, Formulário de Lançamentos e Dashboard Administrativo.
* **Fase 6 (Relatórios e IA):** Processamento avançado de mídias recebidas e IA de Atendimento.
* **Fase 7 (Polimento Final):** Offline Sync e PWA.

## 🛠️ Stack Tecnológica

* **Framework:** [Next.js](https://nextjs.org/) (App Router + React 19)
* **Estilização:** Tailwind CSS v4 + [Framer Motion](https://www.framer.com/motion/)
* **Componentes UI:** [Shadcn UI](https://ui.shadcn.com/) / [Tremor](https://tremor.so/)
* **Banco de Dados:** [Supabase](https://supabase.com/) (PostgreSQL)
* **ORM:** [Prisma](https://www.prisma.io/)
* **Validação/Segurança:** Zod / React Hook Form

## 📖 Documentação Adicional

A documentação detalhada da visão de produto e do código-fonte pode ser encontrada na pasta `/docs`:
- `LEGADO_mvp_scope.md`: Escopo completo do MVP, usuários e permissões.
- `LEGADO_roadmap.md`: O roteiro estratégico do negócio para 2026.
- `LEGADO_plano_execucao_detalhado.md`: Lista detalhada de tarefas arquiteturais do sistema.
- `LEGADO_atendimento.md`: Padrão de respostas para a IA de Atendimento via WhatsApp.
- `CHANGELOG.md`: Histórico de alterações e auditorias de segurança na raiz do projeto.

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
