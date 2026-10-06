-- 052: Balanse ng Pangasiwaan — kasalukuyang balanse ng mga account ng iglesia
-- (BPI, BDO, Cash on hand). Nakakakita at nag-a-update: Admin at Finance Ministry lang.
--
-- Bawat update ay BAGONG snapshot (insert-only; walang UPDATE/DELETE) — nananatili
-- ang kasaysayan ng mga lingguhang update mula sa panimulang tala.
--
-- Panimulang tala (hindi kasama sa migration na ito; ise-seed nang hiwalay na may
-- beripikasyon): BPI ₱300,017.22 (hanggang Set. 25, 2026), BDO ₱1,640,010.54
-- (hanggang Set. 25, 2026), Cash on hand ₱130,590.00 (Set. 2026).

create table if not exists public.pangasiwaan_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_key text not null check (account_key in ('bpi', 'bdo', 'cash')),
  account_label text not null,
  balance numeric(14,2) not null check (balance >= 0),
  as_of date not null,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists pangasiwaan_balance_snapshots_account_created_idx
  on public.pangasiwaan_balance_snapshots (account_key, created_at desc);

-- Access function: Admin, o aktibong kasapi ng church-wide Finance Ministry.
create or replace function public.is_pangasiwaan_balance_admin()
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

revoke all on function public.is_pangasiwaan_balance_admin() from public, anon;
grant execute on function public.is_pangasiwaan_balance_admin() to authenticated;

alter table public.pangasiwaan_balance_snapshots enable row level security;

drop policy if exists pangasiwaan_balances_select on public.pangasiwaan_balance_snapshots;
create policy pangasiwaan_balances_select on public.pangasiwaan_balance_snapshots
  for select to authenticated
  using (public.is_pangasiwaan_balance_admin());

drop policy if exists pangasiwaan_balances_insert on public.pangasiwaan_balance_snapshots;
create policy pangasiwaan_balances_insert on public.pangasiwaan_balance_snapshots
  for insert to authenticated
  with check (public.is_pangasiwaan_balance_admin());

-- Sadyang WALANG update/delete policy: ang mga snapshot ay hindi binabago o binubura;
-- ang pagwawasto ay sa pamamagitan ng bagong snapshot.
