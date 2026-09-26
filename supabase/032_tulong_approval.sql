-- 032: Tulong Financial — approval flow para sa hiram at username.
--
-- Daloy (ayon sa utos ng user):
--  1. Ang Finance Ministry ang gumagawa ng account (username/password) ng active
--     member na magre-request ng Tulong Financial. Hindi ito nalilikha agad:
--     nagiging KAHILINGAN muna (tulong_username_requests, status 'pending').
--  2. Ang kaanib ay humihiling ng hiram sa /tulong-financial portal
--     (tulong_loan_requests, status 'pending'):
--       - kung may DEDICATED username: borrower login ang gamit;
--       - kung may PORTAL account: portal login ang gamit (borrower_id NULL).
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
  -- Maaaring NULL para sa kaanib na gumagamit ng kanyang portal login
  -- (walang dedicated borrower account).
  borrower_id uuid references public.tulong_financial_borrowers(id) on delete cascade,
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

-- Kung ang migration ay tumakbo na sa lumang hugis (hindi pa sa production),
-- tiyaking nullable ang borrower_id para sa mga portal-login na kahilingan.
alter table public.tulong_loan_requests alter column borrower_id drop not null;

-- ---------------------------------------------------------------------------
-- 2) Mga kahilingan ng username (account)
-- ---------------------------------------------------------------------------
create table if not exists public.tulong_username_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id),
  -- Para sa kaanib na WALANG portal account: bagong borrower login ang lilikhain.
  username text,
  password_hash text,
  -- Para sa kaanib na MAY portal account na: gagamitin ang portal login
  -- (walang bagong username/password; approval letter lang ang kailangan).
  profile_id uuid references public.profiles(id),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  requested_by uuid references public.profiles(id),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id)
);

-- Kung ang migration ay tumakbo na sa lumang hugis (hindi pa sa production),
-- idagdag ang mga bagong column.
alter table public.tulong_username_requests
  alter column username drop not null,
  alter column password_hash drop not null;
alter table public.tulong_username_requests
  add column if not exists profile_id uuid references public.profiles(id);

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
    if v_rec.profile_id is not null then
      -- May portal account na ang kaanib: walang bagong account na lilikhain;
      -- apruba lang, at gagamitin niya ang kanyang portal login.
      null;
    else
      -- Siguraduhing hindi pa nagagamit ang username o may account na ang kaanib.
      if v_rec.username is null or v_rec.password_hash is null then
        raise exception 'walang username/password ang kahilingang ito';
      end if;
      if exists (select 1 from public.tulong_financial_borrowers where lower(username) = lower(v_rec.username)) then
        raise exception 'gamit na ang username na ito';
      end if;
      if exists (select 1 from public.tulong_financial_borrowers where member_id = v_rec.member_id) then
        raise exception 'may account na ang kaanib na ito';
      end if;
      insert into public.tulong_financial_borrowers
        (member_id, username, password_hash, is_active, created_by, password_is_temporary)
      values
        (v_rec.member_id, v_rec.username, v_rec.password_hash, true, v_decider, true);
    end if;
  end if;

  update public.tulong_username_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      decided_at = now(),
      decided_by = v_decider
  where id = p_request_id;

  insert into public.letter_messages (letter_id, author_id, body)
  select l.letter_id, v_decider,
         case when p_approve
           then case when v_rec.profile_id is not null
             then 'APRUBADO ng admin. Maaari nang mag-login ang kaanib gamit ang kanyang portal account sa idbcj.org/tulong-financial.'
             else 'APRUBADO ng admin. Nalikha na ang account (aktibo na, maaari nang mag-login ang kaanib).'
             end
           else 'TINANGGIHAN ng admin ang kahilingang ito.' end
  from public.tulong_request_letters l
  where l.request_kind = 'username' and l.request_id = p_request_id;
end;
$$;

