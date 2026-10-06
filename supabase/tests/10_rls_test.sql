-- Behaviour tests for branch separation, role tiers and append-only records.
-- Runs on a plain PostgreSQL server after: 00_supabase_shim.sql, then ALL migrations in order.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/10_rls_test.sql
-- Any failed check aborts with an error; a clean run ends with "ALL CHECKS PASSED".

create schema if not exists t;

-- Run one statement as a database role + logged-in user; returns rows affected, or ERR:<sqlstate>.
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

-- Person -> login id. 'anon' is not a person.
create or replace function t.uid(who text) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(case who
    when 'admin' then '1' when 'mgr1' then '2' when 'cash1' then '3' when 'cash1b' then '4'
    when 'mgr2' then '5' when 'cash2' then '6' when 'inactive' then '7' when 'nobranch' then '8'
    when 'norow' then '9' end, 12, '0'))::uuid
$$;

create or replace function t.as(who text, stmt text) returns text language sql as $$
  select t.run('authenticated', t.uid(who), stmt)
$$;

create or replace function t.expect(label text, got text, want text) returns void
language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % (expected %, got %)', label, want, got;
  end if;
  raise notice 'pass: %', label;
end $$;

-- Build an INSERT that fills every required column with a dummy value, except the ones you set.
create or replace function t.ins(tbl text, ov jsonb default '{}') returns text language plpgsql as $$
declare cols text := ''; vals text := ''; r record; v text;
begin
  for r in select column_name, data_type from information_schema.columns
           where table_schema = 'public' and table_name = tbl
             and ((is_nullable = 'NO' and column_default is null) or ov ? column_name)
           order by ordinal_position loop
    cols := cols || quote_ident(r.column_name) || ',';
    if ov ? r.column_name then v := quote_nullable(ov ->> r.column_name);
    elsif r.data_type = 'text' then v := quote_literal('x' || substr(md5(random()::text), 1, 10));
    elsif r.data_type in ('numeric', 'integer') then v := '1';
    else v := 'null'; end if;
    vals := vals || v || ',';
  end loop;
  return format('insert into public.%I (%s) values (%s)', tbl, rtrim(cols, ','), rtrim(vals, ','));
end $$;

create or replace function t.seed(tbl text, ov jsonb) returns void language plpgsql as $$
begin execute t.ins(tbl, ov); end $$;

-- ===================================== fixtures (as superuser) =====================================
do $$ declare r record; begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('truncate public.%I', r.tablename);
  end loop;
end $$;
delete from auth.users;

insert into auth.users(id) select t.uid(w) from unnest(array['admin','mgr1','cash1','cash1b','mgr2','cash2','inactive','nobranch','norow']) w;

select t.seed('branches', '{"id":"b1","is_main":"1"}'), t.seed('branches', '{"id":"b2","is_main":"0"}');

-- role permissions exactly as the app defines them (src/db/sqlite.ts)
select t.seed('user_roles', jsonb_build_object('id','role-admin','permissions_json',
  '{"can_manage_appliances":true,"can_issue_money":true,"can_record_payments":true,"can_manage_parts":true,"can_manage_expenses":true,"can_view_financials":true,"can_manage_users":true,"can_backup_restore":true,"can_authorize_sales":true,"can_renew_loans":true}'));
select t.seed('user_roles', jsonb_build_object('id','role-manager','permissions_json',
  '{"can_manage_appliances":true,"can_issue_money":true,"can_record_payments":true,"can_manage_parts":true,"can_manage_expenses":true,"can_view_financials":true,"can_manage_users":false,"can_backup_restore":false,"can_authorize_sales":true,"can_renew_loans":true}'));
select t.seed('user_roles', jsonb_build_object('id','role-cashier','permissions_json',
  '{"can_manage_appliances":false,"can_issue_money":false,"can_record_payments":true,"can_manage_parts":false,"can_manage_expenses":false,"can_view_financials":false,"can_manage_users":false,"can_backup_restore":false,"can_authorize_sales":false,"can_renew_loans":false}'));

