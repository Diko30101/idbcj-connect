-- =====================================================================
-- IDBCJ MEMBER PORTAL - 005: Bible Study Courses access tightening +
-- progress tracking (lesson_completions).
-- Ipapatakbo ng Presiding Minister sa Supabase > SQL Editor, PAGKATAPOS
-- ng 004_bible_study_courses.sql.
--
-- Ligtas itong patakbuhin ulit (idempotent). Nasa loob ito ng isang
-- transaction: kung may error, walang mababago.
-- Ang rollback ay nasa 005_rollback.sql.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. LESSON_COMPLETIONS: huling score/status bawat member+lesson
--    (isang row lang bawat profile+lesson -- nag-o-overwrite ang retake)
-- ---------------------------------------------------------------------
create table if not exists public.lesson_completions (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  correct_count integer not null,
  total_count integer not null,
  passed boolean not null,
  completed_at timestamptz not null default now(),
  primary key (profile_id, lesson_id)
);

-- ---------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY: buksan at burahin ang lumang policy (kung meron)
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('courses', 'lessons', 'lesson_completions')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

alter table public.lesson_completions enable row level security;

-- courses/lessons: HIGPITAN ang write access -- Admin/Secretary lang.
-- Ang view access ay pareho pa rin (staff o Pastoral Ministry member).
create policy courses_select on public.courses for select to authenticated
  using (public.is_staff() or public.in_named_ministry('Pastoral Ministry'));
create policy courses_write on public.courses for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy lessons_select on public.lessons for select to authenticated
  using (public.is_staff() or public.in_named_ministry('Pastoral Ministry'));
create policy lessons_write on public.lessons for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- lesson_completions: bawat user, sariling row lang (view/insert/update)
-- PAALALA: client-writable ito sa profile_id = auth.uid() lang (walang
-- ibang gate) -- ang score/passed dito ay "self-attested": totoo namang
-- kina-compute ito ng submitQuizAttempt sa server, pero walang
-- pumipigil sa isang user na direktang mag-insert/update ng sariling
-- row nang may sariling score. Kung gagawa balang-araw ng staff-facing
-- na oversight/report base dito, kailangan munang higpitan ito (hal.
-- hiwalay na insert/update policy, o isang trigger na mag-re-grade).
create policy lesson_completions_own on public.lesson_completions for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

commit;
