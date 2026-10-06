-- Function na nagsasabi kung ang isang profile ay kasapi ng
-- Tulong Financial Members ministry, gamit ang profile_id bilang parameter
-- (hindi umaasa sa auth.uid(), para gumana kahit may session issue).
-- SECURITY DEFINER para gumana kahit naka-RLS ang mga table.

create or replace function public.is_tulong_financial_member_by_profile(p_profile_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.tulong_financial_ministry_members v
    where v.member_id in (
      select m.id from public.members m where m.profile_id = p_profile_id
      union
      select r.member_id from public.tulong_username_requests r
      where r.profile_id = p_profile_id and r.member_id is not null
    )
  )
  or exists (
    select 1 from public.tulong_username_requests r
    where r.profile_id = p_profile_id and r.status = 'approved'
  );
$$;

grant execute on function public.is_tulong_financial_member_by_profile(uuid) to authenticated;
