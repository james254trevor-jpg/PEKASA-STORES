export type UserPermission = 
  | 'can_manage_appliances'
  | 'can_issue_money'
  | 'can_record_payments'
  | 'can_manage_parts'
  | 'can_manage_expenses'
  | 'can_view_financials'
  | 'can_manage_users'
  | 'can_backup_restore'
  | 'can_authorize_sales'
  | 'can_renew_loans';

export interface UserRole {
  id: string;
  name: string;
  description: string;
  permissions: Record<UserPermission, boolean>;
}

export interface User {
  id: string;
  username: string;
  full_name: string;
  email: string;
  phone: string;
  password_hash: string;
  salt: string;
  role_id: string;
  role_title: string;
  branch_id?: string;
  is_active?: boolean;
  created_at: string;
  last_login: string | null;
  avatar_url?: string;
  address?: string;
  notes?: string;
  appearance_theme?: string;
  notification_preferences?: string;
  two_factor_enabled?: boolean;
}

export type RoleType = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'TECHNICIAN';

export interface BusinessSettings {
  business_name: string;
  business_motto: string;
  business_phone: string;
  business_phone_alt: string;
  business_email: string;
  business_address: string;
  currency: string;
  tax_rate: number;
  tax_enabled: boolean;
  receipt_footer: string;
  invoice_prefix: string;
  receipt_prefix: string;
  session_timeout_minutes: number;
  logo_url?: string;
}

export interface NotificationSettings {
  low_stock_alerts: boolean;
  new_customer_alerts: boolean;
  new_sales_alerts: boolean;
  payment_alerts: boolean;
  system_alerts: boolean;
  browser_notifications: boolean;
  sound_alerts: boolean;
}

export interface CustomThemeConfig {
  themeMode: 'dark' | 'light' | 'system';
  primaryColor: string;
  secondaryColor: string;
  backgroundColor?: string;
  sidebarColor?: string;
  buttonColor?: string;
  textColor?: string;
  presetName?: string;
  sidebarStyle: 'standard' | 'compact' | 'glass';
  density: 'comfortable' | 'compact';
  fontSize: 'normal' | 'small' | 'large';
}

export interface CashierSession {
  id: string;
  cashier_id: string;
  cashier_name: string;
  branch_id: string;
  session_date: string;
  opened_at: string;
  closed_at?: string | null;
  opening_cash: number;
  cash_collected: number;
  mpesa_collected: number;
  other_collected: number;
  expected_cash: number;
  actual_cash?: number | null;
  difference?: number | null;
  status: 'OPEN' | 'CLOSED';
  reconciliation_status: 'PENDING_APPROVAL' | 'APPROVED' | 'DISCREPANCY_FLAGGED';
  reconciliation_approved_by?: string | null;
  reconciliation_notes?: string | null;
  notes?: string | null;
}

export interface PaymentVoidRequest {
  id: string;
  request_number: string;
  payment_id: string;
  receipt_number: string;
  loan_number?: string;
  customer_name: string;
  amount: number;
  cashier_id: string;
  cashier_name: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  admin_notes?: string | null;
  created_at: string;
}

export const STORE_NAME = 'PEKASA STORES';
export const STORE_MOTTO = 'We buy and sell used second hand goods, cash against furnitures, fridges, TVs, Woofers, Gas cylinders, Mattress Etc.';
export const STORE_TEL = '0727108749';
export const STORE_TEL_ALT = '0180366344';
export const STORE_PHONES = ['0727108749', '0180366344'];

export interface Branch {
  id: string;
  code: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  is_main: boolean;
}

export const DEFAULT_BRANCHES: Branch[] = [
  {
    id: 'br-nairobi',
    code: 'NBO-01',
    name: 'Nairobi Main Branch (HQ)',
    city: 'Nairobi',
    address: 'Kasarani / Kahawa West Commercial Arcade, Nairobi',
    phone: '0727108749 / 0180366344',
    is_main: true
  },
  {
    id: 'br-mombasa',
    code: 'MSA-01',
    name: 'Mombasa Coast Branch',
    city: 'Mombasa',
    address: 'Mwembe Tayari Road, Mombasa',
    phone: '0727108749',
    is_main: false
  },
  {
    id: 'br-eldoret',
    code: 'ELD-01',
    name: 'Eldoret Rift Branch',
    city: 'Eldoret',
    address: 'Uganda Road, Eldoret',
    phone: '0180366344',
    is_main: false
  }
];

export type CustomerStatus = 'Good Standing' | 'Watchlist' | 'High Risk' | 'Blacklisted';

