-- 035: Payagan ang Tulong Financial (Admin + Finance Ministry) na makita ang lahat
-- ng members sa buong church para sa member dropdown sa Create New Account.
-- Ang Tulong Financial ay church-wide, hindi per-local.

drop policy if exists members_select on public.members;
create policy members_select on public.members for select to authenticated
  using (
    local_id in (select local_id from my_finance_locals)
    or local_id in (select local_id from my_oversight_locals)
    or public.is_admin()
    or public.is_tulong_financial()
  );
