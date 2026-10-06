-- 048: Paghiwalayin ang request letter at confirmation.
-- Dati: iisang letter ang ipinapadala sa mga admin + Finance Ministry.
-- Ngayon:
--   1) Request letter (may Aprubahan/Tanggihan) -> mga admin LANG.
--   2) Confirmation (walang approval) -> Finance Ministry LANG:
--      "Ang kahilingan para kay [pangalan] ay naipadala na sa admin."
-- Sakop ang loan at username requests (parehong gumagamit ng function na ito).

create or replace function public.tulong_send_request_letter(
  p_kind text, p_request_id uuid, p_subject text, p_body text
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_sender uuid;
  v_letter_id uuid;
  v_confirm_id uuid;
  v_member_name text;
begin
  if p_kind not in ('loan','username') then
    raise exception 'di-wastong uri ng kahilingan';
  end if;
  v_sender := auth.uid();
  if v_sender is null or not public.is_tulong_financial() then
    raise exception 'walang access';
  end if;

  -- Kunin ang pangalan ng kaanib para sa confirmation letter.
  if p_kind = 'loan' then
    select m.full_name into v_member_name
    from public.tulong_loan_requests r
    join public.members m on m.id = r.member_id
    where r.id = p_request_id;
  else
    select m.full_name into v_member_name
    from public.tulong_username_requests r
    join public.members m on m.id = r.member_id
    where r.id = p_request_id;
  end if;

  -- 1) Request letter: sa mga admin lang (may approval buttons).
  insert into public.letters (subject, created_by)
  values (p_subject, v_sender)
  returning id into v_letter_id;

  insert into public.letter_recipients (letter_id, profile_id)
  select v_letter_id, p.id from public.profiles p where p.role = 'admin';

  insert into public.letter_messages (letter_id, author_id, body)
  values (v_letter_id, v_sender, p_body);

  insert into public.tulong_request_letters (letter_id, request_kind, request_id)
  values (v_letter_id, p_kind, p_request_id)
  on conflict (letter_id) do nothing;

  -- 2) Confirmation: sa Finance Ministry lang (walang approval).
  insert into public.letters (subject, created_by)
  values ('Naipadala sa admin — ' || coalesce(v_member_name, ''), v_sender)
  returning id into v_confirm_id;

  insert into public.letter_recipients (letter_id, profile_id)
  select v_confirm_id, mm.profile_id
  from public.ministry_members mm
  join public.ministries m on m.id = mm.ministry_id
  where m.name = 'Finance Ministry';

  insert into public.letter_messages (letter_id, author_id, body)
  values (v_confirm_id, v_sender,
    'Ang kahilingan para kay ' || coalesce(v_member_name, '') ||
    ' ay naipadala na sa admin para sa apruba.');

  return v_letter_id;
end;
$$;

revoke all on function public.tulong_send_request_letter(text, uuid, text, text) from public, anon;
grant execute on function public.tulong_send_request_letter(text, uuid, text, text) to authenticated;
