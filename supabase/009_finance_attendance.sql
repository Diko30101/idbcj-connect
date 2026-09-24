-- =====================================================================
-- IDBCJ MEMBER PORTAL - 009: Attendance/Finance encoding (Abuluyan,
--   Ambagan, Tulong sa Klase Ministeryal, Thanksgiving Offerings)
--
-- Ipapatakbo ng Presiding Minister sa Supabase > SQL Editor.
--
-- Batayan ng identity: public.profiles / auth.users (walang hiwalay
-- na login table). Batayan ng "sino ang encoder/overseer bawat local":
-- ang EXISTING na Ministry system (public.ministries + ministry_members),
-- HINDI isang bagong local_roles table:
--   * "local_secretary" (dating disenyo) = kasapi ng ministry na
--     may pangalang 'Local Finance Ministry', naka-scope sa
--     ministry_members.local_id (dinagdag na sa 008).
--   * "local_minister" (dating disenyo) = kasapi ng ministry na
--     may pangalang 'Local Admin Ministry' -- READ-ONLY oversight
--     lang, gaya ng orihinal na disenyo.
--   * "pangasiwaan" (church-wide oversight) = public.profiles.role = 'admin'
--     -- gamit ang existing public.is_admin().
-- Ang "locals" ay ang EXISTING public.locals mula sa 008 -- walang
-- bagong locals table dito.
--
-- Ligtas itong patakbuhin ulit (idempotent). Nasa loob ito ng isang
-- transaction: kung may error, walang mababago.
-- Ang rollback ay nasa 009_rollback.sql.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. ENUM TYPES
-- ---------------------------------------------------------------------
do $$ begin
  create type member_status as enum ('Active', 'Inactive', 'Pagtitiwalag');
exception when duplicate_object then null; end $$;

do $$ begin
  create type record_status as enum ('Draft', 'Submitted', 'Reviewed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type finance_service_type as enum (
    'Linggo',
    'New Year Thanksgiving',
    'Anniversary Thanksgiving',
    'Extra Thanksgiving',
    'Private Thanksgiving'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type member_collection_type as enum ('Ambagan', 'Tulong sa Klase Ministeryal');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. HELPER VIEWS -- batay sa EXISTING ministry_members (hindi bagong
--    local_roles table). Ang ministry_members.local_id ay dinagdag na
--    sa 008 at naka-sync via trigger mula sa profile ng kasapi.
-- ---------------------------------------------------------------------
create or replace view my_finance_locals as
  select mm.local_id
  from public.ministry_members mm
  join public.ministries m on m.id = mm.ministry_id
  where mm.profile_id = auth.uid()
    and m.name = 'Local Finance Ministry'
    and mm.local_id is not null;

create or replace view my_oversight_locals as
  select mm.local_id
  from public.ministry_members mm
  join public.ministries m on m.id = mm.ministry_id
  where mm.profile_id = auth.uid()
    and m.name = 'Local Admin Ministry'
    and mm.local_id is not null;

-- ---------------------------------------------------------------------
-- 3. MEMBERS -- roster ng kongregasyon per local. Hindi lahat may
--    portal login, kaya nullable at optional ang link sa profiles.
-- ---------------------------------------------------------------------
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locals (id),
  profile_id uuid unique references public.profiles (id),
  full_name text not null,
  status member_status not null default 'Active',
  status_changed_at timestamptz,
  status_changed_by uuid references public.profiles (id),
  status_reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_members_local on public.members (local_id);

create table if not exists public.thanksgiving_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

insert into public.thanksgiving_types (name) values
  ('New Year Thanksgiving'),
  ('Anniversary Thanksgiving'),
  ('Extra Thanksgiving'),
  ('Private Thanksgiving')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- 4. ATTENDANCE (per-local, per-member, per-service encoding -- hiwalay
--    sa existing public.attendance na per-service lang, walang local_id)
-- ---------------------------------------------------------------------
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id),
  local_id uuid not null references public.locals (id),
  service_date date not null,
  service_type finance_service_type not null,
  present boolean not null default true,
  recorded_by uuid not null references public.profiles (id),
  status record_status not null default 'Draft',
  submitted_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_attendance_records_local_date on public.attendance_records (local_id, service_date);
