-- 038: Ayusin ang daloy ng loan request — sa Finance Ministry muna, hindi diretso sa Admin.
-- Kapag ang kaanib (gaya ni Elyzah) ay nag-request mula sa kanyang portal,
-- ang request ay mananatiling 'pending' para sa Finance Ministry.
-- Ang Finance Ministry ang mag-forward sa Admin (gamit ang tulong_forward_loan_request)
-- para sa final approval.

create or replace function public.tulong_create_loan_request_by_profile(
  p_amount numeric, p_target_return_date date, p_notes text
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_profile uuid;
  v_member_id uuid;
  v_request_id uuid;
begin
  v_profile := auth.uid();
  if v_profile is null then return null; end if;
  if p_amount is null or p_amount <= 0 then return null; end if;

  select m.id into v_member_id from public.members m where m.profile_id = v_profile;
  if v_member_id is null then
    -- Fallback: kaanib na na-link sa pamamagitan ng pangalan (walang members.profile_id).
    select r.member_id into v_member_id
    from public.tulong_username_requests r
    where r.profile_id = v_profile and r.status = 'approved'
    order by r.decided_at desc nulls last limit 1;
  end if;
  if v_member_id is null then return null; end if;

  if not exists (
    select 1 from public.tulong_username_requests r
    where r.member_id = v_member_id and r.status = 'approved'
  ) and not exists (
    select 1 from public.tulong_financial_loans l where l.member_id = v_member_id
  ) then
    return null;
  end if;

  -- Isang naghihintay na kahilingan lang bawat kaanib.
  if exists (
    select 1 from public.tulong_loan_requests
    where member_id = v_member_id and status in ('pending','sent')
  ) then
    return null;
  end if;

  insert into public.tulong_loan_requests
    (borrower_id, member_id, amount, target_return_date, notes, status)
  values
    (null, v_member_id, round(p_amount, 2), p_target_return_date,
     nullif(trim(coalesce(p_notes, '')), ''), 'pending')
  returning id into v_request_id;

  -- TANDAAN: Hindi na awtomatikong gumagawa ng letter sa Admin.
  -- Ang Finance Ministry ang magre-review at mag-forward sa Admin
  -- gamit ang tulong_forward_loan_request() para sa final approval.

  return v_request_id;
end;
$$;

revoke all on function public.tulong_create_loan_request_by_profile(numeric, date, text) from public, anon;
grant execute on function public.tulong_create_loan_request_by_profile(numeric, date, text) to authenticated;
