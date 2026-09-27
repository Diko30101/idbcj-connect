-- Awtomatikong Inbox letter sa member kapag naaprubahan ang kanilang
-- Tulong Financial request (loan o username). Ipinapadala mula sa
-- Finance Ministry perspective (system-generated).

-- Helper: kumuha ng profile_id ng member mula sa member_id
create or replace function public.tulong_member_profile_id(p_member_id uuid)
returns uuid
language sql
security definer
stable
as $$
  select coalesce(
    (select m.profile_id from public.members m where m.id = p_member_id),
    (select r.profile_id from public.tulong_username_requests r
     where r.member_id = p_member_id and r.status = 'approved'
     order by r.decided_at desc nulls last limit 1)
  );
$$;

grant execute on function public.tulong_member_profile_id(uuid) to authenticated;

-- I-update ang tulong_decide_loan_request para magpadala ng letter sa member pag approved
create or replace function public.tulong_decide_loan_request(p_request_id uuid, p_approve boolean)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  v_decider uuid;
  v_rec record;
  v_local_id uuid;
  v_member_profile uuid;
  v_member_name text;
  v_letter_id uuid;
begin
  v_decider := auth.uid();
  if v_decider is null
     or not exists (select 1 from public.profiles where id = v_decider and role = 'admin') then
    raise exception 'admin lang ang maaaring mag-apruba';
  end if;

  select * into v_rec from public.tulong_loan_requests where id = p_request_id;
  if v_rec.id is null then raise exception 'hindi nakita ang kahilingan'; end if;
  if v_rec.status <> 'sent' then
    raise exception 'hindi na naghihintay ng apruba ang kahilingang ito';
  end if;

  if p_approve then
    select local_id into v_local_id from public.members where id = v_rec.member_id;
    insert into public.tulong_financial_loans
      (member_id, local_id, amount, date_borrowed, target_return_date, notes, recorded_by)
    values
      (v_rec.member_id, v_local_id, v_rec.amount, current_date,
       v_rec.target_return_date, v_rec.notes, v_decider);
  end if;

  update public.tulong_loan_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      decided_at = now(),
      decided_by = v_decider
  where id = p_request_id;

  insert into public.letter_messages (letter_id, author_id, body)
  select l.letter_id, v_decider,
         case when p_approve
           then 'APRUBADO ng admin. Nalikha na ang loan record para sa kahilingang ito.'
           else 'TINANGGIHAN ng admin ang kahilingang ito.' end
  from public.tulong_request_letters l
  where l.request_kind = 'loan' and l.request_id = p_request_id;

  -- Awtomatikong Inbox letter sa member kapag naaprubahan ang hiram
  if p_approve then
    v_member_profile := public.tulong_member_profile_id(v_rec.member_id);
    if v_member_profile is not null then
      select full_name into v_member_name from public.members where id = v_rec.member_id;
      insert into public.letters (subject, created_by)
      values ('Aprubado ang iyong kahilingan ng Tulong Financial', v_decider)
      returning id into v_letter_id;

      insert into public.letter_recipients (letter_id, profile_id)
      values (v_letter_id, v_member_profile);

      insert into public.letter_messages (letter_id, author_id, body)
      values (v_letter_id, v_decider,
        'Magandang balita, ' || coalesce(v_member_name, 'kapatid') || '!' || chr(10) || chr(10) ||
        'Aprubado na ang iyong kahilingan ng Tulong Financial.' || chr(10) ||
        'Halaga: ₱' || to_char(v_rec.amount, 'FM999,999,999.00') || chr(10) ||
        case when v_rec.target_return_date is not null
          then 'Target na petsa ng pagsasauli: ' || to_char(v_rec.target_return_date, 'FMMonth DD, YYYY') || chr(10)
          else '' end || chr(10) ||
        'Makikita mo ang iyong record sa "My Tulong Financial" menu sa portal.');
    end if;
  end if;
end;
$$;

revoke all on function public.tulong_decide_loan_request(uuid, boolean) from public, anon;
grant execute on function public.tulong_decide_loan_request(uuid, boolean) to authenticated;

-- I-update ang tulong_decide_username_request para magpadala ng letter sa member pag approved
create or replace function public.tulong_decide_username_request(p_request_id uuid, p_approve boolean)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  v_decider uuid;
  v_rec record;
  v_member_name text;
  v_letter_id uuid;
begin
  v_decider := auth.uid();
  if v_decider is null
     or not exists (select 1 from public.profiles where id = v_decider and role = 'admin') then
    raise exception 'admin lang ang maaaring mag-apruba';
  end if;

  select * into v_rec from public.tulong_username_requests where id = p_request_id;
  if v_rec.id is null then raise exception 'hindi nakita ang kahilingan'; end if;
  if v_rec.status <> 'pending' then
    raise exception 'hindi na naghihintay ng apruba ang kahilingang ito';
  end if;

  if p_approve then
    if v_rec.profile_id is not null then
      null;
    else
      if v_rec.username is null or v_rec.password_hash is null then
        raise exception 'walang username/password ang kahilingang ito';
      end if;
      if exists (select 1 from public.tulong_financial_borrowers where lower(username) = lower(v_rec.username)) then
        raise exception 'gamit na ang username na ito';
      end if;
      if exists (select 1 from public.tulong_financial_borrowers where member_id = v_rec.member_id) then
        raise exception 'may account na ang kaanib na ito';
      end if;
      insert into public.tulong_financial_borrowers
        (member_id, username, password_hash, is_active, created_by, password_is_temporary)
      values
        (v_rec.member_id, v_rec.username, v_rec.password_hash, true, v_decider, true);
    end if;
  end if;

  update public.tulong_username_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      decided_at = now(),
      decided_by = v_decider
  where id = p_request_id;

  insert into public.letter_messages (letter_id, author_id, body)
  select l.letter_id, v_decider,
         case when p_approve
           then case when v_rec.profile_id is not null
             then 'APRUBADO ng admin. Maaari nang mag-login ang kaanib gamit ang kanyang portal account sa idbcj.org/tulong-financial.'
             else 'APRUBADO ng admin. Nalikha na ang account (aktibo na, maaari nang mag-login ang kaanib).'
             end
           else 'TINANGGIHAN ng admin ang kahilingang ito.' end
  from public.tulong_request_letters l
  where l.request_kind = 'username' and l.request_id = p_request_id;

  -- Awtomatikong Inbox letter sa member kapag naaprubahan ang account
  -- (para sa may portal account lang; ang dedicated borrower ay walang portal inbox)
  if p_approve and v_rec.profile_id is not null then
    select full_name into v_member_name from public.members where id = v_rec.member_id;
    insert into public.letters (subject, created_by)
    values ('Aprubado ang iyong Tulong Financial account', v_decider)
    returning id into v_letter_id;

    insert into public.letter_recipients (letter_id, profile_id)
    values (v_letter_id, v_rec.profile_id);

    insert into public.letter_messages (letter_id, author_id, body)
    values (v_letter_id, v_decider,
      'Magandang balita, ' || coalesce(v_member_name, 'kapatid') || '!' || chr(10) || chr(10) ||
      'Aprubado na ang iyong Tulong Financial account.' || chr(10) || chr(10) ||
      'Makikita mo ang "My Tulong Financial" menu sa iyong portal — doon mo makikita ang iyong record, history ng transactions, at balanse.');
  end if;
end;
$$;

revoke all on function public.tulong_decide_username_request(uuid, boolean) from public, anon;
grant execute on function public.tulong_decide_username_request(uuid, boolean) to authenticated;
