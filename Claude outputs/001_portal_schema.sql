-- =====================================================================
-- IDBCJ MEMBER PORTAL - 001: Database schema, roles, and security (RLS)
-- Ipapatakbo ito ng Presiding Minister sa Supabase > SQL Editor.
--
-- BAGO MO I-RUN:
--  1. Supabase > Table Editor > profiles > Export to CSV (backup).
--  2. Basahin ang PORTAL_SETUP checklist.
--
-- Ligtas itong patakbuhin ulit (idempotent). Kung may error, walang
-- mababago dahil nasa loob ito ng isang transaction.
-- Ang rollback ay nasa 001_rollback.sql.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. PROFILES: dagdagan ang mga column (hindi binubura ang lumang data)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade
);

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists phone_number text,
  add column if not exists ministry_group text,        -- luma; hindi na gagamitin sa bagong portal
  add column if not exists baptism_status text,
  add column if not exists status text,
  add column if not exists updated_at timestamptz,
  add column if not exists email text,
  add column if not exists role text not null default 'member',
  add column if not exists birthday date,
  add column if not exists city text,
  add column if not exists baptism_date date,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists member_since date,
  add column if not exists consent_at timestamptz,
  add column if not exists consent_version text,
  add column if not exists created_at timestamptz not null default now();

-- Gawing pare-pareho ang status: visitor | active | inactive
update public.profiles
set status = case
  when lower(coalesce(status, '')) = 'inactive' then 'inactive'
  when lower(coalesce(status, '')) in ('visitor', 'new member') then 'visitor'
  else 'active'
end;

alter table public.profiles alter column status set default 'active';
alter table public.profiles alter column status set not null;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'secretary', 'leader', 'member'));

alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles
  add constraint profiles_status_check check (status in ('visitor', 'active', 'inactive'));

