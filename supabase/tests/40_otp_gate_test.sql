-- Behaviour tests for the SMS-code gate: cashiers get nothing until their session is code-verified.
-- Runs after 00_supabase_shim.sql and ALL migrations.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/40_otp_gate_test.sql

create schema if not exists t;

-- Run a statement as a role with an explicit set of login-token claims (a JSON object, or null for none)
create or replace function t.run_claims(as_role text, claims jsonb, stmt text) returns text
language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claims', coalesce(claims::text, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(claims ->> 'sub', ''), true);
  execute format('set local role %I', as_role);
  execute format('select (%s)::text', stmt) into v;
  reset role;
  return coalesce(v, 'NULL');
exception when others then
  reset role;
  return 'ERR:' || sqlstate;
end $$;

create or replace function t.expect(label text, got text, want text) returns void
language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % (expected %, got %)', label, want, got;
  end if;
  raise notice 'pass: %', label;
end $$;

-- ----- fixtures -----
truncate public.users, public.user_roles, public.customers, public.cashier_sessions, public.sequence_counters,
         public.otp_verified_sessions;
delete from auth.users;
insert into auth.users(id) values
  ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000c1');

insert into public.user_roles(id, name, description, permissions_json) values
  ('role-admin','Admin','x','{"can_record_payments":true,"can_manage_appliances":true,"can_issue_money":true}'),
  ('role-manager','Manager','x','{"can_record_payments":true,"can_manage_appliances":true,"can_issue_money":true}'),
  ('role-cashier','Cashier','x','{"can_record_payments":true,"can_manage_appliances":true,"can_issue_money":true}');
insert into public.users(id, username, full_name, email, phone, role_id, role_title, branch_id, created_at, is_active, auth_user_id) values
  ('u-admin','admin','Admin','a@x','07','role-admin','Director','b1','now',1,'00000000-0000-0000-0000-0000000000a1'),
  ('u-mgr','mgr','Manager','m@x','07','role-manager','Manager','b1','now',1,'00000000-0000-0000-0000-0000000000b1'),
  ('u-cash','cash','Cashier','c@x','07','role-cashier','Cashier','b1','now',1,'00000000-0000-0000-0000-0000000000c1');
insert into public.customers(id, customer_number, name, id_number, phone, created_at, updated_at, branch_id)
  values ('c1','CUS-1','Customer','111','07','n','n','b1');
insert into public.cashier_sessions(id, cashier_id, cashier_name, branch_id, session_date, opened_at, opening_cash)
  values ('s1','u-cash','Cashier','b1','today','now',1);

-- login tokens (as Supabase would issue them)
\set ADMIN_NO_CODE  '{"sub":"00000000-0000-0000-0000-0000000000a1"}'
\set MGR_NO_CODE    '{"sub":"00000000-0000-0000-0000-0000000000b1"}'
\set CASH_NO_CODE   '{"sub":"00000000-0000-0000-0000-0000000000c1"}'
\set CASH_FALSE     '{"sub":"00000000-0000-0000-0000-0000000000c1","otp_ok":false}'
\set CASH_VERIFIED  '{"sub":"00000000-0000-0000-0000-0000000000c1","otp_ok":true}'

-- ============================== the gate ==============================
select t.expect('cashier WITHOUT the code mark sees no customers',
  t.run_claims('authenticated', :'CASH_NO_CODE', $q$(select count(*) from public.customers)$q$), '0');
select t.expect('cashier with otp_ok=false sees no customers',
  t.run_claims('authenticated', :'CASH_FALSE', $q$(select count(*) from public.customers)$q$), '0');
select t.expect('cashier WITHOUT the code mark is not treated as staff',
  t.run_claims('authenticated', :'CASH_NO_CODE', 'public.is_staff()'), 'false');
select t.expect('cashier without the mark cannot get a number',
  t.run_claims('authenticated', :'CASH_NO_CODE', $q$public.next_sequence('RCT')$q$), 'ERR:42501');
select t.expect('cashier without the mark has no till',
  t.run_claims('authenticated', :'CASH_NO_CODE', $q$(select count(*) from public.cashier_sessions)$q$), '0');
select t.expect('cashier without the mark has no user id',
  t.run_claims('authenticated', :'CASH_NO_CODE', 'public.app_user_id()'), 'NULL');
select t.expect('cashier without the mark has no permissions',
  t.run_claims('authenticated', :'CASH_NO_CODE', $q$public.can_any(array['can_record_payments'])$q$), 'false');

select t.expect('cashier WITH the code mark sees the customer',
  t.run_claims('authenticated', :'CASH_VERIFIED', $q$(select count(*) from public.customers)$q$), '1');
select t.expect('cashier WITH the code mark is staff',
  t.run_claims('authenticated', :'CASH_VERIFIED', 'public.is_staff()'), 'true');
select t.expect('cashier WITH the code mark gets a number',
  t.run_claims('authenticated', :'CASH_VERIFIED', $q$public.next_sequence('RCT')$q$), '1');
select t.expect('cashier WITH the code mark sees their till',
  t.run_claims('authenticated', :'CASH_VERIFIED', $q$(select count(*) from public.cashier_sessions)$q$), '1');
select t.expect('the mark does not give a cashier extra powers (cannot see treasury)',
  t.run_claims('authenticated', :'CASH_VERIFIED', $q$(select count(*) from public.treasury)$q$), '0');

