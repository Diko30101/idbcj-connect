-- =====================================================================
-- IDBCJ MEMBER PORTAL - 012: Pahintulot para sa Inactive na kaanib,
--   validation ng kaanib sa Ambagan/Tulong/Pasalamat, at mga function
--   sa paghahanap ng kaanib
--
-- DRAFT -- HINDI PA NAKA-APPLY. Kailangan ang 010 at 011. Ilalapat
-- KASABAY ng 011.
--
-- Mga patakaran (ipinapatupad sa database):
--   * Active: tanggap.
--   * Pagtitiwalag: hindi tanggap; walang exception.
--   * Inactive: tanggap LAMANG kung may pahintulot na hindi binawi at
--     nasa loob ng bisa (granted_at <= petsa ng pagbibigay <= valid_until).
--   * Ang makapagbibigay/makababawi ng pahintulot: lider ng Pastoral
--     Ministry AT role='admin' (is_pastoral_leader()).
--   * Pahintulot ay para sa kaanib; may bisa saanmang local.
--   * Walang delete. Pagbawi = revoked_at. Pagpapalawig = bagong row.
-- Rollback: 012_rollback.sql
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. GIVING_PERMISSIONS
-- ---------------------------------------------------------------------
create table if not exists public.giving_permissions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id),
  granted_by uuid not null references public.profiles (id),
  granted_at timestamptz not null default now(),
  valid_until date not null,
  consultation_note text not null check (length(btrim(consultation_note)) > 0),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id),
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_giving_permissions_member on public.giving_permissions (member_id, valid_until);

create or replace function public.giving_permissions_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_status public.member_status;
begin
  if auth.uid() is null then
    return new;  -- migration/service role
  end if;

  if not public.is_pastoral_leader() then
    raise exception 'Ang lider lamang ng Pastoral Ministry (Admin) ang makapagbibigay o makababawi ng pahintulot.'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    select status into v_status from public.members where id = new.member_id;
    if v_status is distinct from 'Inactive' then
      raise exception 'Ang pahintulot ay para lang sa kaanib na Inactive.' using errcode = '23514';
    end if;
    if new.valid_until < current_date then
      raise exception 'Ang valid_until ay dapat hindi pa lumilipas.' using errcode = '23514';
    end if;
    new.granted_by := auth.uid();
    new.granted_at := now();
    new.revoked_at := null;
    new.revoked_by := null;
    new.reason := null;
    return new;
  end if;

  -- UPDATE: pagbawi lang
  if (to_jsonb(new) - 'revoked_at' - 'revoked_by' - 'reason')
     is distinct from (to_jsonb(old) - 'revoked_at' - 'revoked_by' - 'reason') then
    raise exception 'Pagbawi lamang ang maaaring gawin sa pahintulot. Gumawa ng bagong pahintulot para sa pagpapalawig.'
      using errcode = '42501';
  end if;
  if old.revoked_at is not null then
    raise exception 'Nabawi na ang pahintulot na ito.' using errcode = '23514';
  end if;
  if new.reason is null or length(btrim(new.reason)) = 0 then
    raise exception 'Kailangan ang dahilan sa pagbawi ng pahintulot.' using errcode = '23514';
  end if;
  new.revoked_at := now();
  new.revoked_by := auth.uid();
  return new;
end $$;

revoke all on function public.giving_permissions_rules() from public, anon, authenticated;

drop trigger if exists giving_permissions_rules on public.giving_permissions;
create trigger giving_permissions_rules
  before insert or update on public.giving_permissions
  for each row execute function public.giving_permissions_rules();

drop trigger if exists giving_permissions_audit on public.giving_permissions;
create trigger giving_permissions_audit
  after insert or update on public.giving_permissions
  for each row execute function public.finance_audit();

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'giving_permissions' loop
    execute format('drop policy %I on public.giving_permissions', r.policyname);
  end loop;
end $$;

alter table public.giving_permissions enable row level security;

