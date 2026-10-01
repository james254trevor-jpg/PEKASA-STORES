export type UserPermission = 
  | 'can_manage_appliances'
  | 'can_issue_money'
  | 'can_record_payments'
  | 'can_manage_parts'
  | 'can_manage_expenses'
  | 'can_view_financials'
  | 'can_manage_users'
  | 'can_backup_restore';

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
  created_at: string;
  last_login: string | null;
}

export const STORE_NAME = 'PEKASA STORES';
export const STORE_MOTTO = 'We buy and sell and used second hand goods, cash against furnitures, fridges, TVs, Woofers, Gas cylinders, Mattress Etc.';
export const STORE_TEL = '0727108749 / 0180366344';
export const STORE_PHONES = ['0727108749', '0180366344'];

export interface Customer {
  id: string;
  name: string;
  id_number: string;
  phone: string;
  email: string;
  address: string;
  photo_url?: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export const APPLIANCE_CATEGORIES = [
  'TV',
  'Woofer/sound system',
  'Gas cooker',
  'Fridge/freezer',
  'Microwave',
  'Washing machine',
  'Air conditioner',
  'Bed',
  'Mattress',
  'Suitcase',
  'Gas cylinder',
  'Table',
  'Chips fryer',
  'Other appliances'
] as const;

export type ApplianceCategory = typeof APPLIANCE_CATEGORIES[number];

export type ApplianceStatus = 
  | 'Active Collateral / Pawn'
  | 'Under Evaluation'
  | 'In Repair'
  | 'Ready for Collection'
  | 'Redeemed'
  | 'Defaulted'
  | 'Sold';

export interface Appliance {
  id: string;
  appliance_number: string; // APP-2026-00001
  customer_id: string;
  category: ApplianceCategory;
  custom_category?: string;
  brand: string;
  model: string;
  serial_number: string;
  condition: string;
  market_value: number;
  amount_received: number; // Disbursed from Peter or Trevor
  funder: 'Peter' | 'Trevor' | 'Joint';
  date_received: string;
  due_date: string; // Exactly 2 weeks (14 days) from date_received
  status: ApplianceStatus;
  technician_name: string;
  interest_charges: number; // Storage/handling/interest fee
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface AppliancePhoto {
  id: string;
  appliance_id: string;
  photo_url: string; // data url or image asset
  caption: string;
  uploaded_at: string;
}

export type PaymentMethod = 'M-Pesa' | 'Cash' | 'Bank' | 'Card';

export interface Payment {
  id: string;
  receipt_number: string; // RCT-2026-00001
  appliance_id: string;
  customer_id: string;
  amount: number;
  payment_method: PaymentMethod;
  mpesa_code?: string;
  mpesa_phone?: string;
  mpesa_sender?: string;
  received_by: string; // 'Trevor' | 'Peter'
  notes?: string;
  payment_date: string;
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  part_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Invoice {
  id: string;
  invoice_number: string; // INV-2026-00001
  appliance_id: string;
  customer_id: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax: number;
  total_amount: number;
  status: 'Paid' | 'Partially Paid' | 'Unpaid' | 'Cancelled';
  notes?: string;
  items?: InvoiceItem[];
  created_at: string;
}

export interface Part {
  id: string;
  sku: string;
  part_name: string;
  category: string;
  supplier_id: string;
  cost_price: number;
  selling_price: number;
  quantity: number;
  reorder_level: number;
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  part_id: string;
  movement_type: 'IN' | 'OUT' | 'ADJUST';
  quantity: number;
  reason: string;
  appliance_id?: string;
  performed_by: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  category: string;
  payment_terms: string;
  created_at: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  paid_by: 'Trevor' | 'Peter' | 'Shop Petty Cash';
  payment_method: PaymentMethod;
  reference_code: string;
  expense_date: string;
  notes: string;
  created_at: string;
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

export interface CustomerHistoryRecord {
  customer: Customer;
  appliances: Appliance[];
  payments: Payment[];
  invoices: Invoice[];
  totalDisbursed: number;
  totalPaid: number;
  outstandingBalance: number;
}
