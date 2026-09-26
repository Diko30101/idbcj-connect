-- 032: Tulong Financial — approval flow para sa hiram at username.
--
-- Daloy (ayon sa utos ng user):
--  1. Ang Finance Ministry ang gumagawa ng account (username/password) ng active
--     member na magre-request ng Tulong Financial. Hindi ito nalilikha agad:
--     nagiging KAHILINGAN muna (tulong_username_requests, status 'pending').
--  2. Ang kaanib na may username ay humihiling ng hiram sa /tulong-financial portal
--     (tulong_loan_requests, status 'pending'). Hindi makakahiram ang walang username.
--  3. Ang Finance Ministry ay nagpapadala ng kahilingan ng hiram sa admin
--     ("Ipadala sa admin"): status 'sent', at may Inbox letter sa mga admin.
--  4. Ang admin ay nag-aapruba o tumatanggi SA LOOB MISMO ng letter (may pindutan):
--       - pag-apruba ng hiram  -> awtomatikong nalilikha ang loan sa
--         tulong_financial_loans;
--       - pag-apruba ng username -> awtomatikong nalilikha ang account sa
--         tulong_financial_borrowers (aktibo agad).
--  5. Ang desisyon ay naipoposte bilang mensahe sa thread ng letter, kaya makikita
--     ng Finance Ministry sa kanilang inbox na na-aprubahan (o tinanggihan) na.
--
-- Ang direktang pagtatala ng hiram ng Finance Ministry ay tinatanggal na sa UI;
-- lahat ng hiram ay dadaan sa request -> approval.

-- ---------------------------------------------------------------------------
-- 1) Mga kahilingan ng hiram
-- ---------------------------------------------------------------------------
create table if not exists public.tulong_loan_requests (
  id uuid primary key default gen_random_uuid(),
  borrower_id uuid not null references public.tulong_financial_borrowers(id) on delete cascade,
  member_id uuid not null references public.members(id),
  amount numeric(12,2) not null check (amount > 0),
  target_return_date date,
  notes text,
  status text not null default 'pending'
    check (status in ('pending','sent','approved','rejected')),
  requested_at timestamptz not null default now(),
  sent_at timestamptz,
  sent_by uuid references public.profiles(id),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id)
);

create index if not exists tulong_loan_requests_borrower_idx on public.tulong_loan_requests(borrower_id);
create index if not exists tulong_loan_requests_status_idx on public.tulong_loan_requests(status);

-- ---------------------------------------------------------------------------
-- 2) Mga kahilingan ng username (account)
-- ---------------------------------------------------------------------------
create table if not exists public.tulong_username_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id),
  username text not null,
  password_hash text not null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  requested_by uuid references public.profiles(id),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id)
);

-- Isang pending na kahilingan lang bawat kaanib.
create unique index if not exists tulong_username_requests_pending_member_uidx
  on public.tulong_username_requests(member_id) where status = 'pending';

-- ---------------------------------------------------------------------------
-- 3) Ugnayan ng letter sa kahilingan (para sa pindutan ng apruba sa Inbox)
-- ---------------------------------------------------------------------------
create table if not exists public.tulong_request_letters (
  letter_id uuid primary key references public.letters(id) on delete cascade,
  request_kind text not null check (request_kind in ('loan','username')),
  request_id uuid not null
);

create index if not exists tulong_request_letters_req_idx
  on public.tulong_request_letters(request_kind, request_id);

-- ---------------------------------------------------------------------------
-- 4) RLS — Admin at Finance Ministry lang ang direktang nakakagalaw;
--    ang mga borrower ay dumadaan sa SECURITY DEFINER functions (token).
-- ---------------------------------------------------------------------------
alter table public.tulong_loan_requests enable row level security;
alter table public.tulong_username_requests enable row level security;
alter table public.tulong_request_letters enable row level security;

drop policy if exists tulong_loan_requests_all on public.tulong_loan_requests;
create policy tulong_loan_requests_all on public.tulong_loan_requests for all to authenticated
  using (public.is_tulong_financial())
  with check (public.is_tulong_financial());

drop policy if exists tulong_username_requests_all on public.tulong_username_requests;
create policy tulong_username_requests_all on public.tulong_username_requests for all to authenticated
  using (public.is_tulong_financial())
  with check (public.is_tulong_financial());

drop policy if exists tulong_request_letters_all on public.tulong_request_letters;
create policy tulong_request_letters_all on public.tulong_request_letters for all to authenticated
  using (public.is_tulong_financial())
  with check (public.is_tulong_financial());

-- ---------------------------------------------------------------------------
-- 5) SECURITY DEFINER functions
-- ---------------------------------------------------------------------------

-- 5a) Borrower: humiling ng hiram (kailangan aktibo ang account; walang username = walang hiram).
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

  return v_request_id;
end;
$$;

revoke all on function public.tulong_create_loan_request(text, numeric, date, text) from public, anon, authenticated;
grant execute on function public.tulong_create_loan_request(text, numeric, date, text) to anon, authenticated;

-- 5b) Borrower: sariling mga kahilingan ng hiram (para makita ang status).
create or replace function public.tulong_my_loan_requests(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_borrower_id uuid;
  v_out jsonb;
begin
  if p_token is null or p_token = '' then return '[]'::jsonb; end if;

  select b.id into v_borrower_id
  from public.tulong_financial_sessions s
  join public.tulong_financial_borrowers b on b.id = s.borrower_id
  where s.token_hash = encode(public.tulong_sha256(p_token), 'hex')
    and s.expires_at > now()
    and b.is_active;

  if v_borrower_id is null then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id,
      'amount', r.amount,
      'target_return_date', r.target_return_date,
      'notes', r.notes,
      'status', r.status,
      'requested_at', r.requested_at,
      'decided_at', r.decided_at
    ) order by r.requested_at desc), '[]'::jsonb)
  into v_out
  from public.tulong_loan_requests r
  where r.borrower_id = v_borrower_id;

  return v_out;
