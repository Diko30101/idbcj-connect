-- 030: Tulong Financial — borrower logins.
-- Bawat pinahiram na active member ay maaaring bigyan ng Finance Ministry ng sariling
-- username + password para makita niya ang SARILI niyang record (mga hiram at bayad).
-- Ang password ay naka-hash (bcrypt via pgcrypto); ang session ay token na naka-hash din.
-- Ang borrower ay nakakakita lang ng sarili niyang datos sa pamamagitan ng dalawang
-- SECURITY DEFINER function sa ibaba; hindi siya dumadaan sa Supabase Auth.

create extension if not exists pgcrypto;

create table if not exists public.tulong_financial_borrowers (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null unique references public.members(id),
  username text not null unique,
  password_hash text not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.tulong_financial_sessions (
  id uuid primary key default gen_random_uuid(),
  borrower_id uuid not null references public.tulong_financial_borrowers(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists tulong_sessions_borrower_idx on public.tulong_financial_sessions(borrower_id);

alter table public.tulong_financial_borrowers enable row level security;
alter table public.tulong_financial_sessions enable row level security;

-- Tanging Admin at Finance Ministry ang nakakabasa/nakakasulat (ang borrower ay
-- dumadaan sa functions sa ibaba, hindi sa direktang table access).
drop policy if exists tulong_borrowers_all on public.tulong_financial_borrowers;
create policy tulong_borrowers_all on public.tulong_financial_borrowers for all to authenticated
  using (public.is_tulong_financial())
  with check (public.is_tulong_financial());

drop policy if exists tulong_sessions_all on public.tulong_financial_sessions;
create policy tulong_sessions_all on public.tulong_financial_sessions for all to authenticated
  using (public.is_tulong_financial())
  with check (public.is_tulong_financial());

-- Helper: i-hash ang password (ginagamit ng Finance Ministry sa paglikha/pag-reset).
-- Tandaan: ang SQL-language function ay bine-validate ng Postgres sa CREATE time,
-- kaya ang mga helper sa ibaba ay DAPAT mauna bago ang tulong_hash_password.
-- Maliit na wrapper para hindi umasa sa search_path ng caller.
create or replace function public.tulong_crypt(pw text, salt text)
returns text language sql stable security definer set search_path = public, extensions as $$
  select crypt(pw, salt);
$$;

create or replace function public.tulong_gen_salt()
returns text language sql volatile security definer set search_path = public, extensions as $$
  select gen_salt('bf', 10);
$$;

create or replace function public.tulong_hash_password(p_password text)
returns text language sql stable security definer set search_path = '' as $$
  select public.tulong_crypt(p_password, public.tulong_gen_salt());
$$;

revoke all on function public.tulong_hash_password(text) from public, anon;
grant execute on function public.tulong_hash_password(text) to authenticated;
revoke all on function public.tulong_crypt(text, text) from public, anon;
grant execute on function public.tulong_crypt(text, text) to authenticated;
revoke all on function public.tulong_gen_salt() from public, anon;
grant execute on function public.tulong_gen_salt() to authenticated;

-- Borrower login: i-verify ang username/password; gumawa ng session; ibalik ang token.
-- Nagbabalik ng NULL kapag mali ang credentials o hindi aktibo.
create or replace function public.tulong_borrower_login(p_username text, p_password text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_borrower public.tulong_financial_borrowers%rowtype;
  v_token text;
  v_member_name text;
begin
  if p_username is null or p_password is null then return null; end if;

  select * into v_borrower
  from public.tulong_financial_borrowers
  where lower(username) = lower(trim(p_username));

  if v_borrower.id is null or not v_borrower.is_active then return null; end if;
  if public.tulong_crypt(p_password, v_borrower.password_hash) <> v_borrower.password_hash then
    return null;
  end if;

  select full_name into v_member_name from public.members where id = v_borrower.member_id;

  v_token := encode(public.tulong_gen_random_bytes(32), 'hex');

  insert into public.tulong_financial_sessions (borrower_id, token_hash, expires_at)
  values (v_borrower.id, encode(public.tulong_sha256(v_token), 'hex'), now() + interval '7 days');

  update public.tulong_financial_borrowers
  set last_login_at = now()
  where id = v_borrower.id;

  return jsonb_build_object('token', v_token, 'member_name', coalesce(v_member_name, ''));
end;
$$;

create or replace function public.tulong_gen_random_bytes(n int)
returns bytea language sql volatile security definer set search_path = public, extensions as $$
  select gen_random_bytes(n);
$$;

create or replace function public.tulong_sha256(s text)
returns bytea language sql immutable security definer set search_path = public, extensions as $$
  select digest(s, 'sha256');
$$;

revoke all on function public.tulong_gen_random_bytes(int) from public, anon;
grant execute on function public.tulong_gen_random_bytes(int) to authenticated;
revoke all on function public.tulong_sha256(text) from public, anon;
grant execute on function public.tulong_sha256(text) to authenticated;

-- Borrower record: ibalik ang SARILING loans + payments ng borrower na may hawak ng token.
-- Nagbabalik ng NULL kapag hindi wasto o paso na ang session.
create or replace function public.tulong_borrower_record(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_member_id uuid;
  v_member_name text;
  v_loans jsonb;
begin
  if p_token is null then return null; end if;

  select b.member_id into v_member_id
  from public.tulong_financial_sessions s
  join public.tulong_financial_borrowers b on b.id = s.borrower_id
  where s.token_hash = encode(public.tulong_sha256(p_token), 'hex')
    and s.expires_at > now()
    and b.is_active;

  if v_member_id is null then return null; end if;

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

  return jsonb_build_object('member_name', coalesce(v_member_name, ''), 'loans', v_loans);
end;
$$;

-- Ang dalawang borrower function ay bukas sa anon (sila ang "login" ng borrower).
revoke all on function public.tulong_borrower_login(text, text) from public;
grant execute on function public.tulong_borrower_login(text, text) to anon, authenticated;
revoke all on function public.tulong_borrower_record(text) from public;
grant execute on function public.tulong_borrower_record(text) to anon, authenticated;
