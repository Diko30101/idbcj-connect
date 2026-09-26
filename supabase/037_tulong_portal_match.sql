-- 037: Ayusin ang paghahanap ng portal account — isama ang first+last name matching
-- (hindi lang exact full name), para hindi gumawa ng duplicate username
-- kapag may middle name ang member pero wala sa portal profile.

create or replace function public.tulong_find_portal_profile(p_member_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_member_name text;
  v_profile_id uuid;
  v_out jsonb;
  v_first text;
  v_last text;
begin
  -- Tanging Admin/Finance Ministry lang ang makakagamit nito (privacy:
  -- nagbabalik ito ng pangalan/email ng profile).
  if not public.is_tulong_financial() then return null; end if;
  if p_member_id is null then return null; end if;

  select m.full_name, m.profile_id into v_member_name, v_profile_id
  from public.members m where m.id = p_member_id;
  if v_member_name is null then return null; end if;

  if v_profile_id is not null then
    select jsonb_build_object('profile_id', p.id, 'full_name', p.full_name, 'email', p.email, 'via', 'link')
    into v_out from public.profiles p where p.id = v_profile_id;
    return v_out;
  end if;

  -- 1. Exact na paghahambing ng pangalan (hindi case-sensitive, walang sobrang espasyo).
  select jsonb_build_object('profile_id', p.id, 'full_name', p.full_name, 'email', p.email, 'via', 'name')
  into v_out
  from public.profiles p
  where p.status = 'active'
    and lower(regexp_replace(trim(p.full_name), '\s+', ' ', 'g'))
      = lower(regexp_replace(trim(v_member_name), '\s+', ' ', 'g'))
  order by p.created_at nulls last
  limit 1;
  if v_out is not null then return v_out; end if;

  -- 2. First name + Last name lang (balewalain ang middle names).
  -- Hal: "Elyzah Soleen Villaverde" -> "elyzah villaverde"
  v_first := lower(split_part(regexp_replace(trim(v_member_name), '\s+', ' ', 'g'), ' ', 1));
  v_last := lower(split_part(regexp_replace(trim(v_member_name), '\s+', ' ', 'g'), ' ', array_length(string_to_array(regexp_replace(trim(v_member_name), '\s+', ' ', 'g'), ' '), 1)));

  select jsonb_build_object('profile_id', p.id, 'full_name', p.full_name, 'email', p.email, 'via', 'name-first-last')
  into v_out
  from public.profiles p
  where p.status = 'active'
    and lower(split_part(regexp_replace(trim(p.full_name), '\s+', ' ', 'g'), ' ', 1)) = v_first
    and lower(split_part(regexp_replace(trim(p.full_name), '\s+', ' ', 'g'), ' ', array_length(string_to_array(regexp_replace(trim(p.full_name), '\s+', ' ', 'g'), ' '), 1))) = v_last
  order by p.created_at nulls last
  limit 1;

  return v_out;
end;
$$;

revoke all on function public.tulong_find_portal_profile(uuid) from public, anon;
grant execute on function public.tulong_find_portal_profile(uuid) to authenticated;