revoke all on function public.tulong_decide_username_request(uuid, boolean) from public, anon;
grant execute on function public.tulong_decide_username_request(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Temporary-password flag: ang auto-generated na password ay kailangang
-- palitan ng kaanib pagkatapos ng unang login. Idinagdag dito (hindi pa
-- tumatakbo ang alinmang migration sa production).
-- ---------------------------------------------------------------------------
alter table public.tulong_financial_borrowers
  add column if not exists password_is_temporary boolean not null default false;

-- Borrower: palitan ang sariling password (kailangan ang kasalukuyang password).
-- Pinapatay ang ibang sessions; ang kasalukuyang session ay nananatili.
create or replace function public.tulong_borrower_change_password(p_token text, p_current text, p_new text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  v_borrower_id uuid;
  v_hash text;
  v_token_hash text;
begin
  if p_token is null or p_token = '' then
    raise exception 'hindi wasto ang session. Mag-login ulit.';
  end if;
  if p_new is null or char_length(p_new) < 6 then
    raise exception 'ang bagong password ay hindi bababa sa 6 na characters';
  end if;

  v_token_hash := encode(public.tulong_sha256(p_token), 'hex');

  select s.borrower_id into v_borrower_id
  from public.tulong_financial_sessions s
  join public.tulong_financial_borrowers b on b.id = s.borrower_id
  where s.token_hash = v_token_hash
    and s.expires_at > now()
    and b.is_active;
  if v_borrower_id is null then
    raise exception 'hindi wasto ang session. Mag-login ulit.';
  end if;

  select password_hash into v_hash
  from public.tulong_financial_borrowers
  where id = v_borrower_id;
  if public.tulong_crypt(p_current, v_hash) <> v_hash then
    raise exception 'mali ang kasalukuyang password';
  end if;

  update public.tulong_financial_borrowers
  set password_hash = public.tulong_hash_password(p_new),
      password_is_temporary = false
  where id = v_borrower_id;

  delete from public.tulong_financial_sessions
  where borrower_id = v_borrower_id
    and token_hash <> v_token_hash;
end;
$$;

revoke all on function public.tulong_borrower_change_password(text, text, text) from public, anon;
grant execute on function public.tulong_borrower_change_password(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Portal login: ang kaanib na MAY portal account na ay gagamit ng kanyang
-- portal login (hindi na gagawa ng bagong borrower username/password).
-- ---------------------------------------------------------------------------

-- 5g) Portal user: sariling record (member_name + loans). Kailangang may
--     aprubadong username request ang kaanib, o may naitala nang hiram.
create or replace function public.tulong_borrower_record_by_profile()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_profile uuid;
  v_member_id uuid;
  v_member_name text;
  v_loans jsonb;
begin
  v_profile := auth.uid();
  if v_profile is null then return null; end if;

  select m.id into v_member_id from public.members m where m.profile_id = v_profile;
  if v_member_id is null then
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

  select full_name into v_member_name from public.members where id = v_member_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', l.id,
      'amount', l.amount,
      'date_borrowed', l.date_borrowed,
      'target_return_date', l.target_return_date,
      'notes', l.notes,
      'payments', coalesce((
        select jsonb_agg(jsonb_build_object('amount', p.amount, 'date_paid', p.date_paid) order by p.date_paid)
        from public.tulong_financial_payments p
        where p.loan_id = l.id
      ), '[]'::jsonb)
    ) order by l.date_borrowed desc
  ), '[]'::jsonb)
  into v_loans
  from public.tulong_financial_loans l
  where l.member_id = v_member_id;

  return jsonb_build_object('member_name', coalesce(v_member_name, ''), 'loans', v_loans,
    'password_is_temporary', false);
end;
$$;

revoke all on function public.tulong_borrower_record_by_profile() from public, anon;
grant execute on function public.tulong_borrower_record_by_profile() to authenticated;

-- 5h) Portal user: sariling mga kahilingan ng hiram (para makita ang status).
create or replace function public.tulong_my_loan_requests_by_profile()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_profile uuid;
  v_member_id uuid;
  v_out jsonb;
begin
  v_profile := auth.uid();
  if v_profile is null then return '[]'::jsonb; end if;

  select m.id into v_member_id from public.members m where m.profile_id = v_profile;
  if v_member_id is null then
    -- Fallback: kaanib na na-link sa pamamagitan ng pangalan (walang members.profile_id).
    select r.member_id into v_member_id
    from public.tulong_username_requests r
    where r.profile_id = v_profile and r.status = 'approved'
    order by r.decided_at desc nulls last limit 1;
  end if;
  if v_member_id is null then return '[]'::jsonb; end if;

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
  where r.member_id = v_member_id;

  return v_out;
end;
$$;

revoke all on function public.tulong_my_loan_requests_by_profile() from public, anon;
grant execute on function public.tulong_my_loan_requests_by_profile() to authenticated;

-- 5i) Portal user: humiling ng hiram gamit ang portal login.
--     Kailangang may aprubadong username request, o may naitala nang hiram.
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

  return v_request_id;
end;
$$;

revoke all on function public.tulong_create_loan_request_by_profile(numeric, date, text) from public, anon;
grant execute on function public.tulong_create_loan_request_by_profile(numeric, date, text) to authenticated;

-- 5j) Finance Ministry: hanapin ang portal account ng isang kaanib.
--     Una: direktang members.profile_id link. Kung wala: pagtugmain ang
--     pangalan (normalized). Para matiyak na hindi gagawa ng bagong
--     username/password kung may portal account na ang kaanib.
create or replace function public.tulong_find_portal_profile(p_member_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_member_name text;
  v_profile_id uuid;
  v_out jsonb;
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

  -- Paghahambing ng pangalan (hindi case-sensitive, walang sobrang espasyo).
  select jsonb_build_object('profile_id', p.id, 'full_name', p.full_name, 'email', p.email, 'via', 'name')
  into v_out
  from public.profiles p
  where p.status = 'active'
    and lower(regexp_replace(trim(p.full_name), '\s+', ' ', 'g'))
      = lower(regexp_replace(trim(v_member_name), '\s+', ' ', 'g'))
  order by p.created_at nulls last
  limit 1;

  return v_out;
end;
$$;

revoke all on function public.tulong_find_portal_profile(uuid) from public, anon;
grant execute on function public.tulong_find_portal_profile(uuid) to authenticated;