end;
$$;

revoke all on function public.tulong_my_loan_requests(text) from public, anon, authenticated;
grant execute on function public.tulong_my_loan_requests(text) to anon, authenticated;

-- 5c) Gumawa ng Inbox letter para sa approval.
--     Tatanggap: lahat ng admin + lahat ng kasapi ng Finance Ministry,
--     para makita ng Finance Ministry sa inbox ang desisyon ng admin.
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

-- 5d) Finance Ministry: ipadala ang kahilingan ng hiram sa admin (+ letter).
create or replace function public.tulong_forward_loan_request(p_request_id uuid)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_sender uuid;
  v_letter_id uuid;
  v_member_name text;
  v_amount numeric;
  v_target date;
  v_notes text;
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
    'Kahilingan ng hiram — ' || coalesce(v_member_name, ''),
    'Humihiling ng hiram si ' || coalesce(v_member_name, '') ||
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

-- 5e) Admin: aprubahan/tanggihan ang kahilingan ng hiram (mula sa letter).
--     Pag-apruba: awtomatikong nalilikha ang loan sa tulong_financial_loans
--     (date_borrowed = petsa ng pag-apruba).
create or replace function public.tulong_decide_loan_request(p_request_id uuid, p_approve boolean)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  v_decider uuid;
  v_rec record;
  v_local_id uuid;
begin
  v_decider := auth.uid();
  if v_decider is null
     or not exists (select 1 from public.profiles where id = v_decider and role = 'admin') then
    raise exception 'admin lang ang maaaring mag-apruba';
  end if;

  select * into v_rec from public.tulong_loan_requests where id = p_request_id;
  if v_rec.id is null then raise exception 'hindi nakita ang kahilingan'; end if;
  if v_rec.status <> 'sent' then
    raise exception 'hindi na naghihintay ng apruba ang kahilingang ito';
  end if;

  if p_approve then
    select local_id into v_local_id from public.members where id = v_rec.member_id;
    insert into public.tulong_financial_loans
      (member_id, local_id, amount, date_borrowed, target_return_date, notes, recorded_by)
    values
      (v_rec.member_id, v_local_id, v_rec.amount, current_date,
       v_rec.target_return_date, v_rec.notes, v_decider);
  end if;

  update public.tulong_loan_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      decided_at = now(),
      decided_by = v_decider
  where id = p_request_id;

  insert into public.letter_messages (letter_id, author_id, body)
  select l.letter_id, v_decider,
         case when p_approve
           then 'APRUBADO ng admin. Nalikha na ang loan record para sa kahilingang ito.'
           else 'TINANGGIHAN ng admin ang kahilingang ito.' end
  from public.tulong_request_letters l
  where l.request_kind = 'loan' and l.request_id = p_request_id;
end;
$$;

revoke all on function public.tulong_decide_loan_request(uuid, boolean) from public, anon;
grant execute on function public.tulong_decide_loan_request(uuid, boolean) to authenticated;

-- 5f) Admin: aprubahan/tanggihan ang kahilingan ng username (mula sa letter).
--     Pag-apruba: awtomatikong nalilikha ang account (aktibo agad).
create or replace function public.tulong_decide_username_request(p_request_id uuid, p_approve boolean)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  v_decider uuid;
  v_rec record;
begin
  v_decider := auth.uid();
  if v_decider is null
     or not exists (select 1 from public.profiles where id = v_decider and role = 'admin') then
    raise exception 'admin lang ang maaaring mag-apruba';
  end if;

  select * into v_rec from public.tulong_username_requests where id = p_request_id;
  if v_rec.id is null then raise exception 'hindi nakita ang kahilingan'; end if;
  if v_rec.status <> 'pending' then
    raise exception 'hindi na naghihintay ng apruba ang kahilingang ito';
  end if;

  if p_approve then
    -- Siguraduhing hindi pa nagagamit ang username o may account na ang kaanib.
    if exists (select 1 from public.tulong_financial_borrowers where lower(username) = lower(v_rec.username)) then
      raise exception 'gamit na ang username na ito';
    end if;
    if exists (select 1 from public.tulong_financial_borrowers where member_id = v_rec.member_id) then
      raise exception 'may account na ang kaanib na ito';
    end if;
    insert into public.tulong_financial_borrowers
      (member_id, username, password_hash, is_active, created_by)
    values
      (v_rec.member_id, v_rec.username, v_rec.password_hash, true, v_decider);
  end if;

  update public.tulong_username_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      decided_at = now(),
      decided_by = v_decider
  where id = p_request_id;

  insert into public.letter_messages (letter_id, author_id, body)
  select l.letter_id, v_decider,
         case when p_approve
           then 'APRUBADO ng admin. Nalikha na ang account (aktibo na, maaari nang mag-login ang kaanib).'
           else 'TINANGGIHAN ng admin ang kahilingang ito.' end
  from public.tulong_request_letters l
  where l.request_kind = 'username' and l.request_id = p_request_id;
end;
$$;

revoke all on function public.tulong_decide_username_request(uuid, boolean) from public, anon;
grant execute on function public.tulong_decide_username_request(uuid, boolean) to authenticated;
