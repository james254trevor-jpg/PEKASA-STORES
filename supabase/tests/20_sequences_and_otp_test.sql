-- Behaviour tests for database-issued numbers and sign-in code tracking.
-- Runs on a plain PostgreSQL server after 00_supabase_shim.sql and ALL migrations.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/20_sequences_and_otp_test.sql
-- A clean run ends with "ALL CHECKS PASSED".

create schema if not exists t;

create or replace function t.run(as_role text, uid uuid, stmt text) returns text
language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  perform set_config('request.jwt.claims', case when uid is null then '' else json_build_object('sub', uid, 'otp_ok', true)::text end, true);
  execute format('set local role %I', as_role);
  execute stmt;
  get diagnostics n = row_count;
  reset role;
  return n::text;
exception when others then
  reset role;
  return 'ERR:' || sqlstate;
end $$;

-- Like t.run but returns the single value the statement produces (or ERR:<sqlstate>)
create or replace function t.val(as_role text, uid uuid, stmt text) returns text
language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  perform set_config('request.jwt.claims', case when uid is null then '' else json_build_object('sub', uid, 'otp_ok', true)::text end, true);
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
truncate public.users, public.sequence_counters, public.auth_otp_challenges;
delete from auth.users;
insert into auth.users(id) values
  ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-0000000000c2'), ('00000000-0000-0000-0000-0000000000d9');
insert into public.users(id, username, full_name, email, phone, role_id, role_title, branch_id, created_at, is_active, auth_user_id) values
  ('u-admin','admin','Admin','a@x','07','role-admin','Director','b1','now',1,'00000000-0000-0000-0000-0000000000a1'),
  ('u-cash','cash','Cashier','c@x','07','role-cashier','Cashier','b1','now',1,'00000000-0000-0000-0000-0000000000c1'),
  ('u-off','off','Inactive','o@x','07','role-cashier','Cashier','b1','now',0,'00000000-0000-0000-0000-0000000000c2');

\set ADMIN '''00000000-0000-0000-0000-0000000000a1'''
\set CASH  '''00000000-0000-0000-0000-0000000000c1'''
\set OFF   '''00000000-0000-0000-0000-0000000000c2'''
\set NOROW '''00000000-0000-0000-0000-0000000000d9'''

-- ============================== sequence numbers ==============================
select t.expect('anon cannot ask for a number',            t.val('anon', null, $q$public.next_sequence('RCT')$q$), 'ERR:42501');
select t.expect('login without a staff row is refused',    t.val('authenticated', :NOROW::uuid, $q$public.next_sequence('RCT')$q$), 'ERR:42501');
select t.expect('deactivated staff are refused',           t.val('authenticated', :OFF::uuid,   $q$public.next_sequence('RCT')$q$), 'ERR:42501');
select t.expect('first number is 1',                       t.val('authenticated', :CASH::uuid,  $q$public.next_sequence('CUS')$q$), '1');
select t.expect('second number is 2',                      t.val('authenticated', :CASH::uuid,  $q$public.next_sequence('CUS')$q$), '2');
select t.expect('numbers are shared between users',        t.val('authenticated', :ADMIN::uuid, $q$public.next_sequence('CUS')$q$), '3');
select t.expect('each prefix counts on its own',           t.val('authenticated', :CASH::uuid,  $q$public.next_sequence('RCT')$q$), '1');
select t.expect('unknown prefix is refused',               t.val('authenticated', :CASH::uuid,  $q$public.next_sequence('XXX')$q$), 'ERR:22023');
select t.expect('prefix is case sensitive',                t.val('authenticated', :CASH::uuid,  $q$public.next_sequence('cus')$q$), 'ERR:22023');
select t.expect('null prefix is refused',                  t.val('authenticated', :CASH::uuid,  $q$public.next_sequence(null)$q$), 'ERR:22023');

-- carries on from an existing counter (e.g. after importing old data)
update public.sequence_counters set last_sequence = 41 where prefix = 'LN';
insert into public.sequence_counters(prefix, current_year, last_sequence) values ('LN', 2026, 41)
  on conflict (prefix) do update set last_sequence = 41;
select t.expect('continues after an imported counter',     t.val('authenticated', :CASH::uuid,  $q$public.next_sequence('LN')$q$), '42');

-- counters cannot be tampered with directly
select t.expect('staff cannot rewind a counter',           t.run('authenticated', :CASH::uuid, $q$update public.sequence_counters set last_sequence = 0 where prefix = 'LN'$q$), '0');
select t.expect('staff cannot add a counter',              t.run('authenticated', :CASH::uuid, $q$insert into public.sequence_counters values ('SAL', 2026, 0)$q$), 'ERR:42501');
select t.expect('staff cannot delete a counter',           t.run('authenticated', :CASH::uuid, $q$delete from public.sequence_counters$q$), '0');
select t.expect('staff can read the counters',             t.run('authenticated', :CASH::uuid, $q$select * from public.sequence_counters$q$), '3');
select t.expect('rewind attempt did not change anything',  t.val('authenticated', :CASH::uuid, $q$public.next_sequence('LN')$q$), '43');
select t.expect('admin can set a counter by hand',         t.run('authenticated', :ADMIN::uuid, $q$update public.sequence_counters set last_sequence = 100 where prefix = 'LN'$q$), '1');
select t.expect('...and numbering continues from it',      t.val('authenticated', :CASH::uuid, $q$public.next_sequence('LN')$q$), '101');

