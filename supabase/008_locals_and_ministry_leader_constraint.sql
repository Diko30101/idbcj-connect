-- =====================================================================
-- IDBCJ MEMBER PORTAL - 008: Locals table (scalable, kapalit ng
--   hardcoded locality enum) + isang leader lang bawat locality
--   bawat ministry (Local Finance Ministry, Local Admin Ministry, atbp.)
--
-- ADDITIVE LANG ITONG MIGRATION -- hindi tinatanggal o binabago ang
-- existing na `locality` text/check columns sa profiles, events, at
-- financial_records. Bagong `local_id` column lang ang idinadagdag sa
-- tabi ng luma. Ang paglipat ng app code papuntang local_id ay hiwalay
-- na follow-up task (code changes sa /app), hindi kasama dito.
--
-- MAHALAGA: ang lumang locality enum value na 'batangas' ay hindi
-- pareho sa bagong locals.key na 'sto_tomas' -- ang "Batangas" ay
-- lalawigan (province), hindi specific na local; ang totoong local ay
-- nasa Sto. Tomas, Batangas (Sta Teresita). Kaya may explicit mapping
-- table sa ibaba (_locality_to_local_key) sa halip na direktang
-- string match.
--
-- Ipapatakbo ng Presiding Minister sa Supabase > SQL Editor.
-- Ligtas itong patakbuhin ulit (idempotent). Nasa loob ito ng isang
-- transaction: kung may error, walang mababago.
-- Ang rollback ay nasa 008_rollback.sql.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. LOCALS (scalable -- hindi na hardcoded na enum)
-- ---------------------------------------------------------------------
create table if not exists public.locals (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,   -- stable code, hindi kinakailangang tumugma sa lumang enum value
  name text not null,
  timezone text not null default 'Asia/Manila',
  created_at timestamptz not null default now()
);

insert into public.locals (key, name, timezone) values
  ('medina', 'Medina', 'Asia/Manila'),
  ('sto_tomas', 'Sta Teresita', 'Asia/Manila'),
  ('fort_mcmurray', 'Fort McMurray', 'America/Edmonton'),
  ('other', 'Other', 'Asia/Manila')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 2. Bagong local_id column (nullable, additive) sa mga existing table.
--    Hindi tinatanggal ang lumang locality column.
-- ---------------------------------------------------------------------
alter table public.profiles          add column if not exists local_id uuid references public.locals (id);
alter table public.events            add column if not exists local_id uuid references public.locals (id);
alter table public.financial_records add column if not exists local_id uuid references public.locals (id);

-- ---------------------------------------------------------------------
-- 3. Explicit mapping: lumang locality enum value -> bagong locals.key.
--    'batangas' (luma) -> 'sto_tomas' (bago) -- HINDI direktang
--    pagkakapareho ng string, dahil "Batangas" ay lalawigan, hindi
--    specific na local.
-- ---------------------------------------------------------------------
create temporary table _locality_to_local_key (locality text primary key, local_key text not null) on commit drop;
insert into _locality_to_local_key (locality, local_key) values
  ('medina', 'medina'),
  ('batangas', 'sto_tomas'),
  ('fort_mcmurray', 'fort_mcmurray'),
  ('other', 'other');

update public.profiles p
set local_id = l.id
from _locality_to_local_key map
join public.locals l on l.key = map.local_key
where p.locality = map.locality;

update public.events e
set local_id = l.id
from _locality_to_local_key map
join public.locals l on l.key = map.local_key
where e.locality = map.locality;

update public.financial_records f
set local_id = l.id
from _locality_to_local_key map
join public.locals l on l.key = map.local_key
where f.locality = map.locality;

-- ---------------------------------------------------------------------
-- 4. MINISTRY_MEMBERS: idagdag ang local_id (denormalized mula sa
--    profile ng kasapi) at panatilihin itong naka-sync via trigger,
--    para magamit sa unique constraint sa hakbang 5.
-- ---------------------------------------------------------------------
alter table public.ministry_members add column if not exists local_id uuid references public.locals (id);

update public.ministry_members mm
set local_id = p.local_id
from public.profiles p
where p.id = mm.profile_id;

create or replace function public.sync_ministry_member_local_id()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select local_id into new.local_id from public.profiles where id = new.profile_id;
  return new;
end $$;

drop trigger if exists ministry_members_sync_local on public.ministry_members;
create trigger ministry_members_sync_local
  before insert or update of profile_id on public.ministry_members
  for each row execute function public.sync_ministry_member_local_id();

create or replace function public.propagate_profile_local_id()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.local_id is distinct from old.local_id then
    update public.ministry_members set local_id = new.local_id where profile_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists profiles_propagate_local_id on public.profiles;
create trigger profiles_propagate_local_id
  after update of local_id on public.profiles
  for each row execute function public.propagate_profile_local_id();

-- ---------------------------------------------------------------------
-- 5. Isang leader (is_leader = true) lang bawat (ministry, local).
--    Generic ito -- ipapatupad sa lahat ng ministry, hindi lang sa
--    Local Finance Ministry/Local Admin Ministry.
-- ---------------------------------------------------------------------
drop index if exists ministry_members_one_leader_per_local;
create unique index ministry_members_one_leader_per_local
  on public.ministry_members (ministry_id, local_id)
  where is_leader = true and local_id is not null;

-- ---------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY para sa locals
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'locals'
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

alter table public.locals enable row level security;

create policy locals_select on public.locals for select to authenticated
  using (public.is_member());
create policy locals_write on public.locals for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.locals from anon;
revoke all on public.locals from authenticated;
grant select, insert, update, delete on public.locals to authenticated;

commit;
