-- Proteção do banco contra acesso pela chave pública do Supabase (S1 do plano de otimização).
--
-- Contexto: o app grava e lê tudo pelo Prisma (usuário postgres, que ignora RLS).
-- O navegador só usa o Supabase para: (1) ler o próprio usuário (papel/loja) e
-- (2) ouvir mudanças em tempo real do inbox. Todo o resto fica fechado.
--
-- `prisma db push` não liga RLS nem mexe em permissões: rode este arquivo de novo
-- sempre que criar uma tabela nova. É idempotente (pode rodar várias vezes).
-- Para desfazer: rls-rollback.sql.

begin;

-- 1. Tira todas as permissões das chaves públicas (anon = sem login, authenticated = logado)
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated, public;

-- Tabelas, sequências e funções criadas no futuro também nascem fechadas
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated, public;

-- 2. RLS ligado em todas as tabelas do esquema public
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- 3. Remove as políticas antigas (algumas liberavam leitura sem login)
do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- 4. Papel do usuário logado (só se estiver ativo). security definer: lê users sem depender da política dela.
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public
as $$ select role::text from public.users where id = auth.uid()::text and ativo $$;
revoke execute on function public.app_role() from public, anon;
grant execute on function public.app_role() to authenticated;

-- 5. Leitura mínima para o navegador logado
grant select on public.users, public.wa_conversations, public.wa_messages,
  public.wa_conversation_reads, public.wa_conversation_notes to authenticated;

-- Cada um lê só o próprio cadastro (menu e proxy usam isso para saber o papel)
create policy users_proprio_select on public.users
  for select to authenticated using (id = auth.uid()::text);

-- Inbox em tempo real: só GERENTE, ADMIN e SUPER_ADMIN ativos
create policy wa_conversations_equipe_select on public.wa_conversations
  for select to authenticated using (public.app_role() in ('GERENTE', 'ADMIN', 'SUPER_ADMIN'));
create policy wa_messages_equipe_select on public.wa_messages
  for select to authenticated using (public.app_role() in ('GERENTE', 'ADMIN', 'SUPER_ADMIN'));
create policy wa_conversation_notes_equipe_select on public.wa_conversation_notes
  for select to authenticated using (public.app_role() in ('GERENTE', 'ADMIN', 'SUPER_ADMIN'));
create policy wa_conversation_reads_proprio_select on public.wa_conversation_reads
  for select to authenticated using ("userId" = auth.uid()::text and public.app_role() in ('GERENTE', 'ADMIN', 'SUPER_ADMIN'));

commit;
