-- =====================================================================
-- IDBCJ MEMBER PORTAL - 025: Beripikasyon ng dumalo mula sa ibang local
--
-- Kapag may dumalo mula sa ibang local, hindi na free-text ang pangalan:
-- hahanapin ito sa roster ng ibang local upang matiyak na nakatala
-- talaga ang kaanib doon.
--
-- Ang migration na ito ay:
--   1. Nagdaragdag ng member_id sa public.attendance_guests (link sa
--      public.members para sa 'other_local'; nananatiling free-text ang
--      'visitor' dahil wala sila sa roster).
--   2. Gumagawa ng RPC public.search_roster_members(p_local_id, p_query):
--      paghahanap ng pangalan sa roster ng isang local (id + full_name
--      lang ang ibinabalik, max 20) -- para sa autocomplete. Ang local
--      secretary ay walang direktang read access sa roster ng ibang
--      local (RLS), kaya controlled RPC ang ginagamit.
--   3. Gumagawa ng RPC public.verify_roster_member(p_member_id):
--      nagbabalik ng canonical na (member_id, full_name, local_id) ng
--      isang kaanib -- para beripikahin sa pag-save na ang kaanib ay
--      nakatala talaga sa sinabing local.
--   Ang dalawang RPC ay SECURITY DEFINER at bukas lang sa mga kasapi
--   ng Administrative / Local Admin Ministry at admin.
--
-- Ipapatakbo sa Supabase > SQL Editor. Ligtas ulitin (idempotent).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. member_id sa attendance_guests
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'attendance_guests'
      and column_name = 'member_id'
  ) then
    alter table public.attendance_guests
      add column member_id uuid references public.members (id);
  end if;
end $$;

create index if not exists idx_attendance_guests_member
  on public.attendance_guests (member_id);

-- ---------------------------------------------------------------------
-- 2. RPC: paghahanap ng pangalan sa roster ng isang local
-- ---------------------------------------------------------------------
create or replace function public.search_roster_members(p_local_id uuid, p_query text)
returns table (member_id uuid, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.full_name
  from public.members m
  where m.local_id = p_local_id
    and (
      public.is_admin()
      or exists (
        select 1
        from public.ministry_members mm
        join public.ministries mi on mi.id = mm.ministry_id
        join public.profiles p on p.id = mm.profile_id
        where mm.profile_id = auth.uid()
          and mi.name in ('Administrative Ministry', 'Local Admin Ministry')
          and mm.local_id is not null
          and p.status <> 'inactive'
      )
    )
    and (
      p_query is null
      or btrim(p_query) = ''
      or m.full_name ilike '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
    )
  order by m.full_name
  limit 20;
$$;

-- ---------------------------------------------------------------------
-- 3. RPC: beripikasyon ng isang kaanib (canonical na pangalan at local)
-- ---------------------------------------------------------------------
create or replace function public.verify_roster_member(p_member_id uuid)
returns table (member_id uuid, full_name text, local_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.full_name, m.local_id
  from public.members m
  where m.id = p_member_id
    and (
      public.is_admin()
      or exists (
        select 1
        from public.ministry_members mm
        join public.ministries mi on mi.id = mm.ministry_id
        join public.profiles p on p.id = mm.profile_id
        where mm.profile_id = auth.uid()
          and mi.name in ('Administrative Ministry', 'Local Admin Ministry')
          and mm.local_id is not null
          and p.status <> 'inactive'
      )
    )
  limit 1;
$$;

revoke all on function public.search_roster_members(uuid, text) from anon;
revoke all on function public.verify_roster_member(uuid) from anon;
grant execute on function public.search_roster_members(uuid, text) to authenticated;
grant execute on function public.verify_roster_member(uuid) to authenticated;

commit;
