-- 053: delete_member() -- ligtas na permanenteng pagtanggal ng roster entry (public.members)
--
-- Bakit kailangan ito: ang dating delete_member ay para lang sa mga kaanib na hindi pa
-- kumpirmado. Pero ang Admin na nagdagdag ng kaanib ay awtomatikong nakukumpirma ito,
-- kaya ang isang dobleng entry na naidagdag ng Admin (hal. "Marcus Santiago" kasabay ng
-- "Marcus M. Santiago") ay hindi matanggal kahit saan sa portal.
--
-- Mga patakaran ng bagong bersiyon:
--   * Admin lang (public.is_admin()).
--   * Matatanggal lang kung WALANG anumang talang naka-link sa kaanib: handog
--     (ambagan, tulong sa klase, pasalamat, collections, thanksgiving), attendance
--     (records at guests), giving permissions, at lahat ng Tulong Financial tables.
--   * Kung may naka-link na tala: may malinaw na Tagalog na error (23514, ipinapakita
--     ng roster UI) at walang mabubura. Para sa mga tunay na kaanib na may kasaysayan,
--     ang tamang daan ay Status (Inactive o Tiwalag), hindi delete.
--   * Ang kahulugan ng function na ito ay wala sa repo bago ang migration na ito;
--     ang bersiyong ito ang opisyal na kahulugan mula ngayon.

create or replace function public.delete_member(p_member_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  if not public.is_admin() then
    raise exception 'Admin lang ang makatatanggal ng kaanib.' using errcode = '42501';
  end if;

  select full_name into v_name from public.members where id = p_member_id;
  if not found then
    raise exception 'Walang kaanib na may ganitong id.' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.ambagan_records where member_id = p_member_id)
     or exists (select 1 from public.tulong_klase_records where member_id = p_member_id)
     or exists (select 1 from public.pasalamat_records where member_id = p_member_id)
     or exists (select 1 from public.member_collections where member_id = p_member_id)
     or exists (select 1 from public.thanksgiving_offerings where member_id = p_member_id)
     or exists (select 1 from public.giving_permissions where member_id = p_member_id)
     or exists (select 1 from public.attendance_records where member_id = p_member_id)
     or exists (select 1 from public.attendance_guests where member_id = p_member_id)
     or exists (select 1 from public.tulong_financial_borrowers where member_id = p_member_id)
     or exists (select 1 from public.tulong_financial_loans where member_id = p_member_id)
     or exists (select 1 from public.tulong_loan_requests where member_id = p_member_id)
     or exists (select 1 from public.tulong_username_requests where member_id = p_member_id) then
    raise exception 'Hindi matatanggal ang "%": may mga tala na itong naka-link (handog, attendance, o Tulong). Gamitin na lang ang Status (Inactive o Tiwalag).', v_name
      using errcode = '23514';
  end if;

  delete from public.members where id = p_member_id;
end $$;

revoke all on function public.delete_member(uuid) from public, anon;
grant execute on function public.delete_member(uuid) to authenticated;
