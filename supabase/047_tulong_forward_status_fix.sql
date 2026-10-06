-- 047: Ibalik ang status update sa tulong_forward_loan_request.
-- Ang 039 ay nagtanggal ng status transition (pending -> sent) at ng access
-- check. Dahil dito, ang mga ni-forward na kahilingan ay nananatiling
-- 'pending' kaya hindi lumalabas ang Aprubahan/Tanggihan buttons sa Inbox
-- (naghihintay ng status = 'sent').
-- Ibabalik: access check (Finance Ministry lang) + status update.
-- Panatilihin ang "Tulong Financial" wording mula sa 046.

create or replace function public.tulong_forward_loan_request(p_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_sender uuid;
  v_member_name text;
  v_amount numeric;
  v_target date;
  v_notes text;
  v_letter_id uuid;
begin
  v_sender := auth.uid();
  if v_sender is null or not public.is_tulong_financial() then
    raise exception 'walang access';
  end if;

  update public.tulong_loan_requests
  set status = 'sent', sent_at = now(), sent_by = v_sender
  where id = p_request_id and status = 'pending';
  if not found then
    raise exception 'hindi nakita o hindi na naghihintay ang kahilingan';
  end if;

  select m.full_name, r.amount, r.target_return_date, r.notes
  into v_member_name, v_amount, v_target, v_notes
  from public.tulong_loan_requests r
  join public.members m on m.id = r.member_id
  where r.id = p_request_id;

  v_letter_id := public.tulong_send_request_letter(
    'loan',
    p_request_id,
    'Humihingi ng Tulong Financial si ' || coalesce(v_member_name, ''),
    'Humihiling ng Tulong Financial si ' || coalesce(v_member_name, '') ||
    ' ng halagang ₱' || coalesce(v_amount::text, '0') ||
    coalesce(' (target balik: ' || v_target::text || ')', '') ||
    coalesce(' — Tala: ' || v_notes, '') ||
    '. Pakitingnan sa ibaba: Aprubahan o Tanggihan.'
  );

  return v_letter_id;
end;
$$;

revoke all on function public.tulong_forward_loan_request(uuid) from public, anon;
grant execute on function public.tulong_forward_loan_request(uuid) to authenticated;
