-- 041: Isama ang mga may approved portal account sa Tulong Financial Members.
-- Dati: loan o dedicated borrower login lang ang binibilang.
-- Ngayon: kasama na rin ang may approved tulong_username_requests (portal account).

create or replace view public.tulong_financial_ministry_members as
select
  m.id as member_id,
  m.full_name,
  l.name as local_name,
  coalesce(b.username, r.username) as username,
  exists (select 1 from public.tulong_financial_loans tl where tl.member_id = m.id) as has_loan,
  (b.id is not null or r.id is not null) as has_login
from public.members m
left join public.locals l on l.id = m.local_id
left join public.tulong_financial_borrowers b on b.member_id = m.id and b.is_active = true
left join public.tulong_username_requests r on r.member_id = m.id and r.status = 'approved'
where exists (select 1 from public.tulong_financial_loans tl where tl.member_id = m.id)
   or b.id is not null
   or r.id is not null;
