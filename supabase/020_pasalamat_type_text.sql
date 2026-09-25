-- =====================================================================
-- 020 -- Pasalamat: sariling uri na tina-type ng nag-e-encode
--
-- Dati: ang pasalamat_records.type ay enum na pasalamat_type
-- ('new_year', 'anniversary', 'extra', 'private').
-- Ngayon: text na, para puwedeng mag-type ng sariling uri ang nag-e-encode
-- (hal. "Pasalamat sa kasal", "Pasalamat sa bagong bahay").
-- Ang mga lumang halaga ay nananatili bilang text (walang nawawalang data).
--
-- IPAPATAKBO SA: Supabase > SQL Editor (isang beses, bago gamitin ang
-- "Ako ang maglalagay" sa Pasalamat form).
-- =====================================================================

alter table public.pasalamat_records
  alter column type type text using type::text;
