-- Behaviour tests for the access rules. Runs on a plain PostgreSQL server after:
--   00_supabase_shim.sql, then both migrations.
-- Usage:  psql -v ON_ERROR_STOP=1 -f supabase/tests/10_rls_test.sql
-- Any failed check aborts with an error; a clean run ends with "ALL CHECKS PASSED".

create schema if not exists t;

-- Run one SQL statement as a given database role + logged-in user, return rows affected or ERR:<code>.
create or replace function t.run(as_role text, uid uuid, stmt text) returns text
language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  execute format('set local role %I', as_role);
  execute stmt;
  get diagnostics n = row_count;
  reset role;
  return n::text;
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

-- ----- fixtures (as superuser) -----
truncate public.users, public.customers, public.treasury, public.ledger_transactions, public.audit_logs,
         public.cashier_sessions, public.payment_void_requests, public.operating_expenses, public.collateral_sales
         restart identity;
delete from auth.users;

insert into auth.users(id) values
  ('00000000-0000-0000-0000-0000000000a1'),  -- admin
  ('00000000-0000-0000-0000-0000000000c1'),  -- cashier 1 (active)
  ('00000000-0000-0000-0000-0000000000c2'),  -- cashier 2 (active)
  ('00000000-0000-0000-0000-0000000000c3'),  -- cashier 3 (deactivated)
  ('00000000-0000-0000-0000-0000000000d4');  -- login with no staff row

insert into public.users(id, username, full_name, email, phone, role_id, role_title, created_at, is_active, auth_user_id) values
  ('u-admin', 'admin', 'Admin',     'a@x', '0700000001', 'role-admin',   'Director', 'now', 1, '00000000-0000-0000-0000-0000000000a1'),
  ('u-c1',    'c1',    'Cashier 1', 'c1@x','0700000002', 'role-cashier', 'Cashier',  'now', 1, '00000000-0000-0000-0000-0000000000c1'),
  ('u-c2',    'c2',    'Cashier 2', 'c2@x','0700000003', 'role-cashier', 'Cashier',  'now', 1, '00000000-0000-0000-0000-0000000000c2'),
  ('u-c3',    'c3',    'Cashier 3', 'c3@x','0700000004', 'role-cashier', 'Cashier',  'now', 0, '00000000-0000-0000-0000-0000000000c3');

insert into public.customers(id, customer_number, name, id_number, phone, created_at, updated_at)
  values ('cus-1', 'CUS-1', 'Existing Customer', '11111111', '0711111111', 'now', 'now');
insert into public.treasury(id, cash_in_vault, mpesa_till_balance, bank_balance, trevor_capital, peter_capital, retained_profit, updated_at)
  values ('t1', 1000, 0, 0, 0, 0, 0, 'now');
insert into public.ledger_transactions(id, transaction_number, receipt_number, branch_id, transaction_type, amount, principal_portion, interest_portion, balance_after, payment_method, received_by, transaction_date, created_at)
  values ('l1', 'TX-1', 'RC-1', 'b1', 'PAYMENT', 100, 100, 0, 0, 'CASH', 'Cashier 1', 'today', 'now');
insert into public.audit_logs(id, user_name, action, entity_type, entity_id, details, created_at)
  values ('au1', 'Admin', 'LOGIN', 'USER', 'u-admin', 'seed', 'now');
insert into public.cashier_sessions(id, cashier_id, cashier_name, branch_id, session_date, opened_at, opening_cash) values
  ('s1', 'u-c1', 'Cashier 1', 'b1', 'today', 'now', 500),
  ('s2', 'u-c2', 'Cashier 2', 'b1', 'today', 'now', 500);
insert into public.payment_void_requests(id, request_number, payment_id, receipt_number, customer_name, amount, cashier_id, cashier_name, reason, created_at)
  values ('v1', 'VR-1', 'p1', 'RC-1', 'Existing Customer', 100, 'u-c1', 'Cashier 1', 'typo', 'now');