-- Kopyahin ang email mula sa login account
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- ---------------------------------------------------------------------
-- 2. IBANG MGA TABLE
-- ---------------------------------------------------------------------
create table if not exists public.ministries (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  name_tl text,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.ministry_members (
  ministry_id uuid not null references public.ministries (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  is_leader boolean not null default false,
  primary key (ministry_id, profile_id)
);

create table if not exists public.ministry_schedule (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries (id) on delete cascade,
  service_date date not null,
  title text not null,
  assigned_to uuid references public.profiles (id) on delete set null,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  service_date date not null,
  kind text not null check (kind in ('sunday', 'midweek', 'special')),
  title text,
  visitors_count integer not null default 0 check (visitors_count >= 0),
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (service_date, kind)
);

create table if not exists public.attendance (
  service_id uuid not null references public.services (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  present boolean not null default true,
  marked_by uuid default auth.uid(),
  marked_at timestamptz not null default now(),
  primary key (service_id, profile_id)
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  ministry_id uuid references public.ministries (id) on delete cascade, -- null = para sa lahat
  published boolean not null default false,
  publish_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  action text not null,
  table_name text not null,
  record_id text,
  detail jsonb
);

-- ---------------------------------------------------------------------
-- 3. HELPER FUNCTIONS (para sa mga patakaran ng access)
-- ---------------------------------------------------------------------
create or replace function public.current_app_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_staff()  -- admin o secretary
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select role in ('admin', 'secretary') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_member()  -- may account at hindi inactive
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select status <> 'inactive' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.leads_ministry(m uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.ministry_members
    where ministry_id = m and profile_id = auth.uid() and is_leader
  ) and public.is_member()
$$;

create or replace function public.in_ministry(m uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.ministry_members
    where ministry_id = m and profile_id = auth.uid()
  ) and public.is_member()
$$;

-- Roster para sa ministry leader: limitadong impormasyon lang, para sa sariling grupo
create or replace function public.ministry_roster(m uuid)
returns table (profile_id uuid, full_name text, phone_number text, status text, is_leader boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.phone_number, p.status, mm.is_leader
  from public.ministry_members mm
  join public.profiles p on p.id = mm.profile_id
  where mm.ministry_id = m
    and (public.is_staff() or public.leads_ministry(m))
  order by p.full_name
$$;


-- Ulat ng attendance bawat serbisyo (staff lang)
create or replace function public.attendance_summary(limit_n integer default 20)
returns table (service_id uuid, service_date date, kind text, title text,
               visitors_count integer, present_count bigint, marked_count bigint)
language sql stable security definer set search_path = '' as $$
  select s.id, s.service_date, s.kind, s.title, s.visitors_count,
         count(a.profile_id) filter (where a.present), count(a.profile_id)
  from public.services s
  left join public.attendance a on a.service_id = s.id
  where public.is_staff()
  group by s.id
  order by s.service_date desc, s.kind
  limit greatest(limit_n, 1)
$$;

-- Pastoral care: ilang Sunday ang nadaluhan ng bawat aktibong member (staff lang)
create or replace function public.member_attendance_summary(n_services integer default 8)
returns table (profile_id uuid, full_name text, phone_number text,
               present_count bigint, total_services bigint, last_present date)
language sql stable security definer set search_path = '' as $$
  with recent as (
    select id from public.services
    where kind = 'sunday'
    order by service_date desc
    limit greatest(n_services, 1)
  )
  select p.id, p.full_name, p.phone_number,
         count(a.profile_id) filter (where a.present and a.service_id in (select id from recent)),
         (select count(*) from recent),
         (select max(s.service_date)
            from public.attendance a2
            join public.services s on s.id = a2.service_id
           where a2.profile_id = p.id and a2.present)
  from public.profiles p
  left join public.attendance a on a.profile_id = p.id
  where public.is_staff() and p.status = 'active'
  group by p.id
  order by 4 asc, p.full_name
$$;

-- ---------------------------------------------------------------------
-- 4. TRIGGERS
-- ---------------------------------------------------------------------
-- 4a. Kapag gumawa ang admin ng bagong account sa Supabase, gumawa ng profile
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'member', 'active')
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4b. Bantay: hindi puwedeng baguhin ng ordinaryong member ang role, status, atbp.
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
begin
  new.updated_at := now();

  -- Walang caller = SQL Editor o server na pinagkakatiwalaan
  if caller is null then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'Hindi puwedeng palitan ang id.';
  end if;

  -- Role: admin lang ang puwedeng magbago
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Admin lang ang puwedeng magpalit ng role.';
  end if;

  -- Hindi maaaring galawin ng secretary ang profile ng admin
  if old.role = 'admin' and old.id <> caller and not public.is_admin() then
    raise exception 'Hindi puwedeng baguhin ang profile ng admin.';
  end if;

  -- Mga field na staff lang ang puwedeng magbago
  if not public.is_staff() then
    if new.status is distinct from old.status
       or new.email is distinct from old.email
       or new.ministry_group is distinct from old.ministry_group
       or new.baptism_status is distinct from old.baptism_status
       or new.baptism_date is distinct from old.baptism_date
       or new.member_since is distinct from old.member_since then
      raise exception 'Staff lang ang puwedeng magbago ng status, ministry, binyag, at petsa ng pagsapi.';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- 4c. Audit: itala kung sino ang nagbago ng profile ng iba, at kung anong field (hindi ang laman)
create or replace function public.log_profile_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  changed text[];
begin
  select array_agg(n.key order by n.key) into changed
  from jsonb_each(to_jsonb(new)) n
  where n.value is distinct from to_jsonb(old) -> n.key
    and n.key <> 'updated_at';

  if changed is not null
     and (auth.uid() is distinct from new.id or 'role' = any (changed) or 'status' = any (changed)) then
    insert into public.audit_log (actor, action, table_name, record_id, detail)
    values (
      auth.uid(), 'update', 'profiles', new.id::text,
      jsonb_build_object(
        'fields', changed,
        'role', case when new.role is distinct from old.role then jsonb_build_array(old.role, new.role) end,
        'status', case when new.status is distinct from old.status then jsonb_build_array(old.status, new.status) end
      )
    );
  end if;
  return new;
end $$;

drop trigger if exists profiles_audit on public.profiles;
create trigger profiles_audit
  after update on public.profiles
  for each row execute function public.log_profile_change();

create or replace function public.touch_prayer_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists prayer_touch on public.prayer_requests;
create trigger prayer_touch
  before update on public.prayer_requests
  for each row execute function public.touch_prayer_updated_at();

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY: buksan sa lahat ng table at burahin ang lumang policy
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'ministries', 'ministry_members', 'ministry_schedule',
                        'services', 'attendance', 'announcements', 'prayer_requests', 'audit_log')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

alter table public.profiles          enable row level security;
alter table public.ministries        enable row level security;
alter table public.ministry_members  enable row level security;
alter table public.ministry_schedule enable row level security;
alter table public.services          enable row level security;
alter table public.attendance        enable row level security;
alter table public.announcements     enable row level security;
alter table public.prayer_requests   enable row level security;
alter table public.audit_log         enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check (id = auth.uid() and role = 'member' and status = 'active');
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_staff())
  with check (id = auth.uid() or public.is_staff());
create policy profiles_delete_admin on public.profiles for delete to authenticated
  using (public.is_admin());

-- ministries
create policy ministries_select on public.ministries for select to authenticated
  using (public.is_member());
create policy ministries_write on public.ministries for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ministry_members
create policy mm_select on public.ministry_members for select to authenticated
  using (profile_id = auth.uid() or public.is_staff());
create policy mm_write on public.ministry_members for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ministry_schedule
create policy sched_select on public.ministry_schedule for select to authenticated
  using (public.is_staff() or public.in_ministry(ministry_id));
create policy sched_write on public.ministry_schedule for all to authenticated
  using (public.is_staff() or public.leads_ministry(ministry_id))
  with check (public.is_staff() or public.leads_ministry(ministry_id));

-- services
create policy services_select on public.services for select to authenticated
  using (public.is_member());
create policy services_write on public.services for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- attendance
create policy attendance_select on public.attendance for select to authenticated
  using (profile_id = auth.uid() or public.is_staff());
create policy attendance_write on public.attendance for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- announcements
create policy ann_select on public.announcements for select to authenticated
  using (
    public.is_staff()
    or (
      public.is_member()
      and published
      and publish_at <= now()
      and (expires_at is null or expires_at > now())
      and (ministry_id is null or public.in_ministry(ministry_id))
    )
    or (ministry_id is not null and public.leads_ministry(ministry_id))
  );
create policy ann_write on public.announcements for all to authenticated
  using (public.is_staff() or (ministry_id is not null and public.leads_ministry(ministry_id)))
  with check (public.is_staff() or (ministry_id is not null and public.leads_ministry(ministry_id)));

-- prayer_requests: PRIBADO. Ang sumulat at ang admin (Presiding Minister) lang.
create policy prayer_select on public.prayer_requests for select to authenticated
  using (author_id = auth.uid() or public.is_admin());
create policy prayer_insert on public.prayer_requests for insert to authenticated
  with check (author_id = auth.uid() and public.is_member());
create policy prayer_update on public.prayer_requests for update to authenticated
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());
create policy prayer_delete on public.prayer_requests for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- audit_log: admin lang ang nakakabasa; walang direktang insert/update/delete
create policy audit_select on public.audit_log for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- 6. PERMISSIONS: walang access ang hindi naka-login (anon)
-- ---------------------------------------------------------------------
revoke all on public.profiles, public.ministries, public.ministry_members,
  public.ministry_schedule, public.services, public.attendance,
  public.announcements, public.prayer_requests, public.audit_log
  from anon;

