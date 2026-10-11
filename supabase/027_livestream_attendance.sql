-- Migration: Livestream online attendance
-- Table para sa pag-track kung sinong members ang nanonood ng livestream sa portal

begin;

create table if not exists public.livestream_attendance (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  service_date date not null default CURRENT_DATE,
  attended_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- Isang record lang bawat member bawat araw (para hindi dumami ang duplicates)
  unique(profile_id, service_date)
);

-- Index para sa mabilis na query by date
create index if not exists idx_livestream_attendance_date
  on public.livestream_attendance(service_date desc);

create index if not exists idx_livestream_attendance_profile
  on public.livestream_attendance(profile_id);

-- RLS: members can insert their own attendance, admins can view all
alter table public.livestream_attendance enable row level security;

drop policy if exists "Members can record own attendance" on public.livestream_attendance;
create policy "Members can record own attendance"
  on public.livestream_attendance for insert
  with check (auth.uid() = profile_id);

drop policy if exists "Members can view own attendance" on public.livestream_attendance;
create policy "Members can view own attendance"
  on public.livestream_attendance for select
  using (auth.uid() = profile_id);

drop policy if exists "Admins can view all attendance" on public.livestream_attendance;
create policy "Admins can view all attendance"
  on public.livestream_attendance for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

commit;
