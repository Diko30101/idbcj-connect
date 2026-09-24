-- =====================================================================
-- 018: Protektahan ang Finance Ministry, Local Finance Ministry, at Pastoral Ministry
-- mismo (hindi lang ang kasapi nito, na saklaw na ng mm_write ng 010).
--
-- Mga butas na nakita sa pagsubok sa lokal na stack (totoong PostgREST at JWT):
--   1. Nabubura ng secretary ang ministry (delete sa ministries). Ang cascade ng foreign key ay
--      nagbubura ng LAHAT ng kasapi, kasama ang dalawang church-wide Finance.
--   2. Napapalitan ng secretary ang PANGALAN ng ordinaryong ministry na kasapi siya papunta sa
--      "Finance Ministry": nalalampasan ang batas na Admin lang ang nagdadagdag ng kasapi. Ang mga
--      check ng access ay batay sa pangalan. Ang kabaligtaran (palitan ang pangalan ng totoong
--      Finance Ministry) ay nagwawalang-bisa ng mga check.
--   (Ang kambal na pangalan ay hinaharang na ng unique constraint sa ministries.name; hindi butas.)
--
-- Patakaran (sa database; hindi lang sa UI):
--   * DELETE ng protektadong ministry: tinatanggihan.
--   * UPDATE na nagpapalit ng pangalan kung ang luma O ang bago ay protektado: tinatanggihan.
--   * INSERT ng ministry na ang pangalan ay protektado (lower/btrim; kasama ang mga kahawig na hindi nahaharang ng unique): tinatanggihan.
--   * Mahigpit: kahit ang Admin ay hindi makagagawa nito sa pamamagitan ng API. (Ang paglipat o
--     pagbabago ay sa pamamagitan ng migration/SQL editor na walang JWT.)
--   * Ang ibang pagbabago (hal. paglalarawan) at ang mga ordinaryong ministry ay gumagana gaya ng dati.
-- =====================================================================

begin;

do $$
declare r record;
begin
  for r in
    select n.name, (select count(*) from public.ministries m where m.name = n.name) as c
    from (values ('Finance Ministry'), ('Local Finance Ministry'), ('Pastoral Ministry')) n(name)
  loop
    if r.c <> 1 then
      raise exception 'Inaasahang eksaktong 1 ang "%", % ang nakita. Walang binago.', r.name, r.c;
    end if;
  end loop;
end $$;

create or replace function public.guard_protected_ministries()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_prot text[] := array['finance ministry', 'local finance ministry', 'pastoral ministry'];
  v_old boolean := false;
  v_new boolean := false;
begin
  if auth.uid() is null then
    return coalesce(new, old);  -- migration/SQL editor/service role
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    v_old := lower(btrim(old.name)) = any (v_prot);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new := lower(btrim(new.name)) = any (v_prot);
  end if;

  if tg_op = 'DELETE' and v_old then
    raise exception 'Hindi mabubura ang ministry na ito (Finance, Local Finance, o Pastoral). Mabubura ang lahat ng kasapi nito.'
      using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.name is distinct from old.name and (v_old or v_new) then
    raise exception 'Hindi mapapalitan ang pangalan ng ministry na ito, at hindi puwedeng gamitin ang pangalan ng Finance, Local Finance, o Pastoral.'
      using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and v_new then
    raise exception 'Hindi puwedeng gumawa ng ministry na may pangalan ng Finance, Local Finance, o Pastoral.'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

revoke all on function public.guard_protected_ministries() from public, anon, authenticated;

drop trigger if exists ministries_guard_protected on public.ministries;
create trigger ministries_guard_protected
  before insert or update or delete on public.ministries
  for each row execute function public.guard_protected_ministries();

commit;
