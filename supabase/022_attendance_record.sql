-- =====================================================================
-- IDBCJ MEMBER PORTAL - 022: Attendance Record (Pangasiwaan)
--
-- Ang Attendance Record ay itinatala ng local secretary (Administrative
-- Ministry / Local Admin Ministry, bawat local) -- HINDI ng Finance.
-- Ang existing na public.attendance_records (mula 009, inayos ng 010)
-- ay per-local at naka-link na sa roster (public.members), kaya ito ang
-- gagamitin para sa mga kaanib. Tandaan: ang status enum sa production
-- ay finance_record_status na lowercase ('draft', 'submitted', 'void').
--
-- Ang migration na ito ay:
--   1. Gumagawa ng view my_roster_locals (mga local na sakop ng
--      naka-login sa ilalim ng Administrative / Local Admin Ministry --
--      kapareho ng ROSTER_MINISTRY_NAMES sa app).
--   2. Gumagawa ng public.attendance_guests para sa mga pangalan ng
--      bisita at mga kaanib na dumalo mula sa ibang local (free-text,
--      dahil walang read access ang local secretary sa roster ng ibang
--      local).
--   3. Nagdaragdag ng RLS policies sa attendance_records para sa roster
--      context: INSERT (bukod sa 010 policy na pang-Finance lang) at
--      DELETE ng draft (kailangan sa re-save: delete + insert ng
--      parehong petsa/uri). HINDI ginagalaw ang mga existing na 010
--      policies.
--
-- Ipapatakbo sa Supabase > SQL Editor. Ligtas ulitin (idempotent).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Helper view: mga local na sakop ng naka-login (roster context)
-- ---------------------------------------------------------------------
create or replace view my_roster_locals as
  select mm.local_id
  from public.ministry_members mm
  join public.ministries m on m.id = mm.ministry_id
  where mm.profile_id = auth.uid()
    and m.name in ('Administrative Ministry', 'Local Admin Ministry')
    and mm.local_id is not null;

-- ---------------------------------------------------------------------
-- 2. attendance_guests: bisita at kaanib galing ibang local, per
--    pagkakatipon (local_id + service_date + service_type)
-- ---------------------------------------------------------------------
create table if not exists public.attendance_guests (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locals (id),
  service_date date not null,
  service_type finance_service_type not null,
  name text not null,
  kind text not null check (kind in ('visitor', 'other_local')),
  home_local_id uuid references public.locals (id),
  recorded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists idx_attendance_guests_local_date
  on public.attendance_guests (local_id, service_date);

alter table public.attendance_guests enable row level security;

drop policy if exists attendance_guests_select on public.attendance_guests;
create policy attendance_guests_select on public.attendance_guests for select to authenticated
  using (
    local_id in (select local_id from my_roster_locals)
    or public.can_access_local(local_id)
    or public.is_admin()
  );

drop policy if exists attendance_guests_insert on public.attendance_guests;
create policy attendance_guests_insert on public.attendance_guests for insert to authenticated
  with check (
    local_id in (select local_id from my_roster_locals)
    or public.is_admin()
  );

drop policy if exists attendance_guests_delete on public.attendance_guests;
create policy attendance_guests_delete on public.attendance_guests for delete to authenticated
  using (
    local_id in (select local_id from my_roster_locals)
    or public.is_admin()
  );

revoke all on public.attendance_guests from anon;
revoke all on public.attendance_guests from authenticated;
grant select, insert, update, delete on public.attendance_guests to authenticated;

-- ---------------------------------------------------------------------
-- 3. attendance_records: idagdag na policies para sa roster context
--    (local secretary). Ang 010 policies ay nananatili; permissive OR
--    ang RLS kaya sapat ang idagdag.
-- ---------------------------------------------------------------------
drop policy if exists attendance_records_insert_roster on public.attendance_records;
create policy attendance_records_insert_roster on public.attendance_records for insert to authenticated
  with check (
    (
      local_id in (select local_id from my_roster_locals)
      or public.is_admin()
    )
    and status = 'draft'
  );

-- Re-save ng isang pagkakatipon = delete + insert ng parehong
-- local/petsa/uri. Draft lang ang pwedeng burahin.
drop policy if exists attendance_records_delete_draft on public.attendance_records;
create policy attendance_records_delete_draft on public.attendance_records for delete to authenticated
  using (
    (
      local_id in (select local_id from my_roster_locals)
      or public.is_admin()
    )
    and status = 'draft'
  );

grant delete on public.attendance_records to authenticated;

commit;
