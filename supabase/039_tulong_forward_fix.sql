-- 039: Ayusin ang tulong_forward_loan_request — alisin ang r.requested_by
-- na hindi umiiral na column sa tulong_loan_requests.
-- Ang v_sender variable ay hindi naman ginagamit sa function body.

create or replace function public.tulong_forward_loan_request(p_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_member_name text;
  v_amount numeric;
  v_target date;
  v_notes text;
  v_letter_id uuid;
begin
  select m.full_name, r.amount, r.target_return_date, r.notes
  into v_member_name, v_amount, v_target, v_notes
  from public.tulong_loan_requests r
  join public.members m on m.id = r.member_id
  where r.id = p_request_id;

  v_letter_id := public.tulong_send_request_letter(
    'loan',
    p_request_id,
    'Humihingi ng Tulong Financial si ' || coalesce(v_member_name, ''),
    'Humihiling ng hiram si ' || coalesce(v_member_name, '') ||
    ' ng halagang ₱' || coalesce(v_amount::text, '0') ||
    coalesce(' (target balik: ' || v_target::text || ')', '') ||
    coalesce(' — Tala: ' || v_notes, '') ||
    '. Pakitingnan sa ibaba: Aprubahan o Tanggihan.'
  );

  return v_letter_id;
end;
$$;
