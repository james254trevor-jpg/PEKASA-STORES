-- PEKASA STORE - branch separation + role tiers (replaces the access rules from 20261004000100)
--
-- Safe to run whether or not the earlier access-rules migration was already applied: it removes every
-- existing policy in the public schema and recreates them.
--
-- WHO CAN DO WHAT
--   Admin (role-admin, the directors) ... all branches, every table, deletes, staff accounts, treasury
--   Everyone else ....................... ONLY records of their own branch (users.branch_id). A staff
--                                         member with no branch assigned sees nothing.
--   What a branch user may change is driven by the role's permission list (user_roles.permissions_json),
--   the same list you already edit in the app, so no SQL is needed to adjust a role:
--
--     can_manage_appliances ... customers, collateral items, appliances, photos
--     can_issue_money ......... loans (and registering customers)
--     can_renew_loans ......... loan renewals
--     can_record_payments ..... payments, invoices, ledger entries
--     can_manage_parts ........ parts, stock movements, suppliers
--     can_manage_expenses ..... operating expenses (view + add + edit)
--     can_authorize_sales ..... collateral sales (view + add + edit)
--     can_view_financials ..... read-only view of expenses and sales
--
--   With the app's current role settings that gives:
--     Cashier ... take payments and write ledger entries, read the branch's customers / loans /
--                 collateral, run their own till, raise void requests
--     Manager ... everything a cashier does, plus issue and renew loans, manage collateral, customers,
--                 parts, expenses and collateral sales for THEIR branch; see every till session in the
--                 branch and approve void requests; read the branch's staff list and audit log.
--                 No staff-account management, no treasury, no deleting.
--
--   Always admin-only: treasury (partners' capital), deleting records, staff accounts, role settings.
--   Always append-only: ledger entries and the audit log can be added but never edited or removed.

-- ---------------------------------------------------------------------------------------------
-- 1. Give customers, parts and audit entries a branch (filled in automatically from the signed-in
--    staff member, so the app does not have to send it)
-- ---------------------------------------------------------------------------------------------
alter table public.customers  add column if not exists branch_id text;
alter table public.parts      add column if not exists branch_id text;
alter table public.audit_logs add column if not exists branch_id text;

create index if not exists customers_branch_id_idx  on public.customers (branch_id);
create index if not exists parts_branch_id_idx      on public.parts (branch_id);
create index if not exists audit_logs_branch_id_idx on public.audit_logs (branch_id);

-- ---------------------------------------------------------------------------------------------
-- 2. Helper functions (SECURITY DEFINER so they can read users/roles regardless of the caller's rules)
-- ---------------------------------------------------------------------------------------------
create or replace function public.app_user_id() returns text
language sql stable security definer set search_path = ''
as $$
  select u.id from public.users u
  where u.auth_user_id = auth.uid() and coalesce(u.is_active, 1) = 1
$$;

create or replace function public.app_user_branch() returns text
language sql stable security definer set search_path = ''
as $$
  select u.branch_id from public.users u
  where u.auth_user_id = auth.uid() and coalesce(u.is_active, 1) = 1
$$;

create or replace function public.branch_of_user(uid text) returns text
language sql stable security definer set search_path = ''
as $$ select u.branch_id from public.users u where u.id = uid $$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.users u
                 where u.auth_user_id = auth.uid() and coalesce(u.is_active, 1) = 1)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.users u
                 where u.auth_user_id = auth.uid() and coalesce(u.is_active, 1) = 1
                   and u.role_id = 'role-admin')
$$;

create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.users u
                 where u.auth_user_id = auth.uid() and coalesce(u.is_active, 1) = 1
                   and u.role_id = 'role-manager')
$$;

