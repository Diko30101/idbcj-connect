-- ROLLBACK ng 004_bible_study_courses.sql
-- Binubura nito ang courses at lessons table (kasama ang lahat ng
-- naitalang course/lesson, pati ang kanilang RLS policies) at ang
-- in_named_ministry() helper function.
-- HINDI binubura ang naseed na "Pastoral Ministry" na row sa ministries
-- table -- baka ginagamit na ito ng ibang bagay sa oras ng rollback.
begin;
drop table if exists public.lessons, public.courses cascade;
drop function if exists public.in_named_ministry(text);
commit;
