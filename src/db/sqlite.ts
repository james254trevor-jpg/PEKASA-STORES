/**
 * PEKASA Relational SQLite Database Engine
 * Comprehensive Rehani / Pawn Management System
 * Powered by WebAssembly SQLite (sql.js) with persistent browser storage.
 */

import type { Database } from 'sql.js';
// @ts-ignore
import initSqlAsm from 'sql.js/dist/sql-asm.js';
import {
  User,
  UserRole,
  Branch,
  DEFAULT_BRANCHES,
  Customer,
  CollateralItem,
  CollateralCategory,
  RehaniLoan,
  LoanStatus,
  LoanRenewal,
  LedgerTransaction,
  CollateralSale,
  OperatingExpense,
  TreasuryAccount,
  AuditLog,
  CashierSession,
  PaymentVoidRequest,
  DEFAULT_LTV_CONFIGS,
  BusinessSettings
} from '../types';
import { hashPassword, DEFAULT_SALT } from '../utils/security';
import { formatSequenceCode, calculateLoanDueDate, calculateMaturityDate } from '../utils/numbering';

const DB_STORE_NAME = 'pekasa_rehani_sqlite_db_v2';
const DB_LOCAL_FALLBACK_KEY = 'pekasa_rehani_raw_fallback_v2';

export interface DashboardMetrics {
  cashInBusiness: number;
  outstandingLoans: number;
  collateralHeldCount: number;
  overdueLoansCount: number;
  approachingMaturityCount: number;
  activeLoansCount: number;
  todaysCollections: number;
  todaysProfit: number;
  itemsForSaleCount: number;
  totalCustomersCount: number;
  totalOutstandingPrincipal: number;
  highRiskCustomersCount: number;
  retainedEarnings: number;
}

class SQLiteService {
  private db: Database | null = null;
  private isInitialized: boolean = false;
  private listeners: Set<() => void> = new Set();
  private pendingCloudSnapshot: Uint8Array | null = null;
  private cloudSyncHandler: ((bytes: Uint8Array) => void) | null = null;

  public stageCloudSnapshot(bytes: Uint8Array): void {
    this.pendingCloudSnapshot = bytes.slice();
  }

  public setCloudSyncHandler(handler: ((bytes: Uint8Array) => void) | null): void {
    this.cloudSyncHandler = handler;
  }

