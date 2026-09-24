-- =====================================================================
-- IDBCJ MEMBER PORTAL - 015: Burahin ang LAMAN ng public.financial_records
--   (sample data; 144 row noong 2026-09-23)
--
-- HIWALAY sa 010-013. HINDI PA NAKA-APPLY. HUWAG ILAPAT hanggang hindi:
--   (a) na-export at naipakita ang backup (backups/financial_records_*.json)
--   (b) naipakita ang bilang ng row at ang eksaktong utos na ito
--   (c) nagbigay ng tahasang kumpirmasyon ang Admin
--
-- LAMAN LANG ang binubura. Ang table, ang mga policy, ang trigger, ang
-- constraint, at ang mga lumang page (app/portal/finance/...) ay
-- HINDI ginagalaw. Kapag wala nang laman, ang cron job
-- weekly-local-finance-report ay walang maipapadala (hindi ito mag-e-error).
--
-- Ang guard ay nag-a-abort kung hindi 144 ang bilang (may nagbago mula
-- nang sinuri) -- palitan ang inaasahang bilang bago ilapat kung nagbago.
-- Pagbabalik: mula sa JSON backup (tingnan ang plano, Task 9).
-- =====================================================================

begin;

do $$
declare n bigint;
begin
  select count(*) into n from public.financial_records;
  if n <> 144 then
    raise exception 'Inaasahang 144 row sa financial_records, % ang nakita. Walang binura.', n;
  end if;
end $$;

delete from public.financial_records;

do $$
declare n bigint;
begin
  select count(*) into n from public.financial_records;
  if n <> 0 then
    raise exception 'May natira pang % row pagkatapos ng delete. Babawiin ang lahat.', n;
  end if;
end $$;

commit;
