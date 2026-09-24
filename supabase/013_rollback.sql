-- =====================================================================
-- Rollback ng 013_roster_policies.sql -- ibinabalik ang mga policy ng
-- members mula sa 009 (Local Finance ang nag-i-insert; admin lang ang
-- nag-a-update).
-- =====================================================================

begin;

drop trigger if exists members_audit on public.members;
drop trigger if exists members_rules on public.members;
drop function if exists public.members_rules();

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'members' loop
    execute format('drop policy %I on public.members', r.policyname);
  end loop;
end $$;

create policy members_select on public.members for select to authenticated
  using (local_id in (select local_id from my_finance_locals)
         or local_id in (select local_id from my_oversight_locals)
         or public.is_admin());
create policy members_insert on public.members for insert to authenticated
  with check (local_id in (select local_id from my_finance_locals) or public.is_admin());
create policy members_update_admin_only on public.members for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.members from anon, authenticated;
grant select, insert, update, delete on public.members to authenticated;

drop function if exists public.is_roster_manager(uuid);

commit;