export interface Customer {
  id: string;
  customer_number: string; // CUS-2026-000125
  name: string;
  id_number: string;
  phone: string;
  alt_phone: string; // Option for N/A
  email?: string;
  address: string;
  county: string;
  photo_url?: string;
  id_photo_url?: string;
  status: CustomerStatus;
  notes: string;
  // Computed / aggregated history metrics
  previous_loans_count: number;
  total_borrowed: number;
  total_repaid: number;
  current_balance: number;
  defaults_count: number;
  created_at: string;
  updated_at: string;
}

export const COLLATERAL_CATEGORIES = [
  'TV',
  'Laptop/PC',
  'Smartphone/Tablet',
  'Refrigerator',
  'Washing Machine',
  'Woofer/Sound System',
  'Gas Cylinder/Cooker',
  'Microwave',
  'Furniture',
  'Power Tools/Machinery',
  'Jewellery',
  'Air Conditioner',
  'Bed & Mattress',
  'Other Collateral'
] as const;

export type CollateralCategory = typeof COLLATERAL_CATEGORIES[number];

// Configurable Category LTV limits
export interface LTVConfig {
  category: CollateralCategory;
  max_ltv_percent: number;
  description: string;
}

export const DEFAULT_LTV_CONFIGS: Record<CollateralCategory, number> = {
  'Smartphone/Tablet': 60,
  'Laptop/PC': 60,
  'TV': 55,
  'Refrigerator': 50,
  'Washing Machine': 50,
  'Woofer/Sound System': 50,
  'Gas Cylinder/Cooker': 55,
  'Microwave': 50,
  'Jewellery': 70,
  'Furniture': 40,
  'Power Tools/Machinery': 50,
  'Air Conditioner': 50,
  'Bed & Mattress': 40,
  'Other Collateral': 45
};

export type CollateralStatus = 
  | 'Held (Active Loan)'
  | 'Redeemed'
  | 'Notice Issued'
  | 'Grace Period'
  | 'Available for Sale'
  | 'Sold'
  | 'Lost/Damaged';

export interface CollateralItem {
  id: string;
  collateral_number: string; // COL-2026-000842
  customer_id: string;
  branch_id: string;
  category: CollateralCategory;
  custom_category?: string;
  item_name: string;
  brand: string;
  model: string;
  serial_number?: string;
  imei_1?: string;
  imei_2?: string;
  colour?: string;
  condition: string;
  age?: string;
  accessories_included: string;
  
  // Electronics specific attributes
  tv_screen_size?: string;
  tv_remote_included?: boolean;
  tv_stand_included?: boolean;
  
  laptop_processor?: string;
  laptop_ram?: string;
  laptop_storage?: string;
  laptop_charger?: boolean;
  laptop_battery_condition?: string;

  // Valuation
  original_purchase_price?: number;
  market_value: number;
  estimated_resale_value: number;
  max_allowed_loan: number;
  amount_offered: number;

  // Storage Location
  storage_room: string;
  rack_shelf: string; // e.g. "Rack B3 / Shelf 7"
  security_tag: string;

  // Photos & Evidence
  photo_front?: string;
  photo_back?: string;
  photo_serial?: string;
  photo_damage?: string;
  photo_accessories?: string;

  // Backward compatibility & appliance mapping
  appliance_number?: string;
  due_date?: string;
  amount_received?: number;
  funder?: string;
  technician_name?: string;
  interest_charges?: number;

  status: CollateralStatus;
  date_received: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type LoanStatus = 
  | 'ACTIVE'
  | 'DUE_SOON'
  | 'DUE_TODAY'
  | 'OVERDUE'
  | 'DEFAULT_ENFORCEMENT'
  | 'REDEEMED'
  | 'RENEWED'
  | 'SOLD';

export interface RehaniLoan {
  id: string;
  loan_number: string; // LN-2026-004521
  customer_id: string;
  collateral_id: string;
  branch_id: string;
  principal_amount: number;
  interest_rate_percent: number;
  interest_amount: number;
  storage_fee: number;
  total_amount_due: number;
  amount_paid: number;
  balance_remaining: number;
  
  term_days: number; // 7, 14, 21, 30 days
  issue_date: string;
  due_date: string;
  grace_period_days: number;
  maturity_date: string; // due_date + grace_period_days

  funder: 'Trevor' | 'Peter' | 'Shop Treasury';
  disbursement_method: 'Cash' | 'M-Pesa' | 'Bank';
  disbursement_reference?: string;

