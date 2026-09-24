-- =====================================================================
-- IDBCJ MEMBER PORTAL - 013: Roster ng kaanib (public.members) --
--   sino ang nagma-manage, at pagpapalit ng status (Admin lang)
--
-- DRAFT -- HINDI PA NAKA-APPLY. Kailangan ang 010.
--
-- Mga patakaran:
--   * Roster manager = Admin (is_admin()), o kasapi ng Administrative
--     Ministry / Local Admin Ministry ng sariling local.
--   * Ang status (Active/Inactive/Pagtitiwalag), status_reason, at
--     local_id ay Admin lang ang makapagbabago. Ang bagong kaanib na
--     idinagdag ng hindi Admin ay laging 'Active' (hindi sila
--     makapagtatakda ng status).
--   * Ang pagpapalit ng status ay nangangailangan ng status_reason;
--     ang trigger ang nagtatakda ng status_changed_at/by.
--   * Church-wide Finance at Finance ng local: SELECT lang (hindi
--     nila ma-manage ang roster).
--   * Audit: bawat INSERT at UPDATE sa finance_audit_log (dating at
--     bagong status ay nasa old_values/new_values).
-- Rollback: 013_rollback.sql
-- =====================================================================

begin;

create or replace function public.is_roster_manager(p_local_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or (
    p_local_id is not null and exists (
      select 1
      from public.ministry_members mm
      join public.ministries m on m.id = mm.ministry_id
      join public.profiles p on p.id = mm.profile_id
      where mm.profile_id = auth.uid()
        and mm.local_id = p_local_id
        and m.name in ('Administrative Ministry', 'Local Admin Ministry')
        and p.status <> 'inactive'
    )
  )
$$;

revoke all on function public.is_roster_manager(uuid) from public, anon;
grant execute on function public.is_roster_manager(uuid) to authenticated;

-- Trigger: status at local_id -- Admin lang.
create or replace function public.members_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_admin boolean;
begin
  if auth.uid() is null then
    return new;  -- migration/service role
  end if;
  v_admin := public.is_admin();

  if tg_op = 'INSERT' then
    if not v_admin then
      new.status := 'Active';
      new.status_reason := null;
    end if;
    new.status_changed_at := case when new.status <> 'Active' then now() end;
    new.status_changed_by := case when new.status <> 'Active' then auth.uid() end;
    return new;
  end if;

  -- UPDATE
  if not v_admin then
    if new.status is distinct from old.status
       or new.status_reason is distinct from old.status_reason
       or new.local_id is distinct from old.local_id then
      raise exception 'Ang Admin lang ang makapagpapalit ng status o ng local ng kaanib.'
        using errcode = '42501';
    end if;
    new.status_changed_at := old.status_changed_at;
    new.status_changed_by := old.status_changed_by;
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status_reason is null or length(btrim(new.status_reason)) = 0 then
      raise exception 'Kailangan ang dahilan sa pagpapalit ng status ng kaanib.' using errcode = '23514';
    end if;
    new.status_changed_at := now();
    new.status_changed_by := auth.uid();
  else
    new.status_changed_at := old.status_changed_at;
    new.status_changed_by := old.status_changed_by;
  end if;
  return new;
end $$;

revoke all on function public.members_rules() from public, anon, authenticated;

drop trigger if exists members_rules on public.members;
create trigger members_rules
  before insert or update on public.members
  for each row execute function public.members_rules();

drop trigger if exists members_audit on public.members;
create trigger members_audit
  after insert or update on public.members
  for each row execute function public.finance_audit();

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'members' loop
    execute format('drop policy %I on public.members', r.policyname);
  end loop;
end $$;

alter table public.members enable row level security;

create policy members_select on public.members for select to authenticated
  using (public.is_roster_manager(local_id) or public.can_access_local(local_id));
create policy members_insert on public.members for insert to authenticated
  with check (public.is_roster_manager(local_id));
create policy members_update on public.members for update to authenticated
  using (public.is_roster_manager(local_id))
  with check (public.is_roster_manager(local_id) or public.is_admin());

revoke all on public.members from anon, authenticated;
grant select, insert, update on public.members to authenticated;

commit;