-- True for admins (every branch) and for staff whose own branch matches. Unknown branch = false.
create or replace function public.in_my_branch(b text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin()
      or (b is not null and b = public.app_user_branch())
$$;

-- True for admins, or if the signed-in user's role has ANY of the listed permissions switched on.
create or replace function public.can_any(perms text[]) returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin()
      or exists (
        select 1
        from public.users u
        join public.user_roles r on r.id = u.role_id
        cross join unnest(perms) as p
        where u.auth_user_id = auth.uid() and coalesce(u.is_active, 1) = 1
          and coalesce((r.permissions_json::jsonb ->> p)::boolean, false)
      )
$$;

revoke all on function
  public.app_user_id(), public.app_user_branch(), public.branch_of_user(text), public.is_staff(),
  public.is_admin(), public.is_manager(), public.in_my_branch(text), public.can_any(text[])
from public, anon;
grant execute on function
  public.app_user_id(), public.app_user_branch(), public.branch_of_user(text), public.is_staff(),
  public.is_admin(), public.is_manager(), public.in_my_branch(text), public.can_any(text[])
to authenticated;

-- Stamp new customers / parts / audit entries with the creating user's branch when none is given.
create or replace function public.set_branch_from_user() returns trigger
language plpgsql as $$
begin
  if new.branch_id is null then
    new.branch_id := public.app_user_branch();
  end if;
  return new;
end $$;

drop trigger if exists set_branch on public.customers;
drop trigger if exists set_branch on public.parts;
drop trigger if exists set_branch on public.audit_logs;
create trigger set_branch before insert on public.customers  for each row execute function public.set_branch_from_user();
create trigger set_branch before insert on public.parts      for each row execute function public.set_branch_from_user();
create trigger set_branch before insert on public.audit_logs for each row execute function public.set_branch_from_user();

-- ---------------------------------------------------------------------------------------------
-- 3. Start clean: lock every table, remove every old policy
-- ---------------------------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------------------------
-- 4. Policies. A small helper writes the standard four (read / add / edit / admin-only delete).
-- ---------------------------------------------------------------------------------------------
create or replace function pg_temp.standard_policies(tbl text, read_cond text, write_cond text)
returns void language plpgsql as $$
begin
  execute format('create policy "read"   on public.%I for select to authenticated using (%s)', tbl, read_cond);
  execute format('create policy "add"    on public.%I for insert to authenticated with check (%s)', tbl, write_cond);
  execute format('create policy "edit"   on public.%I for update to authenticated using (%s) with check (%s)', tbl, write_cond, write_cond);
  execute format('create policy "delete" on public.%I for delete to authenticated using (public.is_admin())', tbl);
end $$;

-- Where each record's branch comes from (directly, or through the customer / loan / part it belongs to)
-- customers.branch_id, collateral_items.branch_id, rehani_loans.branch_id, parts.branch_id : direct
-- appliances, payments, invoices ........ via customer_id
-- appliance_photos ...................... via appliance -> customer
-- invoice_items ......................... via invoice -> customer
-- loan_renewals ......................... via loan_id
-- stock_movements ....................... via part_id
select pg_temp.standard_policies('customers',        'public.in_my_branch(branch_id)',
  $c$public.in_my_branch(branch_id) and public.can_any(array['can_manage_appliances','can_issue_money'])$c$);

select pg_temp.standard_policies('collateral_items', 'public.in_my_branch(branch_id)',
  $c$public.in_my_branch(branch_id) and public.can_any(array['can_manage_appliances'])$c$);

select pg_temp.standard_policies('rehani_loans',     'public.in_my_branch(branch_id)',
  $c$public.in_my_branch(branch_id) and public.can_any(array['can_issue_money'])$c$);

select pg_temp.standard_policies('loan_renewals',
  $c$public.in_my_branch((select l.branch_id from public.rehani_loans l where l.id = loan_id))$c$,
  $c$public.in_my_branch((select l.branch_id from public.rehani_loans l where l.id = loan_id))
     and public.can_any(array['can_renew_loans'])$c$);

select pg_temp.standard_policies('appliances',
  $c$public.in_my_branch((select c.branch_id from public.customers c where c.id = customer_id))$c$,
  $c$public.in_my_branch((select c.branch_id from public.customers c where c.id = customer_id))
     and public.can_any(array['can_manage_appliances'])$c$);

select pg_temp.standard_policies('appliance_photos',
  $c$public.in_my_branch((select c.branch_id from public.appliances a join public.customers c on c.id = a.customer_id where a.id = appliance_id))$c$,
  $c$public.in_my_branch((select c.branch_id from public.appliances a join public.customers c on c.id = a.customer_id where a.id = appliance_id))
     and public.can_any(array['can_manage_appliances'])$c$);

select pg_temp.standard_policies('payments',
  $c$public.in_my_branch((select c.branch_id from public.customers c where c.id = customer_id))$c$,
  $c$public.in_my_branch((select c.branch_id from public.customers c where c.id = customer_id))
     and public.can_any(array['can_record_payments'])$c$);

select pg_temp.standard_policies('invoices',
  $c$public.in_my_branch((select c.branch_id from public.customers c where c.id = customer_id))$c$,
  $c$public.in_my_branch((select c.branch_id from public.customers c where c.id = customer_id))
     and public.can_any(array['can_record_payments'])$c$);

select pg_temp.standard_policies('invoice_items',
  $c$public.in_my_branch((select c.branch_id from public.invoices i join public.customers c on c.id = i.customer_id where i.id = invoice_id))$c$,
  $c$public.in_my_branch((select c.branch_id from public.invoices i join public.customers c on c.id = i.customer_id where i.id = invoice_id))
     and public.can_any(array['can_record_payments'])$c$);

select pg_temp.standard_policies('parts',            'public.in_my_branch(branch_id)',
  $c$public.in_my_branch(branch_id) and public.can_any(array['can_manage_parts'])$c$);

select pg_temp.standard_policies('stock_movements',
  $c$public.in_my_branch((select p.branch_id from public.parts p where p.id = part_id))$c$,
  $c$public.in_my_branch((select p.branch_id from public.parts p where p.id = part_id))
     and public.can_any(array['can_manage_parts'])$c$);

-- Money out / disposal: the branch's own expenses and collateral sales, for roles that hold the permission
select pg_temp.standard_policies('operating_expenses',
  $c$public.in_my_branch(branch_id) and public.can_any(array['can_manage_expenses','can_view_financials'])$c$,
  $c$public.in_my_branch(branch_id) and public.can_any(array['can_manage_expenses'])$c$);

select pg_temp.standard_policies('collateral_sales',
  $c$public.in_my_branch(branch_id) and public.can_any(array['can_authorize_sales','can_view_financials'])$c$,
  $c$public.in_my_branch(branch_id) and public.can_any(array['can_authorize_sales'])$c$);

-- Ledger: append-only. Read your branch; add if you may record payments; nobody edits or deletes.
create policy "read" on public.ledger_transactions for select to authenticated
  using (public.in_my_branch(branch_id));
create policy "add"  on public.ledger_transactions for insert to authenticated
  with check (public.in_my_branch(branch_id) and public.can_any(array['can_record_payments']));

-- Audit log: append-only. Anyone active may write; admins read all, managers read their branch.
create policy "read" on public.audit_logs for select to authenticated
  using (public.is_admin() or (public.is_manager() and public.in_my_branch(branch_id)));
create policy "add"  on public.audit_logs for insert to authenticated
  with check (public.is_staff() and (branch_id is null or public.in_my_branch(branch_id)));

-- Till sessions: cashiers see/edit their own; managers see/reconcile every session in their branch.
create policy "read" on public.cashier_sessions for select to authenticated
  using (public.is_admin() or cashier_id = public.app_user_id()
         or (public.is_manager() and public.in_my_branch(branch_id)));
create policy "add"  on public.cashier_sessions for insert to authenticated
  with check (cashier_id = public.app_user_id() and public.in_my_branch(branch_id));
create policy "edit" on public.cashier_sessions for update to authenticated
  using (public.is_admin() or cashier_id = public.app_user_id()
         or (public.is_manager() and public.in_my_branch(branch_id)))
  with check (public.is_admin() or cashier_id = public.app_user_id()
         or (public.is_manager() and public.in_my_branch(branch_id)));
create policy "delete" on public.cashier_sessions for delete to authenticated using (public.is_admin());

-- Void requests: a cashier raises and sees their own; managers review requests from their branch.
create policy "read" on public.payment_void_requests for select to authenticated
  using (public.is_admin() or cashier_id = public.app_user_id()
         or (public.is_manager() and public.in_my_branch(public.branch_of_user(cashier_id))));
create policy "add"  on public.payment_void_requests for insert to authenticated
  with check (cashier_id = public.app_user_id());
create policy "review" on public.payment_void_requests for update to authenticated
  using (public.is_admin() or (public.is_manager() and public.in_my_branch(public.branch_of_user(cashier_id))))
  with check (public.is_admin() or (public.is_manager() and public.in_my_branch(public.branch_of_user(cashier_id))));
create policy "delete" on public.payment_void_requests for delete to authenticated using (public.is_admin());

-- Staff accounts: you see yourself; managers also see their branch's staff; only admins change accounts.
create policy "read"  on public.users for select to authenticated
  using (public.is_admin() or auth_user_id = auth.uid()
         or (public.is_manager() and public.in_my_branch(branch_id)));
create policy "admin write" on public.users for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Branches: staff see their own branch; admins see and manage all.
create policy "read"  on public.branches for select to authenticated using (public.in_my_branch(id));
create policy "admin write" on public.branches for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Shared reference data: any active staff can read; only admins change it.
create policy "read"  on public.user_roles for select to authenticated using (public.is_staff());
create policy "admin write" on public.user_roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "read"  on public.ltv_configs for select to authenticated using (public.is_staff());
create policy "admin write" on public.ltv_configs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Suppliers are a shared vendor list: everyone reads, parts managers edit, admins delete.
create policy "read"   on public.suppliers for select to authenticated using (public.is_staff());
create policy "add"    on public.suppliers for insert to authenticated with check (public.can_any(array['can_manage_parts']));
create policy "edit"   on public.suppliers for update to authenticated
  using (public.can_any(array['can_manage_parts'])) with check (public.can_any(array['can_manage_parts']));
create policy "delete" on public.suppliers for delete to authenticated using (public.is_admin());

-- Number counters (receipts, loans...) are shared by all branches; staff may read and advance them.
create policy "read"  on public.sequence_counters for select to authenticated using (public.is_staff());
create policy "add"   on public.sequence_counters for insert to authenticated with check (public.is_staff());
create policy "edit"  on public.sequence_counters for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "delete" on public.sequence_counters for delete to authenticated using (public.is_admin());

-- Treasury holds the partners' capital: admins only.
create policy "admin only" on public.treasury for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
