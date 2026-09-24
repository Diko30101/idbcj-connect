-- =====================================================================
-- Rollback ng 016_member_confirmation.sql -- ibinabalik ang eksaktong
-- mga kahulugan ng 010, 012, at 013 (Active agad ang idinagdag ng roster
-- manager; walang kumpirmasyon). Ang confirmed_at/by ay mawawala.
-- =====================================================================

begin;

drop function if exists public.confirm_member(uuid);

-- Table-level grants ng 013
revoke insert, update on public.members from authenticated;
grant select, insert, update on public.members to authenticated;

-- members_rules ng 013
create or replace function public.members_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_admin boolean;
begin
  if auth.uid() is null then
    return new;  -- migration/service role
  end if;
  v_admin := public.is_admin();

  if tg_op = 'INSERT' then
    if not v_admin then
      new.status := 'Active';
      new.status_reason := null;
    end if;
    new.status_changed_at := case when new.status <> 'Active' then now() end;
    new.status_changed_by := case when new.status <> 'Active' then auth.uid() end;
    return new;
  end if;

  -- UPDATE
  if not v_admin then
    if new.status is distinct from old.status
       or new.status_reason is distinct from old.status_reason
       or new.local_id is distinct from old.local_id then
      raise exception 'Ang Admin lang ang makapagpapalit ng status o ng local ng kaanib.'
        using errcode = '42501';
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

-- validate_giving_member ng 012
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

-- search_members ng 012
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

-- policy ng 010
drop policy if exists finance_audit_select on public.finance_audit_log;
create policy finance_audit_select on public.finance_audit_log for select to authenticated
  using (
    public.is_church_wide_finance()
    or (
      public.is_admin() and (
        table_name = 'giving_permissions'
        or (table_name = 'members'
            and (operation = 'INSERT' or old_values ->> 'status' is distinct from new_values ->> 'status'))
      )
    )
  );

alter table public.members drop column if exists confirmed_by;
alter table public.members drop column if exists confirmed_at;

commit;
