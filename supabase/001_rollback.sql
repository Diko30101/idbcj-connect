-- ROLLBACK ng 001_portal_schema.sql
-- Binubura nito ang mga BAGONG table at function. HINDI nito binubura ang
-- profiles table o ang mga dating datos. Ang mga bagong column sa profiles
-- ay iniwan (hindi nakakasama). Ang RLS ng profiles ay iiwan na naka-on.
begin;
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists profiles_guard on public.profiles;
drop trigger if exists profiles_audit on public.profiles;
drop table if exists public.prayer_requests, public.announcements, public.attendance,
  public.services, public.ministry_schedule, public.ministry_members,
  public.ministries, public.audit_log cascade;
drop function if exists public.attendance_summary(integer), public.member_attendance_summary(integer),
  public.ministry_roster(uuid), public.in_ministry(uuid),
  public.leads_ministry(uuid), public.is_member(), public.is_staff(), public.is_admin(),
  public.current_app_role(), public.handle_new_user(), public.guard_profile_update(),
  public.log_profile_change(), public.touch_prayer_updated_at();
commit;
