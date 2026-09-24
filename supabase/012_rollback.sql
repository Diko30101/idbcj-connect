-- =====================================================================
-- Rollback ng 012_giving_permissions.sql
-- BABALA: binubura ang giving_permissions at ang laman nito.
-- =====================================================================

begin;

drop trigger if exists ambagan_records_validate_member on public.ambagan_records;
drop trigger if exists tulong_klase_records_validate_member on public.tulong_klase_records;
drop trigger if exists pasalamat_records_validate_member on public.pasalamat_records;

drop function if exists public.member_display_names(uuid[]);
drop function if exists public.search_members(text);
drop function if exists public.is_any_local_finance();
drop function if exists public.validate_giving_member();

drop table if exists public.giving_permissions;
drop function if exists public.giving_permissions_rules();

commit;
