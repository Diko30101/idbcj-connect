-- Run this ONCE in Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- Creates a tiny table that the daily keep-alive route reads.

create table if not exists public.keep_alive (
  id int primary key,
  note text
);

insert into public.keep_alive (id, note)
values (1, 'keep-alive row')
on conflict (id) do nothing;

alter table public.keep_alive enable row level security;

-- Read-only access for the public (anon) key. No insert/update/delete policy,
-- so nobody can change this table through the public key.
create policy "Allow anon read keep_alive"
  on public.keep_alive
  for select
  to anon
  using (true);
