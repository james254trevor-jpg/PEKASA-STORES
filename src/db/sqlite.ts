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
  DEFAULT_LTV_CONFIGS
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
      const savedBytes = await this.loadSavedDatabaseBytes();

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
      if (typeof window !== 'undefined' && localStorage.getItem('pekasa_clean_data_purged_v5') !== 'true') {
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

      // Add missing columns to customers if upgrading
      try { this.db.run('ALTER TABLE customers ADD COLUMN customer_number TEXT;'); } catch {}
      try { this.db.run('ALTER TABLE customers ADD COLUMN alt_phone TEXT;'); } catch {}
      try { this.db.run('ALTER TABLE customers ADD COLUMN county TEXT;'); } catch {}
      try { this.db.run('ALTER TABLE customers ADD COLUMN id_photo_url TEXT;'); } catch {}
      try { this.db.run('ALTER TABLE customers ADD COLUMN status TEXT DEFAULT "Good Standing";'); } catch {}
      try { this.db.run('ALTER TABLE customers ADD COLUMN defaults_count INTEGER DEFAULT 0;'); } catch {}

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
        address TEXT,
        county TEXT,
        photo_url TEXT,
        id_photo_url TEXT,
        status TEXT NOT NULL DEFAULT 'Good Standing',
        notes TEXT,
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
      ('INV', 2026, 0);
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
  public getNextSequence(prefix: 'LN' | 'COL' | 'CUS' | 'RCT' | 'TXN' | 'RNW' | 'SAL' | 'EXP' | 'APP' | 'INV'): string {
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
    this.db.run('DELETE FROM customers;');
    this.db.run('DELETE FROM collateral_items;');
    this.db.run('DELETE FROM appliances;');
    this.db.run('DELETE FROM rehani_loans;');
    this.db.run('DELETE FROM loan_renewals;');
    this.db.run('DELETE FROM ledger_transactions;');
    this.db.run('DELETE FROM collateral_sales;');
    this.db.run('DELETE FROM operating_expenses;');
    this.db.run('DELETE FROM appliance_photos;');
    this.db.run('DELETE FROM invoices;');
    this.db.run('DELETE FROM invoice_items;');
    this.db.run('DELETE FROM audit_logs;');
    try {
      this.db.run('UPDATE sequence_counters SET last_sequence = 0;');
    } catch {}
    try {
      this.db.run('UPDATE treasury SET cash_in_vault = 0, mpesa_till_balance = 0, bank_balance = 0, trevor_capital = 0, peter_capital = 0, retained_profit = 0;');
    } catch {}
    this.db.run(`
      INSERT INTO audit_logs (id, user_name, action, entity_type, entity_id, details, created_at) VALUES
      ('aud-clean', 'System', 'CLEAR_DATA', 'DATABASE', 'db-clean', 'Cleared all customer, loan, transaction, and profit data. Ready for personal data entry.', '${new Date().toISOString().replace('T', ' ').substring(0, 19)}');
    `);
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
    return this.query('SELECT * FROM invoices');
  }

  public getParts(): any[] {
    return this.query('SELECT * FROM parts');
  }

  public getSuppliers(): any[] {
    return this.query('SELECT * FROM suppliers');
  }

  public updateCustomerPhoto(customerId: string, photoUrl: string): void {
    this.run('UPDATE customers SET photo_url = :p WHERE id = :id', {
      ':p': photoUrl,
      ':id': customerId
    });
  }

  public updateCustomer(id: string, data: Partial<Customer>): void {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    this.run(
      `UPDATE customers SET
        name = COALESCE(:name, name),
        id_number = COALESCE(:id_number, id_number),
        phone = COALESCE(:phone, phone),
        alt_phone = COALESCE(:alt_phone, alt_phone),
        address = COALESCE(:address, address),
        county = COALESCE(:county, county),
        photo_url = COALESCE(:photo_url, photo_url),
        status = COALESCE(:status, status),
        notes = COALESCE(:notes, notes),
        updated_at = :now
       WHERE id = :id`,
      {
        ':id': id,
        ':name': data.name || null,
        ':id_number': data.id_number || null,
        ':phone': data.phone || null,
        ':alt_phone': data.alt_phone || null,
        ':address': data.address || null,
        ':county': data.county || null,
        ':photo_url': data.photo_url || null,
        ':status': data.status || null,
        ':notes': data.notes || null,
        ':now': now
      }
    );
  }

  public getUserRoles(): UserRole[] {
    return this.getRoles();
  }

  public getAppliancePhotos(applianceId: string): any[] {
    return this.query('SELECT * FROM appliance_photos WHERE appliance_id = :id', { ':id': applianceId });
  }

  public getPaymentsForAppliance(applianceId: string): any[] {
    return this.query('SELECT * FROM ledger_transactions WHERE collateral_id = :id OR loan_id = :id OR appliance_id = :id', { ':id': applianceId });
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
    return this.query('SELECT * FROM stock_movements ORDER BY created_at DESC');
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
}

export const sqliteService = new SQLiteService();
