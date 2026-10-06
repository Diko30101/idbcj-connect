-- 049: Approval notifications + disbursement tracking.
--
-- 1) Sa pag-apruba ng loan request: automatic na notification letters
--    - Sa Finance Ministry: aprubado na, pwede nang ibigay ang pera.
--    - Sa nanghihiram (kung may portal account): aprubado na ang kahilingan.
-- 2) Bagong columns sa tulong_financial_loans para sa aktwal na abutan:
--    - date_disbursed: petsa kung kailan talaga natanggap ang pera
--      (iba sa date_borrowed na petsa ng pag-apruba/paghiram).
--    - disbursed_by: sino sa Finance Ministry ang nagtala.
--    - disbursed_at: kailan itinala sa system.
-- 3) Bagong function tulong_confirm_disbursement: itinatala ng Finance
--    Ministry ang pag-abot + automatic confirmation letters
--    (sa nanghihiram at sa Admin).

-- 2) Disbursement columns.
alter table public.tulong_financial_loans
  add column if not exists date_disbursed date,
  add column if not exists disbursed_by uuid references public.profiles(id),
  add column if not exists disbursed_at timestamptz;

-- 1) Bagong bersyon ng decide function na may approval notifications.
create or replace function public.tulong_decide_loan_request(p_request_id uuid, p_approve boolean)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  v_decider uuid;
  v_rec record;
  v_local_id uuid;
  v_member_name text;
  v_borrower_profile uuid;
  v_letter_id uuid;
  v_amount_txt text;
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

  select m.full_name, m.profile_id into v_member_name, v_borrower_profile
  from public.members m where m.id = v_rec.member_id;

  v_amount_txt := '₱' || coalesce(v_rec.amount::text, '0');

  if p_approve then
    select local_id into v_local_id from public.members where id = v_rec.member_id;
    insert into public.tulong_financial_loans
      (member_id, local_id, amount, date_borrowed, target_return_date, notes, recorded_by)
    values
      (v_rec.member_id, v_local_id, v_rec.amount, current_date,
       v_rec.target_return_date, v_rec.notes, v_decider);

    -- Notification sa Finance Ministry: aprubado na, pwede nang ibigay ang pera.
    insert into public.letters (subject, created_by)
    values ('Aprubado — ' || coalesce(v_member_name, '') || ' (' || v_amount_txt || ')', v_decider)
    returning id into v_letter_id;

    insert into public.letter_recipients (letter_id, profile_id)
    select v_letter_id, mm.profile_id
    from public.ministry_members mm
    join public.ministries m on m.id = mm.ministry_id
    where m.name = 'Finance Ministry';

    insert into public.letter_messages (letter_id, author_id, body)
    values (v_letter_id, v_decider,
      'Aprubado na ni Admin ang kahilingan ni ' || coalesce(v_member_name, '') ||
      ' ng halagang ' || v_amount_txt ||
      '. Pwede nang ibigay ang pera at itala ang pag-abot sa portal (pindutin ang "Naiabot na ang pera").');

    -- Notification sa nanghihiram (kung may portal account).
    if v_borrower_profile is not null then
      insert into public.letters (subject, created_by)
      values ('Aprubado ang iyong kahilingan ng Tulong Financial', v_decider)
      returning id into v_letter_id;

      insert into public.letter_recipients (letter_id, profile_id)
      values (v_letter_id, v_borrower_profile);

      insert into public.letter_messages (letter_id, author_id, body)
      values (v_letter_id, v_decider,
        'Aprubado na ang iyong kahilingan ng Tulong Financial ng halagang ' || v_amount_txt ||
        '. Makipag-ugnayan sa Finance Ministry para sa pagtanggap ng pera.');
    end if;
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
end;
$$;

revoke all on function public.tulong_decide_loan_request(uuid, boolean) from public, anon;
grant execute on function public.tulong_decide_loan_request(uuid, boolean) to authenticated;

-- 3) Function para itala ang pag-abot ng pera + confirmation letters.
create or replace function public.tulong_confirm_disbursement(p_loan_id uuid, p_date_disbursed date)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  v_recorder uuid;
  v_loan record;
  v_member_name text;
  v_borrower_profile uuid;
  v_letter_id uuid;
  v_amount_txt text;
  v_date_txt text;
begin
  v_recorder := auth.uid();
  if v_recorder is null or not public.is_tulong_financial() then
    raise exception 'walang access';
  end if;

  if p_date_disbursed is null then
    raise exception 'kailangan ang petsa ng pag-abot';
  end if;

  select * into v_loan from public.tulong_financial_loans where id = p_loan_id;
  if v_loan.id is null then raise exception 'hindi nakita ang loan'; end if;
  if v_loan.date_disbursed is not null then
    raise exception 'naitala na ang pag-abot ng perang ito';
  end if;

  update public.tulong_financial_loans
  set date_disbursed = p_date_disbursed,
      disbursed_by = v_recorder,
      disbursed_at = now()
  where id = p_loan_id;

  select m.full_name, m.profile_id into v_member_name, v_borrower_profile
  from public.members m where m.id = v_loan.member_id;

  v_amount_txt := '₱' || coalesce(v_loan.amount::text, '0');
  v_date_txt := to_char(p_date_disbursed, 'YYYY-MM-DD');

  -- Confirmation sa nanghihiram (kung may portal account).
  if v_borrower_profile is not null then
    insert into public.letters (subject, created_by)
    values ('Natanggap mo na ang Tulong Financial', v_recorder)
    returning id into v_letter_id;

    insert into public.letter_recipients (letter_id, profile_id)
    values (v_letter_id, v_borrower_profile);

    insert into public.letter_messages (letter_id, author_id, body)
    values (v_letter_id, v_recorder,
      'Natanggap mo na ang ' || v_amount_txt ||
      ' na Tulong Financial noong ' || v_date_txt || '.');
  end if;

  -- Confirmation sa Admin (para sa record).
  insert into public.letters (subject, created_by)
  values ('Naiabot na — ' || coalesce(v_member_name, '') || ' (' || v_amount_txt || ')', v_recorder)
  returning id into v_letter_id;

  insert into public.letter_recipients (letter_id, profile_id)
  select v_letter_id, p.id from public.profiles p where p.role = 'admin';

  insert into public.letter_messages (letter_id, author_id, body)
  values (v_letter_id, v_recorder,
    'Naiabot na ng Finance Ministry ang ' || v_amount_txt ||
    ' kay ' || coalesce(v_member_name, '') || ' noong ' || v_date_txt || '.');
end;
$$;

revoke all on function public.tulong_confirm_disbursement(uuid, date) from public, anon;
grant execute on function public.tulong_confirm_disbursement(uuid, date) to authenticated;
