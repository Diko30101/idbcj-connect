-- =====================================================================
-- IDBCJ MEMBER PORTAL - 010: Access (finance_scope, can_access_local),
--   status (draft/submitted/void), audit, at app_config
--
-- DRAFT -- HINDI PA NAKA-APPLY. Spec: docs/superpowers/specs/
-- 2026-09-23-giving-records-design.md. Ipapatakbo lamang pagkatapos ng
-- backup at tahasang pahintulot ng Admin.
--
-- Nilalaman:
--   1. enum finance_record_status; conversion ng abuluyan_totals at
--      attendance_records (Draft->draft, Submitted->submitted,
--      Reviewed->submitted)
--   2. app_config (Admin lang)
--   3. ministry_members.finance_scope + guard trigger + pagtatakda kina
--      Church-wide Finance 1 at 2 (gamit ang profile_id; may
--      assertion na eksaktong 2 row)
--   4. Functions: is_church_wide_finance, is_local_finance,
--      can_access_local, can_read_local_attendance, is_pastoral_leader
--   5. finance_audit_log + generic audit trigger function
--   6. enforce_finance_record_rules (transition rules) -- ikakabit sa
--      abuluyan_totals/attendance_records dito, at sa mga bagong table
--      sa 011
--   7. Bagong RLS ng abuluyan_totals at attendance_records
--   8. Abuluyan Sunday trigger
--
-- Ligtas itong patakbuhin ulit (idempotent). Nasa loob ng isang
-- transaction. Rollback: 010_rollback.sql
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. STATUS ENUM + CONVERSION
-- ---------------------------------------------------------------------
do $$ begin
  create type public.finance_record_status as enum ('draft', 'submitted', 'void');
exception when duplicate_object then null; end $$;

