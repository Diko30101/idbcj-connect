-- Payagan ang user na makita ang SARILI nilang tulong_username_requests
-- (kailangan ito para lumabas ang "Tulong Financial" menu sa kanilang portal).
-- Ang Admin/Finance Ministry ay may access pa rin sa lahat via is_tulong_financial().

drop policy if exists tulong_username_requests_own on public.tulong_username_requests;

create policy tulong_username_requests_own on public.tulong_username_requests
  for select to authenticated
  using (profile_id = auth.uid());
