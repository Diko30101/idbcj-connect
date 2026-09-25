-- =====================================================================
-- IDBCJ MEMBER PORTAL - 026: "Ibang dahilan" na uri ng pagkakatipon
-- sa Attendance Record
--
-- Bukod sa mga takdang uri (Pagsamba, mga Pasalamat), pwedeng mag-type
-- ang user ng sariling dahilan ng pagkakatipon ("Ibang dahilan…").
--
-- Ang migration na ito ay:
--   1. Nagdaragdag ng 'Ibang Pasalamat' sa finance_service_type enum.
--   2. Nagdaragdag ng custom_reason (nullable text) sa
--      public.attendance_records at public.attendance_guests --
--      dito itinatabi ang tina-type na dahilan kapag ang uri ay
--      'Ibang Pasalamat'.
--
-- Tandaan: ang ALTER TYPE ... ADD VALUE ay hindi pwedeng nasa loob ng
-- transaction block, kaya hiwalay ang dalawang bahagi. Ligtas ulitin
-- (IF NOT EXISTS).
-- =====================================================================

alter type public.finance_service_type add value if not exists 'Ibang Pasalamat';

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance_records'
      and column_name = 'custom_reason'
  ) then
    alter table public.attendance_records
      add column custom_reason text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance_guests'
      and column_name = 'custom_reason'
  ) then
    alter table public.attendance_guests
      add column custom_reason text;
  end if;
end $$;