-- Ang mga lumang policy ay umaasa sa status column at sa my_finance_locals:
-- burahin muna bago palitan ang uri ng column.
do $$
declare r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('abuluyan_totals', 'attendance_records')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['abuluyan_totals', 'attendance_records'] loop
    -- Laktawan kung na-convert na (idempotent)
    if (select udt_name from information_schema.columns
        where table_schema = 'public' and table_name = t and column_name = 'status') = 'record_status' then
      execute format('alter table public.%I alter column status drop default', t);
      execute format(
        'alter table public.%I alter column status type public.finance_record_status using (case status::text '
        || 'when ''Draft'' then ''draft'' when ''Submitted'' then ''submitted'' when ''Reviewed'' then ''submitted'' end)'
        || '::public.finance_record_status', t);
      execute format('alter table public.%I alter column status set default ''draft''', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. APP_CONFIG (key/value; Admin lang ang makababasa at makapagbabago)
--    Ang laman (hal. admin_report_email) ay inilalagay sa oras ng apply,
--    hindi nakasulat sa file na ito.
-- ---------------------------------------------------------------------
create table if not exists public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

alter table public.app_config enable row level security;

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'app_config' loop
    execute format('drop policy %I on public.app_config', r.policyname);
  end loop;
end $$;

create policy app_config_select on public.app_config for select to authenticated
  using (public.is_admin());
create policy app_config_insert on public.app_config for insert to authenticated
  with check (public.is_admin());
create policy app_config_update on public.app_config for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.app_config from anon, authenticated;
grant select, insert, update on public.app_config to authenticated;

-- ---------------------------------------------------------------------
-- 3. FINANCE_SCOPE sa ministry_members
-- ---------------------------------------------------------------------
alter table public.ministry_members
  add column if not exists finance_scope text not null default 'local';

do $$ begin
  alter table public.ministry_members
    add constraint ministry_members_finance_scope_check
    check (finance_scope in ('church_wide', 'local'));
exception when duplicate_object then null; end $$;

-- Admin lang ang makapagbabago ng finance_scope; ang 'church_wide' ay para
-- lang sa Finance Ministry. Ang koneksyon na walang JWT (SQL editor,
-- migration, service role) ay pinapayagan.
create or replace function public.guard_finance_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' and new.finance_scope <> 'local' then
      raise exception 'Admin lang ang makapagtatakda ng finance_scope na hindi "local".'
        using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and new.finance_scope is distinct from old.finance_scope then
      raise exception 'Admin lang ang makapagbabago ng finance_scope.'
        using errcode = '42501';
    end if;
  end if;

  if new.finance_scope = 'church_wide' then
    select name into v_name from public.ministries where id = new.ministry_id;
    if v_name is distinct from 'Finance Ministry' then
      raise exception 'Ang finance_scope na "church_wide" ay para lang sa Finance Ministry.'
        using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists ministry_members_guard_finance_scope on public.ministry_members;
create trigger ministry_members_guard_finance_scope
  before insert or update on public.ministry_members
  for each row execute function public.guard_finance_scope();

-- ---------------------------------------------------------------------
-- 3b. ADMIN LANG ang makapagdadagdag/makapag-aalis/makapagpapalit ng
--     kasapi ng Finance Ministry, Local Finance Ministry, at Pastoral
--     Ministry (ipinapatupad sa RLS). Ang ibang ministry ay mananatiling
--     naaayos ng is_staff() gaya ng dati.
-- ---------------------------------------------------------------------
create or replace function public.is_protected_ministry(p_ministry_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.ministries m
    where m.id = p_ministry_id
      and m.name in ('Finance Ministry', 'Local Finance Ministry', 'Pastoral Ministry')
  )
$$;

revoke all on function public.is_protected_ministry(uuid) from public, anon;
grant execute on function public.is_protected_ministry(uuid) to authenticated;

drop policy if exists mm_write on public.ministry_members;
create policy mm_write on public.ministry_members for all to authenticated
  using (public.is_admin() or (public.is_staff() and not public.is_protected_ministry(ministry_id)))
  with check (public.is_admin() or (public.is_staff() and not public.is_protected_ministry(ministry_id)));

-- Ang ministry_members.local_id ay kinokopya mula sa profiles.local_id (008).
-- Dahil pinapayagan ng profiles_update ang user na baguhin ang SARILING
-- profile, kailangang harangan ang pagpapalit ng local_id: ang sinumang
-- Local Finance ay makalilipat sana ng local (at ng access) sa pamamagitan nito.
--   * hindi-staff: hindi makapagpapalit ng local_id (kahit sarili)
--   * kasapi ng protected ministry: Admin lang ang makapagpapalit
create or replace function public.guard_profile_local_id()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or new.local_id is not distinct from old.local_id then
    return new;
  end if;
  if not public.is_staff() then
    raise exception 'Staff lang ang makapagpapalit ng local ng isang profile.' using errcode = '42501';
  end if;
  if not public.is_admin() and exists (
    select 1
    from public.ministry_members mm
    where mm.profile_id = new.id and public.is_protected_ministry(mm.ministry_id)
  ) then
    raise exception 'Admin lang ang makapagpapalit ng local ng kasapi ng Finance, Local Finance, o Pastoral Ministry.'
      using errcode = '42501';
  end if;
  return new;
end $$;

revoke all on function public.guard_profile_local_id() from public, anon, authenticated;

drop trigger if exists profiles_guard_local_id on public.profiles;
create trigger profiles_guard_local_id
  before update of local_id on public.profiles
  for each row execute function public.guard_profile_local_id();

-- ---------------------------------------------------------------------
-- 4. ACCESS FUNCTIONS
-- ---------------------------------------------------------------------
create or replace function public.is_church_wide_finance()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.ministry_members mm
    join public.ministries m on m.id = mm.ministry_id
    join public.profiles p on p.id = mm.profile_id
    where mm.profile_id = auth.uid()
      and m.name = 'Finance Ministry'
      and mm.finance_scope = 'church_wide'
      and p.status <> 'inactive'
  )
$$;

