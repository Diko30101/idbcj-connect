-- =====================================================================
-- Rollback ng 018_protected_ministries.sql
-- =====================================================================

begin;

drop trigger if exists ministries_guard_protected on public.ministries;
drop function if exists public.guard_protected_ministries();

commit;
