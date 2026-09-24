-- ROLLBACK ng 009_finance_attendance.sql
-- Binubura nito ang lahat ng tables na ginawa sa 009 (kasama ang lahat
-- ng naitalang members/attendance/finance data, pati ang kanilang RLS
-- policies), ang my_finance_locals/my_oversight_locals views, at ang
-- mga bagong enum types.
-- HINDI ginagalaw ang public.locals o public.ministry_members (mula sa
-- 008), o ang public.profiles/is_admin()/is_member() (mula sa 001).
begin;

drop view if exists my_finance_locals;
drop view if exists my_oversight_locals;

drop table if exists
  public.pangasiwaan_submissions,
  public.thanksgiving_offerings,
  public.member_collections,
  public.abuluyan_totals,
  public.attendance_records,
  public.thanksgiving_types,
  public.members
  cascade;

drop type if exists member_collection_type;
drop type if exists finance_service_type;
drop type if exists record_status;
drop type if exists member_status;

commit;