-- Local Finance ng isang partikular na local: kasapi ng Local Finance Ministry,
-- o kasapi ng Finance Ministry na finance_scope='local', na ang local_id ay tugma.
create or replace function public.is_local_finance(p_local_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_local_id is not null and exists (
    select 1
    from public.ministry_members mm
    join public.ministries m on m.id = mm.ministry_id
    join public.profiles p on p.id = mm.profile_id
    where mm.profile_id = auth.uid()
      and mm.local_id = p_local_id
      and p.status <> 'inactive'
      and (
        m.name = 'Local Finance Ministry'
        or (m.name = 'Finance Ministry' and mm.finance_scope = 'local')
      )
  )
$$;

-- Iisang function para sa lahat ng data na panglocal.
create or replace function public.can_access_local(p_local_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_church_wide_finance() or public.is_local_finance(p_local_id)
$$;

-- Attendance lang (read-only): Finance ng local, church-wide Finance, at
-- kasapi ng Local Admin Ministry ng local. HINDI ginagamit sa Abuluyan.
create or replace function public.can_read_local_attendance(p_local_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_access_local(p_local_id) or (
    p_local_id is not null and exists (
      select 1
      from public.ministry_members mm
      join public.ministries m on m.id = mm.ministry_id
      join public.profiles p on p.id = mm.profile_id
      where mm.profile_id = auth.uid()
        and mm.local_id = p_local_id
        and m.name = 'Local Admin Ministry'
        and p.status <> 'inactive'
    )
  )
$$;

-- Ang lider ng Pastoral Ministry AT may role='admin'. Ang lider ng Pastoral
-- Ministry sa ibang local na walang role='admin' ay hindi kasama.
create or replace function public.is_pastoral_leader()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.ministry_members mm
    join public.ministries m on m.id = mm.ministry_id
    join public.profiles p on p.id = mm.profile_id
    where mm.profile_id = auth.uid()
      and m.name = 'Pastoral Ministry'
      and mm.is_leader
      and p.role = 'admin'
      and p.status <> 'inactive'
  )
$$;

revoke all on function public.guard_finance_scope() from public, anon, authenticated;
revoke all on function public.is_church_wide_finance() from public, anon;
revoke all on function public.is_local_finance(uuid) from public, anon;
revoke all on function public.can_access_local(uuid) from public, anon;
revoke all on function public.can_read_local_attendance(uuid) from public, anon;
revoke all on function public.is_pastoral_leader() from public, anon;
grant execute on function public.is_church_wide_finance() to authenticated;
grant execute on function public.is_local_finance(uuid) to authenticated;
grant execute on function public.can_access_local(uuid) to authenticated;
grant execute on function public.can_read_local_attendance(uuid) to authenticated;
grant execute on function public.is_pastoral_leader() to authenticated;

-- ---------------------------------------------------------------------
-- 5. FINANCE_AUDIT_LOG (hiwalay sa umiiral na public.audit_log ng profiles)
--    Church-wide Finance lang ang makababasa. Trigger lang ang nagsusulat.
-- ---------------------------------------------------------------------
create table if not exists public.finance_audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text,
  operation text not null check (operation in ('INSERT', 'UPDATE')),
  changed_by uuid,
  changed_at timestamptz not null default now(),
  old_values jsonb,
  new_values jsonb
);
create index if not exists idx_finance_audit_table_record on public.finance_audit_log (table_name, record_id);
create index if not exists idx_finance_audit_changed_at on public.finance_audit_log (changed_at);

alter table public.finance_audit_log enable row level security;

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'finance_audit_log' loop
    execute format('drop policy %I on public.finance_audit_log', r.policyname);
  end loop;
end $$;

-- Church-wide Finance: lahat. Admin: giving_permissions at pagbabago ng status
-- ng kaanib (members) LAMANG. Walang access ang Admin sa audit ng anumang
-- table na may halaga (abuluyan, ambagan, tulong, pasalamat), sa attendance,
-- o sa ministry_members.
create policy finance_audit_select on public.finance_audit_log for select to authenticated
  using (
    public.is_church_wide_finance()
    or (
      public.is_admin() and (
        table_name = 'giving_permissions'
        or (table_name = 'members'
            and (operation = 'INSERT' or old_values ->> 'status' is distinct from new_values ->> 'status'))
      )
    )
  );

revoke all on public.finance_audit_log from anon, authenticated;
grant select on public.finance_audit_log to authenticated;

create or replace function public.finance_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_new jsonb := to_jsonb(new);
  v_id text;
begin
  -- Karamihan ay may "id"; ang ministry_members ay may composite key.
  v_id := coalesce(v_new ->> 'id', concat_ws(':', v_new ->> 'ministry_id', v_new ->> 'profile_id'));

  if tg_op = 'UPDATE' then
    if v_new = to_jsonb(old) then
      return null;
    end if;
    insert into public.finance_audit_log (table_name, record_id, operation, changed_by, old_values, new_values)
    values (tg_table_name, v_id, 'UPDATE', auth.uid(), to_jsonb(old), v_new);
  else
    insert into public.finance_audit_log (table_name, record_id, operation, changed_by, old_values, new_values)
    values (tg_table_name, v_id, 'INSERT', auth.uid(), null, v_new);
  end if;
  return null;
end $$;

revoke all on function public.finance_audit() from public, anon, authenticated;

drop trigger if exists abuluyan_totals_audit on public.abuluyan_totals;
create trigger abuluyan_totals_audit after update on public.abuluyan_totals
  for each row execute function public.finance_audit();

drop trigger if exists attendance_records_audit on public.attendance_records;
create trigger attendance_records_audit after update on public.attendance_records
  for each row execute function public.finance_audit();

drop trigger if exists ministry_members_audit on public.ministry_members;
create trigger ministry_members_audit after update on public.ministry_members
  for each row execute function public.finance_audit();

-- ---------------------------------------------------------------------
-- 6. TRANSITION RULES (BEFORE INSERT/UPDATE) -- para sa lahat ng
--    panglocal na record table.
--    tg_argv[0] = pangalan ng column ng nag-encode (recorded_by | encoded_by)
--    tg_argv[1] = pangalan ng column ng petsa ng pagpapadala
--                 (submitted_date | submitted_at)
--    Ang koneksyon na walang JWT (migration/service role) ay hindi hinaharangan.
-- ---------------------------------------------------------------------
create or replace function public.enforce_finance_record_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_author text := tg_argv[0];
  v_submit text := tg_argv[1];
  v_church boolean;
  v_new jsonb := to_jsonb(new);
  v_old jsonb;
begin
  if v_uid is null then
    if tg_op = 'UPDATE' then
      new.updated_at := now();
    end if;
    return new;
  end if;

  v_church := public.is_church_wide_finance();

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'Ang bagong record ay dapat nasa status na "draft".' using errcode = '23514';
    end if;
    new := jsonb_populate_record(new, jsonb_build_object(v_author, v_uid, v_submit, null));
    new.updated_at := now();
    return new;
  end if;

  -- UPDATE
  v_old := to_jsonb(old);

  if v_new -> v_author is distinct from v_old -> v_author then
    raise exception 'Hindi mababago ang nag-encode ng record.' using errcode = '42501';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'Hindi mababago ang petsa ng pagkakagawa ng record.' using errcode = '42501';
  end if;
  if new.local_id is distinct from old.local_id and not v_church then
    raise exception 'Church-wide Finance lang ang makapagpapalit ng local ng record.' using errcode = '42501';
  end if;

  if old.status = 'void' then
    raise exception 'Ang record na void ay pinal na at hindi na mababago.' using errcode = '23514';
  end if;

  if not v_church then
    -- Local Finance: draft lamang ang mababago
    if old.status <> 'draft' then
      raise exception 'Naipadala na ang record. Ang church-wide Finance na lang ang makapagbabago nito.'
        using errcode = '42501';
    end if;
  else
    if old.status = 'submitted' and new.status = 'draft' then
      raise exception 'Hindi maibabalik sa draft ang naipadala nang record. Gamitin ang void kung may pagkakamali.'
        using errcode = '23514';
    end if;
  end if;

  if old.status = 'draft' and new.status = 'submitted' then
    new := jsonb_populate_record(new, jsonb_build_object(v_submit, now()));
  elsif old.status = new.status then
    new := jsonb_populate_record(new, jsonb_build_object(v_submit, v_old -> v_submit));
  end if;

  new.updated_at := now();
  return new;
end $$;

revoke all on function public.enforce_finance_record_rules() from public, anon, authenticated;

drop trigger if exists abuluyan_totals_rules on public.abuluyan_totals;
create trigger abuluyan_totals_rules
  before insert or update on public.abuluyan_totals
  for each row execute function public.enforce_finance_record_rules('recorded_by', 'submitted_date');

drop trigger if exists attendance_records_rules on public.attendance_records;
create trigger attendance_records_rules
  before insert or update on public.attendance_records
  for each row execute function public.enforce_finance_record_rules('recorded_by', 'submitted_date');

-- ---------------------------------------------------------------------
-- 7. RLS -- abuluyan_totals at attendance_records
--    Abuluyan: can_access_local lang (Finance ng local at church-wide).
--    Attendance: pwede ring basahin ng Local Admin Ministry ng local.
-- ---------------------------------------------------------------------
alter table public.abuluyan_totals enable row level security;
alter table public.attendance_records enable row level security;

create policy abuluyan_select on public.abuluyan_totals for select to authenticated
  using (public.can_access_local(local_id));
create policy abuluyan_insert on public.abuluyan_totals for insert to authenticated
  with check (public.can_access_local(local_id) and status = 'draft');
create policy abuluyan_update on public.abuluyan_totals for update to authenticated
  using (public.can_access_local(local_id) and (status = 'draft' or public.is_church_wide_finance()))
  with check (public.can_access_local(local_id));

create policy attendance_records_select on public.attendance_records for select to authenticated
  using (public.can_read_local_attendance(local_id));
create policy attendance_records_insert on public.attendance_records for insert to authenticated
  with check (public.can_access_local(local_id) and status = 'draft');
create policy attendance_records_update on public.attendance_records for update to authenticated
  using (public.can_access_local(local_id) and (status = 'draft' or public.is_church_wide_finance()))
  with check (public.can_access_local(local_id));

revoke all on public.abuluyan_totals, public.attendance_records from anon, authenticated;
grant select, insert, update on public.abuluyan_totals, public.attendance_records to authenticated;

-- ---------------------------------------------------------------------
-- 8. ABULUYAN: Linggo lang (sa database, hindi lang sa form)
--    Ang service_date ay plain calendar date kaya hindi kailangan ng timezone.
-- ---------------------------------------------------------------------
create or replace function public.abuluyan_require_sunday()
returns trigger language plpgsql set search_path = '' as $$
begin
  if extract(dow from new.service_date) <> 0 then
    raise exception 'Dapat Linggo ang petsa ng Abuluyan.' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists abuluyan_totals_sunday on public.abuluyan_totals;
create trigger abuluyan_totals_sunday
  before insert or update of service_date on public.abuluyan_totals
  for each row execute function public.abuluyan_require_sunday();

-- ---------------------------------------------------------------------
-- 9. CHURCH-WIDE FINANCE: ang dalawang church-wide Finance (Church-wide Finance 1 at 2):
--    Gamit ang profile_id,
--    kinumpirma ng Admin noong 2026-09-23. Kailangang eksaktong 2 row ang
--    tamaan, kung hindi ay mag-a-abort ang buong migration. Ginagawa ito sa
--    dulo, pagkatapos ikabit ang audit trigger, para maitala ang pagbabago.
-- ---------------------------------------------------------------------
do $$
declare n integer;
begin
  update public.ministry_members mm
  set finance_scope = 'church_wide'
  from public.ministries m
  where m.id = mm.ministry_id
    and m.name = 'Finance Ministry'
    and mm.profile_id in (
      '68944d26-3e21-4880-b14e-1eef1c06cbce'::uuid,
      '600fec92-6c76-4cb3-84eb-f46644c8a539'::uuid
    );
  get diagnostics n = row_count;
  if n <> 2 then
    raise exception 'Inaasahang 2 row ang itatakda bilang church_wide, % ang tinamaan. Walang binago.', n;
  end if;
end $$;

commit;
