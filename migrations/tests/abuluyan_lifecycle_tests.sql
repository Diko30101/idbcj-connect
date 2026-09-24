-- =====================================================================
-- Pagsubok ng lifecycle ng Abuluyan (Phase 2, hakbang 1) -- para sa 019_abuluyan_lifecycle.sql
--
-- PAANO PATAKBUHIN: LOKAL na stack lamang, pagkatapos ng 010-013, 016, 018 at 019.
-- (Isinulat BAGO ang 019: inaasahang pumapalya ang mga test na nagsusuri ng bagong asal.)
-- Sintetikong user lang; ang buong script ay nasa isang transaction na laging NABABAWI at
-- ang ulat (PASS/FAIL) ay lalabas bilang sinadyang exception.
--
-- Kailangan ng 019: locals.timezone (walang default), public.local_today(tz, at), mga column
-- na submitted_at, submitted_by, voided_at, voided_by, void_reason, replaces_id.
-- =====================================================================

create temp table t_results (n serial, label text, ok boolean, detail text);

create function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  execute 'set local role authenticated';
end $$;

create function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

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
    -- Ang error na "wala ang function/column/table" ay HINDI pagtanggi ng patakaran: markahan para hindi pumasa nang huwad
    v_ok := false; v_cnt := 0;
    v_msg := case when sqlstate in ('42883', '42703', '42P01') then 'ERR-MISSING: ' else '' end || sqlerrm;
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

-- Halaga (text) bilang postgres; 'ERR: ...' kung nag-error (para hindi mag-abort ang buong suite bago ang 019)
create function pg_temp.val(p_sql text) returns text language plpgsql as $$
declare v text;
begin
  begin
    execute p_sql into v;
  exception when others then
    v := 'ERR: ' || sqlerrm;
  end;
  return v;
end $$;

-- Bilang (bigint) mula sa dynamic na query; -1 kung nag-error (hal. wala pa ang column bago ang 019)
create function pg_temp.n(p_sql text) returns bigint language plpgsql as $$
declare v bigint;
begin
  begin
    execute p_sql into v;
  exception when others then
    v := -1;
  end;
  return v;
end $$;

create function pg_temp.rec(p_label text, p_ok boolean, p_detail text default '') returns void language plpgsql as $$
begin
  insert into t_results (label, ok, detail)
  values (p_label, coalesce(p_ok, false) and coalesce(p_detail, '') not like '%ERR-MISSING:%', p_detail);
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

create function pg_temp.ins(p_local uuid, p_date date, p_amount numeric default null, p_extra_cols text default '', p_extra_vals text default '') returns text language sql as $$
  select format('insert into public.abuluyan_totals (local_id, service_date, total_amount%s) values (%L, %L, %s%s)',
                p_extra_cols, p_local, p_date, coalesce(p_amount::text, 'null'), p_extra_vals)
$$;

create function pg_temp.vd(p_local uuid, p_date date, p_reason text) returns text language sql as $$
  select format('select public.void_abuluyan(%L, %L, %L)', p_local, p_date, p_reason)
$$;

create function pg_temp.rid(p_local uuid, p_date date, p_status text default null) returns uuid language sql as $$
  select id from public.abuluyan_totals
   where local_id = p_local and service_date = p_date and (p_status is null or status::text = p_status)
   order by created_at desc limit 1
$$;

do $test$
declare
  L_MED uuid; L_FM uuid; L_ST uuid; L_OT uuid;
  U_med uuid := gen_random_uuid();     -- Local Finance Medina (Asia/Manila)
  U_fm uuid := gen_random_uuid();      -- Local Finance Fort McMurray (America/Edmonton)
  U_cw uuid := gen_random_uuid();      -- sintetikong church-wide Finance
  U_admin uuid := gen_random_uuid();   -- Admin (role=admin)
  U_ladmin uuid := gen_random_uuid();  -- Local Admin Ministry (Medina)
  U_member uuid := gen_random_uuid();  -- ordinaryong kaanib
  MIN_FIN uuid;
  tod_m date := (now() at time zone 'Asia/Manila')::date;
  F date;                              -- susunod na Linggo (hinaharap para sa lahat ng timezone)
  S1 date; S2 date; S3 date; S4 date; S5 date; S6 date;  -- mga nakaraang Linggo
  r record; rr record; v bigint; t text;
  R1 uuid; R2 uuid; R3 uuid; R4 uuid; RFM uuid; RREP uuid; RVFM uuid;
  n_before bigint; v_report text; v_pass int; v_fail int;