revoke all on public.profiles, public.ministries, public.ministry_members,
  public.ministry_schedule, public.services, public.attendance,
  public.announcements, public.prayer_requests, public.audit_log
  from authenticated;

grant select, insert, update, delete on
  public.profiles, public.ministries, public.ministry_members,
  public.ministry_schedule, public.services, public.attendance,
  public.announcements, public.prayer_requests
  to authenticated;
grant select on public.audit_log to authenticated;

revoke execute on function
  public.current_app_role(), public.is_admin(), public.is_staff(), public.is_member(),
  public.leads_ministry(uuid), public.in_ministry(uuid), public.ministry_roster(uuid),
  public.attendance_summary(integer), public.member_attendance_summary(integer)
  from public, anon;
grant execute on function
  public.current_app_role(), public.is_admin(), public.is_staff(), public.is_member(),
  public.leads_ministry(uuid), public.in_ministry(uuid), public.ministry_roster(uuid),
  public.attendance_summary(integer), public.member_attendance_summary(integer)
  to authenticated;

-- ---------------------------------------------------------------------
-- 7. ITAKDA ANG ADMIN (ang Presiding Minister)
-- ---------------------------------------------------------------------
update public.profiles
set role = 'admin'
where id in (select id from auth.users where lower(email) = 'dikovillaverde@gmail.com');

commit;
