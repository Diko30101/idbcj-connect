-- =====================================================================
-- IDBCJ MEMBER PORTAL - 004: Bible Study Courses (Pastoral Ministry)
-- Ipapatakbo ng Presiding Minister sa Supabase > SQL Editor.
--
-- Ligtas itong patakbuhin ulit (idempotent). Nasa loob ito ng isang
-- transaction: kung may error, walang mababago.
-- Ang rollback ay nasa 004_rollback.sql.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. COURSES
-- ---------------------------------------------------------------------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  published boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. LESSONS
-- ---------------------------------------------------------------------
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  content text not null default '',
  quiz jsonb not null default '[]'::jsonb, -- [{question, choices: [{text, correct}]}]
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. HELPER: kasapi ba ng ministry na may partikular na PANGALAN (hindi
--    fixed uuid) ang kasalukuyang naka-login. Kailangan ito dahil ang
--    "Pastoral Ministry" (gaya ng "Finance Ministry") ay hindi
--    fixed-id na seed sa migration history na ito -- iba ito sa
--    existing public.in_ministry(uuid), na umaasa sa alam nang id.
-- ---------------------------------------------------------------------
create or replace function public.in_named_ministry(ministry_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.ministry_members mm
    join public.ministries m on m.id = mm.ministry_id
    where mm.profile_id = auth.uid() and m.name = ministry_name
  ) and public.is_member();
$$;

revoke execute on function public.in_named_ministry(text) from public, anon;
grant execute on function public.in_named_ministry(text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. SEED: "Pastoral Ministry" (kung wala pa)
-- ---------------------------------------------------------------------
insert into public.ministries (name)
values ('Pastoral Ministry')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY: buksan at burahin ang lumang policy (kung meron)
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('courses', 'lessons')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

alter table public.courses enable row level security;
alter table public.lessons enable row level security;

-- Iisang audience lang: Admin/Secretary o kasapi ng Pastoral Ministry,
-- parehong karapatan sa view at edit -- walang ibang makakakita.
create policy courses_all on public.courses for all to authenticated
  using (public.is_staff() or public.in_named_ministry('Pastoral Ministry'))
  with check (public.is_staff() or public.in_named_ministry('Pastoral Ministry'));

create policy lessons_all on public.lessons for all to authenticated
  using (public.is_staff() or public.in_named_ministry('Pastoral Ministry'))
  with check (public.is_staff() or public.in_named_ministry('Pastoral Ministry'));

commit;
