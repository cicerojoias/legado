# Santa Rita no cadastro de usuários

A unificação de agosto de 2026 (v0.18.74) já consolidou a operação em Santa Rita. A consulta de 23/11/2026 ao Supabase confirmou os 8 perfis e os 3.511 lançamentos em Santa Rita. A coluna `public.users."lojaAutorizada"` ainda tem `JOAO_PESSOA` como padrão, e os formulários de criação, vínculo e edição ainda aceitam as opções antigas.

1. Fixar Santa Rita no servidor e nos formulários de usuários. Retirar a preferência de loja do Perfil, pois deixou de ter efeito na operação de loja única.
2. Ajustar o padrão no schema Prisma e preparar a restrição em `prisma/sql/usuarios-santa-rita.sql`. A atualização corrige possíveis vínculos legados em `public.users` e preserva o enum compartilhado com o financeiro.
3. Verificar a restauração do backup fora de produção. Com aprovação, publicar a aplicação e aplicar o SQL. Conferir a restrição, as contagens e o acesso às páginas após a publicação.

## Validação antes da publicação

- Backup `legado-public-20261123-antes-usuarios-santa-rita.dump` em `Documentos/Cícero Joias/Backups`. As 16 tabelas do schema `public` foram restauradas em PostgreSQL local. A cópia tinha 9 perfis (todos em Santa Rita), 3.511 lançamentos e 1 custo fixo, iguais à segunda conferência de produção.
- Na cópia, a atualização corrigiu vínculos simulados de João Pessoa e Ambas, preservou os dados financeiros e a RLS, atribuiu Santa Rita por padrão e rejeitou novas gravações nas lojas antigas. A segunda execução do SQL preservou os registros já normalizados.
