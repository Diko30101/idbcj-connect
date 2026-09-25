-- =====================================================================
-- IDBCJ MEMBER PORTAL - 023: Attendance Record draft -> submit
--
-- Gaya ng Abuluyan at iba pa sa Pangasiwaan: ang pagdalo ay sina-save
-- muna bilang DRAFT (pwedeng i-edit at i-save ulit), tapos makikita ang
-- talaan ng mga dumalo bago ito i-submit sa Finance Ministry. Pagka-
-- submit ay naka-lock na (hindi na pwedeng baguhin).
--
-- Ang migration na ito ay:
--   1. Nagdaragdag ng status column sa public.attendance_guests
--      (finance_record_status, default 'draft'). Ang
--      public.attendance_records ay may status na (mula 009/010).
--   2. Nagdaragdag ng UPDATE policies para sa submit (draft ->
--      submitted) sa roster context (Administrative / Local Admin
--      Ministry, bawat local) at admin. HINDI ginagalaw ang mga
--      existing na policies (permissive OR ang RLS).
--
-- Ipapatakbo sa Supabase > SQL Editor. Ligtas ulitin (idempotent).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. status column sa attendance_guests
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance_guests'
      and column_name = 'status'
  ) then
    alter table public.attendance_guests
      add column status public.finance_record_status not null default 'draft';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. UPDATE policies: submit (draft -> submitted) sa roster context
-- ---------------------------------------------------------------------
drop policy if exists attendance_records_update_submit on public.attendance_records;
create policy attendance_records_update_submit on public.attendance_records for update to authenticated
  using (
    (
      local_id in (select local_id from my_roster_locals)
      or public.is_admin()
    )
    and status = 'draft'
  )
  with check (
    (
      local_id in (select local_id from my_roster_locals)
      or public.is_admin()
    )
    and status = 'submitted'
  );

drop policy if exists attendance_guests_update_submit on public.attendance_guests;
create policy attendance_guests_update_submit on public.attendance_guests for update to authenticated
  using (
    (
      local_id in (select local_id from my_roster_locals)
      or public.is_admin()
    )
    and status = 'draft'
  )
  with check (
    (
      local_id in (select local_id from my_roster_locals)
      or public.is_admin()
    )
    and status = 'submitted'
  );

grant update on public.attendance_records to authenticated;
grant update on public.attendance_guests to authenticated;

commit;