begin
  select id into L_MED from public.locals where key = 'medina';
  select id into L_FM from public.locals where key = 'fort_mcmurray';
  select id into L_ST from public.locals where key = 'sto_tomas';
  select id into L_OT from public.locals where key = 'other';
  select id into MIN_FIN from public.ministries where name = 'Finance Ministry';

  F  := tod_m + (7 - extract(dow from tod_m)::int);
  S1 := tod_m - extract(dow from tod_m)::int - 7;
  S2 := S1 - 7; S3 := S1 - 14; S4 := S1 - 21; S5 := S1 - 28; S6 := S1 - 35;

  -- ---------------- FIXTURES (postgres, walang JWT) ----------------
  perform pg_temp.mk_user(U_med, 'T Local Finance Medina', 'member', L_MED);
  perform pg_temp.mk_user(U_fm, 'T Local Finance FM', 'member', L_FM);
  perform pg_temp.mk_user(U_cw, 'T Church-wide Finance', 'member', L_MED);
  perform pg_temp.mk_user(U_admin, 'T Admin', 'admin', L_FM);
  perform pg_temp.mk_user(U_ladmin, 'T Local Admin Medina', 'member', L_MED);
  perform pg_temp.mk_user(U_member, 'T Ordinaryong Kaanib', 'member', L_MED);
  perform pg_temp.mk_mm('Local Finance Ministry', U_med);
  perform pg_temp.mk_mm('Local Finance Ministry', U_fm);
  perform pg_temp.mk_mm('Finance Ministry', U_cw);
  perform pg_temp.mk_mm('Local Admin Ministry', U_ladmin);
  update public.ministry_members set finance_scope = 'church_wide' where profile_id = U_cw and ministry_id = MIN_FIN;

  -- ================= 1. TIMEZONE NG LOCALS =================
  -- BAGO baguhin ang anumang fixture: ang backfill na inaprubahan ng Admin
  select string_agg(key || '=' || timezone, ',' order by key) into t from public.locals;
  perform pg_temp.rec('tz1: backfill ng timezone (medina, sto_tomas, other = Asia/Manila; fort_mcmurray = America/Edmonton)',
    t like '%fort_mcmurray=America/Edmonton%' and t like '%medina=Asia/Manila%' and t like '%other=Asia/Manila%' and t like '%sto_tomas=Asia/Manila%', t);
  select count(*) into v from information_schema.columns
   where table_schema = 'public' and table_name = 'locals' and column_name = 'timezone' and is_nullable = 'NO' and column_default is null;
  perform pg_temp.rec('tz2: locals.timezone ay NOT NULL at WALANG default', v = 1, 'tugma=' || v);
  select * into r from pg_temp.try_sql(U_admin, format('update public.locals set timezone = %L where id = %L', 'Mars/Phobos', L_ST));
  perform pg_temp.rec('tz3: hindi-IANA na timezone ay tinatanggihan (kahit Admin)', not r.ok and coalesce(r.msg, '') ilike '%timezone%', coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_admin, format('update public.locals set timezone = null where id = %L', L_ST));
  perform pg_temp.rec('tz4: NULL na timezone ay tinatanggihan', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_admin, format('update public.locals set timezone = %L where id = %L', 'Asia/Tokyo', L_OT));
  perform pg_temp.rec('tz5: Admin ay nakapagpapalit ng timezone sa wastong IANA name', r.ok and r.cnt = 1, coalesce(r.msg, 'cnt=' || r.cnt));
  select * into r from pg_temp.try_sql(U_admin, format('update public.locals set timezone = %L where id = %L', 'Asia/Manila', L_OT));
  for r in select * from (values ('Local Finance', U_med), ('church-wide Finance', U_cw), ('Local Admin', U_ladmin), ('ordinaryong kaanib', U_member)) x(lbl, uid) loop
    select * into t from pg_temp.try_sql(r.uid, format('update public.locals set timezone = %L where id = %L', 'Asia/Tokyo', L_MED));
    v := (select count(*) from public.locals where id = L_MED and timezone = 'Asia/Manila');
    perform pg_temp.rec('tz6: ' || r.lbl || ' ay hindi makapagpapalit ng timezone (Admin lang)', v = 1, 'timezone ay ' || (select timezone from public.locals where id = L_MED));
  end loop;
  select * into r from pg_temp.try_sql(U_med, format('insert into public.locals (key, name) values (%L, %L)', 't_bagong', 'T Bago'));
  perform pg_temp.rec('tz7: hindi makagawa ng local na walang timezone / hindi Admin', not r.ok, coalesce(r.msg, 'natuloy'));
  t := pg_temp.val($q$select public.local_today('America/Edmonton', timestamptz '2026-09-28 03:00:00+00')::text || ' ' || to_char(public.local_today('America/Edmonton', timestamptz '2026-09-28 03:00:00+00'), 'Dy')$q$);
  perform pg_temp.rec('tz8: Edmonton, Linggo 9pm lokal = petsa na Linggo (2026-09-27)', t = '2026-09-27 Sun', t);
  t := pg_temp.val($q$select public.local_today('Asia/Manila', timestamptz '2026-09-28 03:00:00+00')::text$q$);
  perform pg_temp.rec('tz9: sa parehong sandali, ang Manila ay Lunes na (2026-09-28)', t = '2026-09-28', t);

  -- itakda ang mga fixture na timezone (postgres, walang JWT)
  update public.locals set timezone = 'Asia/Manila' where id in (L_MED, L_ST, L_OT);
  update public.locals set timezone = 'America/Edmonton' where id = L_FM;

  -- ================= 2. SCHEMA NG ABULUYAN =================
  select count(*) into v from information_schema.columns where table_schema = 'public' and table_name = 'abuluyan_totals'
     and column_name = 'total_amount' and data_type = 'numeric' and numeric_precision = 12 and numeric_scale = 2 and column_default is null;
  perform pg_temp.rec('sc1: total_amount ay numeric(12,2) at walang default', v = 1, 'tugma=' || v);
  select count(*) into v from information_schema.columns where table_schema = 'public' and table_name = 'abuluyan_totals'
     and column_name = 'service_date' and data_type = 'date';
  perform pg_temp.rec('sc2: service_date ay DATE (hindi timestamptz)', v = 1, 'tugma=' || v);
  select count(*) into v from information_schema.columns where table_schema = 'public' and table_name = 'abuluyan_totals'
     and column_name in ('submitted_at', 'submitted_by', 'voided_at', 'voided_by', 'void_reason', 'replaces_id');
  perform pg_temp.rec('sc3: may bagong column: submitted_at, submitted_by, voided_at, voided_by, void_reason, replaces_id (6)', v = 6, 'nakita=' || v);
  select count(*) into v from information_schema.columns where table_schema = 'public' and table_name = 'abuluyan_totals'
     and (column_name ilike '%currency%' or column_name ilike '%curr%');
  perform pg_temp.rec('sc4: walang currency column', v = 0, 'nakita=' || v);
  select count(*) into v from information_schema.columns where table_schema = 'public' and table_name = 'abuluyan_totals'
     and column_name = 'submitted_date' and data_type = 'date';
  perform pg_temp.rec('sc5: nananatili ang submitted_date (date); hindi ginalaw', v = 1, 'tugma=' || v);
  select count(*) into v from information_schema.columns where table_schema = 'public' and table_name = 'abuluyan_totals'
     and column_name = 'total_amount' and is_nullable = 'YES';
  perform pg_temp.rec('sc6: total_amount ay nullable (para sa draft)', v = 1, 'tugma=' || v);
  select count(*) into v from pg_enum e join pg_type ty on ty.oid = e.enumtypid where ty.typname = 'finance_record_status' and e.enumlabel in ('draft', 'submitted', 'void');
  perform pg_temp.rec('sc7: (010) status enum: draft | submitted | void', v = 3, 'nakita=' || v);
  select count(*) into v from pg_trigger where tgrelid = 'public.abuluyan_totals'::regclass and tgname = 'abuluyan_totals_sunday' and tgenabled = 'O';
  perform pg_temp.rec('sc8: (010) umiiral pa ang Sunday trigger', v = 1, 'tugma=' || v);
  select count(*) into v from pg_indexes where schemaname = 'public' and tablename = 'abuluyan_totals'
     and indexdef ilike '%unique%' and indexdef ilike '%local_id%' and indexdef ilike '%service_date%' and indexdef ilike '%void%';
  perform pg_temp.rec('sc9: partial unique index (local, Linggo) kung hindi void', v = 1, 'tugma=' || v);
  perform pg_temp.rec('sc10: walang DELETE ang authenticated at anon',
    not has_table_privilege('authenticated', 'public.abuluyan_totals', 'DELETE') and not has_table_privilege('anon', 'public.abuluyan_totals', 'DELETE'), '');

  -- ================= 3. AMOUNT =================
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins(L_MED, S1, null));
  perform pg_temp.rec('am1: Local Finance ay nakagagawa ng draft na NULL ang amount', r.ok, r.msg);
  R1 := pg_temp.rid(L_MED, S1);
  select * into r from pg_temp.try_sql(U_med, format('update public.abuluyan_totals set total_amount = -1 where id = %L', R1));
  perform pg_temp.rec('am2: negatibong amount ay tinatanggihan', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_med, format('update public.abuluyan_totals set total_amount = 0 where id = %L', R1));
  perform pg_temp.rec('am3: amount na 0 ay wasto sa draft', r.ok and r.cnt = 1, coalesce(r.msg, 'cnt=' || r.cnt));
  select * into r from pg_temp.try_sql(U_med, format('update public.abuluyan_totals set total_amount = null where id = %L', R1));
  perform pg_temp.rec('am4: puwedeng ibalik sa NULL habang draft', r.ok and r.cnt = 1, coalesce(r.msg, 'cnt=' || r.cnt));
  select * into r from pg_temp.try_sql(U_med, format('update public.abuluyan_totals set status = ''submitted'' where id = %L', R1));
  perform pg_temp.rec('am5: submit na NULL ang amount = FAIL', not r.ok and coalesce(r.msg, '') ilike '%halaga%', coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_med, format('update public.abuluyan_totals set total_amount = 0, status = ''submitted'' where id = %L', R1));
  perform pg_temp.rec('am6: submit na 0 ang amount = PASS', r.ok and r.cnt = 1, coalesce(r.msg, 'cnt=' || r.cnt));
  v := pg_temp.n(format('select count(*) from public.abuluyan_totals where id = %L and status = ''submitted'' and submitted_at is not null and submitted_by = %L and total_amount = 0', R1, U_med));
  perform pg_temp.rec('am7: sa submit, nakatakda ang submitted_at at submitted_by (ang nag-submit)', v = 1, 'tugma=' || v);
  select count(*) into v from public.abuluyan_totals where id = R1 and submitted_date is not null;
  perform pg_temp.rec('am8: (010) napupunan pa rin ang submitted_date sa submit', v = 1, 'tugma=' || v);

  -- ================= 4. PETSA: LINGGO AT HINDI SA HINAHARAP =================
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins(L_MED, S2 + 1, 10));
  perform pg_temp.rec('d1: (010) hindi Linggo ay tinatanggihan', not r.ok and coalesce(r.msg, '') ilike '%Linggo%', coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins(L_MED, F, 10));
  perform pg_temp.rec('d2: Manila local, Linggo sa hinaharap = FAIL', not r.ok and coalesce(r.msg, '') ilike '%hinaharap%', coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_fm, pg_temp.ins(L_FM, F, 10));
  perform pg_temp.rec('d3: Edmonton local, Linggo sa hinaharap = FAIL', not r.ok and coalesce(r.msg, '') ilike '%hinaharap%', coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_fm, pg_temp.ins(L_FM, S1, 40));
  perform pg_temp.rec('d4: Edmonton local, nakaraang Linggo = PASS', r.ok, r.msg);
  RFM := pg_temp.rid(L_FM, S1);
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins(L_MED, S1 - 49, 10));
  perform pg_temp.rec('d5a: (paghahanda) may draft na nagagawa para sa d5', r.ok, r.msg);
  select * into r from pg_temp.try_sql(U_med, format('update public.abuluyan_totals set service_date = %L where id = %L', F, pg_temp.rid(L_MED, S1 - 49, 'draft')));
  perform pg_temp.rec('d5: hindi rin maililipat sa hinaharap ang petsa ng UPDATE (at hindi nagbago ang petsa)',
    not r.ok and coalesce(r.msg, '') ilike '%hinaharap%' and pg_temp.rid(L_MED, S1 - 49, 'draft') is not null, coalesce(r.msg, 'natuloy'));
  -- Sa Linggo ng 9pm lokal: pagsubok sa function na may tiyak na sandali (hindi sa orasan ng server)
  t := pg_temp.val($q$select (public.local_today('America/Edmonton', timestamptz '2026-09-28 03:00:00+00') <= public.local_today('America/Edmonton', timestamptz '2026-09-28 03:00:00+00'))::text$q$);
  perform pg_temp.rec('d6: (tz8) ang Linggo 9pm Edmonton ay hindi "hinaharap" para sa sariling local', t = 'true', t);

  -- ================= 5. ISANG AKTIBONG RECORD BAWAT LOCAL BAWAT LINGGO =================
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins(L_MED, S1, 5));
  perform pg_temp.rec('u1: pangalawang aktibong record sa parehong local at Linggo = FAIL', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins(L_MED, S2, 5));
  perform pg_temp.rec('u2: ibang Linggo sa parehong local = PASS', r.ok, r.msg);
  R2 := pg_temp.rid(L_MED, S2);

  -- ================= 6. LOCAL FINANCE: DRAFT AT SUBMIT =================
  select * into r from pg_temp.try_sql(U_med, format('update public.abuluyan_totals set total_amount = 77 where id = %L', R2));
  perform pg_temp.rec('l1: edit ng sariling draft = PASS', r.ok and r.cnt = 1, coalesce(r.msg, 'cnt=' || r.cnt));
  select * into r from pg_temp.try_sql(U_fm, format('update public.abuluyan_totals set total_amount = 1 where id = %L', R2));
  select count(*) into v from public.abuluyan_totals where id = R2 and total_amount = 77;
  perform pg_temp.rec('l2: draft ng ibang local ay hindi maie-edit', (not r.ok or r.cnt = 0) and v = 1, coalesce(r.msg, 'cnt=' || r.cnt));
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins(L_FM, S3, 5));
  perform pg_temp.rec('l3: hindi makagawa ng draft sa ibang local', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins(L_MED, S3, 5, ', status', ', ''submitted'''));
  perform pg_temp.rec('l4: (010) bagong record ay dapat draft; direktang submitted = FAIL', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_med, format('update public.abuluyan_totals set total_amount = 9 where id = %L', R1));
  select count(*) into v from public.abuluyan_totals where id = R1 and total_amount = 0;
  perform pg_temp.rec('l5: edit ng submitted ni Local Finance = FAIL', (not r.ok or r.cnt = 0) and v = 1, coalesce(r.msg, 'cnt=' || r.cnt));
  select * into r from pg_temp.try_sql(U_med, format('update public.abuluyan_totals set status = ''draft'' where id = %L', R1));
  perform pg_temp.rec('l6: hindi maibabalik sa draft ang submitted', not r.ok or r.cnt = 0, coalesce(r.msg, 'cnt=' || r.cnt));
  select * into r from pg_temp.try_sql(U_cw, format('update public.abuluyan_totals set status = ''draft'' where id = %L', R1));
  perform pg_temp.rec('l7: (010) kahit church-wide, hindi maibabalik sa draft ang submitted', not r.ok or r.cnt = 0, coalesce(r.msg, 'cnt=' || r.cnt));
  select * into r from pg_temp.try_sql(U_med, format('update public.abuluyan_totals set service_date = %L where id = %L', S4, R2));
  perform pg_temp.rec('l8: Local Finance ay makapagpapalit ng Linggo ng sariling draft (PASS)', r.ok and r.cnt = 1, coalesce(r.msg, 'cnt=' || r.cnt));
  update public.abuluyan_totals set service_date = S2 where id = R2;
  select * into r from pg_temp.try_sql(U_med, format('update public.abuluyan_totals set voided_at = now(), void_reason = ''x'' where id = %L', R2));
  perform pg_temp.rec('l9: Local Finance ay hindi makapagtatakda ng voided_at/void_reason sa draft', not r.ok or r.cnt = 0, coalesce(r.msg, 'cnt=' || r.cnt));
  select * into r from pg_temp.try_sql(U_med, format('update public.abuluyan_totals set submitted_by = %L where id = %L', U_cw, R2));
  perform pg_temp.rec('l10: hindi mapepeke ang submitted_by', not r.ok or r.cnt = 0, coalesce(r.msg, 'cnt=' || r.cnt));
  select * into r from pg_temp.try_sql(U_med, format('update public.abuluyan_totals set total_amount = 250, status = ''submitted'' where id = %L', R2));
  perform pg_temp.rec('l11: submit ng draft na may halaga = PASS', r.ok and r.cnt = 1, coalesce(r.msg, 'cnt=' || r.cnt));

  -- ================= 7. VOID =================
  -- R1 (S1, submitted, 0) at R2 (S2, submitted, 250)
  -- Void: TANGING sa pamamagitan ng void_abuluyan(local_id, service_date, reason); bawal ang direktang UPDATE ng status
  for r in select * from (values ('Local Finance', U_med), ('Local Admin', U_ladmin), ('ordinaryong kaanib', U_member)) x(lbl, uid) loop
    select * into rr from pg_temp.try_sql(r.uid, pg_temp.vd(L_MED, S2, 'mali'));
    perform pg_temp.rec('v1: ' || r.lbl || ' ay hindi makakapag-void (void_abuluyan)', not rr.ok and (select status::text from public.abuluyan_totals where id = R2) = 'submitted', coalesce(rr.msg, 'natuloy'));
  end loop;
  select * into r from pg_temp.try_sql(U_admin, pg_temp.vd(L_MED, S2, null));
  perform pg_temp.rec('v3: void na NULL ang reason = FAIL', not r.ok and (select status::text from public.abuluyan_totals where id = R2) = 'submitted', coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_admin, pg_temp.vd(L_MED, S2, ''));
  perform pg_temp.rec('v3b: void na walang laman ang reason = FAIL', not r.ok and (select status::text from public.abuluyan_totals where id = R2) = 'submitted', coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_admin, pg_temp.vd(L_MED, S2, '   '));
  perform pg_temp.rec('v4: void_reason na puro espasyo = FAIL', not r.ok and (select status::text from public.abuluyan_totals where id = R2) = 'submitted', coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_admin, pg_temp.vd(L_MED, S2 + 1, 'mali'));
  perform pg_temp.rec('v5: void ng record na wala (local+Linggo) = FAIL', not r.ok, coalesce(r.msg, 'natuloy'));
  -- Direktang UPDATE ng status papuntang void = FAIL para sa lahat
  for r in select * from (values ('Admin', U_admin), ('church-wide', U_cw), ('Local Finance', U_med)) x(lbl, uid) loop
    select * into t from pg_temp.try_sql(r.uid, format('update public.abuluyan_totals set status = ''void'', void_reason = ''direkta'' where id = %L', R2));
    perform pg_temp.rec('v5b: direktang UPDATE ng status sa void ay FAIL para kay ' || r.lbl, (select status::text from public.abuluyan_totals where id = R2) = 'submitted', '');
  end loop;
  select * into r from pg_temp.try_sql(U_admin, pg_temp.vd(L_MED, S2, 'maling halaga'));
  perform pg_temp.rec('v6: Admin ay nakapag-void ng submitted na may dahilan = PASS', r.ok, coalesce(r.msg, 'ok'));
  v := pg_temp.n(format('select count(*) from public.abuluyan_totals where id = %L and status = ''void'' and voided_at is not null and voided_by = %L and void_reason = ''maling halaga''', R2, U_admin));
  perform pg_temp.rec('v7: nakatakda ang voided_at, voided_by at void_reason', v = 1, 'tugma=' || v);
  select * into r from pg_temp.try_sql(U_cw, pg_temp.vd(L_MED, S1, 'mali ang uri'));
  perform pg_temp.rec('v8: church-wide Finance ay nakapag-void ng submitted = PASS', r.ok, coalesce(r.msg, 'ok'));
  v := pg_temp.n(format('select count(*) from public.abuluyan_totals where id = %L and status = ''void'' and voided_by = %L', R1, U_cw));
  perform pg_temp.rec('v9: voided_by = ang church-wide na nag-void', v = 1, 'tugma=' || v);
  select * into r from pg_temp.try_sql(U_admin, pg_temp.vd(L_MED, S2, 'ulit'));
  perform pg_temp.rec('v9b: pag-void ng void na (walang submitted na record) = FAIL', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins(L_MED, S3, 10));
  R3 := pg_temp.rid(L_MED, S3, 'draft');
  select * into r from pg_temp.try_sql(U_cw, pg_temp.vd(L_MED, S3, 'draft'));
  perform pg_temp.rec('v10: draft ay hindi maaaring i-void (submitted lang)', not r.ok and (select status::text from public.abuluyan_totals where id = R3) = 'draft', coalesce(r.msg, 'natuloy'));
  -- void_abuluyan: mga katangian ng function
  select count(*) into v from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'void_abuluyan'
     and p.prosecdef and pg_get_function_identity_arguments(p.oid) = 'p_local_id uuid, p_service_date date, p_reason text'
     and exists (select 1 from unnest(p.proconfig) c where c in ('search_path=""', 'search_path=')) ;
  perform pg_temp.rec('fn1: void_abuluyan(local_id uuid, service_date date, reason text) ay SECURITY DEFINER na may search_path=''''', v = 1, 'tugma=' || v);
  perform pg_temp.rec('fn2: walang EXECUTE ang PUBLIC at anon; mayroon ang authenticated',
    coalesce(pg_temp.n('select case when has_function_privilege(''anon'', ''public.void_abuluyan(uuid, date, text)'', ''EXECUTE'') then 1 else 0 end') = 0
      and pg_temp.n('select case when has_function_privilege(''authenticated'', ''public.void_abuluyan(uuid, date, text)'', ''EXECUTE'') then 1 else 0 end') = 1
      and pg_temp.n('select count(*) from pg_proc p, aclexplode(coalesce(p.proacl, acldefault(''f'', p.proowner))) a where p.proname = ''void_abuluyan'' and a.grantee = 0') = 0, false), '');
  -- Naka-lock ang submitted para sa LAHAT (pati church-wide): halaga at petsa
  select * into r from pg_temp.try_sql(U_cw, pg_temp.ins(L_MED, S6, 20));
  R4 := pg_temp.rid(L_MED, S6, 'draft');
  select * into r from pg_temp.try_sql(U_cw, format('update public.abuluyan_totals set status = ''submitted'' where id = %L', R4));
  select * into r from pg_temp.try_sql(U_cw, format('update public.abuluyan_totals set total_amount = 999 where id = %L', R4));
  perform pg_temp.rec('lk1: church-wide ay hindi makapag-e-edit ng halaga ng submitted', (not r.ok or r.cnt = 0) and (select total_amount from public.abuluyan_totals where id = R4) = 20, coalesce(r.msg, 'cnt=' || r.cnt));
  select * into r from pg_temp.try_sql(U_cw, format('update public.abuluyan_totals set service_date = %L where id = %L', S6 - 7, R4));
  perform pg_temp.rec('lk2: church-wide ay hindi makapag-e-edit ng petsa ng submitted', (not r.ok or r.cnt = 0) and (select service_date from public.abuluyan_totals where id = R4) = S6, coalesce(r.msg, 'cnt=' || r.cnt));
  select * into r from pg_temp.try_sql(U_cw, format('update public.abuluyan_totals set local_id = %L where id = %L', L_FM, R4));
  perform pg_temp.rec('lk3: hindi mapapalitan ang local ng submitted (kahit church-wide)', (not r.ok or r.cnt = 0) and (select local_id from public.abuluyan_totals where id = R4) = L_MED, coalesce(r.msg, 'cnt=' || r.cnt));
  select * into r from pg_temp.try_sql(U_cw, format('update public.abuluyan_totals set status = ''void'', void_reason = ''direkta'' where id = %L', R4));
  perform pg_temp.rec('lk4: direktang UPDATE ng submitted papuntang void ay FAIL (church-wide)', (not r.ok or r.cnt = 0) and (select status::text from public.abuluyan_totals where id = R4) = 'submitted', coalesce(r.msg, 'cnt=' || r.cnt));
  select * into r from pg_temp.try_sql(U_admin, format('update public.abuluyan_totals set total_amount = 999 where id = %L', R4));
  perform pg_temp.rec('lk5: Admin ay hindi makapag-e-edit ng submitted', (select total_amount from public.abuluyan_totals where id = R4) = 20, coalesce(r.msg, 'cnt=' || r.cnt));
  select * into r from pg_temp.try_sql(U_cw, pg_temp.vd(L_MED, S6, 'aalisin ko rin ito'));
  perform pg_temp.rec('lk6: ang void_abuluyan ay gumagana sa submitted na ito (PASS); pinal ito', r.ok, coalesce(r.msg, 'ok'));
  -- Void ay pinal
  for r in select * from (values ('Admin', U_admin), ('church-wide', U_cw), ('Local Finance', U_med)) x(lbl, uid) loop
    select * into t from pg_temp.try_sql(r.uid, format('update public.abuluyan_totals set total_amount = 5 where id = %L', R2));
    perform pg_temp.rec('v11: void ay pinal: ' || r.lbl || ' ay hindi makapag-e-edit ng void', (select total_amount from public.abuluyan_totals where id = R2) = 250, '');
    select * into t from pg_temp.try_sql(r.uid, format('update public.abuluyan_totals set status = ''submitted'', void_reason = null where id = %L', R2));
    perform pg_temp.rec('v12: ' || r.lbl || ' ay hindi makapag-u-un-void', (select status::text from public.abuluyan_totals where id = R2) = 'void', '');
  end loop;
  -- Local Finance: draft kapag may void sa parehong local+Linggo
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins(L_MED, S1, 10));
  perform pg_temp.rec('v13: Local Finance ay hindi makagagawa ng draft para sa local+Linggo na may void', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins(L_MED, S1, 10, ', replaces_id', format(', %L', R1)));
  perform pg_temp.rec('v14: Local Finance ay hindi makagagawa ng replacement (kahit may replaces_id)', not r.ok, coalesce(r.msg, 'natuloy'));
  v := pg_temp.cnt_as(U_med, format('select count(*) from public.abuluyan_totals where id in (%L, %L)', R1, R2));
  perform pg_temp.rec('v15: nakikita ni Local Finance ang void ng sariling local', v = 2, 'nakita=' || v);
  select * into r from pg_temp.try_sql(U_med, pg_temp.ins(L_MED, S5, 10));
  perform pg_temp.rec('v16: draft sa ibang Linggo ng parehong local ay pinapayagan pa rin', r.ok, r.msg);
  select * into r from pg_temp.try_sql(U_med, format('update public.abuluyan_totals set status = ''void'', void_reason = ''x'' where id = %L', pg_temp.rid(L_MED, S5)));
  perform pg_temp.rec('v17: Local Finance ay hindi makapag-void ng sariling draft', (select status::text from public.abuluyan_totals where id = pg_temp.rid(L_MED, S5)) = 'draft', coalesce(r.msg, 'cnt=' || r.cnt));

  -- ================= 8. REPLACEMENT =================
  -- void ng ibang local para sa mga negatibong pagsubok (postgres: walang JWT, hindi hinaharangan)
  begin
    execute format('insert into public.abuluyan_totals (local_id, service_date, total_amount, recorded_by, status, submitted_at, submitted_by, voided_at, voided_by, void_reason) values (%L, %L, 10, %L, ''void'', now(), %L, now(), %L, ''seed'')', L_FM, S2, U_fm, U_fm, U_cw);
  exception when others then
    null;  -- bago ang 019: wala pa ang mga column; ang mga test na umaasa rito ay papalyahin
  end;
  RVFM := coalesce(pg_temp.rid(L_FM, S2, 'void'), gen_random_uuid());
  select * into r from pg_temp.try_sql(U_cw, pg_temp.ins(L_MED, S1, 300));
  perform pg_temp.rec('p1: church-wide: bagong record sa local+Linggo na may void, walang replaces_id = FAIL', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_cw, pg_temp.ins(L_MED, S1, 300, ', replaces_id', format(', %L', R3)));
  perform pg_temp.rec('p2: replaces_id na hindi void = FAIL', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_cw, pg_temp.ins(L_MED, S1, 300, ', replaces_id', format(', %L', RVFM)));
  perform pg_temp.rec('p3: replaces_id na void ng IBANG local = FAIL', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_cw, pg_temp.ins(L_MED, S6, 300, ', replaces_id', format(', %L', R1)));
  perform pg_temp.rec('p4: replacement na ibang Linggo kaysa sa pinapalitan = FAIL', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_admin, pg_temp.ins(L_MED, S1, 300, ', replaces_id', format(', %L', R1)));
  perform pg_temp.rec('p5: Admin ay hindi makagagawa ng replacement', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_cw, pg_temp.ins(L_MED, S1, 300, ', replaces_id', format(', %L', R1)));
  perform pg_temp.rec('p6: church-wide: replacement na may replaces_id sa void ng parehong local+Linggo = PASS', r.ok, r.msg);
  RREP := pg_temp.rid(L_MED, S1, 'draft');
  select * into r from pg_temp.try_sql(U_cw, pg_temp.ins(L_MED, S1, 300, ', replaces_id', format(', %L', R1)));
  perform pg_temp.rec('p7: pangalawang aktibong replacement para sa parehong Linggo = FAIL', not r.ok, coalesce(r.msg, 'natuloy'));
  select * into r from pg_temp.try_sql(U_med, format('update public.abuluyan_totals set total_amount = 1 where id = %L', RREP));
  perform pg_temp.rec('p8: Local Finance ay hindi makapag-e-edit ng replacement', (not r.ok or r.cnt = 0) and (select total_amount from public.abuluyan_totals where id = RREP) = 300, coalesce(r.msg, 'cnt=' || r.cnt));
  select * into r from pg_temp.try_sql(U_med, format('update public.abuluyan_totals set status = ''submitted'' where id = %L', RREP));
  perform pg_temp.rec('p9: Local Finance ay hindi makapag-s-submit ng replacement', (not r.ok or r.cnt = 0) and (select status::text from public.abuluyan_totals where id = RREP) = 'draft', coalesce(r.msg, 'cnt=' || r.cnt));
  v := pg_temp.cnt_as(U_med, format('select count(*) from public.abuluyan_totals where id = %L', RREP));
  perform pg_temp.rec('p10: nakikita ni Local Finance ang replacement ng sariling local', v = 1, 'nakita=' || v);
  v := pg_temp.cnt_as(U_fm, format('select count(*) from public.abuluyan_totals where id = %L', RREP));
  perform pg_temp.rec('p11: hindi ito nakikita ng Local Finance ng ibang local', v = 0, 'nakita=' || v);
  select * into r from pg_temp.try_sql(U_admin, format('update public.abuluyan_totals set total_amount = 1 where id = %L', RREP));
  perform pg_temp.rec('p12: Admin ay hindi makapag-e-edit ng replacement', (not r.ok or r.cnt = 0) and (select total_amount from public.abuluyan_totals where id = RREP) = 300, coalesce(r.msg, 'cnt=' || r.cnt));
  select * into r from pg_temp.try_sql(U_cw, format('update public.abuluyan_totals set total_amount = 310 where id = %L', RREP));
  perform pg_temp.rec('p13: church-wide ay nakapag-e-edit ng replacement = PASS', r.ok and r.cnt = 1, coalesce(r.msg, 'cnt=' || r.cnt));
  select * into r from pg_temp.try_sql(U_cw, format('update public.abuluyan_totals set replaces_id = %L where id = %L', RVFM, RREP));
  perform pg_temp.rec('p14: hindi mapapalitan ang replaces_id pagkatapos', pg_temp.n(format('select count(*) from public.abuluyan_totals where id = %L and replaces_id = %L', RREP, R1)) = 1, coalesce(r.msg, 'cnt=' || r.cnt));
  select * into r from pg_temp.try_sql(U_cw, format('update public.abuluyan_totals set status = ''submitted'' where id = %L', RREP));
  perform pg_temp.rec('p15: church-wide ay nakapag-s-submit ng replacement = PASS', r.ok and r.cnt = 1, coalesce(r.msg, 'cnt=' || r.cnt));
  v := pg_temp.n(format('select count(*) from public.abuluyan_totals where id = %L and status = ''submitted'' and submitted_by = %L and submitted_at is not null', RREP, U_cw));
  perform pg_temp.rec('p16: nakatala ang submitted_by/at ng replacement', v = 1, 'tugma=' || v);

  -- ================= 9. ACCESS =================
  v := pg_temp.cnt_as(U_ladmin, 'select count(*) from public.abuluyan_totals');
  perform pg_temp.rec('x1: Local Admin ay walang nakikitang Abuluyan', v = 0, 'nakita=' || v);
  select * into r from pg_temp.try_sql(U_ladmin, pg_temp.ins(L_MED, S6 - 7, 5));
  perform pg_temp.rec('x2: Local Admin ay hindi makagagawa ng Abuluyan', not r.ok, coalesce(r.msg, 'natuloy'));
  v := pg_temp.cnt_as(U_admin, 'select count(*) from public.abuluyan_totals');
  perform pg_temp.rec('x3: Admin ay walang nakikitang hilera (kabuuan lang sa ulat)', v = 0, 'nakita=' || v);
  select * into r from pg_temp.try_sql(U_admin, pg_temp.ins(L_MED, S6 - 7, 5));
  perform pg_temp.rec('x4: Admin ay hindi makagagawa ng bagong record', not r.ok, coalesce(r.msg, 'natuloy'));
  v := pg_temp.cnt_as(U_member, 'select count(*) from public.abuluyan_totals');
  perform pg_temp.rec('x5: ordinaryong kaanib ay walang nakikitang Abuluyan', v = 0, 'nakita=' || v);
  perform pg_temp.rec('x6: anon ay walang anumang privilege sa abuluyan_totals',
    not has_table_privilege('anon', 'public.abuluyan_totals', 'SELECT') and not has_table_privilege('anon', 'public.abuluyan_totals', 'INSERT') and not has_table_privilege('anon', 'public.abuluyan_totals', 'UPDATE'), '');
  select count(*) into n_before from public.abuluyan_totals;
  for r in select * from (values ('Local Finance', U_med), ('church-wide', U_cw), ('Admin', U_admin), ('Local Admin', U_ladmin)) x(lbl, uid) loop
    select * into t from pg_temp.try_sql(r.uid, 'delete from public.abuluyan_totals');
    perform pg_temp.rec('x7: DELETE ay tinatanggihan para kay ' || r.lbl, (select count(*) from public.abuluyan_totals) = n_before, '');
  end loop;
  select * into r from pg_temp.try_sql(U_cw, 'truncate public.abuluyan_totals');
  perform pg_temp.rec('x8: TRUNCATE ay tinatanggihan', not r.ok, coalesce(r.msg, 'natuloy'));

  -- ================= ULAT =================
  select string_agg(format('%s [%s] %s%s', n, case when ok then 'PASS' else 'FAIL' end, label,
                           case when ok then '' else '  :: ' || coalesce(detail, '') end), E'\n' order by n),
         count(*) filter (where ok), count(*) filter (where not ok)
    into v_report, v_pass, v_fail
  from t_results;

  raise exception E'\n=== ULAT NG PAGSUBOK: LIFECYCLE NG ABULUYAN (nabawi ang transaction; walang naiwan) ===\n%\n=== PASS=% FAIL=% ===', v_report, v_pass, v_fail;
end
$test$;