\set ADMIN '''00000000-0000-0000-0000-0000000000a1'''
\set C1    '''00000000-0000-0000-0000-0000000000c1'''
\set C3    '''00000000-0000-0000-0000-0000000000c3'''
\set D4    '''00000000-0000-0000-0000-0000000000d4'''

-- ----- not signed in -----
select t.expect('anon cannot read customers',  t.run('anon', null, 'select * from public.customers'), 'ERR:42501');
select t.expect('anon cannot read treasury',   t.run('anon', null, 'select * from public.treasury'),  'ERR:42501');

-- ----- signed in but not a staff member / deactivated -----
select t.expect('login without staff row sees no customers', t.run('authenticated', :D4::uuid, 'select * from public.customers'), '0');
select t.expect('deactivated cashier sees no customers',      t.run('authenticated', :C3::uuid, 'select * from public.customers'), '0');
select t.expect('deactivated cashier cannot add customers',   t.run('authenticated', :C3::uuid,
  $q$insert into public.customers(id,customer_number,name,id_number,phone,created_at,updated_at) values('x1','CUS-X1','X','999','07','n','n')$q$), 'ERR:42501');

-- ----- active cashier: everyday work allowed -----
select t.expect('cashier reads customers', t.run('authenticated', :C1::uuid, 'select * from public.customers'), '1');
select t.expect('cashier adds a customer', t.run('authenticated', :C1::uuid,
  $q$insert into public.customers(id,customer_number,name,id_number,phone,created_at,updated_at) values('cus-2','CUS-2','New','22222222','0722222222','n','n')$q$), '1');
select t.expect('cashier edits a customer', t.run('authenticated', :C1::uuid, $q$update public.customers set phone='0733333333' where id='cus-2'$q$), '1');
select t.expect('cashier cannot delete a customer', t.run('authenticated', :C1::uuid, $q$delete from public.customers where id='cus-2'$q$), '0');

-- ----- active cashier: restricted areas -----
select t.expect('cashier cannot see treasury',        t.run('authenticated', :C1::uuid, 'select * from public.treasury'), '0');
select t.expect('cashier cannot change treasury',     t.run('authenticated', :C1::uuid, 'update public.treasury set cash_in_vault = 999999'), '0');
select t.expect('cashier cannot add an expense',      t.run('authenticated', :C1::uuid,
  $q$insert into public.operating_expenses(id,expense_number,branch_id,category,description,amount,payment_method,paid_by,approved_by,expense_date,created_at) values('e1','EX-1','b1','Rent','x',1,'CASH','c','c','n','n')$q$), 'ERR:42501');
select t.expect('cashier cannot see audit log',       t.run('authenticated', :C1::uuid, 'select * from public.audit_logs'), '0');
select t.expect('cashier can write to audit log',     t.run('authenticated', :C1::uuid,
  $q$insert into public.audit_logs(id,user_name,action,entity_type,entity_id,details,created_at) values('au2','Cashier 1','LOGIN','USER','u-c1','ok','n')$q$), '1');

-- ----- ledger is append-only -----
select t.expect('cashier reads ledger',          t.run('authenticated', :C1::uuid, 'select * from public.ledger_transactions'), '1');
select t.expect('cashier adds ledger entry',     t.run('authenticated', :C1::uuid,
  $q$insert into public.ledger_transactions(id,transaction_number,receipt_number,branch_id,transaction_type,amount,principal_portion,interest_portion,balance_after,payment_method,received_by,transaction_date,created_at) values('l2','TX-2','RC-2','b1','PAYMENT',50,50,0,0,'CASH','Cashier 1','today','now')$q$), '1');
select t.expect('cashier cannot edit ledger',    t.run('authenticated', :C1::uuid, $q$update public.ledger_transactions set amount = 1 where id = 'l1'$q$), '0');
select t.expect('cashier cannot delete ledger',  t.run('authenticated', :C1::uuid, $q$delete from public.ledger_transactions$q$), '0');
select t.expect('even admin cannot edit ledger', t.run('authenticated', :ADMIN::uuid, $q$update public.ledger_transactions set amount = 1 where id = 'l1'$q$), '0');
select t.expect('even admin cannot delete ledger', t.run('authenticated', :ADMIN::uuid, $q$delete from public.ledger_transactions$q$), '0');