select t.seed('users', jsonb_build_object('id','f-'||w,'username',w,'role_id',r,'branch_id',b,'is_active',a::text,'auth_user_id',t.uid(w)::text))
from (values ('admin','role-admin','b1',1),('mgr1','role-manager','b1',1),('cash1','role-cashier','b1',1),
             ('cash1b','role-cashier','b1',1),('mgr2','role-manager','b2',1),('cash2','role-cashier','b2',1),
             ('inactive','role-cashier','b1',0)) v(w,r,b,a);
select t.seed('users', jsonb_build_object('id','f-nobranch','username','nobranch','role_id','role-cashier','branch_id',null,'is_active','1','auth_user_id',t.uid('nobranch')::text));

-- one record per branch in every branch-owned table (ids start with f- so tests can ignore rows they create)
select t.seed('customers',          '{"id":"f-cus-b1","branch_id":"b1"}'),            t.seed('customers',          '{"id":"f-cus-b2","branch_id":"b2"}');
select t.seed('collateral_items',   '{"id":"f-col-b1","branch_id":"b1","customer_id":"f-cus-b1"}'), t.seed('collateral_items', '{"id":"f-col-b2","branch_id":"b2","customer_id":"f-cus-b2"}');
select t.seed('rehani_loans',       '{"id":"f-loan-b1","branch_id":"b1","customer_id":"f-cus-b1","collateral_id":"f-col-b1"}'),
       t.seed('rehani_loans',       '{"id":"f-loan-b2","branch_id":"b2","customer_id":"f-cus-b2","collateral_id":"f-col-b2"}');
select t.seed('loan_renewals',      '{"id":"f-ren-b1","loan_id":"f-loan-b1"}'),       t.seed('loan_renewals',      '{"id":"f-ren-b2","loan_id":"f-loan-b2"}');
select t.seed('appliances',         '{"id":"f-app-b1","customer_id":"f-cus-b1"}'),    t.seed('appliances',         '{"id":"f-app-b2","customer_id":"f-cus-b2"}');
select t.seed('appliance_photos',   '{"id":"f-ph-b1","appliance_id":"f-app-b1"}'),    t.seed('appliance_photos',   '{"id":"f-ph-b2","appliance_id":"f-app-b2"}');
select t.seed('payments',           '{"id":"f-pay-b1","customer_id":"f-cus-b1","appliance_id":"f-app-b1"}'),
       t.seed('payments',           '{"id":"f-pay-b2","customer_id":"f-cus-b2","appliance_id":"f-app-b2"}');
select t.seed('invoices',           '{"id":"f-inv-b1","customer_id":"f-cus-b1","appliance_id":"f-app-b1"}'),
       t.seed('invoices',           '{"id":"f-inv-b2","customer_id":"f-cus-b2","appliance_id":"f-app-b2"}');
select t.seed('invoice_items',      '{"id":"f-ii-b1","invoice_id":"f-inv-b1"}'),      t.seed('invoice_items',      '{"id":"f-ii-b2","invoice_id":"f-inv-b2"}');
select t.seed('parts',              '{"id":"f-part-b1","branch_id":"b1"}'),           t.seed('parts',              '{"id":"f-part-b2","branch_id":"b2"}');
select t.seed('stock_movements',    '{"id":"f-sm-b1","part_id":"f-part-b1"}'),        t.seed('stock_movements',    '{"id":"f-sm-b2","part_id":"f-part-b2"}');
select t.seed('ledger_transactions','{"id":"f-led-b1","branch_id":"b1"}'),            t.seed('ledger_transactions','{"id":"f-led-b2","branch_id":"b2"}');
select t.seed('operating_expenses', '{"id":"f-ex-b1","branch_id":"b1"}'),             t.seed('operating_expenses', '{"id":"f-ex-b2","branch_id":"b2"}');
select t.seed('collateral_sales',   '{"id":"f-sale-b1","branch_id":"b1"}'),           t.seed('collateral_sales',   '{"id":"f-sale-b2","branch_id":"b2"}');
select t.seed('audit_logs',         '{"id":"f-au-b1","branch_id":"b1"}'),             t.seed('audit_logs',         '{"id":"f-au-b2","branch_id":"b2"}');
select t.seed('cashier_sessions',   '{"id":"f-s-c1","cashier_id":"f-cash1","branch_id":"b1"}'),
       t.seed('cashier_sessions',   '{"id":"f-s-c1b","cashier_id":"f-cash1b","branch_id":"b1"}'),
       t.seed('cashier_sessions',   '{"id":"f-s-c2","cashier_id":"f-cash2","branch_id":"b2"}');
