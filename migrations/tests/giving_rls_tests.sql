-- =====================================================================
-- Pagsubok ng RLS, triggers, at patakaran ng 010-013 at 016 (kumpirmasyon ng kaanib)
-- (Ambagan, Tulong sa Klase Ministeryal, Pasalamat, Abuluyan, Attendance,
--  roster, pahintulot, audit)
--
-- PAANO PATAKBUHIN: ilapat LAMANG pagkatapos ma-apply ang 010-013 at 016.
-- Buksan sa Supabase SQL editor (o execute_sql) at patakbuhin ang BUONG file.
-- Sintetikong user/kaanib lang ang ginagamit; ang buong script ay nasa
-- isang transaction na laging NABABAWI: sa dulo, sinasadyang mag-raise ng
-- exception na naglalaman ng ulat (PASS/FAIL). Walang naiiwan sa database.
--
-- Umaasa ito sa umiiral na 3 locals (medina, sto_tomas, fort_mcmurray) at
-- sa mga ministry na: Local Finance Ministry, Finance Ministry, Local Admin
-- Ministry, Administrative Ministry, Pastoral Ministry.
-- =====================================================================

create temp table t_results (n serial, label text, ok boolean, detail text);

create function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  execute 'set local role authenticated';
end $$;

-- Ibalik sa postgres AT burahin ang JWT claims (para hindi mapagkamalang user ang mga fixture na hakbang)
create function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

-- Patakbuhin ang isang SQL bilang isang user; bumabalik ang (ok, msg, cnt)
create function pg_temp.try_sql(p_uid uuid, p_sql text)
returns table (ok boolean, msg text, cnt bigint) language plpgsql as $$
declare v_cnt bigint := 0; v_msg text; v_ok boolean;
begin
  perform pg_temp.as_user(p_uid);
  begin
    execute p_sql;
    get diagnostics v_cnt = row_count;
    v_ok := true; v_msg := null;
  exception when others then
    v_ok := false; v_msg := sqlerrm; v_cnt := 0;
  end;
  perform pg_temp.as_postgres();
  ok := v_ok; msg := v_msg; cnt := v_cnt;
  return next;
end $$;

-- Gaya ng try_sql pero HINDI nagpapalit ng role: tumatakbo bilang postgres (walang RLS) na may claims
-- ng user, para masubok ang mga trigger nang hiwalay sa RLS
create function pg_temp.try_sql_claims(p_uid uuid, p_sql text)
returns table (ok boolean, msg text, cnt bigint) language plpgsql as $$
declare v_cnt bigint := 0; v_msg text; v_ok boolean;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  begin
    execute p_sql;
    get diagnostics v_cnt = row_count;
    v_ok := true; v_msg := null;
  exception when others then
    v_ok := false; v_msg := sqlerrm; v_cnt := 0;
  end;
  perform pg_temp.as_postgres();
  ok := v_ok; msg := v_msg; cnt := v_cnt;
  return next;
end $$;

-- Bilang (o -1 kung nag-error) bilang isang user
create function pg_temp.cnt_as(p_uid uuid, p_sql text) returns bigint language plpgsql as $$
declare v bigint;
begin
  perform pg_temp.as_user(p_uid);
  begin
    execute p_sql into v;
  exception when others then
    v := -1;
  end;
  perform pg_temp.as_postgres();
  return v;
end $$;

create function pg_temp.rec(p_label text, p_ok boolean, p_detail text default '') returns void language plpgsql as $$
begin
  insert into t_results (label, ok, detail) values (p_label, coalesce(p_ok, false), p_detail);
end $$;

create function pg_temp.mk_user(p_id uuid, p_name text, p_role text, p_local uuid) returns void language plpgsql as $$
begin
  insert into auth.users (id, email) values (p_id, p_id::text || '@test.invalid');
  update public.profiles set full_name = p_name, role = p_role, status = 'active', local_id = p_local where id = p_id;
end $$;

create function pg_temp.mk_mm(p_ministry text, p_profile uuid, p_leader boolean default false) returns void language plpgsql as $$
begin
  insert into public.ministry_members (ministry_id, profile_id, is_leader)
  select id, p_profile, p_leader from public.ministries where name = p_ministry;
end $$;

create function pg_temp.ins_amb(p_local uuid, p_member uuid, p_amount numeric, p_date date) returns text language sql as $$
  select format('insert into public.ambagan_records (local_id, member_id, period_month, amount, date_received) values (%L, %L, %L, %s, %L)',
                p_local, p_member, date_trunc('month', p_date)::date, p_amount, p_date)
$$;

do $test$
declare
  L_MED uuid; L_FM uuid; L_ST uuid;
  MIN_FIN uuid; MIN_LA uuid;
  U_med uuid := gen_random_uuid();      -- Local Finance Medina
  U_fm uuid := gen_random_uuid();       -- Local Finance Fort McMurray
  U_cw uuid := gen_random_uuid();       -- sintetikong church-wide Finance
  U_lscope uuid := gen_random_uuid();   -- Finance Ministry (Medina), finance_scope=local
  U_admin uuid := gen_random_uuid();    -- Admin (role=admin), walang finance ministry
  U_ladmin uuid := gen_random_uuid();   -- Local Admin Ministry (Medina)
  U_adminmin uuid := gen_random_uuid(); -- Administrative Ministry (Medina)
  U_member uuid := gen_random_uuid();   -- ordinaryong kaanib
  U_past uuid := gen_random_uuid();     -- lider ng Pastoral Ministry + role=admin
  U_past2 uuid := gen_random_uuid();    -- lider ng Pastoral Ministry, role=leader (hindi admin)
  U_sec uuid := gen_random_uuid();      -- role=secretary
  U_nolocal uuid := gen_random_uuid();  -- Finance Ministry, walang local_id
  M_x uuid := gen_random_uuid();
  M_pend1 uuid := gen_random_uuid();
  M_pend2 uuid := gen_random_uuid();
  M_adm1 uuid := gen_random_uuid();
  M_adm2 uuid := gen_random_uuid();
  M_x2 uuid := gen_random_uuid();
  M_ren uuid := gen_random_uuid();
  M_ren2 uuid := gen_random_uuid();
  M_ren3 uuid := gen_random_uuid();
  M_fmt uuid := gen_random_uuid();
  X2 uuid;
  v_b boolean;
  X1 uuid;
  M_med uuid := gen_random_uuid();
  M_fm uuid := gen_random_uuid();
  M_inact uuid := gen_random_uuid();
  M_inact2 uuid := gen_random_uuid();
  M_inact3 uuid := gen_random_uuid();
  M_tit uuid := gen_random_uuid();
  A1 uuid; A2 uuid; A3 uuid; AB uuid; P1 uuid;
  r record; rr record; v bigint; v_txt text; v_report text; v_pass int; v_fail int;
