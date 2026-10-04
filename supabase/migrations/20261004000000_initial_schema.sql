-- PEKASA STORE - hosted database schema (PostgreSQL / Supabase)
--
-- Generated from the browser SQLite schema in src/db/sqlite.ts (24 tables) so the data can move
-- over one-to-one. Differences from the SQLite version:
--   * REAL money/number columns become numeric (exact decimals, no rounding drift)
--   * users.password_hash and users.salt are NOT carried over: Supabase Auth stores passwords properly
--   * users.auth_user_id links each staff row to its Supabase Auth login
--   * dates stay as text for now so existing data imports unchanged (convert to timestamptz later)
--   * photo columns still hold base64 text; move them to Supabase Storage before go-live (see docs)
--
-- Access rules (row level security) are in the next migration file.

create table if not exists public.user_roles (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  permissions_json text NOT NULL
);

create table if not exists public.users (
  id text PRIMARY KEY,
  username text UNIQUE NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  role_id text NOT NULL,
  role_title text NOT NULL,
  branch_id text,
  is_active integer DEFAULT 1,
  created_at text NOT NULL,
  last_login text,
  auth_user_id uuid unique references auth.users(id) on delete set null
);

create table if not exists public.branches (
  id text PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  city text NOT NULL,
  address text NOT NULL,
  phone text NOT NULL,
  is_main integer NOT NULL
);

