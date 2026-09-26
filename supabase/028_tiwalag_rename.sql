-- 028: Palitan ang "Pagtitiwalag" ng "Tiwalag" sa member_status enum.
-- Ang RENAME VALUE ay awtomatikong nag-a-update sa lahat ng existing rows.

alter type public.member_status rename value 'Pagtitiwalag' to 'Tiwalag';

-- I-update ang validate_giving_member() para gamitin ang bagong enum value.
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
  elsif v_status = 'Tiwalag' then
    raise exception 'Hindi maaaring tumanggap ng handog mula sa tiniwalag na kaanib.'
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