create index if not exists idx_attendance_records_member on public.attendance_records (member_id);

-- ---------------------------------------------------------------------
-- 5. ABULUYAN (aggregate/anonymous, per local per Sunday)
-- ---------------------------------------------------------------------
create table if not exists public.abuluyan_totals (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locals (id),
  service_date date not null,
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  recorded_by uuid not null references public.profiles (id),
  status record_status not null default 'Draft',
  submitted_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_abuluyan_local_date on public.abuluyan_totals (local_id, service_date);

-- ---------------------------------------------------------------------
-- 6. AMBAGAN + TULONG SA KLASE MINISTERYAL (individual, per member)
-- ---------------------------------------------------------------------
create table if not exists public.member_collections (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id),
  local_id uuid not null references public.locals (id),
  collection_type member_collection_type not null,
  amount numeric(12, 2) not null check (amount >= 0),
  service_date date not null,
  -- Tulong sa Klase Ministeryal: normal practice is once/month, last Sunday --
  -- pero HINDI ito rigid na rule (may exceptions), kaya walang DB-level CHECK
  -- constraint dito. App/form layer lang ang naglalagay ng soft warning.
  is_standard_schedule boolean,
  recorded_by uuid not null references public.profiles (id),
  status record_status not null default 'Draft',
  submitted_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_member_collections_local_date on public.member_collections (local_id, service_date);
create index if not exists idx_member_collections_member on public.member_collections (member_id);

-- ---------------------------------------------------------------------
-- 7. THANKSGIVING OFFERINGS (individual, envelope-based)
-- ---------------------------------------------------------------------
create table if not exists public.thanksgiving_offerings (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members (id),  -- nullable: envelope name may not match a registered member
  given_name text not null,                        -- name as written on the envelope
  local_id uuid not null references public.locals (id),
  thanksgiving_type_id uuid not null references public.thanksgiving_types (id),
  reason text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  service_date date not null,
  recorded_by uuid not null references public.profiles (id),
  status record_status not null default 'Draft',
  submitted_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_thanksgiving_offerings_local_date on public.thanksgiving_offerings (local_id, service_date);
create index if not exists idx_thanksgiving_offerings_member on public.thanksgiving_offerings (member_id);

-- ---------------------------------------------------------------------
-- 8. BATCH TRACKING para sa Pangasiwaan (admin) submissions
-- ---------------------------------------------------------------------
create table if not exists public.pangasiwaan_submissions (
  id uuid primary key default gen_random_uuid(),
  klase_ministerial_date date not null,
  submitted_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.abuluyan_totals
  add column if not exists submission_batch_id uuid references public.pangasiwaan_submissions (id);
alter table public.member_collections
  add column if not exists submission_batch_id uuid references public.pangasiwaan_submissions (id);
alter table public.thanksgiving_offerings
  add column if not exists submission_batch_id uuid references public.pangasiwaan_submissions (id);

-- ---------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY: buksan at burahin ang lumang policy (kung meron)
--    Hindi kasama ang public.locals/public.ministry_members dito --
--    existing na ang RLS nila mula sa 008.
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('members', 'attendance_records', 'abuluyan_totals',
                        'member_collections', 'thanksgiving_offerings',
                        'thanksgiving_types', 'pangasiwaan_submissions')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

alter table public.members                 enable row level security;
alter table public.attendance_records      enable row level security;
alter table public.abuluyan_totals         enable row level security;
alter table public.member_collections      enable row level security;
alter table public.thanksgiving_offerings  enable row level security;
alter table public.thanksgiving_types      enable row level security;
alter table public.pangasiwaan_submissions enable row level security;

-- thanksgiving_types: reference data, kahit sino makakabasa, admin lang gumagalaw
create policy thanksgiving_types_select on public.thanksgiving_types for select to authenticated
  using (public.is_member());
create policy thanksgiving_types_write on public.thanksgiving_types for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- members: sariling local (Local Finance Ministry o Local Admin Ministry
-- kasapi) o admin ang makakakita. Status change (Active/Inactive/
-- Pagtitiwalag) -- admin (Pangasiwaan) LANG, hindi puwede ang
-- Local Admin Ministry (dating "local_minister").
create policy members_select on public.members for select to authenticated
  using (
    local_id in (select local_id from my_finance_locals)
    or local_id in (select local_id from my_oversight_locals)
    or public.is_admin()
  );
create policy members_insert on public.members for insert to authenticated
  with check (
    local_id in (select local_id from my_finance_locals)
    or public.is_admin()
  );
create policy members_update_admin_only on public.members for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- attendance_records
create policy attendance_records_select on public.attendance_records for select to authenticated
  using (
    local_id in (select local_id from my_finance_locals)
    or local_id in (select local_id from my_oversight_locals)
    or public.is_admin()
  );
create policy attendance_records_insert on public.attendance_records for insert to authenticated
  with check (
    local_id in (select local_id from my_finance_locals)
  );
create policy attendance_records_update_draft_only on public.attendance_records for update to authenticated
  using (
    status = 'Draft'
    and local_id in (select local_id from my_finance_locals)
  )
  with check (
    local_id in (select local_id from my_finance_locals)
  );
create policy attendance_records_update_admin on public.attendance_records for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- abuluyan_totals (parehong pattern gaya ng attendance)
create policy abuluyan_select on public.abuluyan_totals for select to authenticated
  using (
    local_id in (select local_id from my_finance_locals)
    or local_id in (select local_id from my_oversight_locals)
    or public.is_admin()
  );
create policy abuluyan_insert on public.abuluyan_totals for insert to authenticated
  with check (
    local_id in (select local_id from my_finance_locals)
  );
create policy abuluyan_update_draft_only on public.abuluyan_totals for update to authenticated
  using (
    status = 'Draft'
    and local_id in (select local_id from my_finance_locals)
  )
  with check (
    local_id in (select local_id from my_finance_locals)
  );
create policy abuluyan_update_admin on public.abuluyan_totals for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- member_collections (Ambagan + Tulong sa Klase Ministeryal)
create policy member_collections_select on public.member_collections for select to authenticated
  using (
    local_id in (select local_id from my_finance_locals)
    or local_id in (select local_id from my_oversight_locals)
    or public.is_admin()
  );
create policy member_collections_insert on public.member_collections for insert to authenticated
  with check (
    local_id in (select local_id from my_finance_locals)
  );
create policy member_collections_update_draft_only on public.member_collections for update to authenticated
  using (
    status = 'Draft'
    and local_id in (select local_id from my_finance_locals)
  )
  with check (
    local_id in (select local_id from my_finance_locals)
  );
create policy member_collections_update_admin on public.member_collections for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- thanksgiving_offerings
create policy thanksgiving_offerings_select on public.thanksgiving_offerings for select to authenticated
  using (
    local_id in (select local_id from my_finance_locals)
    or local_id in (select local_id from my_oversight_locals)
    or public.is_admin()
  );
create policy thanksgiving_offerings_insert on public.thanksgiving_offerings for insert to authenticated
  with check (
    local_id in (select local_id from my_finance_locals)
  );
create policy thanksgiving_offerings_update_draft_only on public.thanksgiving_offerings for update to authenticated
  using (
    status = 'Draft'
    and local_id in (select local_id from my_finance_locals)
  )
  with check (
    local_id in (select local_id from my_finance_locals)
  );
create policy thanksgiving_offerings_update_admin on public.thanksgiving_offerings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- pangasiwaan_submissions -- admin (Pangasiwaan) lang
create policy pangasiwaan_submissions_admin_only on public.pangasiwaan_submissions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 10. PERMISSIONS: walang access ang hindi naka-login (anon)
-- ---------------------------------------------------------------------
revoke all on public.members, public.attendance_records, public.abuluyan_totals,
  public.member_collections, public.thanksgiving_offerings, public.thanksgiving_types,
  public.pangasiwaan_submissions
  from anon;

revoke all on public.members, public.attendance_records, public.abuluyan_totals,
  public.member_collections, public.thanksgiving_offerings, public.thanksgiving_types,
  public.pangasiwaan_submissions
  from authenticated;

grant select, insert, update, delete on
  public.members, public.attendance_records, public.abuluyan_totals,
  public.member_collections, public.thanksgiving_offerings, public.thanksgiving_types,
  public.pangasiwaan_submissions
  to authenticated;

commit;