  public subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('Listener notification error:', err);
      }
    });
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized && this.db) {
      return;
    }

    try {
      const SQL = await initSqlAsm();
      const savedBytes = this.pendingCloudSnapshot || await this.loadSavedDatabaseBytes();
      this.pendingCloudSnapshot = null;

      if (savedBytes && savedBytes.length > 0) {
        try {
          this.db = new SQL.Database(savedBytes);
          this.ensureSchema();
        } catch (e) {
          console.warn('Failed to parse saved SQLite bytes, creating fresh database', e);
          this.db = new SQL.Database();
          await this.createInitialSchemaAndSeed();
        }
      } else {
        this.db = new SQL.Database();
        await this.createInitialSchemaAndSeed();
      }

      this.isInitialized = true;

      // Auto-purge any previous dummy data on existing sessions for personal clean install
      if (typeof window !== 'undefined' && localStorage.getItem('pekasa_clean_data_purged_v5') !== 'true' && !savedBytes) {
        await this.clearAllOperationalData();
        localStorage.setItem('pekasa_clean_data_purged_v5', 'true');
      } else {
        await this.persist();
      }

      this.notify();
    } catch (error) {
      console.error('Fatal SQLite initialization error:', error);
      throw error;
    }
  }

  private ensureSchema(): void {
    if (!this.db) return;
    this.db.run('PRAGMA foreign_keys = OFF;');

    try {
      // Check if rehani_loans table exists; if not, create it
      this.db.run(`
        CREATE TABLE IF NOT EXISTS branches (
          id TEXT PRIMARY KEY,
          code TEXT NOT NULL,
          name TEXT NOT NULL,
          city TEXT NOT NULL,
          address TEXT NOT NULL,
          phone TEXT NOT NULL,
          is_main INTEGER NOT NULL
        );
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS collateral_items (
          id TEXT PRIMARY KEY,
          collateral_number TEXT UNIQUE NOT NULL,
          customer_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          category TEXT NOT NULL,
          custom_category TEXT,
          item_name TEXT NOT NULL,
          brand TEXT NOT NULL,
          model TEXT NOT NULL,
          serial_number TEXT,
          imei_1 TEXT,
          imei_2 TEXT,
          colour TEXT,
          condition TEXT NOT NULL,
          age TEXT,
          accessories_included TEXT,
          tv_screen_size TEXT,
          tv_remote_included INTEGER,
          tv_stand_included INTEGER,
          laptop_processor TEXT,
          laptop_ram TEXT,
          laptop_storage TEXT,
          laptop_charger INTEGER,
          laptop_battery_condition TEXT,
          original_purchase_price REAL,
          market_value REAL NOT NULL,
          estimated_resale_value REAL NOT NULL,
          max_allowed_loan REAL NOT NULL,
          amount_offered REAL NOT NULL,
          storage_room TEXT NOT NULL,
          rack_shelf TEXT NOT NULL,
          security_tag TEXT,
          photo_front TEXT,
          photo_back TEXT,
          photo_serial TEXT,
          photo_damage TEXT,
          photo_accessories TEXT,
          status TEXT NOT NULL,
          date_received TEXT NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS rehani_loans (
          id TEXT PRIMARY KEY,
          loan_number TEXT UNIQUE NOT NULL,
          customer_id TEXT NOT NULL,
          collateral_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          principal_amount REAL NOT NULL,
          interest_rate_percent REAL NOT NULL,
          interest_amount REAL NOT NULL,
          storage_fee REAL NOT NULL,
          total_amount_due REAL NOT NULL,
          amount_paid REAL NOT NULL DEFAULT 0,
          balance_remaining REAL NOT NULL,
          term_days INTEGER NOT NULL,
          issue_date TEXT NOT NULL,
          due_date TEXT NOT NULL,
          grace_period_days INTEGER NOT NULL,
          maturity_date TEXT NOT NULL,
          funder TEXT NOT NULL,
          disbursement_method TEXT NOT NULL,
          disbursement_reference TEXT,
          status TEXT NOT NULL,
          renewals_count INTEGER NOT NULL DEFAULT 0,
          staff_issuer TEXT NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS loan_renewals (
          id TEXT PRIMARY KEY,
          renewal_number TEXT UNIQUE NOT NULL,
          loan_id TEXT NOT NULL,
          previous_due_date TEXT NOT NULL,
          new_due_date TEXT NOT NULL,
          previous_principal REAL NOT NULL,
          accrued_interest_paid REAL NOT NULL,
          renewal_charge REAL NOT NULL,
          total_paid REAL NOT NULL,
          payment_method TEXT NOT NULL,
          reference_code TEXT,
          approved_by TEXT NOT NULL,
          renewal_date TEXT NOT NULL,
          notes TEXT
        );
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS ledger_transactions (
          id TEXT PRIMARY KEY,
          transaction_number TEXT UNIQUE NOT NULL,
          receipt_number TEXT UNIQUE NOT NULL,
          loan_id TEXT,
          collateral_id TEXT,
          customer_id TEXT,
          branch_id TEXT NOT NULL,
          transaction_type TEXT NOT NULL,
          amount REAL NOT NULL,
          principal_portion REAL NOT NULL,
          interest_portion REAL NOT NULL,
          balance_after REAL NOT NULL,
          payment_method TEXT NOT NULL,
          mpesa_reference TEXT,
          mpesa_phone TEXT,
          received_by TEXT NOT NULL,
          notes TEXT,
          transaction_date TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS collateral_sales (
          id TEXT PRIMARY KEY,
          sale_number TEXT UNIQUE NOT NULL,
          collateral_id TEXT NOT NULL,
          loan_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          original_market_value REAL NOT NULL,
          outstanding_loan_balance REAL NOT NULL,
          selling_price REAL NOT NULL,
          profit_or_loss REAL NOT NULL,
          buyer_name TEXT NOT NULL,
          buyer_phone TEXT NOT NULL,
          buyer_id_number TEXT,
          payment_method TEXT NOT NULL,
          payment_reference TEXT,
          authorized_by TEXT NOT NULL,
          disposition_reason TEXT NOT NULL,
          sale_date TEXT NOT NULL,
          notes TEXT
        );
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS operating_expenses (
          id TEXT PRIMARY KEY,
          expense_number TEXT UNIQUE NOT NULL,
          branch_id TEXT NOT NULL,
          category TEXT NOT NULL,
          description TEXT NOT NULL,
          amount REAL NOT NULL,
          payment_method TEXT NOT NULL,
          paid_by TEXT NOT NULL,
          reference_code TEXT,
          receipt_photo_url TEXT,
          approved_by TEXT NOT NULL,
          expense_date TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS treasury (
          id TEXT PRIMARY KEY,
          cash_in_vault REAL NOT NULL,
          mpesa_till_balance REAL NOT NULL,
          bank_balance REAL NOT NULL,
          trevor_capital REAL NOT NULL,
          peter_capital REAL NOT NULL,
          retained_profit REAL NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS ltv_configs (
          category TEXT PRIMARY KEY,
          max_ltv_percent REAL NOT NULL
        );
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          user_name TEXT NOT NULL,
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          details TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS sequence_counters (
          prefix TEXT PRIMARY KEY,
          current_year INTEGER NOT NULL,
          last_sequence INTEGER NOT NULL
        );
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS appliances (
          id TEXT PRIMARY KEY,
          appliance_number TEXT UNIQUE NOT NULL,
          customer_id TEXT NOT NULL,
          category TEXT NOT NULL,
          custom_category TEXT,
          brand TEXT NOT NULL,
          model TEXT NOT NULL,
          serial_number TEXT,
          condition TEXT NOT NULL,
          market_value REAL NOT NULL,
          amount_received REAL NOT NULL,
          funder TEXT NOT NULL,
          date_received TEXT NOT NULL,
          due_date TEXT NOT NULL,
          status TEXT NOT NULL,
          technician_name TEXT,
          interest_charges REAL DEFAULT 0,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS payments (
          id TEXT PRIMARY KEY,
          receipt_number TEXT UNIQUE NOT NULL,
          appliance_id TEXT NOT NULL,
          customer_id TEXT NOT NULL,
          amount REAL NOT NULL,
          payment_method TEXT NOT NULL,
          mpesa_code TEXT,
          mpesa_phone TEXT,
          mpesa_sender TEXT,
          received_by TEXT NOT NULL,
          notes TEXT,
          payment_date TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS appliance_photos (
          id TEXT PRIMARY KEY,
          appliance_id TEXT NOT NULL,
          photo_url TEXT NOT NULL,
          caption TEXT,
          uploaded_at TEXT NOT NULL
        );
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS invoices (
          id TEXT PRIMARY KEY,
          invoice_number TEXT UNIQUE NOT NULL,
          appliance_id TEXT,
          customer_id TEXT NOT NULL,
          issue_date TEXT NOT NULL,
          due_date TEXT NOT NULL,
          subtotal REAL NOT NULL DEFAULT 0,
          tax REAL NOT NULL DEFAULT 0,
          total_amount REAL NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'Unpaid',
          notes TEXT,
          created_at TEXT NOT NULL
        );
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS invoice_items (
          id TEXT PRIMARY KEY,
          invoice_id TEXT NOT NULL,
          description TEXT NOT NULL,
          quantity REAL NOT NULL DEFAULT 1,
          unit_price REAL NOT NULL DEFAULT 0,
          total_price REAL NOT NULL DEFAULT 0
        );
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS parts (
          id TEXT PRIMARY KEY,
          sku TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          supplier_id TEXT,
          cost_price REAL NOT NULL DEFAULT 0,
          selling_price REAL NOT NULL DEFAULT 0,
          quantity INTEGER NOT NULL DEFAULT 0,
          reorder_level INTEGER NOT NULL DEFAULT 0,
          location TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS personal_goods (
          id TEXT PRIMARY KEY, item_name TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'Other',
          details TEXT, item_condition TEXT, purchase_price REAL NOT NULL DEFAULT 0,
          asking_price REAL NOT NULL DEFAULT 0, seller_name TEXT, purchase_date TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'IN_STOCK', sale_price REAL, buyer_name TEXT,
          buyer_phone TEXT, sale_date TEXT, payment_method TEXT, payment_reference TEXT,
          notes TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS stock_movements (
          id TEXT PRIMARY KEY,
          part_id TEXT NOT NULL,
          movement_type TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          reference_type TEXT NOT NULL,
          reference_id TEXT,
          notes TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS suppliers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          contact_person TEXT,
          phone TEXT NOT NULL,
          email TEXT,
          address TEXT,
          created_at TEXT NOT NULL
        );
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS cashier_sessions (
          id TEXT PRIMARY KEY,
          cashier_id TEXT NOT NULL,
          cashier_name TEXT NOT NULL,
          branch_id TEXT NOT NULL,
          session_date TEXT NOT NULL,
          opened_at TEXT NOT NULL,
          closed_at TEXT,
          opening_cash REAL NOT NULL,
          cash_collected REAL DEFAULT 0,
          mpesa_collected REAL DEFAULT 0,
          other_collected REAL DEFAULT 0,
          expected_cash REAL DEFAULT 0,
          actual_cash REAL,
          difference REAL,
          status TEXT NOT NULL DEFAULT 'OPEN',
          reconciliation_status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
          reconciliation_approved_by TEXT,
          reconciliation_notes TEXT,
          notes TEXT
        );
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS payment_void_requests (
          id TEXT PRIMARY KEY,
          request_number TEXT UNIQUE NOT NULL,
          payment_id TEXT NOT NULL,
          receipt_number TEXT NOT NULL,
          loan_number TEXT,
          customer_name TEXT NOT NULL,
          amount REAL NOT NULL,
          cashier_id TEXT NOT NULL,
          cashier_name TEXT NOT NULL,
          reason TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING',
          reviewed_by TEXT,
          reviewed_at TEXT,
          admin_notes TEXT,
          created_at TEXT NOT NULL
        );
      `);

      // Add missing columns if upgrading
      try { this.db.run('ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1;'); } catch {}
      try { this.db.run('ALTER TABLE users ADD COLUMN avatar_url TEXT;'); } catch {}
      try { this.db.run('ALTER TABLE users ADD COLUMN address TEXT;'); } catch {}
      try { this.db.run('ALTER TABLE users ADD COLUMN notes TEXT;'); } catch {}
      try { this.db.run('ALTER TABLE users ADD COLUMN appearance_theme TEXT;'); } catch {}
      try { this.db.run('ALTER TABLE users ADD COLUMN notification_preferences TEXT;'); } catch {}
      try { this.db.run('ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER DEFAULT 0;'); } catch {}
      try { this.db.run('ALTER TABLE customers ADD COLUMN customer_number TEXT;'); } catch {}
      try { this.db.run('ALTER TABLE customers ADD COLUMN alt_phone TEXT;'); } catch {}
      // Upgrade existing local databases before customer intake writes the email field.
      try { this.db.run('ALTER TABLE customers ADD COLUMN email TEXT;'); } catch {}
      try { this.db.run('ALTER TABLE customers ADD COLUMN county TEXT;'); } catch {}
      try { this.db.run('ALTER TABLE customers ADD COLUMN id_photo_url TEXT;'); } catch {}
      try { this.db.run('ALTER TABLE customers ADD COLUMN status TEXT DEFAULT "Good Standing";'); } catch {}
      try { this.db.run('ALTER TABLE customers ADD COLUMN defaults_count INTEGER DEFAULT 0;'); } catch {}
      // Intake forms write these loan-history columns, so older databases need them too.
      try { this.db.run('ALTER TABLE customers ADD COLUMN previous_loans_count INTEGER DEFAULT 0;'); } catch {}
      try { this.db.run('ALTER TABLE customers ADD COLUMN total_borrowed REAL DEFAULT 0;'); } catch {}
      try { this.db.run('ALTER TABLE customers ADD COLUMN total_repaid REAL DEFAULT 0;'); } catch {}
      try { this.db.run('ALTER TABLE customers ADD COLUMN current_balance REAL DEFAULT 0;'); } catch {}

      // Business settings table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS business_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      // Seed business settings if not present
      const existingSettings = this.query<{ key: string }>('SELECT key FROM business_settings LIMIT 1');
      if (!existingSettings || existingSettings.length === 0) {
        const defaults: Record<string, string> = {
          business_name: 'PEKASA STORES',
          business_motto: 'We buy and sell used second hand goods, cash against furnitures, fridges, TVs, Woofers, Gas cylinders, Mattress Etc.',
          business_phone: '0727108749',
          business_phone_alt: '0180366344',
          business_email: 'info@pekasastores.co.ke',
          business_address: 'Kombani Commercial Centre, Kwale County, along Kwale-Likoni Road',
          currency: 'KES',
          tax_rate: '0',
          tax_enabled: 'false',
          receipt_footer: 'Directors: Trevor & Peter | Kombani, Kwale · Open 6 Days',
          invoice_prefix: 'INV',
          receipt_prefix: 'RCT',
          session_timeout_minutes: '30'
        };
        const now = new Date().toISOString();
        for (const [k, v] of Object.entries(defaults)) {
          this.db.run('INSERT OR IGNORE INTO business_settings (key, value, updated_at) VALUES (?, ?, ?)', [k, v, now]);
        }
      }

    } catch (e) {
      console.warn('ensureSchema upgrade warning:', e);
    }

    this.db.run('PRAGMA foreign_keys = ON;');
  }

  private async createInitialSchemaAndSeed(): Promise<void> {
    if (!this.db) return;

    this.db.run('PRAGMA foreign_keys = OFF;');

    // 1. Roles table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS user_roles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        permissions_json TEXT NOT NULL
      );
    `);

    // 2. Users table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role_id TEXT NOT NULL,
        role_title TEXT NOT NULL,
        branch_id TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        last_login TEXT
      );
    `);

    // 3. Branches table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS branches (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        city TEXT NOT NULL,
        address TEXT NOT NULL,
        phone TEXT NOT NULL,
        is_main INTEGER NOT NULL
      );
    `);

    // 4. Customers table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        customer_number TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        id_number TEXT UNIQUE NOT NULL,
        phone TEXT NOT NULL,
        alt_phone TEXT,
        email TEXT,
        address TEXT,
        county TEXT,
        photo_url TEXT,
        id_photo_url TEXT,
        status TEXT NOT NULL DEFAULT 'Good Standing',
        notes TEXT,
        previous_loans_count INTEGER DEFAULT 0,
        total_borrowed REAL DEFAULT 0,
        total_repaid REAL DEFAULT 0,
        current_balance REAL DEFAULT 0,
        defaults_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // 5. Collateral items table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS collateral_items (
        id TEXT PRIMARY KEY,
        collateral_number TEXT UNIQUE NOT NULL,
        customer_id TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        category TEXT NOT NULL,
        custom_category TEXT,
        item_name TEXT NOT NULL,
        brand TEXT NOT NULL,
        model TEXT NOT NULL,
        serial_number TEXT,
        imei_1 TEXT,
        imei_2 TEXT,
        colour TEXT,
        condition TEXT NOT NULL,
        age TEXT,
        accessories_included TEXT,
        tv_screen_size TEXT,
        tv_remote_included INTEGER,
        tv_stand_included INTEGER,
        laptop_processor TEXT,
        laptop_ram TEXT,
        laptop_storage TEXT,
        laptop_charger INTEGER,
        laptop_battery_condition TEXT,
        original_purchase_price REAL,
        market_value REAL NOT NULL,
        estimated_resale_value REAL NOT NULL,
        max_allowed_loan REAL NOT NULL,
        amount_offered REAL NOT NULL,
        storage_room TEXT NOT NULL,
        rack_shelf TEXT NOT NULL,
        security_tag TEXT,
        photo_front TEXT,
        photo_back TEXT,
        photo_serial TEXT,
        photo_damage TEXT,
        photo_accessories TEXT,
        status TEXT NOT NULL,
        date_received TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // 6. Rehani Loans table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS rehani_loans (
        id TEXT PRIMARY KEY,
        loan_number TEXT UNIQUE NOT NULL,
        customer_id TEXT NOT NULL,
        collateral_id TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        principal_amount REAL NOT NULL,
        interest_rate_percent REAL NOT NULL,
        interest_amount REAL NOT NULL,
        storage_fee REAL NOT NULL,
        total_amount_due REAL NOT NULL,
        amount_paid REAL NOT NULL DEFAULT 0,
        balance_remaining REAL NOT NULL,
        term_days INTEGER NOT NULL,
        issue_date TEXT NOT NULL,
        due_date TEXT NOT NULL,
        grace_period_days INTEGER NOT NULL,
        maturity_date TEXT NOT NULL,
        funder TEXT NOT NULL,
        disbursement_method TEXT NOT NULL,
        disbursement_reference TEXT,
        status TEXT NOT NULL,
        renewals_count INTEGER NOT NULL DEFAULT 0,
        staff_issuer TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // 7. Loan Renewals
    this.db.run(`
      CREATE TABLE IF NOT EXISTS loan_renewals (
        id TEXT PRIMARY KEY,
        renewal_number TEXT UNIQUE NOT NULL,
        loan_id TEXT NOT NULL,
        previous_due_date TEXT NOT NULL,
        new_due_date TEXT NOT NULL,
        previous_principal REAL NOT NULL,
        accrued_interest_paid REAL NOT NULL,
        renewal_charge REAL NOT NULL,
        total_paid REAL NOT NULL,
        payment_method TEXT NOT NULL,
        reference_code TEXT,
        approved_by TEXT NOT NULL,
        renewal_date TEXT NOT NULL,
        notes TEXT
      );
    `);

    // 8. Immutable Ledger Transactions
    this.db.run(`
      CREATE TABLE IF NOT EXISTS ledger_transactions (
        id TEXT PRIMARY KEY,
        transaction_number TEXT UNIQUE NOT NULL,
        receipt_number TEXT UNIQUE NOT NULL,
        loan_id TEXT,
        collateral_id TEXT,
        customer_id TEXT,
        branch_id TEXT NOT NULL,
        transaction_type TEXT NOT NULL,
        amount REAL NOT NULL,
        principal_portion REAL NOT NULL,
        interest_portion REAL NOT NULL,
        balance_after REAL NOT NULL,
        payment_method TEXT NOT NULL,
        mpesa_reference TEXT,
        mpesa_phone TEXT,
        received_by TEXT NOT NULL,
        notes TEXT,
        transaction_date TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    // 9. Collateral Sales table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS collateral_sales (
        id TEXT PRIMARY KEY,
        sale_number TEXT UNIQUE NOT NULL,
        collateral_id TEXT NOT NULL,
        loan_id TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        original_market_value REAL NOT NULL,
        outstanding_loan_balance REAL NOT NULL,
        selling_price REAL NOT NULL,
        profit_or_loss REAL NOT NULL,
        buyer_name TEXT NOT NULL,
        buyer_phone TEXT NOT NULL,
        buyer_id_number TEXT,
        payment_method TEXT NOT NULL,
        payment_reference TEXT,
        authorized_by TEXT NOT NULL,
        disposition_reason TEXT NOT NULL,
        sale_date TEXT NOT NULL,
        notes TEXT
      );
    `);

    // 10. Operating Expenses table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS operating_expenses (
        id TEXT PRIMARY KEY,
        expense_number TEXT UNIQUE NOT NULL,
        branch_id TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL,
        paid_by TEXT NOT NULL,
        reference_code TEXT,
        receipt_photo_url TEXT,
        approved_by TEXT NOT NULL,
        expense_date TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    // 11. Treasury table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS treasury (
        id TEXT PRIMARY KEY,
        cash_in_vault REAL NOT NULL,
        mpesa_till_balance REAL NOT NULL,
        bank_balance REAL NOT NULL,
        trevor_capital REAL NOT NULL,
        peter_capital REAL NOT NULL,
        retained_profit REAL NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // 12. LTV configurations
    this.db.run(`
      CREATE TABLE IF NOT EXISTS ltv_configs (
        category TEXT PRIMARY KEY,
        max_ltv_percent REAL NOT NULL
      );
    `);

    // 13. Audit logs
    this.db.run(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_name TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        details TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    // 14. Sequences
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sequence_counters (
        prefix TEXT PRIMARY KEY,
        current_year INTEGER NOT NULL,
        last_sequence INTEGER NOT NULL
      );
    `);

    // Also support backward compatibility tables
    this.db.run(`
      CREATE TABLE IF NOT EXISTS appliances (
        id TEXT PRIMARY KEY,
        appliance_number TEXT UNIQUE NOT NULL,
        customer_id TEXT NOT NULL,
        category TEXT NOT NULL,
        custom_category TEXT,
        brand TEXT NOT NULL,
        model TEXT NOT NULL,
        serial_number TEXT,
        condition TEXT NOT NULL,
        market_value REAL NOT NULL,
        amount_received REAL NOT NULL,
        funder TEXT NOT NULL,
        date_received TEXT NOT NULL,
        due_date TEXT NOT NULL,
        status TEXT NOT NULL,
        technician_name TEXT,
        interest_charges REAL DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        receipt_number TEXT UNIQUE NOT NULL,
        appliance_id TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL,
        mpesa_code TEXT,
        mpesa_phone TEXT,
        mpesa_sender TEXT,
        received_by TEXT NOT NULL,
        notes TEXT,
        payment_date TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS appliance_photos (
        id TEXT PRIMARY KEY,
        appliance_id TEXT NOT NULL,
        photo_url TEXT NOT NULL,
        caption TEXT,
        uploaded_at TEXT NOT NULL
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        invoice_number TEXT UNIQUE NOT NULL,
        appliance_id TEXT,
        customer_id TEXT NOT NULL,
        issue_date TEXT NOT NULL,
        due_date TEXT NOT NULL,
        subtotal REAL NOT NULL DEFAULT 0,
        tax REAL NOT NULL DEFAULT 0,
        total_amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'Unpaid',
        notes TEXT,
        created_at TEXT NOT NULL
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL,
        description TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL DEFAULT 0,
        total_price REAL NOT NULL DEFAULT 0
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS parts (
        id TEXT PRIMARY KEY,
        sku TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        supplier_id TEXT,
        cost_price REAL NOT NULL DEFAULT 0,
        selling_price REAL NOT NULL DEFAULT 0,
        quantity INTEGER NOT NULL DEFAULT 0,
        reorder_level INTEGER NOT NULL DEFAULT 0,
        location TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS personal_goods (
        id TEXT PRIMARY KEY, item_name TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'Other',
        details TEXT, item_condition TEXT, purchase_price REAL NOT NULL DEFAULT 0,
        asking_price REAL NOT NULL DEFAULT 0, seller_name TEXT, purchase_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'IN_STOCK', sale_price REAL, buyer_name TEXT,
        buyer_phone TEXT, sale_date TEXT, payment_method TEXT, payment_reference TEXT,
        notes TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id TEXT PRIMARY KEY,
        part_id TEXT NOT NULL,
        movement_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        reference_type TEXT NOT NULL,
        reference_id TEXT,
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        contact_person TEXT,
        phone TEXT NOT NULL,
        email TEXT,
        address TEXT,
        created_at TEXT NOT NULL
      );
    `);

    await this.seedInitialData();
    this.db.run('PRAGMA foreign_keys = ON;');
  }

  private async seedInitialData(): Promise<void> {
    if (!this.db) return;

    // Branches
    for (const b of DEFAULT_BRANCHES) {
      this.db.run(
        `INSERT INTO branches (id, code, name, city, address, phone, is_main) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [b.id, b.code, b.name, b.city, b.address, b.phone, b.is_main ? 1 : 0]
      );
    }

    // Default Roles
    const adminPerms = JSON.stringify({
      can_manage_appliances: true,
      can_issue_money: true,
      can_record_payments: true,
      can_manage_parts: true,
      can_manage_expenses: true,
      can_view_financials: true,
      can_manage_users: true,
      can_backup_restore: true,
      can_authorize_sales: true,
      can_renew_loans: true
    });

    const managerPerms = JSON.stringify({
      can_manage_appliances: true,
      can_issue_money: true,
      can_record_payments: true,
      can_manage_parts: true,
      can_manage_expenses: true,
      can_view_financials: true,
      can_manage_users: false,
      can_backup_restore: false,
      can_authorize_sales: true,
      can_renew_loans: true
    });

    const cashierPerms = JSON.stringify({
      can_manage_appliances: false,
      can_issue_money: false,
      can_record_payments: true,
      can_manage_parts: false,
      can_manage_expenses: false,
      can_view_financials: false,
      can_manage_users: false,
      can_backup_restore: false,
      can_authorize_sales: false,
      can_renew_loans: false
    });

    this.db.run(`
      INSERT INTO user_roles (id, name, description, permissions_json) VALUES
      ('role-admin', 'Senior Partner / Director', 'Full administrative authority and financial control', '${adminPerms}'),
      ('role-manager', 'Branch Operations Manager', 'Loan approvals, custody verification, disposition authorizer', '${managerPerms}'),
      ('role-cashier', 'Counter Cashier', 'Payment receipts, M-Pesa verification and ledger entry', '${cashierPerms}');
    `);

    // Two mandatory primary users with exact requested credentials:
    // 1. Trevor: password "Mbugua254"
    // 2. Peter: password "kamaupita"
    const trevorHash = await hashPassword('Mbugua254', DEFAULT_SALT);
    const peterHash = await hashPassword('kamaupita', DEFAULT_SALT);

    this.db.run(`
      INSERT INTO users (id, username, full_name, email, phone, password_hash, salt, role_id, role_title, branch_id, created_at, last_login) VALUES
      ('usr-trevor', 'trevor', 'Trevor Mbugua', 'james254trevor@gmail.com', '0727108749', '${trevorHash}', '${DEFAULT_SALT}', 'role-admin', 'Senior Partner / Director', 'br-nairobi', '2026-01-01 08:00:00', '2026-10-02 08:00:00'),
      ('usr-peter', 'peter', 'Peter Kamau', 'kamaupita@pekasa.co.ke', '0180366344', '${peterHash}', '${DEFAULT_SALT}', 'role-admin', 'Senior Partner / Director', 'br-nairobi', '2026-01-01 08:00:00', '2026-10-02 08:30:00');
    `);

    // LTV Configurations
    for (const [cat, ltv] of Object.entries(DEFAULT_LTV_CONFIGS)) {
      this.db.run(`INSERT INTO ltv_configs (category, max_ltv_percent) VALUES (?, ?)`, [cat, ltv]);
    }

    // Sequence Counters (Fresh starting numbers)
    this.db.run(`
      INSERT INTO sequence_counters (prefix, current_year, last_sequence) VALUES
      ('LN', 2026, 0),
      ('COL', 2026, 0),
      ('CUS', 2026, 0),
      ('RCT', 2026, 0),
      ('TXN', 2026, 0),
      ('RNW', 2026, 0),
      ('SAL', 2026, 0),
      ('EXP', 2026, 0),
      ('APP', 2026, 0),
      ('INV', 2026, 0),
      ('VOD', 2026, 0),
      ('SES', 2026, 0);
    `);

    // Clean Treasury Account (all starting at 0 for user to install personally)
    this.db.run(`
      INSERT INTO treasury (id, cash_in_vault, mpesa_till_balance, bank_balance, trevor_capital, peter_capital, retained_profit, updated_at) VALUES
      ('trs-main', 0, 0, 0, 0, 0, 0, '2026-10-02 08:00:00');
    `);

    // Log seed audit
    this.db.run(`
      INSERT INTO audit_logs (id, user_name, action, entity_type, entity_id, details, created_at) VALUES
      ('aud-001', 'System', 'SYSTEM_INIT', 'DATABASE', 'db-clean', 'PEKASA STORES Rehani Management System clean installation initialized.', '2026-10-02 08:00:00');
    `);
  }

  // --- Persistence Handlers (IndexedDB + LocalStorage fallback) ---
  private async loadSavedDatabaseBytes(): Promise<Uint8Array | null> {
    try {
      const idbBytes = await this.loadFromIndexedDB();
      if (idbBytes && idbBytes.length > 0) {
        return idbBytes;
      }
    } catch {
      // ignore
    }

    try {
      const raw = localStorage.getItem(DB_LOCAL_FALLBACK_KEY);
      if (raw) {
        const binStr = atob(raw);
        const len = binStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binStr.charCodeAt(i);
        }
        return bytes;
      }
    } catch {
      // ignore
    }

    return null;
  }

  private async loadFromIndexedDB(): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
      if (!window.indexedDB) return resolve(null);
      const req = indexedDB.open('pekasa_sqlite_idb', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(DB_STORE_NAME);
      };
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction(DB_STORE_NAME, 'readonly');
          const store = tx.objectStore(DB_STORE_NAME);
          const getReq = store.get('current_db');
          getReq.onsuccess = () => {
            resolve(getReq.result || null);
          };
          getReq.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  }

  public async persist(): Promise<void> {
    if (!this.db) return;
    try {
      const data = this.db.export();
      if (window.indexedDB) {
        const req = indexedDB.open('pekasa_sqlite_idb', 1);
        req.onsuccess = () => {
          const db = req.result;
          try {
            const tx = db.transaction(DB_STORE_NAME, 'readwrite');
            const store = tx.objectStore(DB_STORE_NAME);
            store.put(data, 'current_db');
          } catch (e) {
            console.error('IDB put error', e);
          }
        };
      }

      // Compact fallback
      if (data.length < 4500000) {
        let binary = '';
        const len = data.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(data[i]);
        }
        localStorage.setItem(DB_LOCAL_FALLBACK_KEY, btoa(binary));
      }
      this.cloudSyncHandler?.(data.slice());
    } catch (err) {
      console.error('Failed to persist SQLite database:', err);
    }
  }

  // --- Generic Query & Execution Helpers ---
  public query<T = any>(sql: string, params: Record<string, any> = {}): T[] {
    if (!this.db) return [];
    try {
      const stmt = this.db.prepare(sql);
      stmt.bind(params);
      const results: T[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject() as unknown as T);
      }
      stmt.free();
      return results;
    } catch (err) {
      console.error('SQLite query error:', sql, params, err);
      return [];
    }
  }

  public run(sql: string, params: Record<string, any> = {}): void {
    if (!this.db) return;
    try {
      this.db.run(sql, params);
      this.persist();
      this.notify();
    } catch (err) {
      console.error('SQLite run error:', sql, params, err);
      throw err;
    }
  }

  // --- Sequences Generator ---
  public getNextSequence(prefix: 'LN' | 'COL' | 'CUS' | 'RCT' | 'TXN' | 'RNW' | 'SAL' | 'EXP' | 'APP' | 'INV' | 'VOD' | 'SES'): string {
    const curYear = 2026;
    const row = this.query<{ last_sequence: number }>(
      'SELECT last_sequence FROM sequence_counters WHERE prefix = :p',
      { ':p': prefix }
    )[0];

    const nextVal = (row ? row.last_sequence : 0) + 1;
    this.run(
      `INSERT INTO sequence_counters (prefix, current_year, last_sequence)
       VALUES (:p, :y, :val)
       ON CONFLICT(prefix) DO UPDATE SET last_sequence = :val`,
      { ':p': prefix, ':y': curYear, ':val': nextVal }
    );

    return formatSequenceCode(prefix, nextVal, curYear);
  }

  // --- Rehani Dashboard Metrics (Dynamic & Real-Time) ---
  public getDashboardMetrics(branchFilter?: string): DashboardMetrics {
    const branchClause = branchFilter && branchFilter !== 'ALL' ? `AND branch_id = '${branchFilter}'` : '';
    const today = new Date().toISOString().split('T')[0];

    // Treasury
    const treasury = this.getTreasury();
    const cashInBusiness = (treasury.cash_in_vault || 0) + (treasury.mpesa_till_balance || 0) + (treasury.bank_balance || 0);

    // Active & Overdue Loans
    const loanRows = this.query<{
      status: string;
      principal_amount: number;
      balance_remaining: number;
      due_date: string;
      maturity_date: string;
    }>(`SELECT status, principal_amount, balance_remaining, due_date, maturity_date FROM rehani_loans WHERE 1=1 ${branchClause}`);

    let outstandingLoans = 0;
    let totalOutstandingPrincipal = 0;
    let activeLoansCount = 0;
    let overdueLoansCount = 0;
    let approachingMaturityCount = 0;

    const nowTime = new Date().getTime();

    loanRows.forEach((l) => {
      if (l.status !== 'REDEEMED' && l.status !== 'SOLD') {
        outstandingLoans += Number(l.balance_remaining) || 0;
        totalOutstandingPrincipal += Number(l.principal_amount) || 0;

        const dueTime = new Date(l.due_date).getTime();
        const diffDays = Math.ceil((dueTime - nowTime) / (1000 * 3600 * 24));

        if (diffDays < 0) {
          overdueLoansCount++;
        } else if (diffDays <= 7) {
          approachingMaturityCount++;
        }

        if (l.status === 'ACTIVE' || l.status === 'DUE_SOON' || l.status === 'DUE_TODAY') {
          activeLoansCount++;
        }
      }
    });

    // Collateral Held
    const colRows = this.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM collateral_items WHERE status = 'Held (Active Loan)' ${branchClause}`
    )[0];
    const collateralHeldCount = colRows?.count || 0;

    // Items for sale
    const saleItemsRows = this.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM collateral_items WHERE status = 'Available for Sale' ${branchClause}`
    )[0];
    const itemsForSaleCount = saleItemsRows?.count || 0;

    // Total Customers
    const custRows = this.query<{ count: number }>(`SELECT COUNT(*) as count FROM customers`)[0];
    const totalCustomersCount = custRows?.count || 0;

    // High risk customers
    const highRiskRows = this.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM customers WHERE status = 'High Risk' OR status = 'Watchlist' OR defaults_count > 0`
    )[0];
    const highRiskCustomersCount = highRiskRows?.count || 0;

    // Today's collections
    const todayTxns = this.query<{ amount: number; interest_portion: number }>(
      `SELECT amount, interest_portion FROM ledger_transactions WHERE transaction_date = '${today}' ${branchClause}`
    );
    const todaysCollections = todayTxns.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const todaysInterest = todayTxns.reduce((sum, t) => sum + (Number(t.interest_portion) || 0), 0);

    // Today's expenses
    const todayExp = this.query<{ amount: number }>(
      `SELECT amount FROM operating_expenses WHERE expense_date = '${today}' ${branchClause}`
    );
    const todaysExpenses = todayExp.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const todaysProfit = todaysInterest - todaysExpenses;

    return {
      cashInBusiness: Number(cashInBusiness) || 0,
      outstandingLoans: Number(outstandingLoans) || 0,
      collateralHeldCount: Number(collateralHeldCount) || 0,
      overdueLoansCount: Number(overdueLoansCount) || 0,
      approachingMaturityCount: Number(approachingMaturityCount) || 0,
      activeLoansCount: Number(activeLoansCount) || 0,
      todaysCollections: Number(todaysCollections) || 0,
      todaysProfit: Number(todaysProfit) || 0,
      itemsForSaleCount: Number(itemsForSaleCount) || 0,
      totalCustomersCount: Number(totalCustomersCount) || 0,
      totalOutstandingPrincipal: Number(totalOutstandingPrincipal) || 0,
      highRiskCustomersCount: Number(highRiskCustomersCount) || 0,
      retainedEarnings: Number(treasury.retained_profit) || 0
    };
  }

  // --- Customers ---
  public getCustomers(): Customer[] {
    const list = this.query<Customer>('SELECT * FROM customers ORDER BY created_at DESC');
    return list.map((c) => {
      // Calculate loans stats
      const loans = this.query<{ principal_amount: number; amount_paid: number; balance_remaining: number; status: string }>(
        'SELECT principal_amount, amount_paid, balance_remaining, status FROM rehani_loans WHERE customer_id = :cid',
        { ':cid': c.id }
      );
      const totalBorrowed = loans.reduce((sum, l) => sum + (Number(l.principal_amount) || 0), 0);
      const totalRepaid = loans.reduce((sum, l) => sum + (Number(l.amount_paid) || 0), 0);
      const currentBalance = loans
        .filter((l) => l.status !== 'REDEEMED' && l.status !== 'SOLD')
        .reduce((sum, l) => sum + (Number(l.balance_remaining) || 0), 0);

      return {
        ...c,
        previous_loans_count: loans.length,
        total_borrowed: totalBorrowed,
        total_repaid: totalRepaid,
        current_balance: currentBalance,
        defaults_count: Number(c.defaults_count) || 0
      };
    });
  }

  public getCustomerById(id: string): Customer | null {
    const cust = this.query<Customer>('SELECT * FROM customers WHERE id = :id', { ':id': id })[0];
    if (!cust) return null;
    return cust;
  }

  // --- Collateral Items ---
  public getCollaterals(branchFilter?: string): CollateralItem[] {
    const branchClause = branchFilter && branchFilter !== 'ALL' ? `WHERE branch_id = '${branchFilter}'` : '';
    return this.query<CollateralItem>(`SELECT * FROM collateral_items ${branchClause} ORDER BY created_at DESC`);
  }

  public getCollateralById(id: string): CollateralItem | null {
    const item = this.query<CollateralItem>('SELECT * FROM collateral_items WHERE id = :id', { ':id': id })[0];
    return item || null;
  }

  public checkDuplicateSerialOrImei(serialNumber?: string, imei?: string, excludeCollateralId?: string): {
    hasDuplicate: boolean;
    duplicateItem?: CollateralItem;
    message?: string;
  } {
    if (!serialNumber && !imei) return { hasDuplicate: false };

    const items = this.query<CollateralItem>('SELECT * FROM collateral_items');
    for (const item of items) {
      if (excludeCollateralId && item.id === excludeCollateralId) continue;

      if (serialNumber && item.serial_number && item.serial_number.trim().toLowerCase() === serialNumber.trim().toLowerCase()) {
        return {
          hasDuplicate: true,
          duplicateItem: item,
          message: `⚠️ Serial number "${serialNumber}" already exists in system for item ${item.item_name} (${item.collateral_number}). Location: ${item.rack_shelf}`
        };
      }

      if (imei && ((item.imei_1 && item.imei_1.trim() === imei.trim()) || (item.imei_2 && item.imei_2.trim() === imei.trim()))) {
        return {
          hasDuplicate: true,
          duplicateItem: item,
          message: `⚠️ IMEI "${imei}" already exists in system for item ${item.item_name} (${item.collateral_number}). Location: ${item.rack_shelf}`
        };
      }
    }

    return { hasDuplicate: false };
  }

  // --- Loans ---
  public getLoans(branchFilter?: string): RehaniLoan[] {
    const branchClause = branchFilter && branchFilter !== 'ALL' ? `WHERE branch_id = '${branchFilter}'` : '';
    return this.query<RehaniLoan>(`SELECT * FROM rehani_loans ${branchClause} ORDER BY created_at DESC`);
  }

  public getLoanById(id: string): RehaniLoan | null {
    const l = this.query<RehaniLoan>('SELECT * FROM rehani_loans WHERE id = :id', { ':id': id })[0];
    return l || null;
  }

  // --- LTV Settings ---
  public getLTVConfigs(): Record<CollateralCategory, number> {
    const rows = this.query<{ category: CollateralCategory; max_ltv_percent: number }>('SELECT * FROM ltv_configs');
    const result = { ...DEFAULT_LTV_CONFIGS };
    rows.forEach((r) => {
      result[r.category] = r.max_ltv_percent;
    });
    return result;
  }

  public calculateMaxLoan(category: CollateralCategory, marketValue: number): {
    maxLTVPercent: number;
    maxAllowedLoan: number;
  } {
    const configs = this.getLTVConfigs();
    const ltv = configs[category] || 50;
    const maxLoan = Math.floor((marketValue * ltv) / 100);
    return {
      maxLTVPercent: ltv,
      maxAllowedLoan: maxLoan
    };
  }

  // --- Treasury ---
  public getTreasury(): TreasuryAccount {
    const row = this.query<TreasuryAccount>('SELECT * FROM treasury LIMIT 1')[0];
    if (row) return row;
    return {
      cash_in_vault: 0,
      mpesa_till_balance: 0,
      bank_balance: 0,
      trevor_capital: 0,
      peter_capital: 0,
      retained_profit: 0
    };
  }

  public updateTreasury(data: Partial<TreasuryAccount>): void {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    this.run(
      `UPDATE treasury SET
        cash_in_vault = COALESCE(:civ, cash_in_vault),
        mpesa_till_balance = COALESCE(:mtb, mpesa_till_balance),
        bank_balance = COALESCE(:bb, bank_balance),
        trevor_capital = COALESCE(:tc, trevor_capital),
        peter_capital = COALESCE(:pc, peter_capital),
        retained_profit = COALESCE(:rp, retained_profit),
        updated_at = :now`,
      {
        ':civ': data.cash_in_vault !== undefined ? data.cash_in_vault : null,
        ':mtb': data.mpesa_till_balance !== undefined ? data.mpesa_till_balance : null,
        ':bb': data.bank_balance !== undefined ? data.bank_balance : null,
        ':tc': data.trevor_capital !== undefined ? data.trevor_capital : null,
        ':pc': data.peter_capital !== undefined ? data.peter_capital : null,
        ':rp': data.retained_profit !== undefined ? data.retained_profit : null,
        ':now': now
      }
    );
    this.persist();
    this.notify();
  }

  public async clearAllOperationalData(): Promise<void> {
    if (!this.db) return;
    try {
      this.db.run('PRAGMA foreign_keys = OFF;');
    } catch {}

    const tablesToClear = [
      'customers',
      'collateral_items',
      'appliances',
      'rehani_loans',
      'loan_renewals',
      'ledger_transactions',
      'collateral_sales',
      'operating_expenses',
      'appliance_photos',
      'invoices',
      'invoice_items',
      'payments',
      'stock_movements',
      'audit_logs'
    ];

    for (const table of tablesToClear) {
      try {
        this.db.run(`DELETE FROM ${table};`);
      } catch {
        // Table might not exist yet; safe to ignore
      }
    }

    try {
      this.db.run('UPDATE sequence_counters SET last_sequence = 0;');
    } catch {}
    try {
      this.db.run('UPDATE treasury SET cash_in_vault = 0, mpesa_till_balance = 0, bank_balance = 0, trevor_capital = 0, peter_capital = 0, retained_profit = 0;');
    } catch {}
    try {
      this.db.run(`
        INSERT INTO audit_logs (id, user_name, action, entity_type, entity_id, details, created_at) VALUES
        ('aud-clean', 'System', 'CLEAR_DATA', 'DATABASE', 'db-clean', 'Cleared all customer, loan, transaction, and profit data. Ready for personal data entry.', '${new Date().toISOString().replace('T', ' ').substring(0, 19)}');
      `);
    } catch {}
    try {
      this.db.run('PRAGMA foreign_keys = ON;');
    } catch {}
    await this.persist();
    this.notify();
  }

  // --- Transactions & Ledger ---
  public getTransactions(loanId?: string): LedgerTransaction[] {
    const where = loanId ? `WHERE loan_id = '${loanId}'` : '';
    return this.query<LedgerTransaction>(`SELECT * FROM ledger_transactions ${where} ORDER BY created_at DESC`);
  }

  // --- Renewals ---
  public getRenewals(loanId?: string): LoanRenewal[] {
    const where = loanId ? `WHERE loan_id = '${loanId}'` : '';
    return this.query<LoanRenewal>(`SELECT * FROM loan_renewals ${where} ORDER BY renewal_date DESC`);
  }

  // --- Sales ---
  public getSales(): CollateralSale[] {
    return this.query<CollateralSale>('SELECT * FROM collateral_sales ORDER BY sale_date DESC');
  }

  // --- Expenses ---
  public getExpenses(): OperatingExpense[] {
    return this.query<OperatingExpense>('SELECT * FROM operating_expenses ORDER BY expense_date DESC');
  }

  // --- Branches ---
  public getBranches(): Branch[] {
    const list = this.query<Branch>('SELECT * FROM branches');
    return list.length > 0 ? list : DEFAULT_BRANCHES;
  }

  // --- Users & Roles ---
  public getUsers(): User[] {
    return this.query<User>('SELECT * FROM users ORDER BY created_at ASC');
  }

  public getRoles(): UserRole[] {
    const rows = this.query<{ id: string; name: string; description: string; permissions_json: string }>('SELECT * FROM user_roles');
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      permissions: JSON.parse(r.permissions_json || '{}')
    }));
  }

  public updateUserProfile(userId: string, data: Partial<User>): void {
    const fields: string[] = [];
    const values: any[] = [];
    
    if (data.full_name !== undefined) { fields.push('full_name = ?'); values.push(data.full_name); }
    if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email); }
    if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }
    if (data.avatar_url !== undefined) { fields.push('avatar_url = ?'); values.push(data.avatar_url); }
    if (data.address !== undefined) { fields.push('address = ?'); values.push(data.address); }
    if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }
    if (data.appearance_theme !== undefined) { fields.push('appearance_theme = ?'); values.push(data.appearance_theme); }
    if (data.notification_preferences !== undefined) { fields.push('notification_preferences = ?'); values.push(data.notification_preferences); }
    if (data.two_factor_enabled !== undefined) { fields.push('two_factor_enabled = ?'); values.push(data.two_factor_enabled ? 1 : 0); }

    if (fields.length === 0) return;
    values.push(userId);
    this.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    this.persist();
  }

  public updateUserPassword(userId: string, hash: string, salt: string): void {
    this.run('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?', [hash, salt, userId]);
    this.persist();
  }

  // --- Business Settings ---
  public getBusinessSettings(): BusinessSettings {
    try {
      const rows = this.query<{ key: string; value: string }>('SELECT key, value FROM business_settings');
      const map: Record<string, string> = {};
      rows.forEach((r) => { map[r.key] = r.value; });

      return {
        business_name: map['business_name'] || 'PEKASA STORES',
        business_motto: map['business_motto'] || 'We buy and sell used second hand goods, cash against furnitures, fridges, TVs, Woofers, Gas cylinders, Mattress Etc.',
        business_phone: map['business_phone'] || '0727108749',
        business_phone_alt: map['business_phone_alt'] || '0180366344',
        business_email: map['business_email'] || 'info@pekasastores.co.ke',
        business_address: map['business_address'] || 'Kombani Commercial Centre, Kwale County, along Kwale-Likoni Road',
        currency: map['currency'] || 'KES',
        tax_rate: Number(map['tax_rate']) || 0,
        tax_enabled: map['tax_enabled'] === 'true',
        receipt_footer: map['receipt_footer'] || 'Directors: Trevor & Peter | Kombani, Kwale · Open 6 Days',
        invoice_prefix: map['invoice_prefix'] || 'INV',
        receipt_prefix: map['receipt_prefix'] || 'RCT',
        session_timeout_minutes: Number(map['session_timeout_minutes']) || 30,
        logo_url: map['logo_url'] || ''
      };
    } catch {
      return {
        business_name: 'PEKASA STORES',
        business_motto: 'We buy and sell used second hand goods, cash against furnitures, fridges, TVs, Woofers, Gas cylinders, Mattress Etc.',
        business_phone: '0727108749',
        business_phone_alt: '0180366344',
        business_email: 'info@pekasastores.co.ke',
        business_address: 'Kombani Commercial Centre, Kwale County, along Kwale-Likoni Road',
        currency: 'KES',
        tax_rate: 0,
        tax_enabled: false,
        receipt_footer: 'Directors: Trevor & Peter | Kombani, Kwale · Open 6 Days',
        invoice_prefix: 'INV',
        receipt_prefix: 'RCT',
        session_timeout_minutes: 30,
        logo_url: ''
      };
    }
  }

  public saveBusinessSettings(settings: Partial<BusinessSettings>): void {
    const now = new Date().toISOString();
    for (const [k, v] of Object.entries(settings)) {
      if (v !== undefined) {
        this.run(
          'INSERT OR REPLACE INTO business_settings (key, value, updated_at) VALUES (?, ?, ?)',
          [k, String(v), now]
        );
      }
    }
    this.persist();
  }

  public getDatabaseStats(): {
    totalTables: number;
    totalRows: number;
    recordCounts: Record<string, number>;
  } {
    const tables = [
      'users', 'customers', 'collateral_items', 'rehani_loans', 'loan_renewals',
      'ledger_transactions', 'operating_expenses', 'treasury', 'cashier_sessions',
      'audit_logs', 'suppliers', 'inventory_parts'
    ];
    const recordCounts: Record<string, number> = {};
    let totalRows = 0;

    for (const t of tables) {
      try {
        const res = this.query<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM ${t}`);
        const cnt = res[0]?.cnt || 0;
        recordCounts[t] = cnt;
        totalRows += cnt;
      } catch {
        recordCounts[t] = 0;
      }
    }

    return {
      totalTables: tables.length,
      totalRows,
      recordCounts
    };
  }

  // --- Cashier Daily Sessions ---
  public getCashierSessions(cashierId?: string): CashierSession[] {
    const clause = cashierId ? `WHERE cashier_id = '${cashierId}'` : '';
    const rows = this.query<any>(`SELECT * FROM cashier_sessions ${clause} ORDER BY opened_at DESC`);
    return rows.map((r) => ({
      ...r,
      opening_cash: Number(r.opening_cash) || 0,
      cash_collected: Number(r.cash_collected) || 0,
      mpesa_collected: Number(r.mpesa_collected) || 0,
      other_collected: Number(r.other_collected) || 0,
      expected_cash: Number(r.expected_cash) || 0,
      actual_cash: r.actual_cash !== null && r.actual_cash !== undefined ? Number(r.actual_cash) : null,
      difference: r.difference !== null && r.difference !== undefined ? Number(r.difference) : null
    }));
  }

  public getCurrentCashierSession(cashierId: string): CashierSession | null {
    const sessions = this.getCashierSessions(cashierId);
    return sessions.find((s) => s.status === 'OPEN') || null;
  }

  public openCashierSession(
    cashierId: string,
    cashierName: string,
    branchId: string,
    openingCash: number,
    notes?: string
  ): CashierSession {
    const existing = this.getCurrentCashierSession(cashierId);
    if (existing) {
      return existing;
    }
    const id = 'ses-' + Date.now();
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const today = nowStr.split(' ')[0];
    const expected = Number(openingCash) || 0;

    this.run(
      `INSERT INTO cashier_sessions (
        id, cashier_id, cashier_name, branch_id, session_date, opened_at,
        opening_cash, cash_collected, mpesa_collected, other_collected,
        expected_cash, status, reconciliation_status, notes
      ) VALUES (
        :id, :cid, :cn, :bid, :sd, :oa,
        :oc, 0, 0, 0,
        :ec, 'OPEN', 'PENDING_APPROVAL', :notes
      )`,
      {
        ':id': id,
        ':cid': cashierId,
        ':cn': cashierName,
        ':bid': branchId || 'br-nairobi',
        ':sd': today,
        ':oa': nowStr,
        ':oc': Number(openingCash) || 0,
        ':ec': expected,
        ':notes': notes || 'Cashier counter session started'
      }
    );

    this.logAudit(cashierName, 'OPEN_SESSION', 'CASHIER_SESSION', id, `Opened cashier session with KSh ${Number(openingCash).toLocaleString()} opening float`);
    this.persist();
    this.notify();

    return this.getCashierSessions(cashierId)[0];
  }

  public closeCashierSession(
    sessionId: string,
    actualCash: number,
    closingNotes?: string
  ): CashierSession | null {
    const session = this.query<any>('SELECT * FROM cashier_sessions WHERE id = :id', { ':id': sessionId })[0];
    if (!session) return null;

    const expectedCash = (Number(session.opening_cash) || 0) + (Number(session.cash_collected) || 0);
    const diff = Number(actualCash) - expectedCash;
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const reconcStatus = diff === 0 ? 'PENDING_APPROVAL' : 'DISCREPANCY_FLAGGED';

    this.run(
      `UPDATE cashier_sessions SET
        closed_at = :ca,
        expected_cash = :ec,
        actual_cash = :ac,
        difference = :diff,
        status = 'CLOSED',
        reconciliation_status = :rs,
        notes = :notes
       WHERE id = :id`,
      {
        ':id': sessionId,
        ':ca': nowStr,
        ':ec': expectedCash,
        ':ac': Number(actualCash),
        ':diff': diff,
        ':rs': reconcStatus,
        ':notes': closingNotes ? `${session.notes || ''} | Close: ${closingNotes}` : session.notes
      }
    );

    const diffMsg = diff === 0 
      ? 'Balanced (KSh 0)' 
      : diff < 0 
        ? `Shortage of KSh ${Math.abs(diff).toLocaleString()}` 
        : `Overage of KSh ${diff.toLocaleString()}`;

    this.logAudit(
      session.cashier_name,
      'CLOSE_SESSION',
      'CASHIER_SESSION',
      sessionId,
      `Closed session. Expected: KSh ${expectedCash.toLocaleString()}, Actual: KSh ${Number(actualCash).toLocaleString()}, Diff: ${diffMsg}`
    );

    this.persist();
    this.notify();

    return this.getCashierSessions(session.cashier_id).find((s) => s.id === sessionId) || null;
  }

  public approveCashierSessionReconciliation(
    sessionId: string,
    adminName: string,
    notes?: string
  ): void {
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    this.run(
      `UPDATE cashier_sessions SET
        reconciliation_status = 'APPROVED',
        reconciliation_approved_by = :ab,
        reconciliation_notes = :rn
       WHERE id = :id`,
      {
        ':id': sessionId,
        ':ab': adminName,
        ':rn': notes || `Approved by ${adminName} on ${nowStr}`
      }
    );
    this.logAudit(adminName, 'APPROVE_RECONCILIATION', 'CASHIER_SESSION', sessionId, `Approved daily cashier session reconciliation`);
    this.persist();
    this.notify();
  }

  public recordCashierCollection(cashierId: string, paymentMethod: string, amount: number): void {
    const active = this.getCurrentCashierSession(cashierId);
    if (!active) return;

    const amt = Number(amount) || 0;
    const isCash = paymentMethod === 'Cash';
    const isMpesa = paymentMethod === 'M-Pesa';

    if (isCash) {
      this.run(
        `UPDATE cashier_sessions SET 
          cash_collected = cash_collected + :amt,
          expected_cash = opening_cash + cash_collected + :amt
         WHERE id = :id`,
        { ':amt': amt, ':id': active.id }
      );
    } else if (isMpesa) {
      this.run(
        `UPDATE cashier_sessions SET 
          mpesa_collected = mpesa_collected + :amt
         WHERE id = :id`,
        { ':amt': amt, ':id': active.id }
      );
    } else {
      this.run(
        `UPDATE cashier_sessions SET 
          other_collected = other_collected + :amt
         WHERE id = :id`,
        { ':amt': amt, ':id': active.id }
      );
    }
  }

  // --- Payment Void / Correction Requests ---
  public getPaymentVoidRequests(): PaymentVoidRequest[] {
    return this.query<PaymentVoidRequest>('SELECT * FROM payment_void_requests ORDER BY created_at DESC');
  }

  public submitPaymentVoidRequest(req: {
    payment_id: string;
    receipt_number: string;
    loan_number?: string;
    customer_name: string;
    amount: number;
    cashier_id: string;
    cashier_name: string;
    reason: string;
  }): PaymentVoidRequest {
    const id = 'vreq-' + Date.now();
    const reqNum = this.getNextSequence('VOD');
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    this.run(
      `INSERT INTO payment_void_requests (
        id, request_number, payment_id, receipt_number, loan_number,
        customer_name, amount, cashier_id, cashier_name, reason, status, created_at
      ) VALUES (
        :id, :rn, :pid, :rcpt, :ln,
        :cn, :amt, :cid, :cname, :rsn, 'PENDING', :ca
      )`,
      {
        ':id': id,
        ':rn': reqNum,
        ':pid': req.payment_id,
        ':rcpt': req.receipt_number,
        ':ln': req.loan_number || null,
        ':cn': req.customer_name,
        ':amt': Number(req.amount),
        ':cid': req.cashier_id,
        ':cname': req.cashier_name,
        ':rsn': req.reason,
        ':ca': nowStr
      }
    );

    this.logAudit(
      req.cashier_name,
      'SUBMIT_VOID_REQUEST',
      'PAYMENT',
      req.payment_id,
      `Requested void/correction for receipt ${req.receipt_number} (KSh ${Number(req.amount).toLocaleString()}). Reason: ${req.reason}`
    );

    this.persist();
    this.notify();

    return this.getPaymentVoidRequests().find((r) => r.id === id)!;
  }

  public approvePaymentVoidRequest(requestId: string, adminName: string, adminNotes?: string): void {
    const req = this.query<PaymentVoidRequest>('SELECT * FROM payment_void_requests WHERE id = :id', { ':id': requestId })[0];
    if (!req) return;

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // 1. Mark request approved
    this.run(
      `UPDATE payment_void_requests SET 
        status = 'APPROVED',
        reviewed_by = :rb,
        reviewed_at = :ra,
        admin_notes = :an
       WHERE id = :id`,
      {
        ':id': requestId,
        ':rb': adminName,
        ':ra': nowStr,
        ':an': adminNotes || `Void approved by ${adminName}`
      }
    );

    // 2. Void the payment record from payments and ledger_transactions
    try {
      this.run('DELETE FROM payments WHERE id = :pid OR receipt_number = :rcpt', { ':pid': req.payment_id, ':rcpt': req.receipt_number });
    } catch {}
    try {
      this.run('DELETE FROM ledger_transactions WHERE id = :pid OR receipt_number = :rcpt', { ':pid': req.payment_id, ':rcpt': req.receipt_number });
    } catch {}

    this.logAudit(
      adminName,
      'APPROVE_VOID_PAYMENT',
      'PAYMENT',
      req.payment_id,
      `Approved void for receipt ${req.receipt_number} of KSh ${Number(req.amount).toLocaleString()} requested by ${req.cashier_name}`
    );

    this.persist();
    this.notify();
  }

  public rejectPaymentVoidRequest(requestId: string, adminName: string, adminNotes?: string): void {
    const req = this.query<PaymentVoidRequest>('SELECT * FROM payment_void_requests WHERE id = :id', { ':id': requestId })[0];
    if (!req) return;

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    this.run(
      `UPDATE payment_void_requests SET 
        status = 'REJECTED',
        reviewed_by = :rb,
        reviewed_at = :ra,
        admin_notes = :an
       WHERE id = :id`,
      {
        ':id': requestId,
        ':rb': adminName,
        ':ra': nowStr,
        ':an': adminNotes || `Void request rejected by ${adminName}`
      }
    );

    this.logAudit(
      adminName,
      'REJECT_VOID_PAYMENT',
      'PAYMENT',
      req.payment_id,
      `Rejected void request for receipt ${req.receipt_number} by ${req.cashier_name}`
    );

    this.persist();
    this.notify();
  }

  // --- Admin Cashier Account Controls ---
  public toggleUserActive(userId: string, isActive: boolean, adminName: string): void {
    this.run('UPDATE users SET is_active = :act WHERE id = :id', {
      ':act': isActive ? 1 : 0,
      ':id': userId
    });
    const user = this.query<User>('SELECT * FROM users WHERE id = :id', { ':id': userId })[0];
    this.logAudit(
      adminName,
      isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      'USER',
      userId,
      `${isActive ? 'Activated' : 'Deactivated'} account for ${user?.full_name || userId}`
    );
    this.persist();
    this.notify();
  }

  public async resetUserPassword(userId: string, newPass: string, adminName: string): Promise<void> {
    const hash = await hashPassword(newPass, DEFAULT_SALT);
    this.run('UPDATE users SET password_hash = :hash, salt = :salt WHERE id = :id', {
      ':hash': hash,
      ':salt': DEFAULT_SALT,
      ':id': userId
    });
    const user = this.query<User>('SELECT * FROM users WHERE id = :id', { ':id': userId })[0];
    this.logAudit(
      adminName,
      'RESET_PASSWORD',
      'USER',
      userId,
      `Reset password for ${user?.full_name || userId}`
    );
    this.persist();
    this.notify();
  }

  public deleteUser(userId: string, adminName: string): void {
    const user = this.query<User>('SELECT * FROM users WHERE id = :id', { ':id': userId })[0];
    if (user?.username === 'trevor' || user?.username === 'peter') {
      throw new Error('Primary Senior Partners Trevor and Peter cannot be deleted.');
    }
    this.run('DELETE FROM users WHERE id = :id', { ':id': userId });
    this.logAudit(
      adminName,
      'DELETE_USER',
      'USER',
      userId,
      `Permanently removed cashier account: ${user?.full_name || userId}`
    );
    this.persist();
    this.notify();
  }

  // --- Audit Logs ---
  public getAuditLogs(): AuditLog[] {
    return this.query<AuditLog>('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200');
  }

  public logAudit(userName: string, action: string, entityType: string, entityId: string, details: string): void {
    const id = 'aud-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    try {
      this.run(
        `INSERT INTO audit_logs (id, user_name, action, entity_type, entity_id, details, created_at)
         VALUES (:id, :un, :act, :et, :eid, :det, :ca)`,
        {
          ':id': id,
          ':un': userName,
          ':act': action,
          ':et': entityType,
          ':eid': entityId,
          ':det': details,
          ':ca': now
        }
      );
    } catch (e) {
      console.error('Failed to write audit log:', e);
    }
  }

  // --- Backward Compatibility Handlers ---
  public getAppliances(): any[] {
    const cols = this.getCollaterals();
    return cols.map((c) => ({
      ...c,
      appliance_number: c.collateral_number,
      amount_received: c.amount_offered,
      due_date: this.query<{ due_date: string }>('SELECT due_date FROM rehani_loans WHERE collateral_id = :cid', { ':cid': c.id })[0]?.due_date || '2026-10-15',
      funder: 'Peter',
      technician_name: 'Trevor',
      interest_charges: 1000
    }));
  }

  public calculateApplianceBalance(app: any): { totalDue: number; totalPaid: number; balanceRemaining: number } {
    const loan = this.query<{ total_amount_due: number; amount_paid: number; balance_remaining: number }>(
      'SELECT total_amount_due, amount_paid, balance_remaining FROM rehani_loans WHERE collateral_id = :cid',
      { ':cid': app.id }
    )[0];
    if (loan) {
      return {
        totalDue: Number(loan.total_amount_due) || 0,
        totalPaid: Number(loan.amount_paid) || 0,
        balanceRemaining: Number(loan.balance_remaining) || 0
      };
    }
    return {
      totalDue: (Number(app.amount_received) || 0) + (Number(app.interest_charges) || 0),
      totalPaid: 0,
      balanceRemaining: (Number(app.amount_received) || 0) + (Number(app.interest_charges) || 0)
    };
  }

  public getPayments(): any[] {
    return this.getTransactions();
  }

  public getInvoices(): any[] {
    try {
      return this.query('SELECT * FROM invoices');
    } catch {
      return [];
    }
  }

  public getParts(): any[] {
    try {
      return this.query('SELECT * FROM parts');
    } catch {
      return [];
    }
  }

  public getPersonalGoods(): any[] {
    try { return this.query('SELECT * FROM personal_goods ORDER BY created_at DESC'); } catch { return []; }
  }

  public addPersonalGood(data: any): void {
    const now = new Date().toISOString();
    this.run(`INSERT INTO personal_goods
      (id, item_name, category, details, item_condition, purchase_price, asking_price, seller_name, purchase_date, status, notes, created_by, created_at, updated_at)
      VALUES (:id, :item_name, :category, :details, :item_condition, :purchase_price, :asking_price, :seller_name, :purchase_date, 'IN_STOCK', :notes, :created_by, :created_at, :updated_at)`,
      { ':id': crypto.randomUUID(), ':item_name': data.item_name, ':category': data.category || 'Other',
        ':details': data.details || null, ':item_condition': data.item_condition || null,
        ':purchase_price': Number(data.purchase_price), ':asking_price': Number(data.asking_price),
        ':seller_name': data.seller_name || null, ':purchase_date': data.purchase_date,
        ':notes': data.notes || null, ':created_by': data.created_by || 'Admin',
        ':created_at': now, ':updated_at': now });
  }

  public recordPersonalGoodSale(id: string, data: any): void {
    this.run(`UPDATE personal_goods SET status = 'SOLD', sale_price = :sale_price,
      buyer_name = :buyer_name, buyer_phone = :buyer_phone, sale_date = :sale_date,
      payment_method = :payment_method, payment_reference = :payment_reference, updated_at = :updated_at
      WHERE id = :id AND status = 'IN_STOCK'`,
      { ':id': id, ':sale_price': Number(data.sale_price), ':buyer_name': data.buyer_name || null,
        ':buyer_phone': data.buyer_phone || null, ':sale_date': data.sale_date,
        ':payment_method': data.payment_method || null, ':payment_reference': data.payment_reference || null,
        ':updated_at': new Date().toISOString() });
  }

  public getSuppliers(): any[] {
    try {
      return this.query('SELECT * FROM suppliers');
    } catch {
      return [];
    }
  }

  public updateCustomerPhoto(customerId: string, photoUrl: string): void {
    this.run('UPDATE customers SET photo_url = :p WHERE id = :id', {
      ':p': photoUrl,
      ':id': customerId
    });
  }

  public updateCustomer(id: string, data: Partial<Customer>): void {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    // Optional text fields can be cleared: when the key is passed (even empty) it is written;
    // when the key is absent the stored value is kept.
    const has = (key: keyof Customer) => (key in data ? 1 : 0);
    this.run(
      `UPDATE customers SET
        name = COALESCE(:name, name),
        id_number = COALESCE(:id_number, id_number),
        phone = COALESCE(:phone, phone),
        alt_phone = COALESCE(:alt_phone, alt_phone),
        email = CASE WHEN :has_email = 1 THEN :email ELSE email END,
        address = CASE WHEN :has_address = 1 THEN :address ELSE address END,
        county = COALESCE(:county, county),
        photo_url = COALESCE(:photo_url, photo_url),
        id_photo_url = COALESCE(:id_photo_url, id_photo_url),
        status = COALESCE(:status, status),
        notes = CASE WHEN :has_notes = 1 THEN :notes ELSE notes END,
        updated_at = :now
       WHERE id = :id`,
      {
        ':id': id,
        ':name': data.name || null,
        ':id_number': data.id_number || null,
        ':phone': data.phone || null,
        ':alt_phone': data.alt_phone || null,
        ':has_email': has('email'),
        ':email': data.email || null,
        ':has_address': has('address'),
        ':address': data.address || null,
        ':county': data.county || null,
        ':photo_url': data.photo_url || null,
        ':id_photo_url': data.id_photo_url || null,
        ':status': data.status || null,
        ':has_notes': has('notes'),
        ':notes': data.notes || null,
        ':now': now
      }
    );
  }

  public getUserRoles(): UserRole[] {
    return this.getRoles();
  }

  public getAppliancePhotos(applianceId: string): any[] {
    try {
      return this.query('SELECT * FROM appliance_photos WHERE appliance_id = :id', { ':id': applianceId });
    } catch {
      return [];
    }
  }

  public getPaymentsForAppliance(applianceId: string): any[] {
    try {
      return this.query('SELECT * FROM ledger_transactions WHERE collateral_id = :id OR loan_id = :id OR appliance_id = :id', { ':id': applianceId });
    } catch {
      return [];
    }
  }

  public issuePartToAppliance(partId: string, applianceId: string, quantity: number, issuedBy: string): void {
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    this.run('UPDATE parts SET quantity = MAX(0, quantity - :qty), updated_at = :u WHERE id = :pid', {
      ':qty': quantity,
      ':u': nowStr,
      ':pid': partId
    });
    this.run(
      `INSERT INTO stock_movements (id, part_id, movement_type, quantity, reference_type, reference_id, notes, created_by, created_at)
       VALUES (:id, :pid, 'OUT', :qty, 'REPAIR', :aid, 'Part issued to appliance repair', :cb, :ca)`,
      {
        ':id': 'smv-' + Date.now(),
        ':pid': partId,
        ':qty': quantity,
        ':aid': applianceId,
        ':cb': issuedBy,
        ':ca': nowStr
      }
    );
  }

  public getStockMovements(): any[] {
    try {
      return this.query('SELECT * FROM stock_movements ORDER BY created_at DESC');
    } catch {
      return [];
    }
  }

  public recordStockMovement(
    arg1: any,
    movementType?: 'IN' | 'OUT' | 'ADJUSTMENT',
    quantity?: number,
    notes?: string,
    createdBy?: string
  ): void {
    const data = typeof arg1 === 'object' && arg1 !== null ? arg1 : {
      part_id: arg1,
      movement_type: movementType,
      quantity: quantity,
      notes: notes,
      created_by: createdBy
    };
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    this.run(
      `INSERT INTO stock_movements (id, part_id, movement_type, quantity, reference_type, reference_id, notes, created_by, created_at)
       VALUES (:id, :pid, :mt, :qty, :rt, :rid, :notes, :cb, :ca)`,
      {
        ':id': 'smv-' + Date.now(),
        ':pid': data.part_id,
        ':mt': data.movement_type,
        ':qty': data.quantity,
        ':rt': data.reference_type || 'MANUAL',
        ':rid': data.reference_id || null,
        ':notes': data.notes || '',
        ':cb': data.created_by || 'Admin',
        ':ca': nowStr
      }
    );
    if (data.movement_type === 'IN') {
      this.run('UPDATE parts SET quantity = quantity + :qty, updated_at = :u WHERE id = :pid', {
        ':qty': data.quantity,
        ':u': nowStr,
        ':pid': data.part_id
      });
    } else if (data.movement_type === 'OUT') {
      this.run('UPDATE parts SET quantity = MAX(0, quantity - :qty), updated_at = :u WHERE id = :pid', {
        ':qty': data.quantity,
        ':u': nowStr,
        ':pid': data.part_id
      });
    }
  }

  public exportDatabaseBinary(): Uint8Array {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.export();
  }

  public exportDatabaseJson(): string {
    if (!this.db) throw new Error('Database not initialized');
    return JSON.stringify({
      version: 2,
      exportedAt: new Date().toISOString(),
      branches: this.getBranches(),
      users: this.getUsers(),
      customers: this.getCustomers(),
      collaterals: this.getCollaterals(),
      loans: this.getLoans(),
      renewals: this.getRenewals(),
      transactions: this.getTransactions(),
      sales: this.getSales(),
      expenses: this.getExpenses(),
      treasury: this.getTreasury(),
      parts: this.getParts(),
      suppliers: this.getSuppliers(),
      auditLogs: this.getAuditLogs()
    }, null, 2);
  }

  /**
   * Merge another device's SQLite snapshot into this database.
   * Rows with different primary keys are retained from both devices. For rows
   * with the same key, the row with the newest update timestamp is kept.
   */
  public async mergeFromSqliteBinary(bytes: Uint8Array, sourceDeviceId = 'device', preferRemoteUntimestamped = true): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const SQL = await initSqlAsm();
    const incoming = new SQL.Database(bytes);
    const quote = (name: string) => '"' + name.replace(/"/g, '""') + '"';
    const codeColumns: Record<string, string[]> = {
      customers: ['customer_number'],
      collateral_items: ['collateral_number'],
      rehani_loans: ['loan_number'],
      loan_renewals: ['renewal_number'],
      ledger_transactions: ['transaction_number', 'receipt_number'],
      collateral_sales: ['sale_number'],
      operating_expenses: ['expense_number'],
      appliances: ['appliance_number'],
      payments: ['receipt_number'],
      invoices: ['invoice_number'],
      payment_void_requests: ['request_number'],
      parts: ['sku']
    };
    const suffix = sourceDeviceId.replace(/[^a-zA-Z0-9]/g, '').slice(-5) || Math.random().toString(36).slice(2, 7);
    const remoteCodeRemaps: Record<string, Record<string, string>> = {};
    const readRows = (database: Database, sql: string): Array<Record<string, any>> => {
      const result = database.exec(sql)[0];
      if (!result) return [];
      return result.values.map((values) =>
        Object.fromEntries(result.columns.map((column, index) => [column, values[index]]))
      );
    };
    const existsBy = (table: string, column: string, value: any, pkColumns: string[], pkValues: any[]) => {
      const where = [`${quote(column)} = :value`, ...pkColumns.map((columnName, index) => `${quote(columnName)} != :pk${index}`)].join(' AND ');
      const params: Record<string, any> = { ':value': value };
      pkValues.forEach((pkValue, index) => { params[':pk' + index] = pkValue; });
      return this.query(`SELECT 1 AS found FROM ${quote(table)} WHERE ${where} LIMIT 1`, params).length > 0;
    };

    this.db.run('PRAGMA foreign_keys = OFF;');
    this.db.run('BEGIN TRANSACTION;');
    try {
      const incomingTables = readRows(incoming, "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
      for (const tableRow of incomingTables) {
        const table = String(tableRow.name);
        const localExists = this.query<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = :name",
          { ':name': table }
        ).length > 0;
        if (!localExists) continue;

        const incomingInfo = readRows(incoming, `PRAGMA table_info(${quote(table)})`);
        const localInfo = this.query<{ name: string; pk: number }>(`PRAGMA table_info(${quote(table)})`);
        const localNames = new Set(localInfo.map((column) => column.name));
        const columns = incomingInfo.map((column: any) => String(column.name)).filter((name) => localNames.has(name));
        const pkColumns = localInfo.filter((column) => Number(column.pk) > 0).sort((a, b) => Number(a.pk) - Number(b.pk)).map((column) => column.name);
        if (columns.length === 0 || pkColumns.length === 0) continue;

        const remoteRows = readRows(incoming, `SELECT * FROM ${quote(table)}`);
        for (const sourceRow of remoteRows) {
          const remoteRow = { ...sourceRow };
          for (const [column, mappings] of Object.entries(remoteCodeRemaps)) {
            if (typeof remoteRow[column] === 'string' && mappings[remoteRow[column]]) {
              remoteRow[column] = mappings[remoteRow[column]];
            }
          }
          const pkValues = pkColumns.map((column) => remoteRow[column]);
          if (pkValues.some((value) => value === null || value === undefined)) continue;
          const pkWhere = pkColumns.map((column, index) => `${quote(column)} = :pk${index}`).join(' AND ');
          const pkParams: Record<string, any> = {};
          pkValues.forEach((value, index) => { pkParams[':pk' + index] = value; });
          const localRow = this.query<Record<string, any>>(
            `SELECT * FROM ${quote(table)} WHERE ${pkWhere} LIMIT 1`,
            pkParams
          )[0];
          const remoteUpdated = String(remoteRow.updated_at || remoteRow.last_login || remoteRow.reviewed_at || remoteRow.closed_at || remoteRow.uploaded_at || '');
          const localUpdated = String(localRow?.updated_at || localRow?.last_login || localRow?.reviewed_at || localRow?.closed_at || localRow?.uploaded_at || '');
          const shouldReplace = !localRow
            || (localUpdated && remoteUpdated ? remoteUpdated >= localUpdated : preferRemoteUntimestamped);
          if (!shouldReplace) continue;

          const mergedRow: Record<string, any> = {};
          columns.forEach((column) => { mergedRow[column] = remoteRow[column]; });
          if (table === 'sequence_counters' && localRow && mergedRow.last_sequence !== undefined) {
            mergedRow.last_sequence = Math.max(Number(localRow.last_sequence) || 0, Number(mergedRow.last_sequence) || 0);
          }

          // Sequence-generated display codes can overlap when devices create
          // records offline. Keep both records and give the incoming code a
          // device suffix instead of dropping the new row on a UNIQUE conflict.
          const codeCols = codeColumns[table] || [];
          for (const column of codeCols) {
            if (mergedRow[column] === null || mergedRow[column] === undefined) continue;
            if (existsBy(table, column, mergedRow[column], pkColumns, pkValues)) {
              const original = String(mergedRow[column]);
              let candidate = `${original}-${suffix}`;
              let attempt = 1;
              while (existsBy(table, column, candidate, pkColumns, pkValues)) {
                candidate = `${original}-${suffix}-${attempt++}`;
              }
              mergedRow[column] = candidate;
              remoteCodeRemaps[column] ||= {};
              remoteCodeRemaps[column][original] = candidate;
            }
          }

          const writeColumns = columns.filter((column) => !pkColumns.includes(column));
          if (localRow) {
            const assignments = writeColumns.map((column) => `${quote(column)} = :v_${column}`).join(', ');
            if (assignments) {
              const params: Record<string, any> = { ...pkParams };
              writeColumns.forEach((column) => { params[':v_' + column] = mergedRow[column]; });
              this.db.run(`UPDATE ${quote(table)} SET ${assignments} WHERE ${pkWhere}`, params);
            }
          } else {
            const names = columns.map(quote).join(', ');
            const placeholders = columns.map((column) => ':v_' + column).join(', ');
            const params: Record<string, any> = {};
            columns.forEach((column) => { params[':v_' + column] = mergedRow[column]; });
            this.db.run(`INSERT INTO ${quote(table)} (${names}) VALUES (${placeholders})`, params);
          }
        }
      }
      this.db.run('COMMIT;');
    } catch (error) {
      this.db.run('ROLLBACK;');
      throw error;
    } finally {
      incoming.close();
      this.db.run('PRAGMA foreign_keys = ON;');
    }
    await this.persist();
    this.notify();
  }

  public async restoreFromSqliteBinary(bytes: Uint8Array): Promise<void> {
    const SQL = await initSqlAsm();
    this.db = new SQL.Database(bytes);
    this.ensureSchema();
    await this.persist();
    this.notify();
  }

  public async restoreFromJson(json: string): Promise<void> {
    const SQL = await initSqlAsm();
    this.db = new SQL.Database();
    await this.createInitialSchemaAndSeed();
    await this.persist();
    this.notify();
  }

  public async resetToDefaults(): Promise<void> {
    const SQL = await initSqlAsm();
    this.db = new SQL.Database();
    await this.createInitialSchemaAndSeed();
    await this.persist();
    this.notify();
  }

  public async clearOperationalDataAdmin(preserveAdminUsers: boolean = true): Promise<void> {
    if (!this.db) return;
    this.run('DELETE FROM loan_renewals;');
    this.run('DELETE FROM ledger_transactions;');
    this.run('DELETE FROM rehani_loans;');
    this.run('DELETE FROM collateral_items;');
    this.run('DELETE FROM customers;');
    this.run('DELETE FROM operating_expenses;');
    this.run('DELETE FROM collateral_sales;');
    this.run('DELETE FROM stock_movements;');
    this.run('DELETE FROM cashier_sessions;');
    try { this.run('DELETE FROM payment_void_requests;'); } catch {}
    if (!preserveAdminUsers) {
      this.run("DELETE FROM users WHERE username NOT IN ('trevor', 'peter');");
    }
    this.run("UPDATE treasury SET cash_in_vault = 0, mpesa_till_balance = 0, bank_balance = 0, trevor_capital = 0, peter_capital = 0, retained_profit = 0 WHERE id = 'trs-main';");
    this.run("INSERT INTO audit_logs (id, user_name, action, entity_type, entity_id, details, created_at) VALUES ('aud-' || hex(randomblob(6)), 'Admin', 'DATA_RESET', 'DATABASE', 'ALL', 'Operational data cleared by authorized administrator.', datetime('now'));");
    await this.persist();
    this.notify();
  }
}

export const sqliteService = new SQLiteService();
