-- Rollback ng 053: inaalis ang delete_member() nang buo.
--
-- Paalala: ang kahulugan ng delete_member bago ang 053 ay wala sa repo (tila ginawa ito
-- nang direkta sa database), kaya hindi ito maibabalik ng rollback na ito. Pagkatapos ng
-- rollback na ito, ang "Tanggalin" sa roster ay hindi gagana hanggang may bagong
-- kahulugan ng function na mailapat.

drop function if exists public.delete_member(uuid);
