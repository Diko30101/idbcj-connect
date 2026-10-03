-- 050: Site settings key-value store (para sa livestream fallback video ID at iba pang settings)

create table if not exists public.site_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

-- RLS: lahat ng naka-login ay makakabasa; admin lang ang makakapag-update
alter table public.site_settings enable row level security;

drop policy if exists "site_settings_select_all" on public.site_settings;
create policy "site_settings_select_all"
  on public.site_settings for select
  to authenticated
  using (true);

drop policy if exists "site_settings_admin_write" on public.site_settings;
create policy "site_settings_admin_write"
  on public.site_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Default: walang fallback video at walang backup URL
insert into public.site_settings (key, value)
values
  ('livestream_fallback_video_id', ''),
  ('livestream_backup_url', '')
on conflict (key) do nothing;
