-- Ibinabalik ang 002_username_category.sql.
-- BABALA: mabubura ang mga username at category na naitala na.
begin;

create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
begin
  new.updated_at := now();
  if caller is null then
    return new;
  end if;
  if new.id is distinct from old.id then
    raise exception 'Hindi puwedeng palitan ang id.';
  end if;
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Admin lang ang puwedeng magpalit ng role.';
  end if;
  if old.role = 'admin' and old.id <> caller and not public.is_admin() then
    raise exception 'Hindi puwedeng baguhin ang profile ng admin.';
  end if;
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

drop index if exists public.profiles_username_key;
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles drop constraint if exists profiles_category_check;
alter table public.profiles
  drop column if exists username,
  drop column if exists category,
  drop column if exists must_change_password;

commit;