create table if not exists public.customers (
  id text PRIMARY KEY,
  customer_number text UNIQUE NOT NULL,
  name text NOT NULL,
  id_number text UNIQUE NOT NULL,
  phone text NOT NULL,
  alt_phone text,
  address text,
  county text,
  photo_url text,
  id_photo_url text,
  status text NOT NULL DEFAULT 'Good Standing',
  notes text,
  defaults_count integer DEFAULT 0,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

create table if not exists public.collateral_items (
  id text PRIMARY KEY,
  collateral_number text UNIQUE NOT NULL,
  customer_id text NOT NULL,
  branch_id text NOT NULL,
  category text NOT NULL,
  custom_category text,
  item_name text NOT NULL,
  brand text NOT NULL,
  model text NOT NULL,
  serial_number text,
  imei_1 text,
  imei_2 text,
  colour text,
  condition text NOT NULL,
  age text,
  accessories_included text,
  tv_screen_size text,
  tv_remote_included integer,
  tv_stand_included integer,
  laptop_processor text,
  laptop_ram text,
  laptop_storage text,
  laptop_charger integer,
  laptop_battery_condition text,
  original_purchase_price numeric,
  market_value numeric NOT NULL,
  estimated_resale_value numeric NOT NULL,
  max_allowed_loan numeric NOT NULL,
  amount_offered numeric NOT NULL,
  storage_room text NOT NULL,
  rack_shelf text NOT NULL,
  security_tag text,
  photo_front text,
  photo_back text,
  photo_serial text,
  photo_damage text,
  photo_accessories text,
  status text NOT NULL,
  date_received text NOT NULL,
  notes text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

create table if not exists public.rehani_loans (
  id text PRIMARY KEY,
  loan_number text UNIQUE NOT NULL,
  customer_id text NOT NULL,
  collateral_id text NOT NULL,
  branch_id text NOT NULL,
  principal_amount numeric NOT NULL,
  interest_rate_percent numeric NOT NULL,
  interest_amount numeric NOT NULL,
  storage_fee numeric NOT NULL,
  total_amount_due numeric NOT NULL,
  amount_paid numeric NOT NULL DEFAULT 0,
  balance_remaining numeric NOT NULL,
  term_days integer NOT NULL,
  issue_date text NOT NULL,
  due_date text NOT NULL,
  grace_period_days integer NOT NULL,
  maturity_date text NOT NULL,
  funder text NOT NULL,
  disbursement_method text NOT NULL,
  disbursement_reference text,
  status text NOT NULL,
  renewals_count integer NOT NULL DEFAULT 0,
  staff_issuer text NOT NULL,
  notes text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

create table if not exists public.loan_renewals (
  id text PRIMARY KEY,
  renewal_number text UNIQUE NOT NULL,
  loan_id text NOT NULL,
  previous_due_date text NOT NULL,
  new_due_date text NOT NULL,
  previous_principal numeric NOT NULL,
  accrued_interest_paid numeric NOT NULL,
  renewal_charge numeric NOT NULL,
  total_paid numeric NOT NULL,
  payment_method text NOT NULL,
  reference_code text,
  approved_by text NOT NULL,
  renewal_date text NOT NULL,
  notes text
);

create table if not exists public.ledger_transactions (
  id text PRIMARY KEY,
  transaction_number text UNIQUE NOT NULL,
  receipt_number text UNIQUE NOT NULL,
  loan_id text,
  collateral_id text,
  customer_id text,
  branch_id text NOT NULL,
  transaction_type text NOT NULL,
  amount numeric NOT NULL,
  principal_portion numeric NOT NULL,
  interest_portion numeric NOT NULL,
  balance_after numeric NOT NULL,
  payment_method text NOT NULL,
  mpesa_reference text,
  mpesa_phone text,
  received_by text NOT NULL,
  notes text,
  transaction_date text NOT NULL,
  created_at text NOT NULL
);

create table if not exists public.collateral_sales (
  id text PRIMARY KEY,
  sale_number text UNIQUE NOT NULL,
  collateral_id text NOT NULL,
  loan_id text NOT NULL,
  customer_id text NOT NULL,
  branch_id text NOT NULL,
  original_market_value numeric NOT NULL,
  outstanding_loan_balance numeric NOT NULL,
  selling_price numeric NOT NULL,
  profit_or_loss numeric NOT NULL,
  buyer_name text NOT NULL,
  buyer_phone text NOT NULL,
  buyer_id_number text,
  payment_method text NOT NULL,
  payment_reference text,
  authorized_by text NOT NULL,
  disposition_reason text NOT NULL,
  sale_date text NOT NULL,
  notes text
);

create table if not exists public.operating_expenses (
  id text PRIMARY KEY,
  expense_number text UNIQUE NOT NULL,
  branch_id text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL,
  payment_method text NOT NULL,
  paid_by text NOT NULL,
  reference_code text,
  receipt_photo_url text,
  approved_by text NOT NULL,
  expense_date text NOT NULL,
  created_at text NOT NULL
);

create table if not exists public.treasury (
  id text PRIMARY KEY,
  cash_in_vault numeric NOT NULL,
  mpesa_till_balance numeric NOT NULL,
  bank_balance numeric NOT NULL,
  trevor_capital numeric NOT NULL,
  peter_capital numeric NOT NULL,
  retained_profit numeric NOT NULL,
  updated_at text NOT NULL
);

create table if not exists public.ltv_configs (
  category text PRIMARY KEY,
  max_ltv_percent numeric NOT NULL
);

create table if not exists public.audit_logs (
  id text PRIMARY KEY,
  user_name text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  details text NOT NULL,
  created_at text NOT NULL
);

create table if not exists public.sequence_counters (
  prefix text PRIMARY KEY,
  current_year integer NOT NULL,
  last_sequence integer NOT NULL
);

create table if not exists public.appliances (
  id text PRIMARY KEY,
  appliance_number text UNIQUE NOT NULL,
  customer_id text NOT NULL,
  category text NOT NULL,
  custom_category text,
  brand text NOT NULL,
  model text NOT NULL,
  serial_number text,
  condition text NOT NULL,
  market_value numeric NOT NULL,
  amount_received numeric NOT NULL,
  funder text NOT NULL,
  date_received text NOT NULL,
  due_date text NOT NULL,
  status text NOT NULL,
  technician_name text,
  interest_charges numeric DEFAULT 0,
  notes text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

create table if not exists public.payments (
  id text PRIMARY KEY,
  receipt_number text UNIQUE NOT NULL,
  appliance_id text NOT NULL,
  customer_id text NOT NULL,
  amount numeric NOT NULL,
  payment_method text NOT NULL,
  mpesa_code text,
  mpesa_phone text,
  mpesa_sender text,
  received_by text NOT NULL,
  notes text,
  payment_date text NOT NULL,
  created_at text NOT NULL
);

create table if not exists public.appliance_photos (
  id text PRIMARY KEY,
  appliance_id text NOT NULL,
  photo_url text NOT NULL,
  caption text,
  uploaded_at text NOT NULL
);

create table if not exists public.invoices (
  id text PRIMARY KEY,
  invoice_number text UNIQUE NOT NULL,
  appliance_id text,
  customer_id text NOT NULL,
  issue_date text NOT NULL,
  due_date text NOT NULL,
  subtotal numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Unpaid',
  notes text,
  created_at text NOT NULL
);

create table if not exists public.invoice_items (
  id text PRIMARY KEY,
  invoice_id text NOT NULL,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0
);

create table if not exists public.parts (
  id text PRIMARY KEY,
  sku text UNIQUE NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  supplier_id text,
  cost_price numeric NOT NULL DEFAULT 0,
  selling_price numeric NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 0,
  reorder_level integer NOT NULL DEFAULT 0,
  location text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

create table if not exists public.stock_movements (
  id text PRIMARY KEY,
  part_id text NOT NULL,
  movement_type text NOT NULL,
  quantity integer NOT NULL,
  reference_type text NOT NULL,
  reference_id text,
  notes text,
  created_by text NOT NULL,
  created_at text NOT NULL
);

create table if not exists public.suppliers (
  id text PRIMARY KEY,
  name text NOT NULL,
  contact_person text,
  phone text NOT NULL,
  email text,
  address text,
  created_at text NOT NULL
);

create table if not exists public.cashier_sessions (
  id text PRIMARY KEY,
  cashier_id text NOT NULL,
  cashier_name text NOT NULL,
  branch_id text NOT NULL,
  session_date text NOT NULL,
  opened_at text NOT NULL,
  closed_at text,
  opening_cash numeric NOT NULL,
  cash_collected numeric DEFAULT 0,
  mpesa_collected numeric DEFAULT 0,
  other_collected numeric DEFAULT 0,
  expected_cash numeric DEFAULT 0,
  actual_cash numeric,
  difference numeric,
  status text NOT NULL DEFAULT 'OPEN',
  reconciliation_status text NOT NULL DEFAULT 'PENDING_APPROVAL',
  reconciliation_approved_by text,
  reconciliation_notes text,
  notes text
);

create table if not exists public.payment_void_requests (
  id text PRIMARY KEY,
  request_number text UNIQUE NOT NULL,
  payment_id text NOT NULL,
  receipt_number text NOT NULL,
  loan_number text,
  customer_name text NOT NULL,
  amount numeric NOT NULL,
  cashier_id text NOT NULL,
  cashier_name text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  reviewed_by text,
  reviewed_at text,
  admin_notes text,
  created_at text NOT NULL
);

-- Indexes on the columns the app joins and filters by
create index if not exists users_role_id_idx on public.users (role_id);
create index if not exists users_branch_id_idx on public.users (branch_id);
create index if not exists collateral_items_customer_id_idx on public.collateral_items (customer_id);
create index if not exists collateral_items_branch_id_idx on public.collateral_items (branch_id);
create index if not exists rehani_loans_customer_id_idx on public.rehani_loans (customer_id);
create index if not exists rehani_loans_collateral_id_idx on public.rehani_loans (collateral_id);
create index if not exists rehani_loans_branch_id_idx on public.rehani_loans (branch_id);
create index if not exists loan_renewals_loan_id_idx on public.loan_renewals (loan_id);
create index if not exists ledger_transactions_loan_id_idx on public.ledger_transactions (loan_id);
create index if not exists ledger_transactions_collateral_id_idx on public.ledger_transactions (collateral_id);
create index if not exists ledger_transactions_customer_id_idx on public.ledger_transactions (customer_id);
create index if not exists ledger_transactions_branch_id_idx on public.ledger_transactions (branch_id);
create index if not exists collateral_sales_collateral_id_idx on public.collateral_sales (collateral_id);
create index if not exists collateral_sales_loan_id_idx on public.collateral_sales (loan_id);
create index if not exists collateral_sales_customer_id_idx on public.collateral_sales (customer_id);
create index if not exists collateral_sales_branch_id_idx on public.collateral_sales (branch_id);
create index if not exists operating_expenses_branch_id_idx on public.operating_expenses (branch_id);
create index if not exists audit_logs_entity_id_idx on public.audit_logs (entity_id);
create index if not exists appliances_customer_id_idx on public.appliances (customer_id);
create index if not exists payments_appliance_id_idx on public.payments (appliance_id);
create index if not exists payments_customer_id_idx on public.payments (customer_id);
create index if not exists appliance_photos_appliance_id_idx on public.appliance_photos (appliance_id);
create index if not exists invoices_appliance_id_idx on public.invoices (appliance_id);
create index if not exists invoices_customer_id_idx on public.invoices (customer_id);
create index if not exists invoice_items_invoice_id_idx on public.invoice_items (invoice_id);
create index if not exists parts_supplier_id_idx on public.parts (supplier_id);
create index if not exists stock_movements_part_id_idx on public.stock_movements (part_id);
create index if not exists stock_movements_reference_id_idx on public.stock_movements (reference_id);
create index if not exists cashier_sessions_cashier_id_idx on public.cashier_sessions (cashier_id);
create index if not exists cashier_sessions_branch_id_idx on public.cashier_sessions (branch_id);
create index if not exists payment_void_requests_payment_id_idx on public.payment_void_requests (payment_id);
create index if not exists payment_void_requests_cashier_id_idx on public.payment_void_requests (cashier_id);
