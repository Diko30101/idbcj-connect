-- =====================================================================
-- 019 -- Lifecycle ng Abuluyan (Phase 2, hakbang 1)
--
-- Mga pagbabago:
--   1. locals.timezone: WALANG default, NOT NULL, validated (IANA), Admin lang ang makapagbabago.
--      Ang inaprubahang backfill (medina, sto_tomas, other = Asia/Manila; fort_mcmurray = America/Edmonton) ay
--      sinusuri lang: mag-a-abort ang migration kung iba ang umiiral na halaga (hindi nag-o-overwrite).
--   2. public.local_today(tz, at default now()): petsa sa isang timezone (ginagamit ng trigger; masusubok ang sandali).
--   3. abuluyan_totals: total_amount ay nullable (kailangan lang sa submit); bagong column na submitted_at,
--      submitted_by, voided_at, voided_by, void_reason, replaces_id; partial unique index: isang aktibong (hindi void)
--      record bawat local bawat Linggo.
--   4. Bagong trigger na abuluyan_totals_lifecycle (kapalit ng abuluyan_totals_rules ng 010 SA TABLE NA ITO LANG;
--      HINDI ginagalaw ang shared na enforce_finance_record_rules, na ginagamit pa ng attendance_records).
--   5. void_abuluyan(local_id, service_date, reason): ang TANGING paraan ng pag-void (Admin o church-wide Finance).
--   6. Mas mahigpit na RLS ng UPDATE: draft lang ang mababago ng sinuman; ang naipadala ay naka-lock.
--
-- Hindi ginagalaw: submitted_date (nananatili at napupunan pa rin sa submit), is_admin(), 010-018.
-- Ang lumang row (1, status submitted) ay hindi binabago; ang submitted_at/by nito ay mananatiling NULL (hindi hinuhulaan).
-- Mag-abort ang buong migration kung may mali (isang transaction).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. locals.timezone
-- ---------------------------------------------------------------------
alter table public.locals alter column timezone drop default;
alter table public.locals alter column timezone set not null;

-- Validation ng IANA name at Admin lang. Ang koneksyon na walang JWT (migration/service) ay hindi hinaharangan
-- sa bahaging Admin, pero LAGING sinusuri ang pangalan.
create or replace function public.locals_guard_timezone()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.timezone is null then
    raise exception 'Kailangan ang timezone ng local.' using errcode = '23502';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Hindi wastong IANA timezone: %', new.timezone using errcode = '22023';
  end if;
  if auth.uid() is not null
     and (tg_op = 'INSERT' or new.timezone is distinct from old.timezone)
     and not public.is_admin() then
    raise exception 'Admin lang ang makapagtatakda o makapagpapalit ng timezone ng local.' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.locals_guard_timezone() from public, anon, authenticated;

drop trigger if exists locals_guard_timezone on public.locals;
create trigger locals_guard_timezone
  before insert or update of timezone on public.locals
  for each row execute function public.locals_guard_timezone();

-- Backfill (inaprubahan ng Admin): medina, sto_tomas, other = Asia/Manila; fort_mcmurray = America/Edmonton.
-- HINDI ito nag-o-overwrite: kung iba ang umiiral na halaga ng alinman sa apat, MAG-A-ABORT ang buong migration
-- (walang binago) para hindi tahimik na mapalitan ang timezone. Ang mga local na wala sa listahan ay hindi ginagalaw.
do $$
declare v_bad text;
begin
  select string_agg(l.key || '=' || l.timezone || ' (inaasahan ' || e.tz || ')', ', ' order by l.key) into v_bad
  from public.locals l
  join (values ('medina', 'Asia/Manila'), ('sto_tomas', 'Asia/Manila'), ('other', 'Asia/Manila'),
               ('fort_mcmurray', 'America/Edmonton')) e(key, tz) on e.key = l.key
  where l.timezone is distinct from e.tz;
  if v_bad is not null then
    raise exception 'Iba ang timezone ng local kaysa sa inaprubahan: %. Walang binago; itanong sa Admin.', v_bad;
  end if;
end $$;

-- Walang local na may di-wastong timezone (kabilang ang anumang hindi nakalista sa itaas)
do $$
declare v_bad text;
begin
  select string_agg(key || '=' || timezone, ', ') into v_bad
  from public.locals l
  where not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = l.timezone);
  if v_bad is not null then
    raise exception 'May local na may di-wastong timezone: %. Walang binago.', v_bad;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. local_today
-- ---------------------------------------------------------------------
create or replace function public.local_today(p_tz text, p_at timestamptz default now())
returns date language plpgsql stable set search_path = '' as $$
begin
  if p_tz is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz) then
    raise exception 'Hindi wastong IANA timezone: %', p_tz using errcode = '22023';
  end if;
  return (p_at at time zone p_tz)::date;
