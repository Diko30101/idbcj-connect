-- =====================================================================
-- IDBCJ MEMBER PORTAL - 002: Username, category (Adult/Young/Child),
-- at "palitan ang temporary password"
-- Ipapatakbo ng Presiding Minister sa Supabase > SQL Editor.
--
-- Ligtas itong patakbuhin ulit (idempotent). Nasa loob ng isang
-- transaction: kung may error, walang mababago.
-- Ang rollback ay nasa 002_rollback.sql.
-- =====================================================================

begin;

-- 1. Mga bagong column (hindi binubura ang lumang data)
alter table public.profiles
  add column if not exists username text,
  add column if not exists category text not null default 'adult',
  add column if not exists must_change_password boolean not null default false;

alter table public.profiles drop constraint if exists profiles_category_check;
alter table public.profiles
  add constraint profiles_category_check check (category in ('adult', 'young', 'child'));

-- Username: maliliit na letra, numero, tuldok, underscore, gitling (3 hanggang 40 na karakter)
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9][a-z0-9._-]{1,38}[a-z0-9]$');

-- Walang dalawang member na pareho ang username
create unique index if not exists profiles_username_key
  on public.profiles (lower(username));

-- 2. Bantayan: staff lang ang puwedeng magbago ng username at category
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
       or new.username is distinct from old.username
       or new.category is distinct from old.category
       or new.ministry_group is distinct from old.ministry_group
       or new.baptism_status is distinct from old.baptism_status
       or new.baptism_date is distinct from old.baptism_date
       or new.member_since is distinct from old.member_since then
      raise exception 'Staff lang ang puwedeng magbago ng status, username, category, ministry, binyag, at petsa ng pagsapi.';
    end if;
  end if;

  return new;
end $$;

commit;
