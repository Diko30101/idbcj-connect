-- =====================================================================
-- Rollback ng 019_abuluyan_lifecycle.sql
-- Ibinabalik ang trigger na abuluyan_totals_rules ng 010, ang policy ng UPDATE, ang NOT NULL ng total_amount,
-- at ang default ng locals.timezone ('Asia/Manila', gaya ng 008). Inaalis ang mga bagong column.
--
-- PAALALA: nawawala ang laman ng submitted_at, submitted_by, voided_at, voided_by, void_reason at replaces_id.
-- Ang mga row na void ay mananatiling status 'void' (umiiral pa ang enum ng 010).
-- Mag-abort kung may draft na walang halaga o may kapalit na record (baka may mawala): suriin muna ang mga ito.
-- =====================================================================

begin;

do $$
declare n_null bigint; n_rep bigint;
begin
  select count(*) into n_null from public.abuluyan_totals where total_amount is null;
  select count(*) into n_rep from public.abuluyan_totals where replaces_id is not null;
  if n_null > 0 then
    raise exception 'May % na record na walang halaga (draft). Punan o burahin muna bago mag-rollback. Walang binago.', n_null;
  end if;
  if n_rep > 0 then
    raise exception 'May % na kapalit (replacement) na record. Suriin muna bago mag-rollback. Walang binago.', n_rep;
  end if;
end $$;

-- policy ng 010
drop policy if exists abuluyan_update on public.abuluyan_totals;
create policy abuluyan_update on public.abuluyan_totals for update to authenticated
  using (public.can_access_local(local_id) and (status = 'draft' or public.is_church_wide_finance()))
  with check (public.can_access_local(local_id));

-- trigger
drop trigger if exists abuluyan_totals_lifecycle on public.abuluyan_totals;
drop function if exists public.abuluyan_lifecycle_rules();
drop trigger if exists abuluyan_totals_rules on public.abuluyan_totals;
create trigger abuluyan_totals_rules
  before insert or update on public.abuluyan_totals
  for each row execute function public.enforce_finance_record_rules('recorded_by', 'submitted_date');

drop function if exists public.void_abuluyan(uuid, date, text);

drop index if exists public.abuluyan_one_active_per_sunday;
alter table public.abuluyan_totals
  drop constraint if exists abuluyan_amount_required_when_not_draft,
  drop constraint if exists abuluyan_void_fields,
  drop constraint if exists abuluyan_not_self_replacement;
alter table public.abuluyan_totals
  drop column if exists replaces_id,
  drop column if exists void_reason,
  drop column if exists voided_by,
  drop column if exists voided_at,
  drop column if exists submitted_by,
  drop column if exists submitted_at;
alter table public.abuluyan_totals alter column total_amount set not null;

-- locals
drop trigger if exists locals_guard_timezone on public.locals;
drop function if exists public.locals_guard_timezone();
drop function if exists public.local_today(text, timestamptz);
alter table public.locals alter column timezone set default 'Asia/Manila';

commit;
