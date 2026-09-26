-- 029: Tulong Financial — talaan ng mga nahiram na salapi ng mga active members.
-- Nakakakita at nagtatala: Admin at Finance Ministry lang (buong iglesia, hindi per-local).
-- Bawat bayad (installment) ay may sariling halaga at petsa; ang balanse ay awtomatikong
-- kinukuwenta (hiniram − kabuuang nabayaran).

create table if not exists public.tulong_financial_loans (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id),
  local_id uuid references public.locals(id),
  amount numeric(12,2) not null check (amount > 0),
  date_borrowed date not null,
  target_return_date date,
  notes text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.tulong_financial_payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.tulong_financial_loans(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  date_paid date not null,
  notes text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Access function: Admin, o aktibong kasapi ng Finance Ministry (anumang scope).
create or replace function public.is_tulong_financial()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1
    from public.ministry_members mm
    join public.ministries m on m.id = mm.ministry_id
    join public.profiles p on p.id = mm.profile_id
    where mm.profile_id = auth.uid()
      and m.name = 'Finance Ministry'
      and p.status <> 'inactive'
  )
$$;

revoke all on function public.is_tulong_financial() from public, anon;
grant execute on function public.is_tulong_financial() to authenticated;

alter table public.tulong_financial_loans enable row level security;
alter table public.tulong_financial_payments enable row level security;

drop policy if exists tulong_loans_all on public.tulong_financial_loans;
create policy tulong_loans_all on public.tulong_financial_loans for all to authenticated
  using (public.is_tulong_financial())
  with check (public.is_tulong_financial());

drop policy if exists tulong_payments_all on public.tulong_financial_payments;
create policy tulong_payments_all on public.tulong_financial_payments for all to authenticated
  using (public.is_tulong_financial())
  with check (public.is_tulong_financial());