end $$;
revoke all on function public.local_today(text, timestamptz) from public, anon;
grant execute on function public.local_today(text, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- 3. abuluyan_totals: mga column, constraint, index
-- ---------------------------------------------------------------------
alter table public.abuluyan_totals alter column total_amount drop not null;

alter table public.abuluyan_totals
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_by uuid references public.profiles (id),
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references public.profiles (id),
  add column if not exists void_reason text,
  add column if not exists replaces_id uuid references public.abuluyan_totals (id);

-- Ang halaga ay kailangan kapag hindi na draft; ang void ay kailangan ng dahilan, sino at kailan
alter table public.abuluyan_totals
  add constraint abuluyan_amount_required_when_not_draft
    check (status = 'draft' or total_amount is not null),
  add constraint abuluyan_void_fields
    check (status <> 'void' or (voided_at is not null and voided_by is not null
                                and void_reason is not null and btrim(void_reason) <> '')),
  add constraint abuluyan_not_self_replacement
    check (replaces_id is null or replaces_id <> id);

-- Isang aktibong (hindi void) record bawat local bawat Linggo
create unique index if not exists abuluyan_one_active_per_sunday
  on public.abuluyan_totals (local_id, service_date)
  where status <> 'void';

-- ---------------------------------------------------------------------
-- 4. Trigger ng lifecycle (BEFORE INSERT OR UPDATE)
--    SECURITY INVOKER sinasadya: ang current_user ay 'authenticated' sa direktang pagsulat ng user, ngunit ang
--    may-ari ng function (definer) kapag dumaan sa void_abuluyan(). Hindi ito mapepeke ng user (hindi tulad ng
--    isang GUC na kayang itakda ng sinuman).
--    Ang koneksyon na walang JWT (migration/service role) ay hindi hinaharangan.
-- ---------------------------------------------------------------------
create or replace function public.abuluyan_lifecycle_rules()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_direct boolean := (current_user = 'authenticated');
  v_cw boolean;
  v_tz text;
  v_rep record;
  v_void_here boolean;
begin
  if v_uid is null then
    if tg_op = 'UPDATE' then
      new.updated_at := now();
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'void' then
    raise exception 'Ang record na void ay pinal at hindi na mababago.' using errcode = '23514';
  end if;

  -- Dumaan sa void_abuluyan(): ang pag-void na lang ang pinapayagan
  if not v_direct then
    if tg_op <> 'UPDATE' or old.status <> 'submitted' or new.status <> 'void'
       or new.void_reason is null or btrim(new.void_reason) = ''
       or new.total_amount is distinct from old.total_amount
       or new.service_date is distinct from old.service_date
       or new.local_id is distinct from old.local_id then
      raise exception 'Pag-void lang ng naipadalang record ang pinapayagan sa daan na ito.' using errcode = '42501';
    end if;
    new.updated_at := now();
    return new;
  end if;

  v_cw := public.is_church_wide_finance();

  -- ---------------- INSERT ----------------
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'Ang bagong record ay dapat nasa status na "draft".' using errcode = '23514';
    end if;

    select timezone into v_tz from public.locals where id = new.local_id;
    if v_tz is null then
      raise exception 'Walang timezone ang local na ito.' using errcode = '23502';
    end if;
    if new.service_date > public.local_today(v_tz) then
      raise exception 'Ang petsa ng Abuluyan ay nasa hinaharap pa (ayon sa oras ng local).' using errcode = '23514';
    end if;

    select exists (
      select 1 from public.abuluyan_totals
      where local_id = new.local_id and service_date = new.service_date and status = 'void'
    ) into v_void_here;

    if new.replaces_id is not null or v_void_here then
      if not v_cw then
        raise exception 'May void na para sa local at Linggong ito. Church-wide Finance lang ang makagagawa ng kapalit.'
          using errcode = '42501';
      end if;
      if new.replaces_id is null then
        raise exception 'Kailangan ang replaces_id: may void na para sa local at Linggong ito.' using errcode = '23514';
      end if;
      select id, status, local_id, service_date into v_rep from public.abuluyan_totals where id = new.replaces_id;
      if not found or v_rep.status <> 'void'
         or v_rep.local_id <> new.local_id or v_rep.service_date <> new.service_date then
        raise exception 'Ang replaces_id ay dapat void na record ng parehong local at Linggo.' using errcode = '23514';
      end if;
    end if;

    new.recorded_by := v_uid;
    new.submitted_at := null; new.submitted_by := null; new.submitted_date := null;
    new.voided_at := null; new.voided_by := null; new.void_reason := null;
    new.updated_at := now();
    return new;
  end if;

  -- ---------------- UPDATE ----------------
  if old.status = 'submitted' then
    raise exception 'Naka-lock na ang naipadalang record para sa lahat. Ang void_abuluyan() lang ang paraan ng pagbabago.'
      using errcode = '42501';
  end if;

  -- old.status = 'draft'. Kapalit (replacement): church-wide Finance lang. Karaniwan: Finance ng local o church-wide.
  if old.replaces_id is not null then
    if not v_cw then
      raise exception 'Church-wide Finance lang ang makapag-e-edit o makapag-s-submit ng kapalit na record.' using errcode = '42501';
    end if;
  elsif not (v_cw or public.is_local_finance(old.local_id)) then
    raise exception 'Walang pahintulot sa record na ito.' using errcode = '42501';
  end if;

  if new.recorded_by is distinct from old.recorded_by then
    raise exception 'Hindi mababago ang nag-encode ng record.' using errcode = '42501';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'Hindi mababago ang petsa ng pagkakagawa ng record.' using errcode = '42501';
  end if;
  if new.replaces_id is distinct from old.replaces_id then
    raise exception 'Hindi mababago ang replaces_id.' using errcode = '42501';
  end if;
  if new.submitted_at is distinct from old.submitted_at or new.submitted_by is distinct from old.submitted_by
     or new.submitted_date is distinct from old.submitted_date
     or new.voided_at is distinct from old.voided_at or new.voided_by is distinct from old.voided_by
     or new.void_reason is distinct from old.void_reason then
    raise exception 'Hindi maaaring itakda nang direkta ang mga field ng pagpapadala o pag-void.' using errcode = '42501';
  end if;
  if new.status not in ('draft', 'submitted') then
    raise exception 'Ang void_abuluyan() lang ang paraan ng pag-void.' using errcode = '42501';
  end if;

  if new.local_id is distinct from old.local_id or new.service_date is distinct from old.service_date then
    if old.replaces_id is not null then
      raise exception 'Hindi mababago ang local o Linggo ng kapalit na record.' using errcode = '23514';
    end if;
    if new.local_id is distinct from old.local_id and not v_cw then
      raise exception 'Church-wide Finance lang ang makapagpapalit ng local ng record.' using errcode = '42501';
    end if;
    select timezone into v_tz from public.locals where id = new.local_id;
    if v_tz is null then
      raise exception 'Walang timezone ang local na ito.' using errcode = '23502';
    end if;
    if new.service_date > public.local_today(v_tz) then
      raise exception 'Ang petsa ng Abuluyan ay nasa hinaharap pa (ayon sa oras ng local).' using errcode = '23514';
    end if;
    if exists (select 1 from public.abuluyan_totals
               where local_id = new.local_id and service_date = new.service_date and status = 'void') then
      raise exception 'May void na para sa local at Linggong iyon; kapalit na record lang ang maaaring gawin.' using errcode = '23514';
    end if;
  end if;

  if new.status = 'submitted' then
    if new.total_amount is null then
      raise exception 'Kailangan ang halaga bago i-submit (0 ay wasto).' using errcode = '23514';
    end if;
    select timezone into v_tz from public.locals where id = new.local_id;
    new.submitted_at := now();
    new.submitted_by := v_uid;
    new.submitted_date := public.local_today(v_tz);
  end if;

  new.updated_at := now();
  return new;
end $$;
revoke all on function public.abuluyan_lifecycle_rules() from public, anon, authenticated;

drop trigger if exists abuluyan_totals_rules on public.abuluyan_totals;
drop trigger if exists abuluyan_totals_lifecycle on public.abuluyan_totals;
create trigger abuluyan_totals_lifecycle
  before insert or update on public.abuluyan_totals
  for each row execute function public.abuluyan_lifecycle_rules();

-- ---------------------------------------------------------------------
-- 5. void_abuluyan -- ang tanging paraan ng pag-void
-- ---------------------------------------------------------------------
create or replace function public.void_abuluyan(p_local_id uuid, p_service_date date, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  n integer;
begin
  if v_uid is null then
    raise exception 'Kailangang naka-login.' using errcode = '42501';
  end if;
  if not (public.is_admin() or public.is_church_wide_finance()) then
    raise exception 'Admin o church-wide Finance lang ang makapag-vo-void ng Abuluyan.' using errcode = '42501';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Kailangan ang dahilan ng pag-void.' using errcode = '23514';
  end if;

  update public.abuluyan_totals
     set status = 'void', voided_at = now(), voided_by = v_uid, void_reason = btrim(p_reason)
   where local_id = p_local_id and service_date = p_service_date and status = 'submitted';
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Walang naipadalang (submitted) na record para sa local at Linggong iyon.' using errcode = 'P0002';
  end if;
end $$;
revoke all on function public.void_abuluyan(uuid, date, text) from public, anon;
grant execute on function public.void_abuluyan(uuid, date, text) to authenticated;

-- ---------------------------------------------------------------------
-- 6. RLS: draft lang ang mababago ng sinuman (ang void ay dumadaan sa void_abuluyan)
-- ---------------------------------------------------------------------
drop policy if exists abuluyan_update on public.abuluyan_totals;
create policy abuluyan_update on public.abuluyan_totals for update to authenticated
  using (public.can_access_local(local_id) and status = 'draft')
  with check (public.can_access_local(local_id));

commit;
