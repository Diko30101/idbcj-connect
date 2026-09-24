-- =====================================================================
-- IDBCJ MEMBER PORTAL - 016: Kumpirmasyon ng Admin bago makatanggap ng
--   handog ang bagong kaanib (desisyon #3, opsyon A; spec seksyon 18)
--
-- DRAFT -- HINDI PA NAKA-APPLY. Kailangan ang 010-013. Ibinukod ang
-- desisyong ito sa sariling migration para (1) manatiling buo ang
-- 010-013 na nasubukan na, at (2) ang rollback nito ay ibalik ang eksaktong
-- estado ng 010-013.
--
-- Patakaran:
--   * members.confirmed_at / confirmed_by (nullable)
--   * Ang idinagdag ng Admin ay kumpirmado agad. Ang idinagdag ng
--     Administrative Ministry o Local Admin ay HINDI pa kumpirmado.
--   * Admin lang ang makapagtatakda ng confirmed_at/by -- sa pamamagitan ng
--     public.confirm_member(). Ipinapatupad sa dalawang antas:
--       (1) column privilege: walang INSERT/UPDATE grant ang authenticated
--           sa dalawang column (kaya walang paraan ang API, kahit ang Admin,
--           na direktang magtakda ng mga ito -- hindi kayang gawin ng RLS
--           ang paghahambing sa lumang halaga ng row)
--       (2) trigger members_rules: hinaharangan ang sinumang hindi Admin, at
--           ang Admin mismo ay hindi makapagpapalsipika ng oras/pangalan
--   * Hindi kumpirmadong kaanib: (a) wala sa search_members, (b) tinatanggihan
--     ng validate_giving_member() sa INSERT/UPDATE ng Ambagan/Tulong/Pasalamat
--     (kasama ang "Ipadala" ng draft na naka-encode na), na may malinaw na
--     mensahe. Nananatiling nakikita ng roster manager ang sarili nilang
--     idinagdag (members_select ng 013 ay hindi nagbago).
--   * Audit: ang kumpirmasyon ay nakatala sa finance_audit_log (members) at
--     mababasa ng Admin.
--   * Ang pagpapalit ng pangalan (maliban sa malaki/maliit na titik o espasyo lang) o ng naka-link na
--     profile ng kumpirmadong kaanib ng hindi Admin ay nag-re-reset ng kumpirmasyon (null).
--   * Ang confirmed_at/by sa INSERT ay itinatakda LANG ng trigger, sa lahat ng konteksto. Ang trusted na
--     koneksyon (SQL editor/service role) ay nagkukumpirma sa hiwalay na UPDATE pagkatapos ng INSERT.
--   * Walang backfill: ang umiiral na row (0 sa production noong 2026-09-23)
--     ay mananatiling hindi kumpirmado hanggang kumpirmahin ng Admin (fail
--     closed). Ang insert na walang JWT (SQL editor/service role) ay hindi
--     awtomatikong kumpirmado; magpatakbo ng hiwalay na UPDATE para kumpirmahin.
-- Rollback: 016_rollback.sql
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. COLUMNS
-- ---------------------------------------------------------------------
alter table public.members add column if not exists confirmed_at timestamptz;
alter table public.members add column if not exists confirmed_by uuid references public.profiles (id);

-- ---------------------------------------------------------------------
-- 2. COLUMN PRIVILEGES (unang antas): walang direktang pagsulat sa
--    confirmed_at/confirmed_by ang authenticated
-- ---------------------------------------------------------------------
revoke insert, update on public.members from authenticated;
grant insert (id, local_id, profile_id, full_name, status, status_reason) on public.members to authenticated;
grant update (local_id, profile_id, full_name, status, status_reason) on public.members to authenticated;

-- ---------------------------------------------------------------------
-- 3. TRIGGER (ikalawang antas) -- kapalit ng members_rules ng 013
-- ---------------------------------------------------------------------
create or replace function public.members_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_admin boolean;
begin
  if auth.uid() is null then
    -- migration/service role/SQL editor: ang INSERT ay HINDI tumatanggap ng ipinasang confirmed_*
    -- (hindi kailanman); ang pagkumpirma ng row ay hiwalay na UPDATE ng trusted na koneksyon.
    if tg_op = 'INSERT' then
      new.confirmed_at := null;
      new.confirmed_by := null;
    end if;
    return new;
  end if;
  v_admin := public.is_admin();

  if tg_op = 'INSERT' then
    -- Ang confirmed_at/by sa INSERT ay itinatakda LANG ng trigger na ito, hindi ng ipinasa ng client
    if v_admin then
      new.confirmed_at := now();
      new.confirmed_by := auth.uid();
    else
      new.status := 'Active';
      new.status_reason := null;
      new.confirmed_at := null;
      new.confirmed_by := null;
    end if;
    new.status_changed_at := case when new.status <> 'Active' then now() end;
    new.status_changed_by := case when new.status <> 'Active' then auth.uid() end;
    return new;
  end if;

  -- UPDATE: kumpirmasyon
  if new.confirmed_at is distinct from old.confirmed_at or new.confirmed_by is distinct from old.confirmed_by then
    if not v_admin then
      raise exception 'Admin lang ang makakakumpirma ng kaanib.' using errcode = '42501';
    end if;
    if old.confirmed_at is null and new.confirmed_at is not null then
      new.confirmed_at := now();
      new.confirmed_by := auth.uid();
    elsif new.confirmed_at is null then
      new.confirmed_by := null;
    else
      new.confirmed_at := old.confirmed_at;
      new.confirmed_by := old.confirmed_by;
    end if;
  end if;

  if not v_admin then
    if new.status is distinct from old.status
       or new.status_reason is distinct from old.status_reason
       or new.local_id is distinct from old.local_id then
      raise exception 'Ang Admin lang ang makapagpapalit ng status o ng local ng kaanib.'
        using errcode = '42501';
    end if;
    -- Pagbabago ng PAGKAKAKILANLAN ng kumpirmadong kaanib (pangalan o naka-link na profile) ng hindi Admin:
    -- mawawala ang kumpirmasyon at kailangang kumpirmahin muli ng Admin. (Ang pagbabago ng malaki/maliit
    -- na titik o ng espasyo lang ay hindi binibilang.) Pinili ito kaysa sa pagtanggi sa pag-edit para
    -- makapagtama pa rin ng typo ang roster manager, habang fail-closed: hindi makatatanggap ng handog
    -- ang row hangga't hindi muling kinukumpirma. Ang Admin mismo ay hindi nagre-reset.
    if old.confirmed_at is not null and (
         new.profile_id is distinct from old.profile_id
         or lower(regexp_replace(btrim(new.full_name), '\s+', ' ', 'g'))
            is distinct from lower(regexp_replace(btrim(old.full_name), '\s+', ' ', 'g'))
       ) then
      new.confirmed_at := null;
      new.confirmed_by := null;
    end if;
    new.status_changed_at := old.status_changed_at;
    new.status_changed_by := old.status_changed_by;
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status_reason is null or length(btrim(new.status_reason)) = 0 then
      raise exception 'Kailangan ang dahilan sa pagpapalit ng status ng kaanib.' using errcode = '23514';
    end if;
    new.status_changed_at := now();
    new.status_changed_by := auth.uid();
  else
    new.status_changed_at := old.status_changed_at;
    new.status_changed_by := old.status_changed_by;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 4. confirm_member(): ang tanging daan ng Admin sa pagkumpirma
-- ---------------------------------------------------------------------
create or replace function public.confirm_member(p_member_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Admin lang ang makakakumpirma ng kaanib.' using errcode = '42501';
  end if;
  update public.members
     set confirmed_at = now(), confirmed_by = auth.uid()
   where id = p_member_id and confirmed_at is null;
  if not found then
    raise exception 'Walang kaanib na naghihintay ng kumpirmasyon na may ganitong id.' using errcode = 'P0002';
  end if;
end $$;

revoke all on function public.confirm_member(uuid) from public, anon;
grant execute on function public.confirm_member(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. validate_giving_member() -- kapalit ng 012: dagdag ang pagsusuri ng kumpirmasyon
-- ---------------------------------------------------------------------
create or replace function public.validate_giving_member()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb;
  v_date date := coalesce((to_jsonb(new) ->> 'date_received')::date, (to_jsonb(new) ->> 'date')::date);
  v_status public.member_status;
  v_confirmed timestamptz;
  v_latest date;
begin
  if new.member_id is null then
    raise exception 'Kailangang may napiling kaanib. Walang tinatanggap na handog mula sa hindi kaanib.'
      using errcode = '23502';
  end if;

  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    if new.status = 'void' then
      return new;
    end if;
    if new.member_id is not distinct from old.member_id
       and v_date is not distinct from coalesce((v_old ->> 'date_received')::date, (v_old ->> 'date')::date)
       and not (old.status = 'draft' and new.status = 'submitted') then
      return new;
    end if;
  end if;

  select status, confirmed_at into v_status, v_confirmed from public.members where id = new.member_id;
  if not found then
    raise exception 'Hindi kaanib ang napiling tao. Walang tinatanggap na handog mula sa hindi kaanib.'
      using errcode = '23503';
  end if;

  if v_confirmed is null then
    raise exception 'Hindi pa kinukumpirma ng Admin ang kaanib na ito. Hindi maaaring i-record ang handog hangga''t hindi siya nakukumpirma.'
      using errcode = '23514';
  end if;

  if v_status = 'Active' then
    return new;
  elsif v_status = 'Pagtitiwalag' then
    raise exception 'Hindi maaaring tumanggap ng handog mula sa natitiwalag na kaanib.'
      using errcode = '23514';
  end if;

  -- Inactive: kailangan ng aktibong pahintulot na sumasakop sa petsa ng pagbibigay
  select max(gp.valid_until) into v_latest
  from public.giving_permissions gp
  where gp.member_id = new.member_id
    and gp.revoked_at is null
    and (gp.granted_at at time zone 'America/Edmonton')::date <= v_date;

  if v_latest is null then
    raise exception 'Ang kaanib na ito ay hindi aktibo at walang aktibong pahintulot mula sa Pastoral Ministry. Hindi maaaring i-record ang handog.'
      using errcode = '23514';
  elsif v_latest < v_date then
    raise exception 'Lumipas na ang pahintulot noong %. Hindi maaaring i-record ang handog.', to_char(v_latest, 'YYYY-MM-DD')
      using errcode = '23514';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 6. search_members() -- kapalit ng 012: hindi kasama ang hindi kumpirmado
-- ---------------------------------------------------------------------
create or replace function public.search_members(q text)
returns table (id uuid, full_name text, local_name text, status public.member_status)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_church_wide_finance() or public.is_any_local_finance()) then
    raise exception 'Walang access.' using errcode = '42501';
  end if;
  if q is null or length(btrim(q)) < 2 then
    return;
  end if;
  return query
    select m.id, m.full_name, l.name, m.status
    from public.members m
    join public.locals l on l.id = m.local_id
    where strpos(lower(m.full_name), lower(btrim(q))) > 0
      and m.confirmed_at is not null
      and (
        m.status = 'Active'
        or (m.status = 'Inactive' and exists (
              select 1 from public.giving_permissions gp
              where gp.member_id = m.id and gp.revoked_at is null and gp.valid_until >= current_date))
      )
    order by m.full_name
    limit 20;
end $$;

-- ---------------------------------------------------------------------
-- 7. AUDIT: mababasa ng Admin ang kumpirmasyon (kapalit ng policy ng 010)
-- ---------------------------------------------------------------------
drop policy if exists finance_audit_select on public.finance_audit_log;
create policy finance_audit_select on public.finance_audit_log for select to authenticated
  using (
    public.is_church_wide_finance()
    or (
      public.is_admin() and (
        table_name = 'giving_permissions'
        or (table_name = 'members'
            and (operation = 'INSERT'
                 or old_values ->> 'status' is distinct from new_values ->> 'status'
                 or old_values ->> 'confirmed_at' is distinct from new_values ->> 'confirmed_at'))
      )
    )
  );

commit;