select t.seed('payment_void_requests','{"id":"f-v-c1","cashier_id":"f-cash1"}'),      t.seed('payment_void_requests','{"id":"f-v-c2","cashier_id":"f-cash2"}');
select t.seed('suppliers',          '{"id":"f-sup"}');
select t.seed('treasury',           '{"id":"f-treasury"}');

-- ================================= not signed in / not allowed in =================================
select t.expect('anon cannot read customers', t.run('anon', null, 'select * from public.customers'), 'ERR:42501');
select t.expect('anon cannot read treasury',  t.run('anon', null, 'select * from public.treasury'),  'ERR:42501');
select t.expect('login with no staff row sees nothing',   t.as('norow',    $q$select * from public.customers where id like 'f-%'$q$), '0');
select t.expect('deactivated cashier sees nothing',        t.as('inactive', $q$select * from public.customers where id like 'f-%'$q$), '0');
select t.expect('staff with no branch assigned sees nothing', t.as('nobranch', $q$select * from public.customers where id like 'f-%'$q$), '0');

-- ================================= branches are kept apart =================================
-- every branch-owned table: a branch user sees exactly their own branch's row, admin sees both
do $$ declare tbl text; begin
  foreach tbl in array array['customers','collateral_items','rehani_loans','loan_renewals','appliances','appliance_photos',
                             'payments','invoices','invoice_items','parts','stock_movements','ledger_transactions'] loop
    perform t.expect('cashier (branch 1) sees only branch 1 ' || tbl, t.as('cash1', format($q$select * from public.%I where id like 'f-%%'$q$, tbl)), '1');
    perform t.expect('manager (branch 2) sees only branch 2 ' || tbl, t.as('mgr2',  format($q$select * from public.%I where id like 'f-%%'$q$, tbl)), '1');
    perform t.expect('admin sees both branches in ' || tbl,           t.as('admin', format($q$select * from public.%I where id like 'f-%%'$q$, tbl)), '2');
  end loop;
end $$;

select t.expect('branch 1 manager sees only branch 1 data and it is the right row',
  t.as('mgr1', $q$select * from public.customers where id = 'f-cus-b2'$q$), '0');
select t.expect('manager cannot add a customer to another branch', t.as('mgr1',
  t.ins('customers', '{"id":"y1","branch_id":"b2"}')), 'ERR:42501');
select t.expect('manager cannot issue a loan in another branch', t.as('mgr1',
  t.ins('rehani_loans', '{"id":"y2","branch_id":"b2"}')), 'ERR:42501');
select t.expect('manager cannot record a payment for another branch''s customer', t.as('mgr1',
  t.ins('payments', '{"id":"y3","customer_id":"f-cus-b2"}')), 'ERR:42501');
select t.expect('manager cannot edit another branch''s customer', t.as('mgr1', $q$update public.customers set notes='x' where id='f-cus-b2'$q$), '0');
select t.expect('manager cannot edit another branch''s expense',  t.as('mgr1', $q$update public.operating_expenses set description='x' where id='f-ex-b2'$q$), '0');
select t.expect('cashier sees only own branch''s branch record', t.as('cash1', $q$select * from public.branches$q$), '1');
select t.expect('admin sees all branch records',                  t.as('admin', $q$select * from public.branches$q$), '2');

-- new customers/parts are stamped with the creator's branch automatically
select t.expect('manager adds a customer without sending a branch', t.as('mgr1', t.ins('customers', '{"id":"new-cus"}')), '1');
select t.expect('...and it was stamped with branch 1', (select branch_id from public.customers where id = 'new-cus'), 'b1');
select t.expect('...so a branch 2 user cannot see it', t.as('mgr2', $q$select * from public.customers where id = 'new-cus'$q$), '0');
select t.expect('manager adds a part without sending a branch', t.as('mgr1', t.ins('parts', '{"id":"new-part"}')), '1');
select t.expect('...stamped with branch 1', (select branch_id from public.parts where id = 'new-part'), 'b1');