-- Lider ng Pastoral Ministry (Admin) at church-wide Finance lang ang nakakabasa.
create policy giving_permissions_select on public.giving_permissions for select to authenticated
  using (public.is_pastoral_leader() or public.is_church_wide_finance());
create policy giving_permissions_insert on public.giving_permissions for insert to authenticated
  with check (public.is_pastoral_leader());
create policy giving_permissions_update on public.giving_permissions for update to authenticated
  using (public.is_pastoral_leader()) with check (public.is_pastoral_leader());

revoke all on public.giving_permissions from anon, authenticated;
grant select, insert, update on public.giving_permissions to authenticated;

-- ---------------------------------------------------------------------
-- 2. VALIDATION NG KAANIB sa tatlong per-member na table
--    Petsa ng pagbibigay d = date_received (Ambagan/Tulong) o date (Pasalamat).
--    Sinusuri ang KASALUKUYANG status ng kaanib (walang kasaysayan ng status).
--    Tinatakbo: sa INSERT; sa UPDATE kapag nagbago ang member_id o ang petsa,
--    o kapag draft->submitted. Hindi tinatakbo sa ->void.
-- ---------------------------------------------------------------------
create or replace function public.validate_giving_member()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb;
  v_date date := coalesce((to_jsonb(new) ->> 'date_received')::date, (to_jsonb(new) ->> 'date')::date);
  v_status public.member_status;
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

  select status into v_status from public.members where id = new.member_id;
  if not found then
    raise exception 'Hindi kaanib ang napiling tao. Walang tinatanggap na handog mula sa hindi kaanib.'
      using errcode = '23503';
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

revoke all on function public.validate_giving_member() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['ambagan_records', 'tulong_klase_records', 'pasalamat_records'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_validate_member', t);
    execute format(
      'create trigger %I before insert or update on public.%I for each row '
      || 'execute function public.validate_giving_member()', t || '_validate_member', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. PAGHAHANAP NG KAANIB (para sa Finance ng anumang local o church-wide)
--    Hindi mabasa ang buong roster ng ibang local: id, pangalan, local,
--    at status lamang; Active o Inactive-na-may-aktibong-pahintulot lang.
-- ---------------------------------------------------------------------
create or replace function public.is_any_local_finance()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.ministry_members mm
    join public.ministries m on m.id = mm.ministry_id
    join public.profiles p on p.id = mm.profile_id
    where mm.profile_id = auth.uid()
      and mm.local_id is not null
      and p.status <> 'inactive'
      and (m.name = 'Local Finance Ministry'
           or (m.name = 'Finance Ministry' and mm.finance_scope = 'local'))
  )
$$;

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
      and (
        m.status = 'Active'
        or (m.status = 'Inactive' and exists (
              select 1 from public.giving_permissions gp
              where gp.member_id = m.id and gp.revoked_at is null and gp.valid_until >= current_date))
      )
    order by m.full_name
    limit 20;
end $$;

-- Pangalan ng kaanib para sa mga record na nakikita ng tumatawag (kahit sa
-- ibang local ang kaanib). Walang ibinibigay na pangalan kung walang record
-- na sakop ng access ng tumatawag.
create or replace function public.member_display_names(p_ids uuid[])
returns table (member_id uuid, full_name text)
language sql stable security definer set search_path = '' as $$
  select m.id, m.full_name
  from public.members m
  where m.id = any (p_ids)
    and (
      exists (select 1 from public.ambagan_records r where r.member_id = m.id and public.can_access_local(r.local_id))
      or exists (select 1 from public.tulong_klase_records r where r.member_id = m.id and public.can_access_local(r.local_id))
      or exists (select 1 from public.pasalamat_records r where r.member_id = m.id and public.can_access_local(r.local_id))
    )
$$;

revoke all on function public.is_any_local_finance() from public, anon;
revoke all on function public.search_members(text) from public, anon;
revoke all on function public.member_display_names(uuid[]) from public, anon;
grant execute on function public.is_any_local_finance() to authenticated;
grant execute on function public.search_members(text) to authenticated;
grant execute on function public.member_display_names(uuid[]) to authenticated;

commit;
