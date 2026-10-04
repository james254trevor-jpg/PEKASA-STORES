-- PEKASA STORE - access rules (row level security)
--
-- These rules are enforced by the DATABASE, so they hold even if someone edits the web app in
-- their browser. Today the app only hides admin screens; after the move these rules decide.
--
--   Not signed in (anon) ........ no access to anything
--   Staff (active user) ......... read/write day-to-day records; cannot delete them
--   Cashier ..................... only sees and edits their own till sessions and void requests
--   Admin (role-admin) .......... everything, including treasury, expenses, sales, staff accounts
--   Ledger + audit log .......... append-only: rows can be added, never changed or removed
--
-- Every signed-in login must have a matching row in public.users (linked by auth_user_id) that is
-- active. A login with no row, or a deactivated row, has no access at all.

-- ---------------------------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so they can read public.users without tripping its own rules)
-- ---------------------------------------------------------------------------------------------
create or replace function public.app_user_id() returns text
language sql stable security definer set search_path = ''
as $$
  select u.id from public.users u
  where u.auth_user_id = auth.uid() and coalesce(u.is_active, 1) = 1
$$;

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

revoke all on function public.app_user_id(), public.is_staff(), public.is_admin() from public, anon;
grant execute on function public.app_user_id(), public.is_staff(), public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Lock everything down first, then open up exactly what each role needs
-- ---------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

revoke all on all tables in schema public from anon;

-- Day-to-day records: any active staff member can read, add and edit; only admins can delete.
do $$
declare t text;
begin
  foreach t in array array[
    'customers','collateral_items','rehani_loans','loan_renewals','appliances','appliance_photos',
    'payments','invoices','invoice_items','parts','stock_movements','suppliers','sequence_counters'
  ] loop
    execute format('create policy "staff read"   on public.%I for select to authenticated using (public.is_staff())', t);
    execute format('create policy "staff add"    on public.%I for insert to authenticated with check (public.is_staff())', t);
    execute format('create policy "staff edit"   on public.%I for update to authenticated using (public.is_staff()) with check (public.is_staff())', t);
    execute format('create policy "admin delete" on public.%I for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- Reference data: staff can read, only admins can change.
do $$
declare t text;
begin
  foreach t in array array['branches','ltv_configs','user_roles'] loop
    execute format('create policy "staff read"  on public.%I for select to authenticated using (public.is_staff())', t);
    execute format('create policy "admin write" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Money and disposal records: admins only (collateral sales, operating expenses, treasury).
do $$
declare t text;
begin
  foreach t in array array['collateral_sales','operating_expenses','treasury'] loop
    execute format('create policy "admin only" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Append-only: ledger entries and the audit log can be added but never edited or deleted.
create policy "staff read"  on public.ledger_transactions for select to authenticated using (public.is_staff());
create policy "staff add"   on public.ledger_transactions for insert to authenticated with check (public.is_staff());

create policy "admin read"  on public.audit_logs for select to authenticated using (public.is_admin());
create policy "staff add"   on public.audit_logs for insert to authenticated with check (public.is_staff());

-- Till sessions: a cashier sees and edits only their own; admins see and approve all.
create policy "own or admin read" on public.cashier_sessions for select to authenticated
  using (public.is_admin() or cashier_id = public.app_user_id());
create policy "own open"          on public.cashier_sessions for insert to authenticated
  with check (cashier_id = public.app_user_id());
create policy "own or admin edit" on public.cashier_sessions for update to authenticated
  using (public.is_admin() or cashier_id = public.app_user_id())
  with check (public.is_admin() or cashier_id = public.app_user_id());
create policy "admin delete"      on public.cashier_sessions for delete to authenticated using (public.is_admin());

-- Void requests: a cashier can raise and see their own; only admins can approve/reject (edit) them.
create policy "own or admin read" on public.payment_void_requests for select to authenticated
  using (public.is_admin() or cashier_id = public.app_user_id());
create policy "own raise"         on public.payment_void_requests for insert to authenticated
  with check (cashier_id = public.app_user_id());
create policy "admin review"      on public.payment_void_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin delete"      on public.payment_void_requests for delete to authenticated using (public.is_admin());

-- Staff accounts: everyone can see their own row, admins see and manage all. Nobody can promote
-- themselves, because only admins can write to this table.
create policy "own or admin read" on public.users for select to authenticated
  using (public.is_admin() or auth_user_id = auth.uid());
create policy "admin write"       on public.users for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