-- ================================= cashier tier =================================
select t.expect('cashier records a payment in own branch',      t.as('cash1', t.ins('payments', '{"id":"c-pay","customer_id":"f-cus-b1"}')), '1');
select t.expect('cashier cannot record a payment in another branch', t.as('cash1', t.ins('payments', '{"id":"c-pay2","customer_id":"f-cus-b2"}')), 'ERR:42501');
select t.expect('cashier adds a ledger entry in own branch',    t.as('cash1', t.ins('ledger_transactions', '{"id":"c-led","branch_id":"b1"}')), '1');
select t.expect('cashier cannot add a ledger entry for another branch', t.as('cash1', t.ins('ledger_transactions', '{"id":"c-led2","branch_id":"b2"}')), 'ERR:42501');
select t.expect('cashier cannot issue a loan',        t.as('cash1', t.ins('rehani_loans', '{"id":"c-loan","branch_id":"b1"}')), 'ERR:42501');
select t.expect('cashier cannot renew a loan',        t.as('cash1', t.ins('loan_renewals', '{"id":"c-ren","loan_id":"f-loan-b1"}')), 'ERR:42501');
select t.expect('cashier cannot add collateral',      t.as('cash1', t.ins('collateral_items', '{"id":"c-col","branch_id":"b1","customer_id":"f-cus-b1"}')), 'ERR:42501');
select t.expect('cashier cannot register a customer', t.as('cash1', t.ins('customers', '{"id":"c-cus","branch_id":"b1"}')), 'ERR:42501');
select t.expect('cashier cannot add parts',           t.as('cash1', t.ins('parts', '{"id":"c-part","branch_id":"b1"}')), 'ERR:42501');
select t.expect('cashier cannot edit a loan',         t.as('cash1', $q$update public.rehani_loans set notes='x' where id='f-loan-b1'$q$), '0');
select t.expect('cashier cannot see expenses',        t.as('cash1', $q$select * from public.operating_expenses where id like 'f-%'$q$), '0');
select t.expect('cashier cannot add an expense',      t.as('cash1', t.ins('operating_expenses', '{"id":"c-ex","branch_id":"b1"}')), 'ERR:42501');
select t.expect('cashier cannot see collateral sales', t.as('cash1', $q$select * from public.collateral_sales where id like 'f-%'$q$), '0');
select t.expect('cashier cannot see treasury',        t.as('cash1', 'select * from public.treasury'), '0');
select t.expect('cashier cannot see the audit log',   t.as('cash1', $q$select * from public.audit_logs where id like 'f-%'$q$), '0');
select t.expect('cashier can read suppliers',         t.as('cash1', 'select * from public.suppliers'), '1');
select t.expect('cashier cannot add a supplier',      t.as('cash1', t.ins('suppliers', '{"id":"c-sup"}')), 'ERR:42501');
select t.expect('cashier cannot delete anything',     t.as('cash1', $q$delete from public.customers where id='f-cus-b1'$q$), '0');

