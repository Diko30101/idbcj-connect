-- Function na nagsasabi kung ang kasalukuyang user ay kasapi ng
-- Tulong Financial Members ministry (automatic membership: may loan record,
-- may active borrower login, o may approved portal-linked Tulong account).
-- SECURITY DEFINER para gumana kahit naka-RLS ang mga table.

create or replace function public.is_tulong_financial_member()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.tulong_financial_ministry_members v
    where v.member_id in (
      -- Member na direktang naka-link sa profile
      select m.id from public.members m where m.profile_id = auth.uid()
      union
      -- Member mula sa username requests ng profile (approved man o hindi,
      -- basta naka-link ang member_id)
      select r.member_id from public.tulong_username_requests r
      where r.profile_id = auth.uid() and r.member_id is not null
    )
  )
  or exists (
    -- May approved username request na naka-link sa profile
    -- (kahit walang member_id, gaya ni Elyzah)
    select 1 from public.tulong_username_requests r
    where r.profile_id = auth.uid() and r.status = 'approved'
  );
$$;

grant execute on function public.is_tulong_financial_member() to authenticated;