-- ============================== sign-in code tracking ==============================
-- only the server (service_role) may touch any of it
select t.expect('app users cannot start a code',   t.val('authenticated', :CASH::uuid, $q$public.otp_start('n0','u-cash')$q$), 'ERR:42501');
select t.expect('anon cannot start a code',        t.val('anon', null, $q$public.otp_start('n0','u-cash')$q$), 'ERR:42501');
select t.expect('app users cannot guess a code',   t.val('authenticated', :CASH::uuid, $q$public.otp_attempt('n0','u-cash')$q$), 'ERR:42501');
select t.expect('app users cannot consume a code', t.val('authenticated', :CASH::uuid, $q$public.otp_consume('n0','u-cash')$q$), 'ERR:42501');
select t.expect('staff cannot read the code table',t.run('authenticated', :ADMIN::uuid, 'select * from public.auth_otp_challenges'), 'ERR:42501');
select t.expect('staff cannot write the code table', t.run('authenticated', :ADMIN::uuid, $q$insert into public.auth_otp_challenges(nonce,user_id,expires_at) values('x','u-cash',now()+interval '1 hour')$q$), 'ERR:42501');
select t.expect('anon cannot read the code table', t.run('anon', null, 'select * from public.auth_otp_challenges'), 'ERR:42501');

select t.expect('server starts a code',                  t.val('service_role', null, $q$public.otp_start('n1','u-cash')$q$), 'ok');
select t.expect('asking again at once is blocked (30s)', t.val('service_role', null, $q$public.otp_start('n1b','u-cash')$q$), 'cooldown');
select t.expect('another user is not affected',          t.val('service_role', null, $q$public.otp_start('n2','u-admin')$q$), 'ok');

-- guesses
select t.expect('guess 1 allowed', t.val('service_role', null, $q$public.otp_attempt('n1','u-cash')$q$), 'ok');
select t.expect('guess 2 allowed', t.val('service_role', null, $q$public.otp_attempt('n1','u-cash')$q$), 'ok');
select t.expect('guess 3 allowed', t.val('service_role', null, $q$public.otp_attempt('n1','u-cash')$q$), 'ok');
select t.expect('guess 4 allowed', t.val('service_role', null, $q$public.otp_attempt('n1','u-cash')$q$), 'ok');
select t.expect('guess 5 allowed', t.val('service_role', null, $q$public.otp_attempt('n1','u-cash')$q$), 'ok');
select t.expect('guess 6 is locked out', t.val('service_role', null, $q$public.otp_attempt('n1','u-cash')$q$), 'locked');
select t.expect('stays locked',          t.val('service_role', null, $q$public.otp_attempt('n1','u-cash')$q$), 'locked');
-- (otp_consume only checks unexpired + unused; the server only calls it after an allowed guess was correct)
select t.expect('unknown code',          t.val('service_role', null, $q$public.otp_attempt('nope','u-cash')$q$), 'unknown');
select t.expect('code of another user is "unknown"', t.val('service_role', null, $q$public.otp_attempt('n2','u-cash')$q$), 'unknown');

-- single use
select t.expect('first use succeeds',     t.val('service_role', null, $q$public.otp_consume('n2','u-admin')$q$), 'true');
select t.expect('second use is refused',  t.val('service_role', null, $q$public.otp_consume('n2','u-admin')$q$), 'false');
select t.expect('a used code is "used"',  t.val('service_role', null, $q$public.otp_attempt('n2','u-admin')$q$), 'used');
select t.expect('wrong user cannot consume', t.val('service_role', null, $q$public.otp_consume('n1','u-admin')$q$), 'false');

-- expiry (insert a code that already expired)
insert into public.auth_otp_challenges(nonce, user_id, expires_at, created_at)
  values ('old', 'u-off', now() - interval '1 minute', now() - interval '11 minutes');
select t.expect('expired code is "expired"',  t.val('service_role', null, $q$public.otp_attempt('old','u-off')$q$), 'expired');
select t.expect('expired code cannot be consumed', t.val('service_role', null, $q$public.otp_consume('old','u-off')$q$), 'false');

-- SMS flood limit: 5 codes in 10 minutes for one account
insert into public.auth_otp_challenges(nonce, user_id, expires_at, created_at)
  select 'f'||g, 'u-flood', now() + interval '5 minutes', now() - (g || ' minutes')::interval from generate_series(1,5) g;
select t.expect('6th code within 10 minutes is rate limited', t.val('service_role', null, $q$public.otp_start('f6','u-flood')$q$), 'rate_limited');
select t.expect('rate limit is per account',                  t.val('service_role', null, $q$public.otp_start('g1','u-other')$q$), 'ok');

-- housekeeping removes codes older than a day
insert into public.auth_otp_challenges(nonce, user_id, expires_at, created_at)
  values ('ancient', 'u-x', now() - interval '2 days', now() - interval '2 days');
select t.val('service_role', null, $q$public.otp_start('h1','u-clean')$q$);
select t.expect('old codes are cleaned up', (select count(*)::text from public.auth_otp_challenges where nonce = 'ancient'), '0');

\echo
\echo ALL CHECKS PASSED