select t.expect('admin does not need the code mark',
  t.run_claims('authenticated', :'ADMIN_NO_CODE', 'public.is_admin()'), 'true');
select t.expect('manager does not need the code mark',
  t.run_claims('authenticated', :'MGR_NO_CODE', 'public.is_manager()'), 'true');
select t.expect('manager works normally without the mark',
  t.run_claims('authenticated', :'MGR_NO_CODE', $q$(select count(*) from public.customers)$q$), '1');

select t.expect('someone else''s verified mark does not unlock this cashier (wrong user)',
  t.run_claims('authenticated', '{"sub":"00000000-0000-0000-0000-0000000000d9","otp_ok":true}', 'public.is_staff()'), 'false');
select t.expect('no login at all: nothing',
  t.run_claims('authenticated', null, 'public.is_staff()'), 'false');

-- ============================== the token hook ==============================
-- session 11111111-... was code-verified just now; 22222222-... 13 hours ago; 33333333-... never
select public.otp_mark_session('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000c1');
insert into public.otp_verified_sessions(session_id, user_id, verified_at)
  values ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-0000000000c1', now() - interval '13 hours');

create or replace function t.hook(sid text) returns jsonb language sql as $$
  select public.custom_access_token_hook(jsonb_build_object(
    'user_id', '00000000-0000-0000-0000-0000000000c1',
    'authentication_method', 'password',
    'claims', jsonb_build_object('sub','00000000-0000-0000-0000-0000000000c1','role','authenticated','aal','aal1','session_id', sid)))
$$;

select t.expect('hook marks a freshly verified session',    t.hook('11111111-1111-1111-1111-111111111111') -> 'claims' ->> 'otp_ok', 'true');
select t.expect('hook does not mark an unverified session', coalesce(t.hook('33333333-3333-3333-3333-333333333333') -> 'claims' ->> 'otp_ok', 'absent'), 'absent');
select t.expect('hook drops the mark after 12 hours',       coalesce(t.hook('22222222-2222-2222-2222-222222222222') -> 'claims' ->> 'otp_ok', 'absent'), 'absent');
select t.expect('hook survives a missing session id',       coalesce(public.custom_access_token_hook('{"claims":{"sub":"x"}}'::jsonb) -> 'claims' ->> 'otp_ok', 'absent'), 'absent');
select t.expect('hook survives a malformed session id',     coalesce(t.hook('not-a-uuid') -> 'claims' ->> 'otp_ok', 'absent'), 'absent');
select t.expect('hook keeps the other claims',              t.hook('11111111-1111-1111-1111-111111111111') -> 'claims' ->> 'aal', 'aal1');
select t.expect('hook keeps the rest of the event',         t.hook('11111111-1111-1111-1111-111111111111') ->> 'authentication_method', 'password');
select t.expect('hook removes a mark that a client tried to carry along',
  coalesce(public.custom_access_token_hook(jsonb_build_object('claims', jsonb_build_object('session_id','33333333-3333-3333-3333-333333333333','otp_ok',true))) -> 'claims' ->> 'otp_ok', 'absent'), 'absent');

-- end to end: the claims the hook produces unlock the cashier
select t.expect('token from the hook (verified session) unlocks the cashier',
  t.run_claims('authenticated', (t.hook('11111111-1111-1111-1111-111111111111') -> 'claims'), 'public.is_staff()'), 'true');
select t.expect('token from the hook (unverified session) stays locked',
  t.run_claims('authenticated', (t.hook('33333333-3333-3333-3333-333333333333') -> 'claims'), 'public.is_staff()'), 'false');

-- ============================== who may call what ==============================
select t.expect('app users cannot mark a session verified',
  t.run_claims('authenticated', :'CASH_NO_CODE', $q$public.otp_mark_session('44444444-4444-4444-4444-444444444444','00000000-0000-0000-0000-0000000000c1')$q$), 'ERR:42501');
select t.expect('anon cannot mark a session verified',
  t.run_claims('anon', null, $q$public.otp_mark_session('44444444-4444-4444-4444-444444444444','00000000-0000-0000-0000-0000000000c1')$q$), 'ERR:42501');
select t.expect('the server can mark a session verified',
  t.run_claims('service_role', null, $q$public.otp_mark_session('44444444-4444-4444-4444-444444444444','00000000-0000-0000-0000-0000000000c1')$q$), '');  -- returns nothing, so an empty value means it ran
select t.expect('app users cannot call the hook',
  t.run_claims('authenticated', :'CASH_NO_CODE', $q$public.custom_access_token_hook('{"claims":{}}'::jsonb)$q$), 'ERR:42501');
select t.expect('anon cannot call the hook',
  t.run_claims('anon', null, $q$public.custom_access_token_hook('{"claims":{}}'::jsonb)$q$), 'ERR:42501');
select t.expect('Supabase Auth can call the hook',
  t.run_claims('supabase_auth_admin', null, $q$public.custom_access_token_hook('{"claims":{}}'::jsonb) -> 'claims'$q$), '{}');
select t.expect('app users cannot read the verified-sessions table',
  t.run_claims('authenticated', :'ADMIN_NO_CODE', $q$(select count(*) from public.otp_verified_sessions)$q$), 'ERR:42501');
select t.expect('app users cannot read the sign-in code table either',
  t.run_claims('authenticated', :'ADMIN_NO_CODE', $q$(select count(*) from public.auth_otp_challenges)$q$), 'ERR:42501');

\echo
\echo ALL CHECKS PASSED