-- ----- till sessions & void requests -----
select t.expect('cashier sees only own till session',  t.run('authenticated', :C1::uuid, 'select * from public.cashier_sessions'), '1');
select t.expect('admin sees all till sessions',        t.run('authenticated', :ADMIN::uuid, 'select * from public.cashier_sessions'), '2');
select t.expect('cashier cannot open session for someone else', t.run('authenticated', :C1::uuid,
  $q$insert into public.cashier_sessions(id,cashier_id,cashier_name,branch_id,session_date,opened_at,opening_cash) values('s9','u-c2','Cashier 2','b1','today','now',1)$q$), 'ERR:42501');
select t.expect('cashier cannot edit another cashier''s session', t.run('authenticated', :C1::uuid, $q$update public.cashier_sessions set opening_cash = 0 where id = 's2'$q$), '0');
select t.expect('cashier can edit own session',        t.run('authenticated', :C1::uuid, $q$update public.cashier_sessions set notes = 'ok' where id = 's1'$q$), '1');
select t.expect('cashier raises own void request',     t.run('authenticated', :C1::uuid,
  $q$insert into public.payment_void_requests(id,request_number,payment_id,receipt_number,customer_name,amount,cashier_id,cashier_name,reason,created_at) values('v2','VR-2','p2','RC-2','C',50,'u-c1','Cashier 1','typo','n')$q$), '1');
select t.expect('cashier cannot raise request as someone else', t.run('authenticated', :C1::uuid,
  $q$insert into public.payment_void_requests(id,request_number,payment_id,receipt_number,customer_name,amount,cashier_id,cashier_name,reason,created_at) values('v3','VR-3','p3','RC-3','C',50,'u-c2','Cashier 2','typo','n')$q$), 'ERR:42501');
select t.expect('cashier cannot approve own void request', t.run('authenticated', :C1::uuid, $q$update public.payment_void_requests set status = 'APPROVED' where id = 'v1'$q$), '0');
select t.expect('admin approves a void request',          t.run('authenticated', :ADMIN::uuid, $q$update public.payment_void_requests set status = 'APPROVED' where id = 'v1'$q$), '1');

-- ----- staff accounts -----
select t.expect('cashier sees only own account',        t.run('authenticated', :C1::uuid, 'select * from public.users'), '1');
select t.expect('admin sees all accounts',              t.run('authenticated', :ADMIN::uuid, 'select * from public.users'), '4');
select t.expect('cashier cannot promote themselves',    t.run('authenticated', :C1::uuid, $q$update public.users set role_id = 'role-admin' where id = 'u-c1'$q$), '0');
select t.expect('cashier cannot create an admin account', t.run('authenticated', :C1::uuid,
  $q$insert into public.users(id,username,full_name,email,phone,role_id,role_title,created_at) values('u-evil','evil','E','e@x','07','role-admin','Director','n')$q$), 'ERR:42501');

-- ----- admin powers -----
select t.expect('admin sees treasury',            t.run('authenticated', :ADMIN::uuid, 'select * from public.treasury'), '1');
select t.expect('admin updates treasury',         t.run('authenticated', :ADMIN::uuid, 'update public.treasury set cash_in_vault = 2000'), '1');
select t.expect('admin reads audit log',          t.run('authenticated', :ADMIN::uuid, 'select * from public.audit_logs'), '2');
select t.expect('admin can delete a customer',    t.run('authenticated', :ADMIN::uuid, $q$delete from public.customers where id = 'cus-2'$q$), '1');
select t.expect('admin deactivates a cashier',    t.run('authenticated', :ADMIN::uuid, $q$update public.users set is_active = 0 where id = 'u-c2'$q$), '1');

\echo
\echo ALL CHECKS PASSED
