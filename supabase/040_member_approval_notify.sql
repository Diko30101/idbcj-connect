-- 040: Inbox notification para sa bagong kaanib na naghihintay ng kumpirmasyon ng Admin.
-- Kapag ang non-Admin ay nagdagdag ng kaanib, magpapadala ng liham sa Inbox ng Admin.

create or replace function public.notify_admin_new_member(p_member_id uuid)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_sender uuid;
  v_letter_id uuid;
  v_member_name text;
  v_local_name text;
begin
  v_sender := auth.uid();
  if v_sender is null then
    raise exception 'walang access';
  end if;

  select m.full_name, l.name
  into v_member_name, v_local_name
  from public.members m
  left join public.locals l on l.id = m.local_id
  where m.id = p_member_id;

  if v_member_name is null then
    raise exception 'hindi natagpuan ang kaanib';
  end if;

  insert into public.letters (subject, created_by)
  values ('Bagong kaanib na naghihintay ng kumpirmasyon — ' || v_member_name, v_sender)
  returning id into v_letter_id;

  -- Ipadala sa lahat ng Admin
  insert into public.letter_recipients (letter_id, profile_id)
  select v_letter_id, p.id from public.profiles p where p.role = 'admin';

  insert into public.letter_messages (letter_id, author_id, body)
  values (
    v_letter_id,
    v_sender,
    'May bagong kaanib na idinagdag at naghihintay ng iyong kumpirmasyon:' || chr(10) ||
    'Pangalan: ' || v_member_name || chr(10) ||
    'Local: ' || coalesce(v_local_name, '—') || chr(10) || chr(10) ||
    'Pakitingnan sa ibaba: Kumpirmahin o tingnan sa Mga Miyembro.'
  );

  return v_letter_id;
end;
$$;

revoke all on function public.notify_admin_new_member(uuid) from public, anon;
grant execute on function public.notify_admin_new_member(uuid) to authenticated;
