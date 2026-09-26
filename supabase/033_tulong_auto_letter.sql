-- 033_tulong_auto_letter.sql
-- Auto-create Inbox letter kapag nag-submit ng loan request ang miyembro.
-- Ang letter of request ay diretso sa Inbox ng admin (at Finance Ministry)
-- para ma-aprubahan — hindi na kailangan ang manual na "Ipadala sa admin".
--
-- Gayundin: backfill ng mga nawawalang letter para sa mga pending na
-- username request (tulad ng kay Jimmy Villaverde).

-- ---------------------------------------------------------------------------
-- 1) Internal helper: gumawa ng Inbox letter para sa loan request.
--    SECURITY DEFINER — walang permission check dito; ang tumatawag na
--    function ang responsable (borrower na nag-submit ng sariling request).
-- ---------------------------------------------------------------------------
create or replace function public.tulong_make_loan_letter(p_request_id uuid)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_letter_id uuid;
  v_member_name text;
  v_amount numeric;
  v_target date;
  v_notes text;
  v_sender uuid;
begin
  select m.full_name, r.amount, r.target_return_date, r.notes, m.profile_id
  into v_member_name, v_amount, v_target, v_notes, v_sender
  from public.tulong_loan_requests r
  join public.members m on m.id = r.member_id
  where r.id = p_request_id;

  if v_member_name is null then return null; end if;

  insert into public.letters (subject, created_by)
  values ('Kahilingan ng hiram — ' || v_member_name, v_sender)
  returning id into v_letter_id;

  insert into public.letter_recipients (letter_id, profile_id)
  select v_letter_id, p.id from public.profiles p where p.role = 'admin'
  union
  select v_letter_id, mm.profile_id
  from public.ministry_members mm
  join public.ministries m on m.id = mm.ministry_id
  where m.name = 'Finance Ministry';

  insert into public.letter_messages (letter_id, author_id, body)
  values (v_letter_id, v_sender,
    'Humihiling ng hiram si ' || v_member_name ||
    ' ng halagang ₱' || coalesce(v_amount::text, '0') ||
    coalesce(' (target balik: ' || v_target::text || ')', '') ||
    coalesce(' — Tala: ' || v_notes, '') ||
    '. Pakitingnan sa ibaba: Aprubahan o Tanggihan.');

  insert into public.tulong_request_letters (letter_id, request_kind, request_id)
  values (v_letter_id, 'loan', p_request_id)
  on conflict (letter_id) do nothing;

  -- Markahan bilang naipadala na sa admin.
  update public.tulong_loan_requests
  set status = 'sent', sent_at = now()
  where id = p_request_id and status = 'pending';

  return v_letter_id;
end;
$$;