begin
  select id into L_MED from public.locals where key = 'medina';
  select id into L_FM from public.locals where key = 'fort_mcmurray';
  select id into L_ST from public.locals where key = 'sto_tomas';
  select id into MIN_FIN from public.ministries where name = 'Finance Ministry';
  select id into MIN_LA from public.ministries where name = 'Local Admin Ministry';

  -- ---------------- FIXTURES (bilang postgres) ----------------
  perform pg_temp.mk_user(U_med, 'T Local Finance Medina', 'member', L_MED);
  perform pg_temp.mk_user(U_fm, 'T Local Finance FM', 'member', L_FM);
  perform pg_temp.mk_user(U_cw, 'T Church-wide Finance', 'member', L_MED);
  perform pg_temp.mk_user(U_lscope, 'T Finance Ministry Medina (local)', 'member', L_MED);
  perform pg_temp.mk_user(U_admin, 'T Admin', 'admin', L_FM);
  perform pg_temp.mk_user(U_ladmin, 'T Local Admin Medina', 'member', L_MED);
  perform pg_temp.mk_user(U_adminmin, 'T Administrative Medina', 'member', L_MED);
  perform pg_temp.mk_user(U_member, 'T Ordinaryong Kaanib', 'member', L_MED);
  perform pg_temp.mk_user(U_past, 'T Pastoral Leader Admin', 'admin', L_MED);
  perform pg_temp.mk_user(U_past2, 'T Pastoral Leader hindi admin', 'leader', L_ST);
  perform pg_temp.mk_user(U_sec, 'T Secretary', 'secretary', L_MED);
  perform pg_temp.mk_user(U_nolocal, 'T Finance Ministry walang local', 'member', null);
  perform pg_temp.mk_mm('Finance Ministry', U_nolocal);

  perform pg_temp.mk_mm('Local Finance Ministry', U_med);
  perform pg_temp.mk_mm('Local Finance Ministry', U_fm);
  perform pg_temp.mk_mm('Finance Ministry', U_cw);
  perform pg_temp.mk_mm('Finance Ministry', U_lscope);
  perform pg_temp.mk_mm('Local Admin Ministry', U_ladmin);
  perform pg_temp.mk_mm('Administrative Ministry', U_adminmin);
  perform pg_temp.mk_mm('Pastoral Ministry', U_past, true);
  perform pg_temp.mk_mm('Pastoral Ministry', U_past2, true);

  -- church-wide para sa sintetikong U_cw (postgres: walang JWT, pinapayagan ng guard)
  update public.ministry_members set finance_scope = 'church_wide' where profile_id = U_cw and ministry_id = MIN_FIN;

  insert into public.members (id, local_id, full_name, status) values
    (M_med, L_MED, 'T Kaanib Medina Active', 'Active'),
    (M_fm, L_FM, 'T Kaanib FM Active', 'Active'),
    (M_inact, L_MED, 'T Kaanib Inactive 1', 'Inactive'),
    (M_inact2, L_MED, 'T Kaanib Inactive 2', 'Inactive'),
    (M_inact3, L_MED, 'T Kaanib Inactive 3', 'Inactive'),
    (M_tit, L_MED, 'T Kaanib Natitiwalag', 'Pagtitiwalag');
  -- Ang INSERT ay hindi tumatanggap ng confirmed_* (016): kumpirmahin sa hiwalay na UPDATE (postgres, walang JWT)
  update public.members set confirmed_at = now(), confirmed_by = U_admin where full_name like 'T Kaanib%';

  -- ---------------- a / F: Medina at Fort McMurray ----------------
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins_amb(L_MED, M_med, 100, date '2026-09-06'));
  perform pg_temp.rec('a1: Local Finance Medina: ambagan para sa kaanib ng Medina', r.ok, r.msg);
  select id into A1 from public.ambagan_records where member_id = M_med and local_id = L_MED order by created_at desc limit 1;

  select * into r from pg_temp.try_sql(U_med, pg_temp.ins_amb(L_MED, M_fm, 200, date '2026-09-06'));
  perform pg_temp.rec('F1: Medina ay nakatanggap ng ambagan mula sa kaanib ng Fort McMurray', r.ok, r.msg);
  select id into A2 from public.ambagan_records where member_id = M_fm and local_id = L_MED order by created_at desc limit 1;

  select * into r from pg_temp.try_sql(U_fm, pg_temp.ins_amb(L_FM, M_fm, 300, date '2026-09-06'));
  perform pg_temp.rec('a2: Local Finance FM: ambagan sa sariling local', r.ok, r.msg);
  select id into A3 from public.ambagan_records where member_id = M_fm and local_id = L_FM order by created_at desc limit 1;

  select * into r from pg_temp.try_sql(U_med, pg_temp.ins_amb(L_FM, M_med, 50, date '2026-09-06'));
  perform pg_temp.rec('a3: Local Finance Medina ay hindi makapag-insert para sa local ng FM', not r.ok, coalesce(r.msg, 'natuloy ang insert'));

  v := pg_temp.cnt_as(U_med, 'select count(*) from public.ambagan_records');
  perform pg_temp.rec('a4: Medina ay nakakakita ng 2 record (kanya lang, kasama ang natanggap mula sa FM member)', v = 2, 'nakita=' || v);
  v := pg_temp.cnt_as(U_fm, 'select count(*) from public.ambagan_records');
  perform pg_temp.rec('a5: FM ay nakakakita ng 1 record (hindi ang natanggap ng Medina kahit kaanib nila)', v = 1, 'nakita=' || v);
  v := pg_temp.cnt_as(U_cw, 'select count(*) from public.ambagan_records');
  perform pg_temp.rec('a6: church-wide ay nakakakita ng lahat (3)', v = 3, 'nakita=' || v);

  -- ---------------- i: Finance Ministry na finance_scope=local ----------------
  v := pg_temp.cnt_as(U_lscope, 'select count(*) from public.ambagan_records');
  perform pg_temp.rec('i1: Finance Ministry (local scope, Medina) ay nakakakita lang ng Medina (2)', v = 2, 'nakita=' || v);
  v := pg_temp.cnt_as(U_lscope, format('select case when public.can_access_local(%L) then 1 else 0 end', L_FM));
  perform pg_temp.rec('i2: at walang access sa Fort McMurray', v = 0, 'nakita=' || v);

  -- ---------------- e: kaanib ----------------
  select * into r from pg_temp.try_sql(U_med,
    format('insert into public.ambagan_records (local_id, member_id, period_month, amount, date_received) values (%L, null, %L, 10, %L)', L_MED, date '2026-09-01', date '2026-09-06'));
  perform pg_temp.rec('e1: tinatanggihan ang record na walang member_id (may malinaw na mensahe)', not r.ok and r.msg ilike '%kaanib%', coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins_amb(L_MED, gen_random_uuid(), 10, date '2026-09-06'));
  perform pg_temp.rec('e2: tinatanggihan ang member_id na wala sa listahan ng kaanib', not r.ok and r.msg ilike '%hindi kaanib%', coalesce(r.msg, 'natuloy'));
  select count(*) into v from information_schema.columns
   where table_schema = 'public' and table_name in ('ambagan_records', 'tulong_klase_records', 'pasalamat_records')
     and column_name in ('given_name', 'name', 'full_name', 'giver_name');
  perform pg_temp.rec('e3: walang free-text na column ng pangalan ng nagbibigay', v = 0, 'columns=' || v);

  -- Tulong at Pasalamat (kailangan para sa privacy test)
  select * into r from pg_temp.try_sql(U_med,
    format('insert into public.tulong_klase_records (local_id, member_id, period_month, amount, date_received) values (%L, %L, %L, 20, %L)', L_MED, M_med, date '2026-09-01', date '2026-09-27'));
  perform pg_temp.rec('t1: Local Finance Medina: Tulong sa Klase Ministeryal', r.ok, r.msg);
  select * into r from pg_temp.try_sql(U_med,
    format('insert into public.pasalamat_records (local_id, member_id, type, date, amount) values (%L, %L, ''new_year'', %L, 30)', L_MED, M_med, date '2026-09-06'));
  perform pg_temp.rec('t2: Local Finance Medina: Pasalamat (new_year)', r.ok, r.msg);
  select * into r from pg_temp.try_sql(U_med,
    format('insert into public.pasalamat_records (local_id, member_id, type, date, amount) values (%L, %L, ''bogus'', %L, 30)', L_MED, M_med, date '2026-09-06'));
  perform pg_temp.rec('t3: tinatanggihan ang di-kilalang uri ng Pasalamat', not r.ok, coalesce(r.msg, 'natuloy'));

  -- Abuluyan at Attendance (Medina)
  select * into r from pg_temp.try_sql(U_med,
    format('insert into public.abuluyan_totals (local_id, service_date, total_amount) values (%L, %L, 500)', L_MED, date '2026-09-06'));
  perform pg_temp.rec('ab1: Abuluyan sa Linggo (2026-09-06)', r.ok, r.msg);
  select * into r from pg_temp.try_sql(U_med,
    format('insert into public.abuluyan_totals (local_id, service_date, total_amount) values (%L, %L, 500)', L_MED, date '2026-09-07'));
  perform pg_temp.rec('ab2: tinatanggihan ang Abuluyan na hindi Linggo (sa database)', not r.ok and r.msg ilike '%Linggo%', coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_med,
    format('insert into public.attendance_records (member_id, local_id, service_date, service_type, present) values (%L, %L, %L, ''Linggo'', true)', M_med, L_MED, date '2026-09-06'));
  perform pg_temp.rec('at1: Attendance record', r.ok, r.msg);
  -- Mga pagbabagong magbubunga ng audit row para sa attendance at abuluyan (para sa test ng audit visibility)
  select * into r from pg_temp.try_sql(U_med, format('update public.attendance_records set present = false where local_id = %L', L_MED));
  perform pg_temp.rec('at2: Local Finance ay nakapag-update ng draft na attendance', r.ok and r.cnt = 1, coalesce(r.msg, 'cnt=' || r.cnt));
  select * into r from pg_temp.try_sql(U_med, format('update public.abuluyan_totals set total_amount = 600 where local_id = %L', L_MED));
  perform pg_temp.rec('ab3: Local Finance ay nakapag-update ng draft na Abuluyan', r.ok and r.cnt = 1, coalesce(r.msg, 'cnt=' || r.cnt));

  -- ---------------- d: privacy ----------------
  for r in select * from (values ('Admin', U_admin), ('Local Admin', U_ladmin), ('Administrative', U_adminmin), ('ordinaryong kaanib', U_member)) as x(lbl, uid) loop
    v := pg_temp.cnt_as(r.uid, 'select (select count(*) from public.ambagan_records) + (select count(*) from public.tulong_klase_records) + (select count(*) from public.pasalamat_records)');
    perform pg_temp.rec('d1: ' || r.lbl || ' ay walang nakikitang per-member na halaga', v = 0, 'nakita=' || v);
    v := pg_temp.cnt_as(r.uid, format('select count(*) from public.abuluyan_totals where local_id = %L', L_MED));
    perform pg_temp.rec('d2: ' || r.lbl || ' ay walang nakikitang Abuluyan', v = 0, 'nakita=' || v);
  end loop;
  v := pg_temp.cnt_as(U_ladmin, format('select count(*) from public.attendance_records where local_id = %L', L_MED));
  perform pg_temp.rec('d3: Local Admin ay nakakabasa ng Attendance ng sariling local', v = 1, 'nakita=' || v);
  v := pg_temp.cnt_as(U_admin, 'select count(*) from public.attendance_records');
  perform pg_temp.rec('d4: Admin ay walang access sa Attendance', v = 0, 'nakita=' || v);
  v := pg_temp.cnt_as(U_med, format('select count(*) from public.abuluyan_totals where local_id = %L', L_MED));
  perform pg_temp.rec('d5: Local Finance Medina ay nakakabasa ng Abuluyan ng Medina', v = 1, 'nakita=' || v);
  v := pg_temp.cnt_as(U_fm, format('select count(*) from public.abuluyan_totals where local_id = %L', L_MED));
  perform pg_temp.rec('d6: Local Finance FM ay hindi nakakabasa ng Abuluyan ng Medina', v = 0, 'nakita=' || v);

  -- ---------------- b: submitted ----------------
  select * into r from pg_temp.try_sql(U_med, format('update public.ambagan_records set status = ''submitted'' where id = %L', A1));
  perform pg_temp.rec('b1: Local Finance: "Ipadala" (draft -> submitted)', r.ok and r.cnt = 1, coalesce(r.msg, 'cnt=' || r.cnt));
  select * into r from pg_temp.try_sql(U_med, format('update public.ambagan_records set amount = 999 where id = %L', A1));
  perform pg_temp.rec('b2: Local Finance ay hindi na maka-edit ng submitted', not r.ok or r.cnt = 0, coalesce(r.msg, 'cnt=' || r.cnt));
  select * into r from pg_temp.try_sql(U_med, format('update public.ambagan_records set status = ''void'' where id = %L', A1));
  perform pg_temp.rec('b3: Local Finance ay hindi maka-void ng submitted', not r.ok or r.cnt = 0, coalesce(r.msg, 'cnt=' || r.cnt));
  select amount into v from public.ambagan_records where id = A1;
  perform pg_temp.rec('b4: nanatili ang halaga (100)', v = 100, 'halaga=' || v);

  -- ---------------- c: church-wide at audit ----------------
  select * into r from pg_temp.try_sql(U_cw, format('update public.ambagan_records set amount = 150 where id = %L', A1));
  perform pg_temp.rec('c1: church-wide Finance ay nakakapag-edit ng submitted', r.ok and r.cnt = 1, coalesce(r.msg, 'cnt=' || r.cnt));
  select count(*) into v from public.finance_audit_log
   where table_name = 'ambagan_records' and record_id = A1::text and operation = 'UPDATE'
     and (old_values ->> 'amount')::numeric = 100 and (new_values ->> 'amount')::numeric = 150
     and changed_by = U_cw;
  perform pg_temp.rec('c2: may audit log (sino, dating at bagong halaga)', v = 1, 'rows=' || v);
  select count(*) into v from public.finance_audit_log
   where table_name = 'ambagan_records' and record_id = A1::text and new_values ->> 'status' = 'submitted' and old_values ->> 'status' = 'draft';
  perform pg_temp.rec('c3: may audit ang "Ipadala"', v = 1, 'rows=' || v);
  v := pg_temp.cnt_as(U_med, 'select count(*) from public.finance_audit_log');
  perform pg_temp.rec('c4: Local Finance ay hindi nakakabasa ng audit log', v = 0, 'nakita=' || v);
  v := pg_temp.cnt_as(U_admin, 'select count(*) from public.finance_audit_log where table_name in (''ambagan_records'', ''tulong_klase_records'', ''pasalamat_records'', ''abuluyan_totals'', ''attendance_records'')');
  perform pg_temp.rec('c5: Admin ay hindi nakakabasa ng audit ng anumang table na may halaga o ng attendance', v = 0, 'nakita=' || v);
  select count(*) into v from public.finance_audit_log where table_name = 'ambagan_records';
  perform pg_temp.rec('c5b: (kontrol) may audit row na ng ambagan_records na dapat hindi makita ng Admin', v > 0, 'rows=' || v);
  v := pg_temp.cnt_as(U_cw, 'select count(*) from public.finance_audit_log');
  perform pg_temp.rec('c6: church-wide ay nakakabasa ng audit log', v > 0, 'nakita=' || v);
  select * into r from pg_temp.try_sql(U_cw, format('update public.ambagan_records set status = ''draft'' where id = %L', A1));
  perform pg_temp.rec('c7: hindi maibabalik sa draft ang submitted', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_cw, format('update public.ambagan_records set status = ''void'' where id = %L', A2));
  perform pg_temp.rec('c8: church-wide: void', r.ok and r.cnt = 1, coalesce(r.msg, 'cnt=' || r.cnt));
  select * into r from pg_temp.try_sql(U_cw, format('update public.ambagan_records set notes = ''x'' where id = %L', A2));
  perform pg_temp.rec('c9: void ay pinal na', not r.ok and r.msg ilike '%void%', coalesce(r.msg, 'natuloy'));

  -- ---------------- f: status ng kaanib ----------------
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins_amb(L_MED, M_inact, 10, current_date));
  perform pg_temp.rec('f1: Inactive na walang pahintulot ay tinatanggihan (may malinaw na mensahe)', not r.ok and r.msg ilike '%hindi aktibo%', coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins_amb(L_MED, M_tit, 10, current_date));
  perform pg_temp.rec('f2: Natitiwalag ay tinatanggihan (may malinaw na mensahe)', not r.ok and r.msg ilike '%natitiwalag%', coalesce(r.msg, 'natuloy'));

  -- ---------------- g: pagbibigay ng pahintulot ----------------
  for r in select * from (values ('Administrative Ministry', U_adminmin), ('Local Admin Ministry', U_ladmin), ('Local Finance', U_med),
                                 ('church-wide Finance', U_cw), ('lider ng Pastoral na hindi role=admin', U_past2), ('Admin na hindi Pastoral', U_admin)) as x(lbl, uid) loop
    select * into rr from pg_temp.try_sql(r.uid,
      format('insert into public.giving_permissions (member_id, valid_until, consultation_note) values (%L, current_date + 30, ''Pulong ng Pastoral Ministry'')', M_inact));
    perform pg_temp.rec('g1: ' || r.lbl || ' ay hindi makapagbibigay ng pahintulot', not rr.ok, coalesce(rr.msg, 'natuloy ang insert'));
  end loop;
  select * into r from pg_temp.try_sql(U_past,
    format('insert into public.giving_permissions (member_id, valid_until, consultation_note) values (%L, current_date + 30, '''')', M_inact));
  perform pg_temp.rec('g2: kailangan ang consultation_note', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_past,
    format('insert into public.giving_permissions (member_id, consultation_note) values (%L, ''Pulong'')', M_inact));
  perform pg_temp.rec('g3: kailangan ang valid_until', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_past,
    format('insert into public.giving_permissions (member_id, valid_until, consultation_note) values (%L, current_date + 30, ''Pulong'')', M_med));
  perform pg_temp.rec('g4: hindi puwedeng bigyan ng pahintulot ang Active na kaanib', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_past,
    format('insert into public.giving_permissions (member_id, valid_until, consultation_note) values (%L, current_date + 30, ''Pulong ng Pastoral Ministry, 2026-09-20'')', M_inact));
  perform pg_temp.rec('g5: lider ng Pastoral Ministry (role=admin) ay nakapagbibigay', r.ok, r.msg);

  -- ---------------- h: bisa ng pahintulot ----------------
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins_amb(L_MED, M_inact, 10, current_date));
  perform pg_temp.rec('h1: Inactive na may aktibong pahintulot ay tinatanggap', r.ok, r.msg);

  -- Lumipas na pahintulot (gagawin bilang postgres: walang JWT)
  insert into public.giving_permissions (member_id, granted_by, granted_at, valid_until, consultation_note)
  values (M_inact2, U_past, now() - interval '40 days', current_date - 10, 'lumang pahintulot');
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins_amb(L_MED, M_inact2, 10, current_date));
  perform pg_temp.rec('h2: lumipas ang valid_until: tinatanggihan (may mensaheng "lumipas")', not r.ok and r.msg ilike '%lumipas%', coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins_amb(L_MED, M_inact2, 10, current_date - 60));
  perform pg_temp.rec('h3: petsa ng pagbibigay bago pa ang pahintulot: tinatanggihan', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_past,
    format('insert into public.giving_permissions (member_id, valid_until, consultation_note) values (%L, current_date + 30, ''Pagpapalawig, pulong 2026-09-22'')', M_inact2));
  perform pg_temp.rec('h4: pagpapalawig = bagong pahintulot', r.ok, r.msg);
  select count(*) into v from public.giving_permissions where member_id = M_inact2;
  perform pg_temp.rec('h5: nananatili ang lumang pahintulot sa talaan', v = 2, 'rows=' || v);
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins_amb(L_MED, M_inact2, 10, current_date));
  perform pg_temp.rec('h6: pagkatapos ng pagpapalawig ay tinatanggap', r.ok, r.msg);

  -- Pagbawi
  select * into r from pg_temp.try_sql(U_med, format('update public.giving_permissions set reason = ''x'' where member_id = %L', M_inact));
  perform pg_temp.rec('h7: Local Finance ay hindi makababawi ng pahintulot', not r.ok or r.cnt = 0, coalesce(r.msg, 'cnt=' || r.cnt));
  select * into r from pg_temp.try_sql(U_past, format('update public.giving_permissions set reason = ''Nagbago ang kalagayan'' where member_id = %L', M_inact));
  perform pg_temp.rec('h8: lider ng Pastoral ay nakababawi (revoked_at)', r.ok and r.cnt = 1, coalesce(r.msg, 'cnt=' || r.cnt));
  select count(*) into v from public.giving_permissions where member_id = M_inact and revoked_at is not null and revoked_by = U_past;
  perform pg_temp.rec('h9: nakatala ang revoked_at at revoked_by', v = 1, 'rows=' || v);
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins_amb(L_MED, M_inact, 10, current_date));
  perform pg_temp.rec('h10: pagkatapos ng pagbawi ay tinatanggihan', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_past, format('delete from public.giving_permissions where member_id = %L', M_inact));
  perform pg_temp.rec('h11: walang delete ng pahintulot', not r.ok or r.cnt = 0, coalesce(r.msg, 'cnt=' || r.cnt));
  select count(*) into v from public.finance_audit_log where table_name = 'giving_permissions';
  perform pg_temp.rec('h12: may audit ang bawat bigay at bawi', v >= 4, 'rows=' || v);

  -- Naging Active bago mag-expire: Admin lang ang makapagpapalit ng status
  select * into r from pg_temp.try_sql(U_ladmin, format('update public.members set status = ''Active'', status_reason = ''x'' where id = %L', M_inact3));
  perform pg_temp.rec('h13: Local Admin ay hindi makapagpapalit ng status', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_admin, format('update public.members set status = ''Active'' where id = %L', M_inact3));
  perform pg_temp.rec('h14: kailangan ang dahilan sa pagpapalit ng status (kahit Admin)', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_admin, format('update public.members set status = ''Active'', status_reason = ''Bumalik sa pagsamba'' where id = %L', M_inact3));
  perform pg_temp.rec('h15: Admin ay nakapagpapalit ng status', r.ok and r.cnt = 1, coalesce(r.msg, 'cnt=' || r.cnt));
  select count(*) into v from public.finance_audit_log
   where table_name = 'members' and record_id = M_inact3::text and operation = 'UPDATE'
     and old_values ->> 'status' = 'Inactive' and new_values ->> 'status' = 'Active' and changed_by = U_admin;
  perform pg_temp.rec('h16: may audit ang pagpapalit ng status (sino, dating, bago)', v = 1, 'rows=' || v);
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins_amb(L_MED, M_inact3, 10, current_date));
  perform pg_temp.rec('h17: naging Active na: hindi na kailangan ang pahintulot', r.ok, r.msg);

  -- ---------------- extras ----------------
  select * into r from pg_temp.try_sql(U_cw, 'delete from public.ambagan_records');
  select count(*) into v from public.ambagan_records;
  perform pg_temp.rec('x1: walang DELETE (kahit church-wide)', (not r.ok or r.cnt = 0) and v > 0, coalesce(r.msg, 'cnt=' || r.cnt) || ' natira=' || v);
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins_amb(L_MED, M_med, 0, date '2026-09-13'));
  perform pg_temp.rec('x2: amount = 0 ay tinatanggihan', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins_amb(L_MED, M_med, -5, date '2026-09-13'));
  perform pg_temp.rec('x3: negatibong amount ay tinatanggihan', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_med,
    format('insert into public.ambagan_records (local_id, member_id, period_month, amount, date_received) values (%L, %L, %L, 10, %L)', L_MED, M_med, date '2026-09-15', date '2026-09-15'));
  perform pg_temp.rec('x4: period_month na hindi unang araw ay tinatanggihan', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins_amb(L_MED, M_med, 40, date '2026-09-20'));
  perform pg_temp.rec('x5: higit sa isang record kada kaanib kada buwan ay tinatanggap', r.ok, r.msg);
  select count(*) into v from public.ambagan_records where member_id = M_med and period_month = date '2026-09-01';
  perform pg_temp.rec('x5b: 2 record ng iisang kaanib sa iisang buwan', v = 2, 'rows=' || v);
  select * into r from pg_temp.try_sql(U_med,
    format('insert into public.ambagan_records (local_id, member_id, period_month, amount, currency, date_received, notes) values (%L, %L, %L, 77, ''CAD'', %L, ''cad-test'')', L_MED, M_med, date '2026-09-01', date '2026-09-13'));
  select currency into v_txt from public.ambagan_records where notes = 'cad-test';
  perform pg_temp.rec('x6: currency ay laging PHP kahit CAD ang ipinasa', r.ok and v_txt = 'PHP', coalesce(r.msg, 'currency=' || v_txt));
  select * into r from pg_temp.try_sql(U_med, format('update public.ambagan_records set local_id = %L where notes = ''cad-test''', L_FM));
  perform pg_temp.rec('x7: Local Finance ay hindi makapagpapalit ng local ng record', not r.ok or r.cnt = 0, coalesce(r.msg, 'cnt=' || r.cnt));
  select * into r from pg_temp.try_sql(U_med, format('update public.ambagan_records set status = ''void'' where notes = ''cad-test'''));
  perform pg_temp.rec('x8: Local Finance ay nakaka-void ng sariling draft', r.ok and r.cnt = 1, coalesce(r.msg, 'cnt=' || r.cnt));

  -- finance_scope
  -- x9: ang RLS (mm_write, 010) ang unang humaharang: 0 row ang na-update (tahimik), hindi error.
  -- Sinusuri PAREHO: (a) 0 row o may error, at (b) nanatiling 'local' ang finance_scope (tiningnan bilang postgres).
  select * into r from pg_temp.try_sql(U_sec, format('update public.ministry_members set finance_scope = ''church_wide'' where profile_id = %L and ministry_id = %L', U_lscope, MIN_FIN));
  select finance_scope into v_txt from public.ministry_members where profile_id = U_lscope and ministry_id = MIN_FIN;
  perform pg_temp.rec('x9: hindi-Admin (secretary) ay hindi makapagbabago ng finance_scope (0 row o error, AT nanatiling local)',
    (not r.ok or r.cnt = 0) and v_txt = 'local', 'ok=' || r.ok || ' cnt=' || r.cnt || ' scope=' || coalesce(v_txt, 'null') || ' msg=' || coalesce(r.msg, ''));
  -- x9b: ang trigger guard_finance_scope bilang ikalawang antas ng depensa: patakbuhin bilang postgres
  -- (walang RLS) pero may claims ng secretary; dapat mag-error ang trigger.
  select * into r from pg_temp.try_sql_claims(U_sec, format('update public.ministry_members set finance_scope = ''church_wide'' where profile_id = %L and ministry_id = %L', U_lscope, MIN_FIN));
  select finance_scope into v_txt from public.ministry_members where profile_id = U_lscope and ministry_id = MIN_FIN;
  perform pg_temp.rec('x9b: trigger guard_finance_scope ay tumatanggi sa hindi-Admin kahit walang RLS (may mensaheng "Admin lang") at nanatiling local',
    not r.ok and r.msg ilike '%Admin lang%' and v_txt = 'local', coalesce(r.msg, 'natuloy') || ' scope=' || coalesce(v_txt, 'null'));
  select * into r from pg_temp.try_sql_claims(U_admin, format('update public.ministry_members set finance_scope = ''church_wide'' where profile_id = %L and ministry_id = %L', U_lscope, MIN_FIN));
  perform pg_temp.rec('x9c: (kontrol) ang parehong update na may claims ng Admin ay tinatanggap ng trigger', r.ok and r.cnt = 1, coalesce(r.msg, 'cnt=' || r.cnt));
  update public.ministry_members set finance_scope = 'local' where profile_id = U_lscope and ministry_id = MIN_FIN;
  select * into r from pg_temp.try_sql(U_admin, format('update public.ministry_members set finance_scope = ''church_wide'' where profile_id = %L and ministry_id = %L', U_ladmin, MIN_LA));
  perform pg_temp.rec('x10: church_wide ay para lang sa Finance Ministry', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_admin, format('update public.ministry_members set finance_scope = ''church_wide'' where profile_id = %L and ministry_id = %L', U_lscope, MIN_FIN));
  perform pg_temp.rec('x11: Admin ay nakapagtatakda ng finance_scope', r.ok and r.cnt = 1, coalesce(r.msg, 'cnt=' || r.cnt));
  v := pg_temp.cnt_as(U_lscope, format('select case when public.can_access_local(%L) then 1 else 0 end', L_FM));
  perform pg_temp.rec('x12: pagkatapos, ang user ay may access sa lahat ng local', v = 1, 'nakita=' || v);
  select count(*) into v from public.finance_audit_log where table_name = 'ministry_members' and new_values ->> 'finance_scope' = 'church_wide' and changed_by = U_admin;
  perform pg_temp.rec('x13: may audit ang pagbabago ng finance_scope (x9c at x11, parehong Admin)', v = 2, 'rows=' || v);

  -- Totoong church-wide (Church-wide Finance 1 at 2) -- para sa aktwal na data
  select count(*) into v from public.ministry_members
   where finance_scope = 'church_wide' and ministry_id = MIN_FIN
     and profile_id in ('68944d26-3e21-4880-b14e-1eef1c06cbce'::uuid, '600fec92-6c76-4cb3-84eb-f46644c8a539'::uuid);
  perform pg_temp.rec('x14: ang dalawang church-wide (1 at 2) ay church_wide', v = 2, 'rows=' || v);
  select count(*) into v from public.ministry_members
   where finance_scope = 'church_wide'
     and profile_id not in ('68944d26-3e21-4880-b14e-1eef1c06cbce'::uuid, '600fec92-6c76-4cb3-84eb-f46644c8a539'::uuid, U_cw, U_lscope);
  perform pg_temp.rec('x15: walang ibang church_wide', v = 0, 'rows=' || v);

  -- Roster
  select * into r from pg_temp.try_sql(U_ladmin, format('update public.members set status = ''Inactive'' where id = %L', M_med));
  perform pg_temp.rec('x16: Local Admin ay hindi makapagpapalit ng status ng kaanib', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_ladmin, format('update public.members set full_name = ''T Bagong Pangalan'' where id = %L', M_med));
  perform pg_temp.rec('x17: Local Admin ay nakapag-e-edit ng pangalan (roster)', r.ok and r.cnt = 1, coalesce(r.msg, 'cnt=' || r.cnt));
  -- (ang pagpapalit ng pangalan ng hindi Admin ay nag-re-reset ng kumpirmasyon -- tingnan ang rn*; ibalik ang kumpirmasyon ni M_med para sa mga susunod na pagsubok)
  update public.members set confirmed_at = now(), confirmed_by = U_admin where id = M_med;
  select * into r from pg_temp.try_sql(U_ladmin,
    format('insert into public.members (local_id, full_name, status) values (%L, ''T Bagong Kaanib'', ''Inactive'')', L_MED));
  select status::text into v_txt from public.members where full_name = 'T Bagong Kaanib';
  perform pg_temp.rec('x18: bagong kaanib mula sa Local Admin ay laging Active', r.ok and v_txt = 'Active', coalesce(r.msg, 'status=' || v_txt));
  select * into r from pg_temp.try_sql(U_med, format('insert into public.members (local_id, full_name) values (%L, ''T Mula sa Finance'')', L_MED));
  perform pg_temp.rec('x19: Local Finance ay hindi nagdaragdag ng kaanib', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_ladmin, format('insert into public.members (local_id, full_name) values (%L, ''T Ibang Local'')', L_FM));
  perform pg_temp.rec('x20: Local Admin ng Medina ay hindi nagdaragdag sa ibang local', not r.ok, coalesce(r.msg, 'natuloy'));

  -- Paghahanap ng kaanib
  -- Inaasahan: M_fm (Active), M_inact2 (Inactive, may aktibong pahintulot), M_inact3 (naging Active).
  -- Hindi kasama: M_inact (nabawi), M_tit (Natitiwalag), M_med (napalitan na ang pangalan).
  v := pg_temp.cnt_as(U_med, 'select count(*) from public.search_members(''T Kaanib'')');
  perform pg_temp.rec('x21: search_members: Active at Inactive-na-may-pahintulot lang (hindi ang Natitiwalag o nabawi)', v = 3, 'nakita=' || v);
  v := pg_temp.cnt_as(U_member, 'select count(*) from public.search_members(''T Kaanib'')');
  perform pg_temp.rec('x22: ordinaryong kaanib ay hindi makagagamit ng search_members', v = -1, 'resulta=' || v);

  -- app_config
  insert into public.app_config (key, value) values ('t_key', 't_value');
  v := pg_temp.cnt_as(U_med, 'select count(*) from public.app_config');
  perform pg_temp.rec('x23: hindi-Admin ay hindi nakakabasa ng app_config', v = 0, 'nakita=' || v);
  select * into r from pg_temp.try_sql(U_med, 'update public.app_config set value = ''hack'' where key = ''t_key''');
  perform pg_temp.rec('x24: hindi-Admin ay hindi nakapagbabago ng app_config', not r.ok or r.cnt = 0, coalesce(r.msg, 'cnt=' || r.cnt));
  select * into r from pg_temp.try_sql(U_admin, 'update public.app_config set value = ''ok'' where key = ''t_key''');
  perform pg_temp.rec('x25: Admin ay nakapagbabago ng app_config', r.ok and r.cnt = 1, coalesce(r.msg, 'cnt=' || r.cnt));

  -- ---------------- #3 (opsyon A): kumpirmasyon ng Admin bago makatanggap ng handog ----------------
  -- Ang Local Admin at ang Administrative Ministry ay nagdaragdag ng kaanib: hindi pa kumpirmado
  select * into r from pg_temp.try_sql(U_ladmin, format('insert into public.members (id, local_id, full_name) values (%L, %L, ''T Bago Mula sa LocalAdmin'')', M_pend1, L_MED));
  select confirmed_at is null and confirmed_by is null into v_b from public.members where id = M_pend1;
  perform pg_temp.rec('cf1: kaanib na idinagdag ng Local Admin ay hindi pa kumpirmado', r.ok and coalesce(v_b, false), coalesce(r.msg, 'unconfirmed=' || coalesce(v_b::text, 'walang row')));
  select * into r from pg_temp.try_sql(U_adminmin, format('insert into public.members (id, local_id, full_name) values (%L, %L, ''T Bago Mula sa Administrative'')', M_pend2, L_MED));
  select confirmed_at is null and confirmed_by is null into v_b from public.members where id = M_pend2;
  perform pg_temp.rec('cf2: kaanib na idinagdag ng Administrative Ministry ay hindi pa kumpirmado', r.ok and coalesce(v_b, false), coalesce(r.msg, 'unconfirmed=' || coalesce(v_b::text, 'walang row')));

  -- Hindi makapagtatakda ng confirmed_at/by sa INSERT ang hindi Admin (column privilege)
  select * into r from pg_temp.try_sql(U_ladmin, format('insert into public.members (id, local_id, full_name, confirmed_at) values (%L, %L, ''T Sariling Kumpirma'', now())', gen_random_uuid(), L_MED));
  perform pg_temp.rec('cf3: Local Admin ay hindi makapagtatakda ng confirmed_at sa pagdaragdag', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_ladmin, format('insert into public.members (id, local_id, full_name, confirmed_by) values (%L, %L, ''T Sariling Kumpirma 2'', %L)', gen_random_uuid(), L_MED, U_admin));
  perform pg_temp.rec('cf3b: Local Admin ay hindi makapagtatakda ng confirmed_by sa pagdaragdag', not r.ok, coalesce(r.msg, 'natuloy'));

  -- Tinatanggihan ang Ambagan/Tulong/Pasalamat para sa hindi pa kumpirmado
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins_amb(L_MED, M_pend1, 10, current_date));
  perform pg_temp.rec('cf4a: Ambagan para sa hindi kumpirmadong kaanib ay tinatanggihan (may malinaw na mensahe)', not r.ok and r.msg ilike '%kinukumpirma%', coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_med,
    format('insert into public.tulong_klase_records (local_id, member_id, period_month, amount, date_received) values (%L, %L, %L, 20, %L)', L_MED, M_pend1, date_trunc('month', current_date)::date, current_date));
  perform pg_temp.rec('cf4b: Tulong para sa hindi kumpirmadong kaanib ay tinatanggihan', not r.ok and r.msg ilike '%kinukumpirma%', coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_med,
    format('insert into public.pasalamat_records (local_id, member_id, type, date, amount) values (%L, %L, ''extra'', %L, 30)', L_MED, M_pend1, current_date));
  perform pg_temp.rec('cf4c: Pasalamat para sa hindi kumpirmadong kaanib ay tinatanggihan', not r.ok and r.msg ilike '%kinukumpirma%', coalesce(r.msg, 'natuloy'));

  -- Hindi lumalabas sa search_members
  v := pg_temp.cnt_as(U_med, 'select count(*) from public.search_members(''T Bago Mula'')');
  perform pg_temp.rec('cf5: hindi kumpirmado ay wala sa search_members', v = 0, 'nakita=' || v);

  -- Roster: nakikita ng Local Admin/Administrative ang idinagdag, may marka (confirmed_at is null)
  v := pg_temp.cnt_as(U_ladmin, format('select count(*) from public.members where id = %L and confirmed_at is null', M_pend1));
  perform pg_temp.rec('cf6: Local Admin ay nakikita sa roster ang sarili niyang idinagdag na naghihintay ng kumpirmasyon', v = 1, 'nakita=' || v);
  v := pg_temp.cnt_as(U_adminmin, format('select count(*) from public.members where id = %L and confirmed_at is null', M_pend2));
  perform pg_temp.rec('cf6b: Administrative ay nakikita sa roster ang sarili niyang idinagdag na naghihintay ng kumpirmasyon', v = 1, 'nakita=' || v);

  -- Hindi makakonfirma ang sinuman maliban sa Admin (direktang update AT confirm_member), kasama ang sarili niyang idinagdag
  for r in select * from (values
      ('Local Admin (kasama ang sarili niyang idinagdag na row)', U_ladmin),
      ('Administrative', U_adminmin),
      ('Local Finance', U_med),
      ('church-wide Finance (sintetiko)', U_cw),
      ('Church-wide Finance 1', '68944d26-3e21-4880-b14e-1eef1c06cbce'::uuid),
      ('Church-wide Finance 2', '600fec92-6c76-4cb3-84eb-f46644c8a539'::uuid)) as x(lbl, uid) loop
    select * into rr from pg_temp.try_sql(r.uid, format('update public.members set confirmed_at = now(), confirmed_by = %L where id = %L', r.uid, M_pend1));
    select confirmed_at is null into v_b from public.members where id = M_pend1;
    perform pg_temp.rec('cf7a: ' || r.lbl || ': direktang update ng confirmed_at ay tinatanggihan at nanatiling hindi kumpirmado', (not rr.ok or rr.cnt = 0) and v_b, coalesce(rr.msg, 'cnt=' || rr.cnt) || ' unconfirmed=' || v_b);
    select * into rr from pg_temp.try_sql(r.uid, format('select public.confirm_member(%L)', M_pend1));
    select confirmed_at is null into v_b from public.members where id = M_pend1;
    perform pg_temp.rec('cf7b: ' || r.lbl || ': confirm_member() ay tinatanggihan ("Admin lang") at nanatiling hindi kumpirmado', not rr.ok and rr.msg ilike '%Admin lang%' and v_b, coalesce(rr.msg, 'natuloy') || ' unconfirmed=' || v_b);
  end loop;
  -- Ikalawang antas (trigger) nang hiwalay sa column privilege: postgres na may claims ng user
  select * into rr from pg_temp.try_sql_claims(U_ladmin, format('update public.members set confirmed_at = now(), confirmed_by = %L where id = %L', U_ladmin, M_pend1));
  select confirmed_at is null into v_b from public.members where id = M_pend1;
  perform pg_temp.rec('cf8a: trigger members_rules ay tumatanggi sa Local Admin (walang column privilege) at nanatiling hindi kumpirmado', not rr.ok and rr.msg ilike '%Admin lang%' and v_b, coalesce(rr.msg, 'natuloy') || ' unconfirmed=' || v_b);
  select * into rr from pg_temp.try_sql_claims(U_cw, format('update public.members set confirmed_at = now() where id = %L', M_pend1));
  select confirmed_at is null into v_b from public.members where id = M_pend1;
  perform pg_temp.rec('cf8b: trigger members_rules ay tumatanggi sa church-wide Finance', not rr.ok and rr.msg ilike '%Admin lang%' and v_b, coalesce(rr.msg, 'natuloy') || ' unconfirmed=' || v_b);
  -- Kahit ang Admin ay hindi makapagpapalsipika sa pamamagitan ng direktang update (kailangan ang confirm_member)
  select * into rr from pg_temp.try_sql(U_admin, format('update public.members set confirmed_at = now(), confirmed_by = %L where id = %L', U_admin, M_pend2));
  select confirmed_at is null into v_b from public.members where id = M_pend2;
  perform pg_temp.rec('cf8c: kahit ang Admin ay hindi makapagtatakda ng confirmed_at nang direkta (confirm_member lang)', (not rr.ok or rr.cnt = 0) and v_b, coalesce(rr.msg, 'cnt=' || rr.cnt) || ' unconfirmed=' || v_b);

  -- Ang Admin ang nagkumpirma: tanggap na ang record; may audit na mababasa ng Admin
  select * into rr from pg_temp.try_sql(U_admin, format('select public.confirm_member(%L)', M_pend1));
  select confirmed_at is not null and confirmed_by = U_admin into v_b from public.members where id = M_pend1;
  perform pg_temp.rec('cf9: Admin ay nakakakumpirma sa pamamagitan ng confirm_member() (nakatala ang confirmed_by)', rr.ok and coalesce(v_b, false), coalesce(rr.msg, 'confirmed=' || coalesce(v_b::text, 'null')));
  v := pg_temp.cnt_as(U_admin, format('select count(*) from public.finance_audit_log where table_name = ''members'' and record_id = %L and old_values ->> ''confirmed_at'' is null and new_values ->> ''confirmed_at'' is not null and changed_by = %L', M_pend1::text, U_admin));
  perform pg_temp.rec('cf10: ang kumpirmasyon ay nasa finance_audit_log at mababasa ng Admin', v = 1, 'nakita=' || v);
  v := pg_temp.cnt_as(U_ladmin, format('select count(*) from public.finance_audit_log where record_id = %L', M_pend1::text));
  perform pg_temp.rec('cf10b: hindi mababasa ng Local Admin ang audit ng kumpirmasyon', v = 0, 'nakita=' || v);
  select * into rr from pg_temp.try_sql(U_admin, format('select public.confirm_member(%L)', M_pend1));
  perform pg_temp.rec('cf11: ang muling pagkumpirma ay may malinaw na mensahe', not rr.ok and rr.msg ilike '%Walang kaanib%', coalesce(rr.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins_amb(L_MED, M_pend1, 10, current_date));
  perform pg_temp.rec('cf12: pagkatapos ng kumpirmasyon, tanggap na ang Ambagan', r.ok, r.msg);
  v := pg_temp.cnt_as(U_med, 'select count(*) from public.search_members(''T Bago Mula sa LocalAdmin'')');
  perform pg_temp.rec('cf13: at lumalabas na sa search_members', v = 1, 'nakita=' || v);

  -- Kaanib na idinagdag ng Admin (kasama ang unang import na may tahasang status): kumpirmado agad
  select * into r from pg_temp.try_sql(U_admin, format('insert into public.members (id, local_id, full_name, status, status_reason) values (%L, %L, ''T Idinagdag ng Admin'', ''Active'', null)', M_adm1, L_MED));
  select confirmed_at is not null and confirmed_by = U_admin into v_b from public.members where id = M_adm1;
  perform pg_temp.rec('cf14: kaanib na idinagdag ng Admin ay kumpirmado agad', r.ok and coalesce(v_b, false), coalesce(r.msg, 'confirmed=' || coalesce(v_b::text, 'null')));
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins_amb(L_MED, M_adm1, 10, current_date));
  perform pg_temp.rec('cf15: tanggap agad ang Ambagan para sa idinagdag ng Admin', r.ok, r.msg);
  select * into r from pg_temp.try_sql(U_admin, format('insert into public.members (id, local_id, full_name, status, status_reason) values (%L, %L, ''T Import ng Admin Inactive'', ''Inactive'', ''unang import'')', M_adm2, L_MED));
  select confirmed_at is not null and status::text = 'Inactive' into v_b from public.members where id = M_adm2;
  perform pg_temp.rec('cf16: unang import ng Admin na may tahasang status: kumpirmado, at nasa itinakdang status', r.ok and coalesce(v_b, false), coalesce(r.msg, 'ok=' || coalesce(v_b::text, 'null')));

  -- Draft na naka-encode na, tapos hindi na kumpirmado: hindi maipapadala (parehong prinsipyo ng x28)
  insert into public.members (id, local_id, full_name, status) values (M_x2, L_MED, 'T Kaanib X2', 'Active');
  update public.members set confirmed_at = now(), confirmed_by = U_admin where id = M_x2;
  insert into public.ambagan_records (local_id, member_id, period_month, amount, date_received, encoded_by)
  values (L_MED, M_x2, date '2026-09-01', 15, date '2026-09-13', U_med) returning id into X2;
  update public.members set confirmed_at = null, confirmed_by = null where id = M_x2;
  select * into r from pg_temp.try_sql(U_med, format('update public.ambagan_records set status = ''submitted'' where id = %L', X2));
  perform pg_temp.rec('cf17: hindi maipapadala ang draft ng kaanib na naging hindi kumpirmado', not r.ok and r.msg ilike '%kinukumpirma%', coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_med, format('update public.ambagan_records set amount = 16 where id = %L', X2));
  perform pg_temp.rec('cf17b: (kontrol) ang pag-edit ng halaga ng draft na hindi nagbabago ang kaanib o petsa ay hindi sinusuri muli', r.ok and r.cnt = 1, coalesce(r.msg, 'cnt=' || r.cnt));
  select * into rr from pg_temp.try_sql(U_admin, format('select public.confirm_member(%L)', M_x2));
  select * into r from pg_temp.try_sql(U_med, format('update public.ambagan_records set status = ''submitted'' where id = %L', X2));
  perform pg_temp.rec('cf18: pagkatapos ng kumpirmasyon, maipapadala na', rr.ok and r.ok and r.cnt = 1, coalesce(rr.msg, coalesce(r.msg, 'cnt=' || r.cnt)));
  -- Pagpapalit ng member_id ng draft sa hindi kumpirmadong kaanib ay tinatanggihan din (UPDATE)
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins_amb(L_MED, M_med, 11, date '2026-09-21'));
  perform pg_temp.rec('cf19a: (kontrol) draft para sa kumpirmadong kaanib', r.ok, r.msg);
  select * into r from pg_temp.try_sql(U_med, format('update public.ambagan_records set member_id = %L where local_id = %L and amount = 11 and status = ''draft''', M_pend2, L_MED));
  perform pg_temp.rec('cf19: hindi mapapalitan ang member_id ng draft sa hindi kumpirmadong kaanib', not r.ok and r.msg ilike '%kinukumpirma%', coalesce(r.msg, 'natuloy cnt=' || r.cnt));

  -- ---------------- #3 karagdagan (1): pagbabago ng PAGKAKAKILANLAN ng kumpirmadong kaanib ng hindi Admin ----------------
  -- Pinili: ang pag-edit ay tinatanggap pero NAWAWALA ang kumpirmasyon (fail-closed); ang local_id ay tinatanggihan.
  insert into public.members (id, local_id, full_name) values
    (M_ren, L_MED, 'T Rename Isa'), (M_ren2, L_MED, 'T Rename Dalawa'), (M_ren3, L_MED, 'T Rename Tatlo'), (M_fmt, L_MED, 'T Format Lang');
  update public.members set confirmed_at = now(), confirmed_by = U_admin where id in (M_ren, M_ren2, M_ren3, M_fmt);
  select count(*) into v from public.members where id in (M_ren, M_ren2, M_ren3, M_fmt) and confirmed_at is not null and confirmed_by = U_admin;
  perform pg_temp.rec('rn0: (kontrol) kumpirmado ang 4 na fixture bago ang mga pagbabago', v = 4, 'kumpirmado=' || v);

  select * into r from pg_temp.try_sql(U_ladmin, format('update public.members set full_name = ''T Rename Isa Binago'' where id = %L', M_ren));
  select confirmed_at is null and confirmed_by is null into v_b from public.members where id = M_ren;
  perform pg_temp.rec('rn1: Local Admin: pagpapalit ng pangalan ng kumpirmadong kaanib ay tinatanggap pero nawawala ang kumpirmasyon (null/null)', r.ok and r.cnt = 1 and coalesce(v_b, false), coalesce(r.msg, 'cnt=' || r.cnt || ' reset=' || coalesce(v_b::text, 'null')));
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins_amb(L_MED, M_ren, 10, current_date));
  perform pg_temp.rec('rn2: pagkatapos ng pagpapalit ng pangalan, tinatanggihan ang handog (may malinaw na mensahe)', not r.ok and r.msg ilike '%kinukumpirma%', coalesce(r.msg, 'natuloy'));
  v := pg_temp.cnt_as(U_admin, format('select count(*) from public.finance_audit_log where table_name = ''members'' and record_id = %L and old_values ->> ''confirmed_at'' is not null and new_values ->> ''confirmed_at'' is null', M_ren::text));
  perform pg_temp.rec('rn3: ang pagkawala ng kumpirmasyon ay nasa audit at mababasa ng Admin', v = 1, 'nakita=' || v);

  select * into r from pg_temp.try_sql(U_adminmin, format('update public.members set full_name = ''T Rename Dalawa Binago'' where id = %L', M_ren2));
  select confirmed_at is null and confirmed_by is null into v_b from public.members where id = M_ren2;
  perform pg_temp.rec('rn4: Administrative Ministry: pagpapalit ng pangalan ay nag-re-reset din ng kumpirmasyon', r.ok and r.cnt = 1 and coalesce(v_b, false), coalesce(r.msg, 'cnt=' || r.cnt || ' reset=' || coalesce(v_b::text, 'null')));

  select * into r from pg_temp.try_sql(U_ladmin, format('update public.members set profile_id = %L where id = %L', U_member, M_ren3));
  select confirmed_at is null and confirmed_by is null into v_b from public.members where id = M_ren3;
  perform pg_temp.rec('rn5: pagpapalit ng naka-link na profile ng kumpirmadong kaanib ay nag-re-reset ng kumpirmasyon', r.ok and r.cnt = 1 and coalesce(v_b, false), coalesce(r.msg, 'cnt=' || r.cnt || ' reset=' || coalesce(v_b::text, 'null')));

  select * into r from pg_temp.try_sql(U_ladmin, format('update public.members set full_name = %L where id = %L', '  t   FORMAT lang ', M_fmt));
  select confirmed_at is not null and confirmed_by = U_admin into v_b from public.members where id = M_fmt;
  perform pg_temp.rec('rn6: pagbabago lang ng malaki/maliit na titik at espasyo ay HINDI nag-re-reset', r.ok and r.cnt = 1 and coalesce(v_b, false), coalesce(r.msg, 'cnt=' || r.cnt || ' kumpirmado=' || coalesce(v_b::text, 'null')));
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins_amb(L_MED, M_fmt, 10, current_date));
  perform pg_temp.rec('rn6b: at tanggap pa rin ang handog para sa kanya', r.ok, r.msg);

  select * into r from pg_temp.try_sql(U_ladmin, format('update public.members set local_id = %L where id = %L', L_FM, M_fmt));
  select local_id = L_MED and confirmed_at is not null into v_b from public.members where id = M_fmt;
  perform pg_temp.rec('rn7: pagpapalit ng local_id ng kumpirmadong kaanib ng Local Admin ay TINATANGGIHAN (Admin lang) at walang nagbago', not r.ok and r.msg ilike '%Admin lang%' and coalesce(v_b, false), coalesce(r.msg, 'natuloy') || ' ligtas=' || coalesce(v_b::text, 'null'));
  select * into r from pg_temp.try_sql(U_adminmin, format('update public.members set local_id = %L where id = %L', L_FM, M_fmt));
  select local_id = L_MED and confirmed_at is not null into v_b from public.members where id = M_fmt;
  perform pg_temp.rec('rn7b: gayundin ang Administrative Ministry', not r.ok and coalesce(v_b, false), coalesce(r.msg, 'natuloy'));

  select * into r from pg_temp.try_sql(U_admin, format('update public.members set full_name = ''T Format Lang (Admin nag-edit)'' where id = %L', M_fmt));
  select confirmed_at is not null and confirmed_by = U_admin into v_b from public.members where id = M_fmt;
  perform pg_temp.rec('rn8: ang pag-edit ng pangalan ng mismong Admin ay HINDI nag-re-reset', r.ok and r.cnt = 1 and coalesce(v_b, false), coalesce(r.msg, 'cnt=' || r.cnt || ' kumpirmado=' || coalesce(v_b::text, 'null')));

  select * into r from pg_temp.try_sql(U_ladmin, format('update public.members set full_name = ''T Bago Mula sa Administrative (typo)'' where id = %L', M_pend2));
  select confirmed_at is null into v_b from public.members where id = M_pend2;
  perform pg_temp.rec('rn9: ang hindi pa kumpirmadong kaanib ay maaaring i-edit ng roster manager at nananatiling hindi kumpirmado', r.ok and r.cnt = 1 and coalesce(v_b, false), coalesce(r.msg, 'cnt=' || r.cnt));

  select * into rr from pg_temp.try_sql(U_admin, format('select public.confirm_member(%L)', M_ren));
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins_amb(L_MED, M_ren, 10, current_date));
  perform pg_temp.rec('rn10: pagkatapos ng muling pagkumpirma ng Admin, tanggap na ulit ang handog', rr.ok and r.ok, coalesce(rr.msg, r.msg));

  -- ---------------- #3 karagdagan (2): ang confirmed_at/by sa INSERT ay itinatakda LANG ng trigger ----------------
  -- (a) hindi-Admin na may JWT, kahit lampasan ang column privilege (postgres na may claims): ang ipinasa ay binabalewala
  select * into r from pg_temp.try_sql_claims(U_ladmin,
    format('insert into public.members (id, local_id, full_name, confirmed_at, confirmed_by) values (%L, %L, ''T Ins Hindi-Admin'', now(), %L)', gen_random_uuid(), L_MED, U_admin));
  select confirmed_at is null and confirmed_by is null into v_b from public.members where full_name = 'T Ins Hindi-Admin';
  perform pg_temp.rec('ins1: INSERT ng hindi-Admin: ang ipinasang confirmed_at/by ay binabalewala (null/null)', r.ok and coalesce(v_b, false), coalesce(r.msg, 'null=' || coalesce(v_b::text, 'walang row')));
  -- (b) Admin na may JWT: itinatakda ng trigger (ngayon at si Admin), hindi ang ipinasang lumang petsa at ibang tao
  select * into r from pg_temp.try_sql_claims(U_admin,
    format('insert into public.members (id, local_id, full_name, confirmed_at, confirmed_by) values (%L, %L, ''T Ins Admin'', timestamptz ''2000-01-01'', %L)', gen_random_uuid(), L_MED, U_ladmin));
  select confirmed_by = U_admin and confirmed_at > now() - interval '1 minute' into v_b from public.members where full_name = 'T Ins Admin';
  perform pg_temp.rec('ins2: INSERT ng Admin: ang trigger ang nagtatakda (oras ngayon, si Admin), hindi ang ipinasa', r.ok and coalesce(v_b, false), coalesce(r.msg, 'stamped=' || coalesce(v_b::text, 'walang row')));
  -- (c) walang JWT (SQL editor/service role): hindi rin tumatanggap
  insert into public.members (id, local_id, full_name, confirmed_at, confirmed_by) values (gen_random_uuid(), L_MED, 'T Ins Walang JWT', now(), U_admin);
  select confirmed_at is null and confirmed_by is null into v_b from public.members where full_name = 'T Ins Walang JWT';
  perform pg_temp.rec('ins3: INSERT na walang JWT (SQL editor/service role): binabalewala rin ang ipinasa', coalesce(v_b, false), 'null=' || coalesce(v_b::text, 'walang row'));
  -- (d) ang trusted na koneksyon ay nagkukumpirma sa hiwalay na UPDATE
  update public.members set confirmed_at = now(), confirmed_by = U_admin where full_name = 'T Ins Walang JWT';
  select confirmed_at is not null and confirmed_by = U_admin into v_b from public.members where full_name = 'T Ins Walang JWT';
  perform pg_temp.rec('ins4: sa trusted na koneksyon, ang hiwalay na UPDATE ay nagkukumpirma', coalesce(v_b, false), 'kumpirmado=' || coalesce(v_b::text, 'null'));
  -- (e) authenticated (API): bawal ang pagpasa ng confirmed_* sa INSERT, kahit ang Admin (column privilege)
  select * into r from pg_temp.try_sql(U_admin,
    format('insert into public.members (id, local_id, full_name, confirmed_at) values (%L, %L, ''T Ins Admin API'', now())', gen_random_uuid(), L_MED));
  perform pg_temp.rec('ins5: sa API, kahit ang Admin ay hindi makapagpapasa ng confirmed_at sa INSERT (column privilege)', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_admin,
    format('insert into public.members (id, local_id, full_name) values (%L, %L, ''T Ins Admin API 2'')', gen_random_uuid(), L_MED));
  select confirmed_by = U_admin into v_b from public.members where full_name = 'T Ins Admin API 2';
  perform pg_temp.rec('ins6: sa API, ang INSERT ng Admin na walang confirmed_* ay kumpirmado ng trigger', r.ok and coalesce(v_b, false), coalesce(r.msg, 'kumpirmado=' || coalesce(v_b::text, 'null')));

  -- ---------------- #2: sino ang nakababasa ng finance_audit_log ----------------
  v := pg_temp.cnt_as(U_admin, 'select count(*) from public.finance_audit_log where table_name = ''giving_permissions''');
  perform pg_temp.rec('au1: Admin ay nakakabasa ng audit ng giving_permissions', v > 0, 'nakita=' || v);
  v := pg_temp.cnt_as(U_admin, 'select count(*) from public.finance_audit_log where table_name = ''members'' and old_values ->> ''status'' = ''Inactive'' and new_values ->> ''status'' = ''Active''');
  perform pg_temp.rec('au2: Admin ay nakakabasa ng audit ng pagbabago ng status ng kaanib', v >= 1, 'nakita=' || v);
  select count(*) into v from public.finance_audit_log
   where table_name = 'members' and operation = 'UPDATE' and old_values ->> 'status' = new_values ->> 'status'
     and old_values ->> 'confirmed_at' is not distinct from new_values ->> 'confirmed_at';
  perform pg_temp.rec('au3: (kontrol) may audit ng members na hindi status ang binago (pagpapalit ng pangalan)', v >= 1, 'rows=' || v);
  v := pg_temp.cnt_as(U_admin, 'select count(*) from public.finance_audit_log where table_name = ''members'' and operation = ''UPDATE'' and old_values ->> ''status'' = new_values ->> ''status'' and old_values ->> ''confirmed_at'' is not distinct from new_values ->> ''confirmed_at''');
  perform pg_temp.rec('au4: Admin ay hindi nakakabasa ng audit ng members na hindi status ang binago', v = 0, 'nakita=' || v);
  v := pg_temp.cnt_as(U_admin, 'select count(*) from public.finance_audit_log where table_name in (''ambagan_records'', ''tulong_klase_records'', ''pasalamat_records'', ''abuluyan_totals'', ''attendance_records'', ''ministry_members'')');
  perform pg_temp.rec('au5: Admin ay walang nakikitang audit ng halaga, attendance, o ministry_members', v = 0, 'nakita=' || v);
  select count(*) into v from public.finance_audit_log where table_name in ('attendance_records', 'abuluyan_totals');
  perform pg_temp.rec('au6: (kontrol) may audit row na ng attendance at abuluyan', v >= 2, 'rows=' || v);
  select count(*) into v from public.finance_audit_log;
  perform pg_temp.rec('au7: church-wide Finance ay nakakabasa ng LAHAT ng audit',
    pg_temp.cnt_as(U_cw, 'select count(*) from public.finance_audit_log') = v, 'kabuuan=' || v);
  v := pg_temp.cnt_as(U_ladmin, 'select count(*) from public.finance_audit_log');
  perform pg_temp.rec('au8: Local Admin ay walang nakikitang audit', v = 0, 'nakita=' || v);
  v := pg_temp.cnt_as(U_med, 'select count(*) from public.finance_audit_log');
  perform pg_temp.rec('au9: Local Finance ay walang nakikitang audit', v = 0, 'nakita=' || v);

  -- ---------------- #1: Admin lang sa Finance, Local Finance, Pastoral ministry ----------------
  for r in select * from (values ('Finance Ministry'), ('Local Finance Ministry'), ('Pastoral Ministry')) as x(mname) loop
    select * into rr from pg_temp.try_sql(U_sec,
      format('insert into public.ministry_members (ministry_id, profile_id) select id, %L::uuid from public.ministries where name = %L', U_sec, r.mname));
    perform pg_temp.rec('p1: secretary ay hindi makapagdaragdag ng sarili sa ' || r.mname, not rr.ok, coalesce(rr.msg, 'natuloy'));
    select * into rr from pg_temp.try_sql(U_ladmin,
      format('insert into public.ministry_members (ministry_id, profile_id) select id, %L::uuid from public.ministries where name = %L', U_ladmin, r.mname));
    perform pg_temp.rec('p2: Local Admin ay hindi makapagdaragdag ng sarili sa ' || r.mname, not rr.ok, coalesce(rr.msg, 'natuloy'));
    select * into rr from pg_temp.try_sql(U_med,
      format('insert into public.ministry_members (ministry_id, profile_id) select id, %L::uuid from public.ministries where name = %L', U_med, r.mname));
    perform pg_temp.rec('p2b: Local Finance ay hindi makapagdaragdag ng sarili sa ' || r.mname, not rr.ok and not exists (
      select 1 from public.ministry_members mm join public.ministries m on m.id = mm.ministry_id where mm.profile_id = U_med and m.name = 'Finance Ministry'), coalesce(rr.msg, 'natuloy'));
  end loop;
  select * into rr from pg_temp.try_sql(U_sec,
    format('insert into public.ministry_members (ministry_id, profile_id) select id, %L::uuid from public.ministries where name = ''Youth Ministry''', U_sec));
  perform pg_temp.rec('p3: secretary ay nakapagdaragdag pa rin sa hindi-protektadong ministry (Youth)', rr.ok and rr.cnt = 1, coalesce(rr.msg, 'cnt=' || rr.cnt));
  select * into rr from pg_temp.try_sql(U_sec, format('update public.ministry_members set is_leader = true where profile_id = %L', U_past2));
  perform pg_temp.rec('p4: secretary ay hindi makapagpapalit ng is_leader sa Pastoral Ministry', not rr.ok or rr.cnt = 0, coalesce(rr.msg, 'cnt=' || rr.cnt));
  select * into rr from pg_temp.try_sql(U_sec, format('delete from public.ministry_members where profile_id = %L', U_med));
  select count(*) into v from public.ministry_members where profile_id = U_med;
  perform pg_temp.rec('p5: secretary ay hindi makapag-aalis ng kasapi ng Local Finance Ministry', v = 1, 'natira=' || v || ' ' || coalesce(rr.msg, 'cnt=' || rr.cnt));
  select * into rr from pg_temp.try_sql(U_admin,
    format('insert into public.ministry_members (ministry_id, profile_id) select id, %L::uuid from public.ministries where name = ''Pastoral Ministry''', U_member));
  perform pg_temp.rec('p6: Admin ay nakapagdaragdag sa Pastoral Ministry', rr.ok and rr.cnt = 1, coalesce(rr.msg, 'cnt=' || rr.cnt));
  select * into rr from pg_temp.try_sql(U_admin, format('delete from public.ministry_members where profile_id = %L and ministry_id = (select id from public.ministries where name = ''Pastoral Ministry'')', U_member));
  perform pg_temp.rec('p7: Admin ay nakapag-aalis sa Pastoral Ministry', rr.ok and rr.cnt = 1, coalesce(rr.msg, 'cnt=' || rr.cnt));

  -- ---------------- profiles.local_id: hindi makalilipat ng local para makakuha ng access ----------------
  select * into rr from pg_temp.try_sql(U_med, format('update public.profiles set local_id = %L where id = %L', L_FM, U_med));
  perform pg_temp.rec('l1: Local Finance ay hindi makapagpapalit ng sariling local_id', not rr.ok, coalesce(rr.msg, 'natuloy'));
  v := pg_temp.cnt_as(U_med, format('select case when public.can_access_local(%L) then 1 else 0 end', L_FM));
  perform pg_temp.rec('l2: at wala pa ring access sa Fort McMurray', v = 0, 'nakita=' || v);
  select * into rr from pg_temp.try_sql(U_member, format('update public.profiles set local_id = %L where id = %L', L_FM, U_member));
  perform pg_temp.rec('l3: ordinaryong kaanib ay hindi makapagpapalit ng sariling local_id', not rr.ok, coalesce(rr.msg, 'natuloy'));
  select * into rr from pg_temp.try_sql(U_sec, format('update public.profiles set local_id = %L where id = %L', L_FM, U_med));
  perform pg_temp.rec('l4: secretary ay hindi makapagpapalit ng local ng kasapi ng Local Finance', not rr.ok and rr.msg ilike '%Admin lang%', coalesce(rr.msg, 'natuloy'));
  select * into rr from pg_temp.try_sql(U_sec, format('update public.profiles set local_id = %L where id = %L', L_FM, U_member));
  perform pg_temp.rec('l5: secretary ay nakapagpapalit ng local ng ordinaryong profile', rr.ok and rr.cnt = 1, coalesce(rr.msg, 'cnt=' || rr.cnt));
  select * into rr from pg_temp.try_sql(U_admin, format('update public.profiles set local_id = %L where id = %L', L_ST, U_fm));
  perform pg_temp.rec('l6: Admin ay nakapagpapalit ng local ng kasapi ng Local Finance', rr.ok and rr.cnt = 1, coalesce(rr.msg, 'cnt=' || rr.cnt));

  -- ---------------- Review Focus ----------------
  -- x26: Finance Ministry na walang local_id ay walang access saanman
  v := pg_temp.cnt_as(U_nolocal, format('select (select count(*) from public.ambagan_records) + case when public.can_access_local(%L) then 1 else 0 end', L_MED));
  perform pg_temp.rec('x26: Finance Ministry na walang local_id ay walang access', v = 0, 'nakita=' || v);

  -- x28: draft na na-encode habang Active, tapos naging Inactive bago "Ipadala"
  insert into public.members (id, local_id, full_name, status) values (M_x, L_MED, 'T Kaanib X', 'Active');
  update public.members set confirmed_at = now(), confirmed_by = U_admin where id = M_x;
  insert into public.ambagan_records (local_id, member_id, period_month, amount, date_received, encoded_by)
  values (L_MED, M_x, date '2026-09-01', 25, date '2026-09-13', U_med) returning id into X1;
  update public.members set status = 'Inactive' where id = M_x;
  select * into r from pg_temp.try_sql(U_med, format('update public.ambagan_records set status = ''submitted'' where id = %L', X1));
  perform pg_temp.rec('x28: hindi maipapadala ang draft ng kaanib na naging Inactive (walang pahintulot)', not r.ok and r.msg ilike '%hindi aktibo%', coalesce(r.msg, 'natuloy'));

  -- x29: church-wide ay hindi makapagpapalit ng member_id ng submitted sa Natitiwalag
  select * into r from pg_temp.try_sql(U_cw, format('update public.ambagan_records set member_id = %L where id = %L', M_tit, A1));
  perform pg_temp.rec('x29: hindi mapapalitan ang member_id ng submitted sa Natitiwalag', not r.ok and r.msg ilike '%natitiwalag%', coalesce(r.msg, 'natuloy'));

  -- x30: hindi mapapalitan ang petsa ng Abuluyan sa hindi Linggo
  select * into r from pg_temp.try_sql(U_med, format('update public.abuluyan_totals set service_date = %L where local_id = %L', date '2026-09-07', L_MED));
  perform pg_temp.rec('x30: hindi mapapalitan ang petsa ng Abuluyan sa hindi Linggo', not r.ok and r.msg ilike '%Linggo%', coalesce(r.msg, 'natuloy'));

  -- x27: Finance na inactive ang profile ay nawawalan ng access
  update public.profiles set status = 'inactive' where id = U_fm;
  v := pg_temp.cnt_as(U_fm, 'select count(*) from public.ambagan_records');
  perform pg_temp.rec('x27: Finance na inactive ang profile ay walang access', v = 0, 'nakita=' || v);

  -- ---------------- 018: proteksyon ng mga ministry mismo ----------------
  for r in select * from (values ('Finance Ministry'), ('Local Finance Ministry'), ('Pastoral Ministry')) as x(nm) loop
    select * into rr from pg_temp.try_sql(U_sec, format('delete from public.ministries where name = %L', r.nm));
    perform pg_temp.rec('m1: secretary ay hindi makabubura ng ' || r.nm, not rr.ok and rr.msg ilike '%hindi mabubura%', coalesce(rr.msg, 'natuloy cnt=' || rr.cnt));
    select * into rr from pg_temp.try_sql(U_admin, format('delete from public.ministries where name = %L', r.nm));
    perform pg_temp.rec('m2: kahit Admin ay hindi makabubura ng ' || r.nm || ' sa API', not rr.ok and rr.msg ilike '%hindi mabubura%', coalesce(rr.msg, 'natuloy cnt=' || rr.cnt));
    select * into rr from pg_temp.try_sql(U_sec, format('update public.ministries set name = %L where name = %L', 'Iba', r.nm));
    perform pg_temp.rec('m3: secretary ay hindi makapagpapalit ng pangalan ng ' || r.nm, not rr.ok and rr.msg ilike '%hindi mapapalitan%', coalesce(rr.msg, 'natuloy cnt=' || rr.cnt));
    select * into rr from pg_temp.try_sql(U_sec, format('insert into public.ministries (name) values (%L)', r.nm));
    perform pg_temp.rec('m4: secretary ay hindi makagagawa ng kambal na ' || r.nm, not rr.ok and rr.msg ilike '%hindi puwedeng gumawa%', coalesce(rr.msg, 'natuloy'));
  end loop;
  select * into rr from pg_temp.try_sql(U_sec, 'insert into public.ministries (name) values (''  finance MINISTRY '')');
  perform pg_temp.rec('m5: kahawig na pangalan (malaki/maliit, espasyo) ay tinatanggihan', not rr.ok and rr.msg ilike '%hindi puwedeng gumawa%', coalesce(rr.msg, 'natuloy'));
  select * into rr from pg_temp.try_sql(U_sec, 'insert into public.ministries (name) values (''T Ordinaryong Ministry'')');
  perform pg_temp.rec('m6: ang ordinaryong ministry ay nagagawa pa rin ng secretary', rr.ok, rr.msg);
  select * into rr from pg_temp.try_sql(U_sec, 'update public.ministries set name = ''T Ordinaryong Ministry 2'' where name = ''T Ordinaryong Ministry''');
  perform pg_temp.rec('m7: ang ordinaryong ministry ay napapalitan pa rin ng pangalan', rr.ok and rr.cnt = 1, coalesce(rr.msg, 'cnt=' || rr.cnt));
  select * into rr from pg_temp.try_sql(U_sec, 'update public.ministries set name = ''Finance Ministry'' where name = ''T Ordinaryong Ministry 2''');
  perform pg_temp.rec('m8: hindi maaaring palitan ang ordinaryong ministry papunta sa pangalang protektado (butas 2)', not rr.ok and rr.msg ilike '%hindi mapapalitan%', coalesce(rr.msg, 'natuloy cnt=' || rr.cnt));
  select * into rr from pg_temp.try_sql(U_sec, 'delete from public.ministries where name = ''T Ordinaryong Ministry 2''');
  perform pg_temp.rec('m9: ang ordinaryong ministry ay nabubura pa rin', rr.ok and rr.cnt = 1, coalesce(rr.msg, 'cnt=' || rr.cnt));
  select count(*) into v from public.ministries where name in ('Finance Ministry', 'Local Finance Ministry', 'Pastoral Ministry');
  perform pg_temp.rec('m10: nananatili ang tatlong protektadong ministry (eksaktong 3)', v = 3, 'nakita=' || v);
  select count(*) into v from public.ministry_members where profile_id = U_cw and ministry_id = MIN_FIN and finance_scope = 'church_wide';
  perform pg_temp.rec('m11: nananatili ang church-wide na kasapi', v = 1, 'nakita=' || v);
  select * into rr from pg_temp.try_sql(U_admin, 'update public.ministries set created_at = created_at where name = ''Finance Ministry''');
  perform pg_temp.rec('m12: ang pagbabago ng ibang column (hindi pangalan, hal. created_at) ay hindi hinaharang', rr.ok, rr.msg);

  -- ---------------- 011: nananatili ang 4 na default na thanksgiving_types (desisyon ng Admin) ----------------
  select count(*) into v from public.thanksgiving_types;
  perform pg_temp.rec('z1: ang 4 na default na thanksgiving_types ay nananatili pagkatapos ng 011', v = 4, 'nakita=' || v);

  -- ---------------- ULAT ----------------
  select string_agg(format('%s [%s] %s%s', n, case when ok then 'PASS' else 'FAIL' end, label,
                           case when ok then '' else '  :: ' || coalesce(detail, '') end), E'\n' order by n),
         count(*) filter (where ok), count(*) filter (where not ok)
    into v_report, v_pass, v_fail
  from t_results;

  raise exception E'\n=== ULAT NG PAGSUBOK (nabawi ang transaction; walang naiwan) ===\n%\n=== PASS=% FAIL=% ===', v_report, v_pass, v_fail;
end
$test$;
