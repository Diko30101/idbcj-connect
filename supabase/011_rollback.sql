-- =====================================================================
-- Rollback ng 011_giving_records.sql
-- BABALA: binubura nito ang ambagan_records, tulong_klase_records, at
-- pasalamat_records at ang LAHAT ng laman. Mag-export muna kung may laman.
-- Ibinabalik ang walang-laman na member_collections, thanksgiving_types
-- (may 4 na seed row), at thanksgiving_offerings gaya ng sa 009.
-- Ang record_status enum ay ibinabalik din (kailangan ng 010_rollback).
-- Ilapat ang 012_rollback.sql bago ito.
-- =====================================================================

begin;

drop table if exists public.pasalamat_records;
drop table if exists public.tulong_klase_records;
drop table if exists public.ambagan_records;
drop function if exists public.force_currency_php();
drop type if exists public.pasalamat_type;

do $$ begin
  create type public.record_status as enum ('Draft', 'Submitted', 'Reviewed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.member_collection_type as enum ('Ambagan', 'Tulong sa Klase Ministeryal');
exception when duplicate_object then null; end $$;

create table if not exists public.thanksgiving_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);
insert into public.thanksgiving_types (name) values
  ('New Year Thanksgiving'), ('Anniversary Thanksgiving'),
  ('Extra Thanksgiving'), ('Private Thanksgiving')
on conflict (name) do nothing;

create table if not exists public.member_collections (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id),
  local_id uuid not null references public.locals (id),
  collection_type public.member_collection_type not null,
  amount numeric(12, 2) not null check (amount >= 0),
  service_date date not null,
  is_standard_schedule boolean,
  recorded_by uuid not null references public.profiles (id),
  status public.record_status not null default 'Draft',
  submitted_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submission_batch_id uuid references public.pangasiwaan_submissions (id)
);

create table if not exists public.thanksgiving_offerings (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members (id),
  given_name text not null,
  local_id uuid not null references public.locals (id),
  thanksgiving_type_id uuid not null references public.thanksgiving_types (id),
  reason text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  service_date date not null,
  recorded_by uuid not null references public.profiles (id),
  status public.record_status not null default 'Draft',
  submitted_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submission_batch_id uuid references public.pangasiwaan_submissions (id)
);

-- Ang RLS ng tatlong ito ay ibalik sa pamamagitan ng muling pagpapatakbo ng
-- seksyon 9 ng 009_finance_attendance.sql kung kailangan (walang laman ang mga ito).
alter table public.thanksgiving_types enable row level security;
alter table public.member_collections enable row level security;
alter table public.thanksgiving_offerings enable row level security;

commit;
