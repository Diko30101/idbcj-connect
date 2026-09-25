-- 027: Read-only na access ng Admin sa finance tables.
-- ---------------------------------------------------------------------
-- Ang Admin (role='admin') ay makakabasa ng lahat ng naipadalang koleksyon
-- (Abuluyan, Ambagan, Tulong sa Klase, Pasalamat) para sa mga buod at ulat
-- (hal. "Financial Report -- Buod" sa Home at ang taunang Audit Report),
-- gaya ng nakikita ng Finance Ministry.
--
-- READ-ONLY LAMANG: walang binabago sa mga patakaran ng insert/update.
-- Ang pag-encode, pag-edit, pag-submit, at pag-manage ng mga finance record
-- ay nananatiling sa Finance Ministry (at Local Finance Ministry).
--
-- Ang mga SELECT policy sa Postgres ay permissive (OR): idinadagdag lang ang
-- mga patakarang ito sa umiiral na can_access_local na mga patakaran.
-- ---------------------------------------------------------------------

begin;

-- Abuluyan (weekly totals per local)
drop policy if exists abuluyan_select_admin on public.abuluyan_totals;
create policy abuluyan_select_admin on public.abuluyan_totals
  for select to authenticated
  using (public.is_admin());

-- Ambagan, Tulong sa Klase, Pasalamat (per-member na halaga)
do $$
declare
  t text;
begin
  foreach t in array array['ambagan_records', 'tulong_klase_records', 'pasalamat_records'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select_admin', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_admin())',
      t || '_select_admin', t);
  end loop;
end $$;

commit;
