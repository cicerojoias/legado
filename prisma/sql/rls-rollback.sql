-- Desfaz rls-seguranca.sql e volta ao estado de 21/10/2026 (antes da correção).
-- Gerado a partir do backup banco-2026-10-21-antes-rls/_resumo.json. Use só em emergência:
-- ele reabre o banco para a chave pública.

begin;

-- Políticas novas e função
drop policy if exists users_proprio_select on public.users;
drop policy if exists wa_conversations_equipe_select on public.wa_conversations;
drop policy if exists wa_messages_equipe_select on public.wa_messages;
drop policy if exists wa_conversation_notes_equipe_select on public.wa_conversation_notes;
drop policy if exists wa_conversation_reads_proprio_select on public.wa_conversation_reads;
drop function if exists public.app_role();

-- Políticas originais
create policy wab_messages_auth_select on public.wa_messages as permissive for select to anon,authenticated using (true);
create policy wab_message_generations_auth_select on public.wa_message_generations as permissive for select to authenticated using (true);
create policy wab_conversations_auth_select on public.wa_conversations as permissive for select to anon,authenticated using (true);
create policy wab_contacts_auth_select on public.wa_contacts as permissive for select to authenticated using (true);
create policy wab_push_subscriptions_own_delete on public.wa_push_subscriptions as permissive for delete to authenticated using (("userId" = (auth.uid())::text));
create policy wab_push_subscriptions_own_insert on public.wa_push_subscriptions as permissive for insert to authenticated with check (("userId" = (auth.uid())::text));
create policy wab_push_subscriptions_own_select on public.wa_push_subscriptions as permissive for select to authenticated using (("userId" = (auth.uid())::text));
create policy wab_conv_reads_own_insert on public.wa_conversation_reads as permissive for insert to authenticated with check (("userId" = (auth.uid())::text));
create policy wab_conv_reads_own_select on public.wa_conversation_reads as permissive for select to authenticated using (("userId" = (auth.uid())::text));
create policy wab_conv_reads_own_update on public.wa_conversation_reads as permissive for update to authenticated using (("userId" = (auth.uid())::text));

-- RLS volta a ficar desligado onde estava
alter table public.conversation_tags disable row level security;
alter table public.custos_fixos disable row level security;
alter table public.lancamentos disable row level security;
alter table public.logs disable row level security;
alter table public.users disable row level security;
alter table public.wa_conversation_notes disable row level security;
alter table public.wa_settings disable row level security;
alter table public.wa_tags disable row level security;

-- Permissões padrão do Supabase
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated, public;
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated;
alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated, public;

commit;
