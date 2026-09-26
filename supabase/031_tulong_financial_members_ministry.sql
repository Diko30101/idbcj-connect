-- =====================================================================
-- 031: "Tulong Financial Members" ministry.
--
-- Bagong ministry na ang lahat ng miyembro ay ang mga kaanib na MAY HIRAM
-- o MAY ACCOUNT sa Tulong Financial. Awtomatiko ang membership: isang view
-- (hindi manual na ministry_members rows) ang tumutukoy kung sino ang kasali.
--
-- Umaasa sa: 029 (tulong_financial_loans) at 030 (tulong_financial_borrowers).
-- Patakbuhin PAGKATAPOS ng 028, 029, at 030.
-- =====================================================================

begin;

-- Flag para matukoy ang ministry nang hindi umaasa sa pangalan (pangalan ay
-- maaaring palitan; ang flag ang ginagamit ng UI).
alter table public.ministries
  add column if not exists is_borrower_ministry boolean not null default false;

-- Idempotent na paglikha ng ministry.
insert into public.ministries (name, name_tl, description, is_borrower_ministry)
values (
  'Tulong Financial Members',
  'Mga Miyembro ng Tulong Financial',
  'Awtomatikong kasapi ang lahat ng kaanib na may hiram o may account sa Tulong Financial. Ang membership ay hindi manual na idinaragdag o inaalis.'
)
on conflict (name) do update set
  is_borrower_ministry = true,
  name_tl = excluded.name_tl,
  description = excluded.description;

-- Dynamic membership: may loan record O may active na borrower login.
-- View ito kaya laging kasabay (sync) — walang trigger na kailangan.
create or replace view public.tulong_financial_ministry_members as
select
  m.id as member_id,
  m.full_name,
  l.name as local_name,
  b.username,
  exists (select 1 from public.tulong_financial_loans tl where tl.member_id = m.id) as has_loan,
  (b.id is not null) as has_login
from public.members m
left join public.locals l on l.id = m.local_id
left join public.tulong_financial_borrowers b on b.member_id = m.id and b.is_active = true
where exists (select 1 from public.tulong_financial_loans tl where tl.member_id = m.id)
   or b.id is not null;

commit;
