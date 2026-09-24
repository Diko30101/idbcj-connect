-- =====================================================================
-- Rollback ng 010_finance_access_audit.sql
-- Ibinabalik ang status sa record_status (Draft/Submitted), ang mga policy
-- ng 009, at inaalis ang lahat ng idinagdag ng 010.
-- PAALALA: kailangang naka-rollback na muna ang 013, 012, at 011 (ang mga
-- iyon ay umaasa sa mga function dito).
-- Ang status na 'void' ay hindi maibabalik: ang mga row na void ay
-- magiging 'Submitted' (walang katumbas sa lumang enum). Suriin muna:
--   select count(*) from abuluyan_totals where status = 'void';
-- =====================================================================

begin;

drop trigger if exists abuluyan_totals_sunday on public.abuluyan_totals;
drop function if exists public.abuluyan_require_sunday();

drop trigger if exists abuluyan_totals_rules on public.abuluyan_totals;
drop trigger if exists attendance_records_rules on public.attendance_records;
drop trigger if exists abuluyan_totals_audit on public.abuluyan_totals;
drop trigger if exists attendance_records_audit on public.attendance_records;
drop trigger if exists ministry_members_audit on public.ministry_members;
drop trigger if exists ministry_members_guard_finance_scope on public.ministry_members;
drop trigger if exists profiles_guard_local_id on public.profiles;
drop function if exists public.guard_profile_local_id();

-- Ibalik ang orihinal na mm_write (is_staff() para sa lahat ng ministry)
drop policy if exists mm_write on public.ministry_members;
create policy mm_write on public.ministry_members for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
drop function if exists public.is_protected_ministry(uuid);

do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('abuluyan_totals', 'attendance_records')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['abuluyan_totals', 'attendance_records'] loop
    if (select udt_name from information_schema.columns
        where table_schema = 'public' and table_name = t and column_name = 'status') = 'finance_record_status' then
      execute format('alter table public.%I alter column status drop default', t);
      execute format(
        'alter table public.%I alter column status type public.record_status using (case status::text '
        || 'when ''draft'' then ''Draft'' else ''Submitted'' end)::public.record_status', t);
      execute format('alter table public.%I alter column status set default ''Draft''', t);
    end if;
  end loop;
end $$;

-- Mga policy ng 009 para sa abuluyan_totals at attendance_records
create policy attendance_records_select on public.attendance_records for select to authenticated
  using (local_id in (select local_id from my_finance_locals)
         or local_id in (select local_id from my_oversight_locals) or public.is_admin());
create policy attendance_records_insert on public.attendance_records for insert to authenticated
  with check (local_id in (select local_id from my_finance_locals));
create policy attendance_records_update_draft_only on public.attendance_records for update to authenticated
  using (status = 'Draft' and local_id in (select local_id from my_finance_locals))
  with check (local_id in (select local_id from my_finance_locals));
create policy attendance_records_update_admin on public.attendance_records for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy abuluyan_select on public.abuluyan_totals for select to authenticated
  using (local_id in (select local_id from my_finance_locals)
         or local_id in (select local_id from my_oversight_locals) or public.is_admin());
create policy abuluyan_insert on public.abuluyan_totals for insert to authenticated
  with check (local_id in (select local_id from my_finance_locals));
create policy abuluyan_update_draft_only on public.abuluyan_totals for update to authenticated
  using (status = 'Draft' and local_id in (select local_id from my_finance_locals))
  with check (local_id in (select local_id from my_finance_locals));
create policy abuluyan_update_admin on public.abuluyan_totals for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.abuluyan_totals, public.attendance_records from anon, authenticated;
grant select, insert, update, delete on public.abuluyan_totals, public.attendance_records to authenticated;

drop function if exists public.enforce_finance_record_rules();
drop function if exists public.finance_audit();
drop table if exists public.finance_audit_log;

drop function if exists public.can_read_local_attendance(uuid);
drop function if exists public.can_access_local(uuid);
drop function if exists public.is_local_finance(uuid);
drop function if exists public.is_church_wide_finance();
drop function if exists public.is_pastoral_leader();
drop function if exists public.guard_finance_scope();

alter table public.ministry_members drop constraint if exists ministry_members_finance_scope_check;
alter table public.ministry_members drop column if exists finance_scope;

drop table if exists public.app_config;
drop type if exists public.finance_record_status;

commit;
