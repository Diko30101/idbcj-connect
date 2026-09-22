-- ROLLBACK ng 003_sermons_events.sql
-- Binubura nito ang sermons at events table (kasama ang lahat ng naka-tala
-- na sermon at event, pati ang kanilang RLS policies).
begin;
drop table if exists public.sermons, public.events cascade;
commit;