  status: LoanStatus;
  renewals_count: number;
  staff_issuer: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface LoanRenewal {
  id: string;
  renewal_number: string; // RNW-2026-0001
  loan_id: string;
  previous_due_date: string;
  new_due_date: string;
  previous_principal: number;
  accrued_interest_paid: number;
  renewal_charge: number;
  total_paid: number;
  payment_method: 'M-Pesa' | 'Cash' | 'Bank';
  reference_code?: string;
  approved_by: string; // Trevor or Peter
  renewal_date: string;
  notes?: string;
}

export type LedgerEntryType = 
  | 'LOAN_ISSUED'
  | 'PARTIAL_PAYMENT'
  | 'FULL_SETTLEMENT'
  | 'RENEWAL_FEE'
  | 'COLLATERAL_SALE'
  | 'FEE_ADJUSTMENT';

export type PaymentMethod = 'M-Pesa' | 'Cash' | 'Bank' | 'Card';

export interface LedgerTransaction {
  id: string;
  transaction_number: string; // TXN-2026-0001
  receipt_number: string;     // RCT-2026-0001
  loan_id?: string;
  collateral_id?: string;
  appliance_id?: string;
  customer_id?: string;
  branch_id: string;
  transaction_type: LedgerEntryType;
  amount: number;
  principal_portion: number;
  interest_portion: number;
  balance_after: number;
  payment_method: PaymentMethod;
  mpesa_reference?: string;
  mpesa_code?: string;
  mpesa_phone?: string;
  mpesa_sender?: string;
  received_by: string;
  notes?: string;
  transaction_date: string;
  payment_date?: string;
  created_at: string;
}

export interface CollateralSale {
  id: string;
  sale_number: string; // SAL-2026-0001
  collateral_id: string;
  loan_id: string;
  customer_id: string;
  branch_id: string;
  original_market_value: number;
  outstanding_loan_balance: number;
  selling_price: number;
  profit_or_loss: number; // selling_price - outstanding_loan_balance
  buyer_name: string;
  buyer_phone: string;
  buyer_id_number?: string;
  payment_method: 'M-Pesa' | 'Cash' | 'Bank';
  payment_reference?: string;
  authorized_by: string; // Trevor or Peter
  disposition_reason: string; // Defaulted beyond grace period
  sale_date: string;
  notes?: string;
}

export interface OperatingExpense {
  id: string;
  expense_number: string; // EXP-2026-0001
  branch_id: string;
  category: 
    | 'Rent'
    | 'Salaries'
    | 'Electricity/Tokens'
    | 'Security'
    | 'Transport'
    | 'Repairs & Maintenance'
    | 'Airtime & Internet'
    | 'M-Pesa / Bank Charges'
    | 'Shop Supplies'
    | 'Legal & Licensing'
    | 'Other Expense';
  description: string;
  amount: number;
  payment_method: 'M-Pesa' | 'Cash' | 'Bank';
  paid_by: 'Trevor' | 'Peter' | 'Shop Petty Cash';
  reference_code?: string;
  receipt_photo_url?: string;
  approved_by: string;
  expense_date: string;
  notes?: string;
  created_at: string;
}

export interface TreasuryAccount {
  cash_in_vault: number;
  mpesa_till_balance: number;
  bank_balance: number;
  trevor_capital: number;
  peter_capital: number;
  retained_profit: number;
}

export interface AuditLog {
  id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  created_at: string;
}

export interface AppliancePhoto {
  id: string;
  appliance_id: string;
  photo_url: string;
  caption?: string;
  uploaded_at: string;
}

export interface Part {
  id: string;
  sku: string;
  name: string;
  category: string;
  supplier_id?: string;
  cost_price: number;
  selling_price: number;
  quantity: number;
  reorder_level: number;
  location?: string;
  created_at: string;
  updated_at: string;
}

export interface PersonalGood {
  id: string; item_name: string; category: string; details?: string; item_condition?: string;
  purchase_price: number; asking_price: number; seller_name?: string; purchase_date: string;
  status: 'IN_STOCK' | 'SOLD'; sale_price?: number | null; buyer_name?: string; buyer_phone?: string;
  sale_date?: string | null; payment_method?: string; payment_reference?: string; notes?: string;
  created_by: string; created_at: string; updated_at: string;
}

export interface StockMovement {
  id: string;
  part_id: string;
  movement_type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reference_type: 'PURCHASE' | 'REPAIR' | 'SALE' | 'AUDIT';
  reference_id?: string;
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  phone: string;
  email?: string;
  address?: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  appliance_id?: string;
  customer_id: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax: number;
  total_amount: number;
  status: 'Unpaid' | 'Partial' | 'Paid' | 'Cancelled';
  notes?: string;
  created_at: string;
}

// Backward compatibility aliases
export type Appliance = CollateralItem;
export type Payment = LedgerTransaction;
export type Expense = OperatingExpense;
export type ApplianceCategory = CollateralCategory;
export type ApplianceStatus = CollateralStatus;
export const APPLIANCE_CATEGORIES = COLLATERAL_CATEGORIES;