-- ================================= manager tier =================================
select t.expect('manager issues a loan in own branch',    t.as('mgr1', t.ins('rehani_loans', '{"id":"m-loan","branch_id":"b1"}')), '1');
select t.expect('manager renews a loan in own branch',    t.as('mgr1', t.ins('loan_renewals', '{"id":"m-ren","loan_id":"f-loan-b1"}')), '1');
select t.expect('manager cannot renew another branch''s loan', t.as('mgr1', t.ins('loan_renewals', '{"id":"m-ren2","loan_id":"f-loan-b2"}')), 'ERR:42501');
select t.expect('manager adds collateral in own branch',  t.as('mgr1', t.ins('collateral_items', '{"id":"m-col","branch_id":"b1","customer_id":"f-cus-b1"}')), '1');
select t.expect('manager edits a loan in own branch',     t.as('mgr1', $q$update public.rehani_loans set notes='ok' where id='f-loan-b1'$q$), '1');
select t.expect('manager sees only own branch expenses',  t.as('mgr1', $q$select * from public.operating_expenses where id like 'f-%'$q$), '1');
select t.expect('manager adds an expense in own branch',  t.as('mgr1', t.ins('operating_expenses', '{"id":"m-ex","branch_id":"b1"}')), '1');
select t.expect('manager sees only own branch sales',     t.as('mgr1', $q$select * from public.collateral_sales where id like 'f-%'$q$), '1');
select t.expect('manager authorises a sale in own branch', t.as('mgr1', t.ins('collateral_sales', '{"id":"m-sale","branch_id":"b1"}')), '1');
select t.expect('manager cannot authorise a sale for another branch', t.as('mgr1', t.ins('collateral_sales', '{"id":"m-sale2","branch_id":"b2"}')), 'ERR:42501');
select t.expect('manager adds a supplier',                t.as('mgr1', t.ins('suppliers', '{"id":"m-sup"}')), '1');
select t.expect('manager CANNOT see treasury',            t.as('mgr1', 'select * from public.treasury'), '0');
select t.expect('manager CANNOT change treasury',         t.as('mgr1', 'update public.treasury set cash_in_vault = 1'), '0');
select t.expect('manager CANNOT delete a customer',       t.as('mgr1', $q$delete from public.customers where id='f-cus-b1'$q$), '0');
select t.expect('manager CANNOT delete a loan',           t.as('mgr1', $q$delete from public.rehani_loans where id='f-loan-b1'$q$), '0');
select t.expect('manager CANNOT delete an expense',       t.as('mgr1', $q$delete from public.operating_expenses where id='f-ex-b1'$q$), '0');
select t.expect('manager CANNOT create a staff account',  t.as('mgr1', t.ins('users', '{"id":"m-user","role_id":"role-admin","branch_id":"b1"}')), 'ERR:42501');
select t.expect('manager CANNOT promote anyone',          t.as('mgr1', $q$update public.users set role_id='role-admin' where id='f-cash1'$q$), '0');
select t.expect('manager CANNOT edit role settings',      t.as('mgr1', $q$update public.user_roles set permissions_json='{}' where id='role-cashier'$q$), '0');
select t.expect('manager sees own branch staff only (5 of 8)', t.as('mgr1', $q$select * from public.users where id like 'f-%'$q$), '5');
select t.expect('cashier sees only themselves in staff list',  t.as('cash1', $q$select * from public.users where id like 'f-%'$q$), '1');
select t.expect('admin sees all staff',                        t.as('admin', $q$select * from public.users where id like 'f-%'$q$), '8');

-- ================================= tills & void requests =================================
select t.expect('cashier sees only own till session',        t.as('cash1', $q$select * from public.cashier_sessions where id like 'f-%'$q$), '1');
select t.expect('manager sees every session in own branch',  t.as('mgr1',  $q$select * from public.cashier_sessions where id like 'f-%'$q$), '2');
select t.expect('other branch manager sees only theirs',     t.as('mgr2',  $q$select * from public.cashier_sessions where id like 'f-%'$q$), '1');
select t.expect('admin sees all sessions',                   t.as('admin', $q$select * from public.cashier_sessions where id like 'f-%'$q$), '3');
select t.expect('cashier edits own session',                 t.as('cash1', $q$update public.cashier_sessions set notes='ok' where id='f-s-c1'$q$), '1');
select t.expect('cashier cannot edit a colleague''s session', t.as('cash1', $q$update public.cashier_sessions set notes='x' where id='f-s-c1b'$q$), '0');
select t.expect('manager reconciles a cashier in own branch', t.as('mgr1', $q$update public.cashier_sessions set reconciliation_status='APPROVED' where id='f-s-c1b'$q$), '1');
select t.expect('manager cannot touch another branch''s till', t.as('mgr1', $q$update public.cashier_sessions set reconciliation_status='APPROVED' where id='f-s-c2'$q$), '0');
select t.expect('cashier cannot open a till as someone else', t.as('cash1', t.ins('cashier_sessions', '{"id":"c-s","cashier_id":"f-cash1b","branch_id":"b1"}')), 'ERR:42501');
select t.expect('cashier cannot open a till in another branch', t.as('cash1', t.ins('cashier_sessions', '{"id":"c-s2","cashier_id":"f-cash1","branch_id":"b2"}')), 'ERR:42501');
select t.expect('cashier raises own void request',            t.as('cash1', t.ins('payment_void_requests', '{"id":"c-v","cashier_id":"f-cash1"}')), '1');
select t.expect('cashier cannot raise a request as someone else', t.as('cash1', t.ins('payment_void_requests', '{"id":"c-v2","cashier_id":"f-cash1b"}')), 'ERR:42501');
select t.expect('cashier cannot approve own void request',    t.as('cash1', $q$update public.payment_void_requests set status='APPROVED' where id='f-v-c1'$q$), '0');
select t.expect('manager approves a void request from own branch', t.as('mgr1', $q$update public.payment_void_requests set status='APPROVED' where id='f-v-c1'$q$), '1');
select t.expect('manager cannot approve another branch''s request', t.as('mgr1', $q$update public.payment_void_requests set status='APPROVED' where id='f-v-c2'$q$), '0');
select t.expect('manager sees only own branch void requests', t.as('mgr1', $q$select * from public.payment_void_requests where id like 'f-%'$q$), '1');

