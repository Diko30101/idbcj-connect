-- =====================================================================
-- IDBCJ MEMBER PORTAL - 011: Ambagan, Tulong sa Klase Ministeryal,
--   at Pasalamat (per-member, buwan-buwan / per petsa)
--
-- DRAFT -- HINDI PA NAKA-APPLY. Kailangan ang 010 muna. Ilalapat ito
-- KASABAY ng 012 (ang validation ng kaanib ay ikinakabit doon).
--
-- Doktrina (ipinapatupad sa database):
--   * member_id NOT NULL, FK sa public.members (walang free-text na
--     pangalan ng nagbibigay)
--   * amount > 0 lang ang validation ng halaga; walang default na halaga
--   * walang unique constraint sa (member_id, period_month)
--   * currency ay laging 'PHP' (itinatakda ng trigger, hindi ng client)
--   * walang DELETE; status='void' ang paraan ng pagbabalewala
--
-- Nagba-drop ng member_collections at thanksgiving_offerings (mula 009)
-- LAMANG kung 0 ang laman ng dalawa. Kung hindi, mag-a-abort ang buong
-- migration. Ang thanksgiving_types (4 na default na row) ay NANANATILI
-- (desisyon ng Admin, 2026-09-23); wala nang umaasa rito pagkatapos ng drop.
-- Rollback: 011_rollback.sql
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. GUARD + DROP ng mga lumang table (0 row lang)
-- ---------------------------------------------------------------------
do $$
declare n_mc bigint := 0; n_to bigint := 0;
begin
  if to_regclass('public.member_collections') is not null then
    execute 'select count(*) from public.member_collections' into n_mc;
  end if;
  if to_regclass('public.thanksgiving_offerings') is not null then
    execute 'select count(*) from public.thanksgiving_offerings' into n_to;
  end if;
  if n_mc <> 0 or n_to <> 0 then
    raise exception 'Hindi 0 ang laman: member_collections=%, thanksgiving_offerings=%. Walang binago.', n_mc, n_to;
  end if;
end $$;

drop table if exists public.thanksgiving_offerings;
drop table if exists public.member_collections;
drop type if exists public.member_collection_type;
-- Kung may umaasa pa sa record_status, mag-e-error ito at babawiin ang lahat:
drop type if exists public.record_status;

-- ---------------------------------------------------------------------
-- 2. ENUM
-- ---------------------------------------------------------------------
do $$ begin
  create type public.pasalamat_type as enum ('new_year', 'anniversary', 'extra', 'private');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 3. CURRENCY: laging PHP (isang currency sa buong sistema)
-- ---------------------------------------------------------------------
create or replace function public.force_currency_php()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.currency := 'PHP';
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 4. MGA TABLE
-- ---------------------------------------------------------------------
create table if not exists public.ambagan_records (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locals (id),
  member_id uuid not null references public.members (id),
  period_month date not null check (period_month = date_trunc('month', period_month)::date),
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'PHP' check (currency = 'PHP'),
  date_received date not null,
  notes text,
  status public.finance_record_status not null default 'draft',
  encoded_by uuid not null references public.profiles (id),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_ambagan_local_month on public.ambagan_records (local_id, period_month);
create index if not exists idx_ambagan_member on public.ambagan_records (member_id);

create table if not exists public.tulong_klase_records (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locals (id),
  member_id uuid not null references public.members (id),
  period_month date not null check (period_month = date_trunc('month', period_month)::date),
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'PHP' check (currency = 'PHP'),
  date_received date not null,
  notes text,
  status public.finance_record_status not null default 'draft',
  encoded_by uuid not null references public.profiles (id),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tulong_local_month on public.tulong_klase_records (local_id, period_month);
create index if not exists idx_tulong_member on public.tulong_klase_records (member_id);

create table if not exists public.pasalamat_records (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.locals (id),
  member_id uuid not null references public.members (id),
  type public.pasalamat_type not null,
  date date not null,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'PHP' check (currency = 'PHP'),
  notes text,
  status public.finance_record_status not null default 'draft',
  encoded_by uuid not null references public.profiles (id),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_pasalamat_local_date on public.pasalamat_records (local_id, date);
create index if not exists idx_pasalamat_member on public.pasalamat_records (member_id);

-- ---------------------------------------------------------------------
-- 5. TRIGGERS (transition rules, currency, audit)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['ambagan_records', 'tulong_klase_records', 'pasalamat_records'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_rules', t);
    execute format(
      'create trigger %I before insert or update on public.%I for each row '
      || 'execute function public.enforce_finance_record_rules(''encoded_by'', ''submitted_at'')',
      t || '_rules', t);

    execute format('drop trigger if exists %I on public.%I', t || '_currency', t);
    execute format(
      'create trigger %I before insert or update on public.%I for each row '
      || 'execute function public.force_currency_php()', t || '_currency', t);

    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format(
      'create trigger %I after update on public.%I for each row execute function public.finance_audit()',
      t || '_audit', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6. RLS -- per-member na halaga: church-wide Finance at Finance ng
--    tumanggap na local LAMANG. Walang is_admin(), walang Local Admin.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  r record;
begin
  foreach t in array array['ambagan_records', 'tulong_klase_records', 'pasalamat_records'] loop
    for r in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', r.policyname, t);
    end loop;

    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_access_local(local_id))',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated '
      || 'with check (public.can_access_local(local_id) and status = ''draft'')',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated '
      || 'using (public.can_access_local(local_id) and (status = ''draft'' or public.is_church_wide_finance())) '
      || 'with check (public.can_access_local(local_id))',
      t || '_update', t);

    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
end $$;

commit;
