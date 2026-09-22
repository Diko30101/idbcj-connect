-- =====================================================================
-- IDBCJ MEMBER PORTAL - 003: Sermon library at Events (DB-driven, para
-- makapag-add ang Admin/Secretary nang walang code deploy)
-- Ipapatakbo ng Presiding Minister sa Supabase > SQL Editor.
--
-- Ligtas itong patakbuhin ulit (idempotent). Nasa loob ito ng isang
-- transaction: kung may error, walang mababago.
-- Ang rollback ay nasa 003_rollback.sql.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. SERMONS
-- ---------------------------------------------------------------------
create table if not exists public.sermons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  title_tl text,
  speaker text not null,
  sermon_date date not null,
  category text not null default 'General',
  video_id text,
  summary text not null,
  summary_tl text,
  verses jsonb not null default '[]'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  pdf_path text,
  published boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sermons drop constraint if exists sermons_slug_format;
alter table public.sermons
  add constraint sermons_slug_format
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Seed: ang 3 sermon na dating nasa lib/sermons.ts (hindi na dapat mawala)
insert into public.sermons (slug, title, speaker, sermon_date, category, video_id, summary, published)
values
  (
    'walking-in-faith-not-by-sight',
    'Walking in Faith, Not by Sight',
    'Elder Bro. Rod S. Villaverde',
    '2025-12-09',
    'Faith Series',
    'oEBwRr2aILc',
    'Discover what it means to truly trust God when the path ahead is unclear. We explore 2 Corinthians 5:7 and learn how to navigate life''s challenges through spiritual vision.',
    true
  ),
  (
    'the-power-of-prayer',
    'The Power of Prayer',
    'Bro. Abon Mangubat',
    '2023-02-12',
    'Prayer Works',
    '0ustuDLHTjI',
    'Prayer is not just asking for things; it is a conversation with the Creator. Learn how to deepen your prayer life and see real change.',
    true
  ),
  (
    'living-a-life-of-gratitude',
    'Living a Life of Gratitude',
    'Bro. Abon Mangubat',
    '2025-12-01',
    'Thanksgiving',
    'c5aaOqqp5tc',
    'Gratitude changes our attitude. In this message, we look at how being thankful in all circumstances can transform your mental and spiritual health.',
    true
  )
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- 2. EVENTS (special events lang; ang regular weekly worship schedule
--    ay hardcoded pa rin sa lib/worship.ts)
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date date not null,
  event_time text,
  locality text,
  location text,
  link text,
  published boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events drop constraint if exists events_locality_check;
alter table public.events
  add constraint events_locality_check
  check (locality is null or locality in ('medina', 'batangas', 'fort_mcmurray', 'other'));

-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY: buksan at burahin ang lumang policy (kung meron)
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('sermons', 'events')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

alter table public.sermons enable row level security;
alter table public.events  enable row level security;

-- sermons: publiko ay makakabasa lang ng published; admin/secretary lang ang makaka-edit
create policy sermons_select_public on public.sermons for select to anon
  using (published = true);
create policy sermons_select_authenticated on public.sermons for select to authenticated
  using (published = true or public.is_staff());
create policy sermons_write on public.sermons for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- events: parehong patakaran
create policy events_select_public on public.events for select to anon
  using (published = true);
create policy events_select_authenticated on public.events for select to authenticated
  using (published = true or public.is_staff());
create policy events_write on public.events for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

commit;