-- ================================= ledger & audit are append-only =================================
select t.expect('cashier cannot edit the ledger',       t.as('cash1', $q$update public.ledger_transactions set amount=9 where id='f-led-b1'$q$), '0');
select t.expect('manager cannot edit the ledger',       t.as('mgr1',  $q$update public.ledger_transactions set amount=9 where id='f-led-b1'$q$), '0');
select t.expect('even admin cannot edit the ledger',    t.as('admin', $q$update public.ledger_transactions set amount=9 where id='f-led-b1'$q$), '0');
select t.expect('even admin cannot delete ledger rows', t.as('admin', $q$delete from public.ledger_transactions$q$), '0');
select t.expect('manager reads own branch audit log only', t.as('mgr1', $q$select * from public.audit_logs where id like 'f-%'$q$), '1');
select t.expect('admin reads the whole audit log',         t.as('admin', $q$select * from public.audit_logs where id like 'f-%'$q$), '2');
select t.expect('cashier can write an audit entry (stamped with own branch)', t.as('cash1', t.ins('audit_logs', '{"id":"c-au"}')), '1');
select t.expect('...stamped with branch 1', (select branch_id from public.audit_logs where id = 'c-au'), 'b1');
select t.expect('cashier cannot write an audit entry for another branch', t.as('cash1', t.ins('audit_logs', '{"id":"c-au2","branch_id":"b2"}')), 'ERR:42501');
select t.expect('nobody can edit audit entries', t.as('admin', $q$update public.audit_logs set details='x'$q$), '0');
select t.expect('nobody can delete audit entries', t.as('admin', $q$delete from public.audit_logs$q$), '0');

-- ================================= permissions follow the role settings =================================
select t.expect('admin lets cashiers issue loans (tick the permission)', t.as('admin',
  $q$update public.user_roles set permissions_json = '{"can_issue_money":true,"can_record_payments":true}' where id='role-cashier'$q$), '1');
select t.expect('...cashier can now issue a loan in own branch',     t.as('cash1', t.ins('rehani_loans', '{"id":"c-loan-ok","branch_id":"b1"}')), '1');
select t.expect('...but still not in another branch',                t.as('cash1', t.ins('rehani_loans', '{"id":"c-loan-no","branch_id":"b2"}')), 'ERR:42501');
select t.expect('...and still cannot add collateral (not ticked)',   t.as('cash1', t.ins('collateral_items', '{"id":"c-col2","branch_id":"b1","customer_id":"f-cus-b1"}')), 'ERR:42501');
select t.expect('a cashier cannot change role settings themselves',  t.as('cash1', $q$update public.user_roles set permissions_json='{"can_manage_expenses":true}' where id='role-cashier'$q$), '0');

-- ================================= admin =================================
select t.expect('admin sees treasury',          t.as('admin', 'select * from public.treasury'), '1');
select t.expect('admin updates treasury',       t.as('admin', 'update public.treasury set cash_in_vault = 2000'), '1');
select t.expect('admin deletes a customer',     t.as('admin', $q$delete from public.customers where id='f-cus-b1'$q$), '1');
select t.expect('admin deactivates a cashier',  t.as('admin', $q$update public.users set is_active = 0 where id='f-cash1'$q$), '1');
select t.expect('a deactivated cashier is locked out at once', t.as('cash1', $q$select * from public.customers where id like 'f-%'$q$), '0');

\echo
\echo ALL CHECKS PASSED
