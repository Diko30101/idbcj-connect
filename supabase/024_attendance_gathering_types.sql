-- =====================================================================
-- IDBCJ MEMBER PORTAL - 024: Mga bagong uri ng pagkakatipon sa
-- Attendance Record (gaya ng sa Pasalamat)
--
-- Ang mga pagtitipon ng Pasalamat (Anniversary, New Year, Taunang,
-- Birthday, Extra) ay hindi laging natatapat sa araw ng Linggo, kaya
-- idinaragdag ang dalawang bagong value sa finance_service_type enum.
-- Ang mga lumang value (hal. 'Anniversary Thanksgiving') ay nananatili;
-- ang Attendance Record ay nagpapakita na lang ng label na Tagalog.
--
-- Tandaan: ang ALTER TYPE ... ADD VALUE ay hindi pwedeng nasa loob ng
-- transaction block, kaya walang BEGIN/COMMIT dito. Ligtas ulitin
-- (IF NOT EXISTS).
-- =====================================================================

alter type public.finance_service_type add value if not exists 'Birthday Pasalamat';
alter type public.finance_service_type add value if not exists 'Taunang Pasalamat';
