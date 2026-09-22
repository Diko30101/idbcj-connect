-- ROLLBACK ng 005_bible_study_progress.sql
-- Ibinabalik ang courses/lessons sa dating iisang "for all" policy
-- bawat table (courses_all, lessons_all, gaya ng 004), at binubura ang
-- lesson_completions table (kasama ang lahat ng naitalang score).
begin;

drop table if exists public.lesson_completions cascade;

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

create policy courses_all on public.courses for all to authenticated
  using (public.is_staff() or public.in_named_ministry('Pastoral Ministry'))
  with check (public.is_staff() or public.in_named_ministry('Pastoral Ministry'));

create policy lessons_all on public.lessons for all to authenticated
  using (public.is_staff() or public.in_named_ministry('Pastoral Ministry'))
  with check (public.is_staff() or public.in_named_ministry('Pastoral Ministry'));

commit;