revoke all on function public.tulong_make_loan_letter(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Borrower (token): auto-letter pagkatapos malikha ang request.
-- ---------------------------------------------------------------------------
create or replace function public.tulong_create_loan_request(
  p_token text, p_amount numeric, p_target_return_date date, p_notes text
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_borrower_id uuid;
  v_member_id uuid;
  v_request_id uuid;
begin
  if p_token is null or p_token = '' then return null; end if;
  if p_amount is null or p_amount <= 0 then return null; end if;

  select b.id, b.member_id into v_borrower_id, v_member_id
  from public.tulong_financial_sessions s
  join public.tulong_financial_borrowers b on b.id = s.borrower_id
  where s.token_hash = encode(public.tulong_sha256(p_token), 'hex')
    and s.expires_at > now()
    and b.is_active;

  if v_borrower_id is null then return null; end if;

  -- Isang naghihintay na kahilingan lang bawat borrower.
  if exists (
    select 1 from public.tulong_loan_requests
    where borrower_id = v_borrower_id and status in ('pending','sent')
  ) then
    return null;
  end if;

  insert into public.tulong_loan_requests
    (borrower_id, member_id, amount, target_return_date, notes, status)
  values
    (v_borrower_id, v_member_id, round(p_amount, 2), p_target_return_date,
     nullif(trim(coalesce(p_notes, '')), ''), 'pending')
  returning id into v_request_id;

  -- Awtomatikong letter sa Inbox ng admin.
  perform public.tulong_make_loan_letter(v_request_id);

  return v_request_id;
end;
$$;

revoke all on function public.tulong_create_loan_request(text, numeric, date, text) from public, anon, authenticated;
grant execute on function public.tulong_create_loan_request(text, numeric, date, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Portal user (may portal account): auto-letter pagkatapos malikha.
-- ---------------------------------------------------------------------------
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

  -- Awtomatikong letter sa Inbox ng admin.
  perform public.tulong_make_loan_letter(v_request_id);

  return v_request_id;
end;
$$;

revoke all on function public.tulong_create_loan_request_by_profile(numeric, date, text) from public, anon;
grant execute on function public.tulong_create_loan_request_by_profile(numeric, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Tiyakin na umiiral ang tulong_send_request_letter (para sa username).
-- ---------------------------------------------------------------------------
create or replace function public.tulong_send_request_letter(
  p_kind text, p_request_id uuid, p_subject text, p_body text
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_sender uuid;
  v_letter_id uuid;
begin
  if p_kind not in ('loan','username') then
    raise exception 'di-wastong uri ng kahilingan';
  end if;
  v_sender := auth.uid();
  if v_sender is null or not public.is_tulong_financial() then
    raise exception 'walang access';
  end if;

  insert into public.letters (subject, created_by)
  values (p_subject, v_sender)
  returning id into v_letter_id;

  insert into public.letter_recipients (letter_id, profile_id)
  select v_letter_id, p.id from public.profiles p where p.role = 'admin'
  union
  select v_letter_id, mm.profile_id
  from public.ministry_members mm
  join public.ministries m on m.id = mm.ministry_id
  where m.name = 'Finance Ministry';

  insert into public.letter_messages (letter_id, author_id, body)
  values (v_letter_id, v_sender, p_body);

  insert into public.tulong_request_letters (letter_id, request_kind, request_id)
  values (v_letter_id, p_kind, p_request_id)
  on conflict (letter_id) do nothing;

  return v_letter_id;
end;
$$;

revoke all on function public.tulong_send_request_letter(text, uuid, text, text) from public, anon;
grant execute on function public.tulong_send_request_letter(text, uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Backfill: gumawa ng letter para sa mga pending username request na
--    walang letter (hal. kay Jimmy Villaverde).
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_letter_id uuid;
  v_member_name text;
begin
  for r in
    select ur.id as req_id, ur.member_id, ur.username, ur.requested_by, m.full_name
    from public.tulong_username_requests ur
    join public.members m on m.id = ur.member_id
    left join public.tulong_request_letters trl
      on trl.request_kind = 'username' and trl.request_id = ur.id
    where ur.status = 'pending' and trl.letter_id is null
  loop
    v_member_name := r.full_name;

    insert into public.letters (subject, created_by)
    values ('Kahilingan ng username — ' || v_member_name, r.requested_by)
    returning id into v_letter_id;

    insert into public.letter_recipients (letter_id, profile_id)
    select v_letter_id, p.id from public.profiles p where p.role = 'admin'
    union
    select v_letter_id, mm.profile_id
    from public.ministry_members mm
    join public.ministries m on m.id = mm.ministry_id
    where m.name = 'Finance Ministry';

    insert into public.letter_messages (letter_id, author_id, body)
    values (v_letter_id, r.requested_by,
      'Humihiling ang Finance Ministry ng username para kay ' || v_member_name ||
      ' (awtomatikong username: ' || coalesce(r.username, '') || '). ' ||
      'Pakitingnan sa ibaba: Aprubahan o Tanggihan. ' ||
      'Kapag na-aprubahan, malilikha ang account at maaari nang mag-login ang kaanib sa ' ||
      'idbcj.org/tulong-financial/login gamit ang temporary password na ibinigay ng Finance Ministry.');

    insert into public.tulong_request_letters (letter_id, request_kind, request_id)
    values (v_letter_id, 'username', r.req_id)
    on conflict (letter_id) do nothing;
  end loop;
end;
$$;
