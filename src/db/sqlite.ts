/**
 * PEKASA Relational SQLite Database Engine
 * Powered by WebAssembly SQLite (sql.js) with IndexedDB & localStorage persistence.
 * Full relational schema with foreign keys, sequential auto-numbering, backup & restore.
 */

import type { Database } from 'sql.js';
// @ts-ignore
import initSqlAsm from 'sql.js/dist/sql-asm.js';
import {
  User,
  UserRole,
  Customer,
  Appliance,
  AppliancePhoto,
  Payment,
  Invoice,
  InvoiceItem,
  Part,
  StockMovement,
  Supplier,
  Expense,
  AuditLog
} from '../types';
import { hashPassword, DEFAULT_SALT } from '../utils/security';
import { formatSequenceCode, calculateDueDate } from '../utils/numbering';

const DB_STORE_NAME = 'pekasa_sqlite_db_v1';
const DB_LOCAL_FALLBACK_KEY = 'pekasa_sqlite_raw_fallback';

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
      // Initialize self-contained SQLite engine without external wasm network dependencies
      const SQL = await initSqlAsm();

      // Try loading previous binary database from IndexedDB or localStorage
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
      await this.persist();
      this.notify();
    } catch (error) {
      console.error('Fatal SQLite initialization error:', error);
      throw error;
    }
  }

  private ensureSchema(): void {
    if (!this.db) return;
    this.db.run('PRAGMA foreign_keys = ON;');
    try {
      this.db.run('ALTER TABLE customers ADD COLUMN photo_url TEXT;');
    } catch {
      // column already exists
    }
  }

  private async createInitialSchemaAndSeed(): Promise<void> {
    if (!this.db) return;

    // Temporarily turn foreign keys off during table creation & initial seed
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
        created_at TEXT NOT NULL,
        last_login TEXT,
        FOREIGN KEY (role_id) REFERENCES user_roles(id)
      );
    `);

    // 3. Customers table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        id_number TEXT UNIQUE NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        address TEXT,
        photo_url TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // 4. Appliances table
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
        updated_at TEXT NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      );
    `);

    // 5. Photos table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS appliance_photos (
        id TEXT PRIMARY KEY,
        appliance_id TEXT NOT NULL,
        photo_url TEXT NOT NULL,
        caption TEXT,
        uploaded_at TEXT NOT NULL,
        FOREIGN KEY (appliance_id) REFERENCES appliances(id) ON DELETE CASCADE
      );
    `);

    // 6. Payments table
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
        created_at TEXT NOT NULL,
        FOREIGN KEY (appliance_id) REFERENCES appliances(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      );
    `);

    // 7. Invoices table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        invoice_number TEXT UNIQUE NOT NULL,
        appliance_id TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        issue_date TEXT NOT NULL,
        due_date TEXT NOT NULL,
        subtotal REAL NOT NULL,
        tax REAL DEFAULT 0,
        total_amount REAL NOT NULL,
        status TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (appliance_id) REFERENCES appliances(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      );
    `);

    // 8. Invoice items
    this.db.run(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL,
        part_id TEXT,
        description TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
      );
    `);

    // 9. Suppliers table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        contact_person TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        address TEXT,
        category TEXT,
        payment_terms TEXT,
        created_at TEXT NOT NULL
      );
    `);

    // 10. Parts & Stock
    this.db.run(`
      CREATE TABLE IF NOT EXISTS parts (
        id TEXT PRIMARY KEY,
        sku TEXT UNIQUE NOT NULL,
        part_name TEXT NOT NULL,
        category TEXT NOT NULL,
        supplier_id TEXT,
        cost_price REAL NOT NULL,
        selling_price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        reorder_level INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      );
    `);

    // 11. Stock movements
    this.db.run(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id TEXT PRIMARY KEY,
        part_id TEXT NOT NULL,
        movement_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        reason TEXT NOT NULL,
        appliance_id TEXT,
        performed_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (part_id) REFERENCES parts(id),
        FOREIGN KEY (appliance_id) REFERENCES appliances(id)
      );
    `);

    // 12. Expenses table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        paid_by TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        reference_code TEXT,
        expense_date TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL
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

    await this.seedInitialData();
    this.db.run('PRAGMA foreign_keys = ON;');
  }

  private async seedInitialData(): Promise<void> {
    if (!this.db) return;

    // Default Roles
    const adminPerms = JSON.stringify({
      can_manage_appliances: true,
      can_issue_money: true,
      can_record_payments: true,
      can_manage_parts: true,
      can_manage_expenses: true,
      can_view_financials: true,
      can_manage_users: true,
      can_backup_restore: true
    });

    const technicianPerms = JSON.stringify({
      can_manage_appliances: true,
      can_issue_money: false,
      can_record_payments: false,
      can_manage_parts: true,
      can_manage_expenses: false,
      can_view_financials: false,
      can_manage_users: false,
      can_backup_restore: false
    });

    const clerkPerms = JSON.stringify({
      can_manage_appliances: true,
      can_issue_money: false,
      can_record_payments: true,
      can_manage_parts: false,
      can_manage_expenses: true,
      can_view_financials: false,
      can_manage_users: false,
      can_backup_restore: false
    });

    this.db.run(`
      INSERT INTO user_roles (id, name, description, permissions_json) VALUES
      ('role-admin', 'Senior Partner / Director', 'Full administrative authority and financial control', '${adminPerms}'),
      ('role-tech', 'Lead Technician', 'Handles appliance repairs, diagnostics, and part replacements', '${technicianPerms}'),
      ('role-clerk', 'Shop Cashier / Clerk', 'Front-desk operations, customer intake, and M-Pesa receipts', '${clerkPerms}');
    `);

    // Two mandatory primary users with exact passwords requested:
    // 1. Trevor: password "Mbugua254"
    // 2. Peter: password "kamaupita"
    const trevorHash = await hashPassword('Mbugua254', DEFAULT_SALT);
    const peterHash = await hashPassword('kamaupita', DEFAULT_SALT);

    this.db.run(`
      INSERT INTO users (id, username, full_name, email, phone, password_hash, salt, role_id, role_title, created_at, last_login) VALUES
      ('usr-trevor', 'trevor', 'Trevor Mbugua', 'james254trevor@gmail.com', '+254 722 100 200', '${trevorHash}', '${DEFAULT_SALT}', 'role-admin', 'Senior Partner / Director', '2026-01-01 08:00:00', '2026-09-30 10:15:00'),
      ('usr-peter', 'peter', 'Peter Kamau', 'kamaupita@pekasa.co.ke', '+254 711 300 400', '${peterHash}', '${DEFAULT_SALT}', 'role-admin', 'Senior Partner / Director', '2026-01-01 08:00:00', '2026-09-30 09:30:00');
    `);

    // Initial sequence counters
    this.db.run(`
      INSERT INTO sequence_counters (prefix, current_year, last_sequence) VALUES
      ('APP', 2026, 4),
      ('INV', 2026, 2),
      ('RCT', 2026, 3);
    `);

    // Suppliers
    this.db.run(`
      INSERT INTO suppliers (id, name, contact_person, phone, email, address, category, payment_terms, created_at) VALUES
      ('sup-1', 'Nairobi Electronics & Spares Hub', 'Jared Mutua', '+254 722 555 111', 'sales@nairobisparehub.co.ke', 'Luthuli Avenue, Nairobi', 'TV & Sound Components', 'Cash on Delivery', '2026-01-10'),
      ('sup-2', 'Kenlux Refrigeration Parts Ltd', 'Beatrice Wanjiru', '+254 733 444 888', 'info@kenluxrefrig.com', 'Commercial Street, Industrial Area', 'Compressors & Gas', 'Net 14 Days', '2026-01-15'),
      ('sup-3', 'Cooker & Heating Tech Solutions', 'Sammy Kioko', '+254 701 999 333', 'sammy@cookertech.co.ke', 'River Road, Nairobi', 'Heating Elements & Regulators', 'Cash / M-Pesa', '2026-02-01');
    `);

    // Parts Inventory
    this.db.run(`
      INSERT INTO parts (id, sku, part_name, category, supplier_id, cost_price, selling_price, quantity, reorder_level, created_at, updated_at) VALUES
      ('prt-1', 'PRT-TV-001', 'Smart TV Universal LED Backlight Strip (32-55")', 'Electronics', 'sup-1', 1200, 2500, 18, 5, '2026-02-01', '2026-09-20'),
      ('prt-2', 'PRT-TV-002', 'Samsung 4K Main Logic Power Board Replacement', 'Electronics', 'sup-1', 4500, 7500, 4, 3, '2026-02-10', '2026-09-22'),
      ('prt-3', 'PRT-REF-001', 'R134a Refrigerant Canister 1kg & Charging Valve', 'Refrigeration', 'sup-2', 1800, 3200, 9, 4, '2026-02-15', '2026-09-25'),
      ('prt-4', 'PRT-REF-002', 'Universal Compressor PTC Starter Relay & Capacitor', 'Refrigeration', 'sup-2', 750, 1600, 2, 5, '2026-03-01', '2026-09-28'),
      ('prt-5', 'PRT-GAS-001', 'Cast Iron Gas Burner Crown & Flame Cap Set', 'Gas & Cooking', 'sup-3', 950, 1900, 14, 4, '2026-03-10', '2026-09-26'),
      ('prt-6', 'PRT-MW-001', 'Microwave Magnetron Tube 2M214 High Voltage', 'Appliances', 'sup-3', 2800, 5200, 3, 2, '2026-03-20', '2026-09-29'),
      ('prt-7', 'PRT-WSH-001', 'Washing Machine Universal Drainage Pump 30W', 'Appliances', 'sup-2', 2200, 4200, 1, 3, '2026-04-01', '2026-09-29');
    `);

    // Customers with direct portrait photos
    const johnPhoto = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%230f172a"/><circle cx="100" cy="80" r="45" fill="%230abab5"/><circle cx="100" cy="75" r="35" fill="%23f1f5f9"/><path d="M40 185 c0 -35 25 -60 60 -60 c35 0 60 25 60 60 Z" fill="%2320b2aa"/><text x="100" y="85" font-family="sans-serif" font-weight="bold" font-size="28" fill="%230f172a" text-anchor="middle">JM</text></svg>';
    const gracePhoto = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%230f172a"/><circle cx="100" cy="80" r="45" fill="%230abab5"/><circle cx="100" cy="75" r="35" fill="%23f8fafc"/><path d="M40 185 c0 -35 25 -60 60 -60 c35 0 60 25 60 60 Z" fill="%23089995"/><text x="100" y="85" font-family="sans-serif" font-weight="bold" font-size="28" fill="%230f172a" text-anchor="middle">GW</text></svg>';
    const davidPhoto = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%230f172a"/><circle cx="100" cy="80" r="45" fill="%2338bdf8"/><circle cx="100" cy="75" r="35" fill="%23e2e8f0"/><path d="M40 185 c0 -35 25 -60 60 -60 c35 0 60 25 60 60 Z" fill="%230284c7"/><text x="100" y="85" font-family="sans-serif" font-weight="bold" font-size="28" fill="%230f172a" text-anchor="middle">DO</text></svg>';
    const estherPhoto = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%230f172a"/><circle cx="100" cy="80" r="45" fill="%232dd4bf"/><circle cx="100" cy="75" r="35" fill="%23f8fafc"/><path d="M40 185 c0 -35 25 -60 60 -60 c35 0 60 25 60 60 Z" fill="%230d9488"/><text x="100" y="85" font-family="sans-serif" font-weight="bold" font-size="28" fill="%230f172a" text-anchor="middle">EC</text></svg>';

    this.db.run(`
      INSERT INTO customers (id, name, id_number, phone, email, address, photo_url, notes, created_at, updated_at) VALUES
      ('cust-1', 'John Mwangi Kariuki', '29481923', '+254 721 884 921', 'mwangijohn@gmail.com', 'Kahawa West, Nairobi', '${johnPhoto}', 'Regular client, very reliable on repayment terms.', '2026-08-10', '2026-09-28'),
      ('cust-2', 'Grace Wanjiku Njeri', '33104928', '+254 712 409 332', 'grace.njeri@yahoo.com', 'Kasarani Clay City, Nairobi', '${gracePhoto}', 'Brought Ramtons fridge for cooling repair and short-term pawn collateral.', '2026-08-20', '2026-09-25'),
      ('cust-3', 'David Ochieng Otieno', '26491024', '+254 728 991 445', 'ochieng.david@outlook.com', 'Ruaraka near Babadogo, Nairobi', '${davidPhoto}', 'Provided Sony sound system as pawn collateral.', '2026-09-01', '2026-09-20'),
      ('cust-4', 'Esther Muthoni Chege', '31882049', '+254 790 123 456', 'esthermuthoni@gmail.com', 'Thika Road, Roysambu', '${estherPhoto}', 'Chips fryer and 13kg gas cylinder evaluation.', '2026-09-15', '2026-09-29');
    `);

    // Appliances
    // Reminder: Due date is strictly 2 weeks (14 days) from date recorded
    const now = new Date();
    const past10Days = new Date(now.getTime() - 10 * 86400000).toISOString().split('T')[0];
    const due10Days = calculateDueDate(past10Days);

    const past5Days = new Date(now.getTime() - 5 * 86400000).toISOString().split('T')[0];
    const due5Days = calculateDueDate(past5Days);

    const past16Days = new Date(now.getTime() - 16 * 86400000).toISOString().split('T')[0];
    const duePast16 = calculateDueDate(past16Days); // overdue!

    const todayStr = now.toISOString().split('T')[0];
    const dueToday = calculateDueDate(todayStr);

    this.db.run(`
      INSERT INTO appliances (id, appliance_number, customer_id, category, custom_category, brand, model, serial_number, condition, market_value, amount_received, funder, date_received, due_date, status, technician_name, interest_charges, notes, created_at, updated_at) VALUES
      ('app-1', 'APP-2026-00001', 'cust-1', 'TV', NULL, 'Samsung', '55" Crystal UHD 4K (AU7000)', 'SN-SM55-89472', 'Clean condition, original remote included, slight bezel scratch', 58000, 18000, 'Trevor', '${past10Days}', '${due10Days}', 'Active Collateral / Pawn', 'Trevor', 1800, 'Appliance held in secure rack A-04.', '${past10Days} 11:00:00', '${past10Days} 11:00:00'),
      ('app-2', 'APP-2026-00002', 'cust-2', 'Fridge/freezer', NULL, 'Ramtons', 'Double Door 213L Silver', 'RF-RAM-33921', 'Good working condition, relay replaced by Peter, cooling tested', 42000, 14000, 'Peter', '${past5Days}', '${due5Days}', 'In Repair', 'Peter', 1400, 'Compressor starter relay replaced. Cooling test underway.', '${past5Days} 14:00:00', '${past5Days} 14:00:00'),
      ('app-3', 'APP-2026-00003', 'cust-3', 'Woofer/sound system', NULL, 'Sony', '5.1 Channel Home Theater 1000W', 'SN-SNY-HT984', 'Complete with all 5 speakers and subwoofer, remote control present', 35000, 12000, 'Trevor', '${past16Days}', '${duePast16}', 'Active Collateral / Pawn', 'Trevor', 1200, 'Due date exceeded 2 days ago. Sent WhatsApp reminder.', '${past16Days} 09:30:00', '${past16Days} 09:30:00'),
      ('app-4', 'APP-2026-00004', 'cust-4', 'Chips fryer', NULL, 'Royal Swiss', 'Commercial Double Tank 6L+6L Stainless', 'RF-RSW-6602', 'Stainless steel, power cables intact, heating elements functional', 24000, 8500, 'Peter', '${todayStr}', '${dueToday}', 'Ready for Collection', 'Peter', 850, 'Cleaned and tested. Customer notified for pickup.', '${todayStr} 10:00:00', '${todayStr} 10:00:00');
    `);

    // Appliance Photos (sample data URLs)
    const tvPhoto = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%231e293b"/><rect x="40" y="30" width="320" height="200" rx="8" fill="%230f172a" stroke="%2338bdf8" stroke-width="4"/><polygon points="170,100 250,130 170,160" fill="%2338bdf8"/><rect x="180" y="240" width="40" height="30" fill="%23475569"/><rect x="140" y="270" width="120" height="10" rx="4" fill="%2364748b"/><text x="200" y="215" fill="%2394a3b8" font-size="14" font-family="sans-serif" text-anchor="middle">SAMSUNG 55-INCH UHD 4K</text></svg>';
    const fridgePhoto = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%231e293b"/><rect x="120" y="20" width="160" height="260" rx="8" fill="%23334155" stroke="%2394a3b8" stroke-width="3"/><line x1="120" y1="110" x2="280" y2="110" stroke="%2364748b" stroke-width="2"/><rect x="135" y="55" width="10" height="40" rx="3" fill="%23cbd5e1"/><rect x="135" y="135" width="10" height="70" rx="3" fill="%23cbd5e1"/><text x="200" y="240" fill="%23cbd5e1" font-size="12" font-family="sans-serif" text-anchor="middle">RAMTONS 213L SILVER</text></svg>';

    this.db.run(`
      INSERT INTO appliance_photos (id, appliance_id, photo_url, caption, uploaded_at) VALUES
      ('pht-1', 'app-1', '${tvPhoto}', 'Front view with screen turned on, crystal clear display', '${past10Days} 11:05:00'),
      ('pht-2', 'app-2', '${fridgePhoto}', 'Front view showing intact handles and seal gaskets', '${past5Days} 14:10:00');
    `);

    // Invoices
    this.db.run(`
      INSERT INTO invoices (id, invoice_number, appliance_id, customer_id, issue_date, due_date, subtotal, tax, total_amount, status, notes, created_at) VALUES
      ('inv-1', 'INV-2026-00001', 'app-1', 'cust-1', '${past10Days}', '${due10Days}', 19800, 0, 19800, 'Partially Paid', 'Collateral principal KES 18,000 + handling fee KES 1,800', '${past10Days} 11:10:00'),
      ('inv-2', 'INV-2026-00002', 'app-2', 'cust-2', '${past5Days}', '${due5Days}', 15400, 0, 15400, 'Unpaid', 'Pawn advance KES 14,000 + repair service & relay KES 1,400', '${past5Days} 14:20:00');
    `);

    this.db.run(`
      INSERT INTO invoice_items (id, invoice_id, part_id, description, quantity, unit_price, total_price) VALUES
      ('itm-1', 'inv-1', NULL, 'Pawn Advance (Samsung 55")', 1, 18000, 18000),
      ('itm-2', 'inv-1', NULL, 'Collateral Safekeeping & Processing Fee', 1, 1800, 1800),
      ('itm-3', 'inv-2', 'prt-4', 'Universal Compressor Starter Relay', 1, 1400, 1400),
      ('itm-4', 'inv-2', NULL, 'Cash Advance Disbursed by Peter', 1, 14000, 14000);
    `);

    // Payments
    this.db.run(`
      INSERT INTO payments (id, receipt_number, appliance_id, customer_id, amount, payment_method, mpesa_code, mpesa_phone, mpesa_sender, received_by, notes, payment_date, created_at) VALUES
      ('pay-1', 'RCT-2026-00001', 'app-1', 'cust-1', 6000, 'M-Pesa', 'QHK482910M', '+254 721 884 921', 'JOHN MWANGI', 'Trevor', 'Partial repayment for Samsung 55 TV', '${past5Days}', '${past5Days} 15:45:00'),
      ('pay-2', 'RCT-2026-00002', 'app-1', 'cust-1', 4000, 'Cash', NULL, NULL, NULL, 'Trevor', 'Second installment paid at shop counter', '${past2Days(now)}', '${past2Days(now)} 16:30:00'),
      ('pay-3', 'RCT-2026-00003', 'app-4', 'cust-4', 9350, 'M-Pesa', 'QHN910384B', '+254 790 123 456', 'ESTHER MUTHONI', 'Peter', 'Full redemption payment for chips fryer advance + charges', '${todayStr}', '${todayStr} 11:20:00');
    `);

    // Stock Movements (inserted after appliances so app-2 foreign key is satisfied)
    this.db.run(`
      INSERT INTO stock_movements (id, part_id, movement_type, quantity, reason, appliance_id, performed_by, created_at) VALUES
      ('mov-1', 'prt-1', 'IN', 25, 'Initial bulk delivery from Nairobi Electronics Hub', NULL, 'Trevor', '2026-02-01 10:00:00'),
      ('mov-2', 'prt-4', 'OUT', 1, 'Installed on Ramtons Fridge repair', 'app-2', 'Peter', '2026-09-25 14:30:00');
    `);

    // Expenses
    this.db.run(`
      INSERT INTO expenses (id, category, amount, paid_by, payment_method, reference_code, expense_date, notes, created_at) VALUES
      ('exp-1', 'Rent', 35000, 'Trevor', 'Bank', 'BNK-TX-99018', '2026-09-01', 'Shop space monthly rent for September', '2026-09-01 09:00:00'),
      ('exp-2', 'Electricity/Tokens', 4500, 'Peter', 'M-Pesa', 'QHL839102X', '2026-09-12', 'KPLC prepaid power tokens for shop & workshop testing', '2026-09-12 10:15:00'),
      ('exp-3', 'Transport', 1800, 'Shop Petty Cash', 'Cash', 'VOUCHER-08', '2026-09-20', 'Motorbike delivery of spares from Industrial Area', '2026-09-20 14:00:00');
    `);

    // Audit Log
    this.db.run(`
      INSERT INTO audit_logs (id, user_name, action, entity_type, entity_id, details, created_at) VALUES
      ('aud-1', 'Trevor', 'CREATE_SYSTEM', 'SYSTEM', 'SYS-001', 'PEKASA Relational SQLite Database initialized with seed data', '${past10Days} 08:00:00'),
      ('aud-2', 'Trevor', 'RECORD_DISBURSEMENT', 'APPLIANCE', 'app-1', 'Disbursed KES 18,000 for Samsung 55 TV to John Mwangi', '${past10Days} 11:00:00'),
      ('aud-3', 'Peter', 'RECORD_DISBURSEMENT', 'APPLIANCE', 'app-2', 'Disbursed KES 14,000 for Ramtons Fridge to Grace Wanjiku', '${past5Days} 14:00:00');
    `);
  }

  // --- IndexedDB & LocalStorage Persistence Layer ---

  private async openIndexedDB(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB not supported in current environment'));
    }
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('PEKASA_STORAGE', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('sqlite_blobs')) {
          db.createObjectStore('sqlite_blobs');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async loadSavedDatabaseBytes(): Promise<Uint8Array | null> {
    try {
      const idb = await this.openIndexedDB();
      const tx = idb.transaction('sqlite_blobs', 'readonly');
      const store = tx.objectStore('sqlite_blobs');
      const req = store.get(DB_STORE_NAME);

      return new Promise((resolve) => {
        req.onsuccess = () => {
          if (req.result instanceof Uint8Array) {
            resolve(req.result);
          } else if (req.result instanceof ArrayBuffer) {
            resolve(new Uint8Array(req.result));
          } else {
            // Check localStorage fallback
            const localRaw = localStorage.getItem(DB_LOCAL_FALLBACK_KEY);
            if (localRaw) {
              try {
                const bin = Uint8Array.from(atob(localRaw), (c) => c.charCodeAt(0));
                resolve(bin);
                return;
              } catch {
                resolve(null);
                return;
              }
            }
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  public async persist(): Promise<void> {
    if (!this.db) return;
    try {
      const binaryData = this.db.export();
      const idb = await this.openIndexedDB();
      const tx = idb.transaction('sqlite_blobs', 'readwrite');
      const store = tx.objectStore('sqlite_blobs');
      store.put(binaryData, DB_STORE_NAME);

      // Also keep lightweight fallback
      try {
        if (binaryData.length < 3 * 1024 * 1024) {
          let binaryStr = '';
          const len = binaryData.byteLength;
          for (let i = 0; i < len; i++) {
            binaryStr += String.fromCharCode(binaryData[i]);
          }
          localStorage.setItem(DB_LOCAL_FALLBACK_KEY, btoa(binaryStr));
        }
      } catch {
        // LocalStorage quota might be reached, indexedDB is primary
      }
    } catch (e) {
      console.warn('Error saving SQLite database to IndexedDB:', e);
    }
  }

  // --- Sequences & Auto Numbering ---

  public getNextSequence(prefix: 'APP' | 'INV' | 'RCT'): string {
    if (!this.db) return formatSequenceCode(prefix, 1);

    const year = 2026;
    const stmt = this.db.prepare('SELECT last_sequence FROM sequence_counters WHERE prefix = :prefix');
    stmt.bind({ ':prefix': prefix });

    let nextNum = 1;
    if (stmt.step()) {
      const row = stmt.getAsObject();
      nextNum = (Number(row.last_sequence) || 0) + 1;
      this.db.run('UPDATE sequence_counters SET last_sequence = :next WHERE prefix = :prefix', {
        ':next': nextNum,
        ':prefix': prefix
      });
    } else {
      this.db.run('INSERT INTO sequence_counters (prefix, current_year, last_sequence) VALUES (:prefix, :year, 1)', {
        ':prefix': prefix,
        ':year': year
      });
      nextNum = 1;
    }
    stmt.free();
    this.persist();
    return formatSequenceCode(prefix, nextNum, year);
  }

  // --- Query Helpers ---

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
      console.error('SQLite query error on SQL:', sql, err);
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
      console.error('SQLite run error on SQL:', sql, err);
      throw err;
    }
  }

  // --- High Level Domain CRUD ---

  public getUsers(): User[] {
    return this.query<User>('SELECT * FROM users ORDER BY full_name ASC');
  }

  public getUserRoles(): UserRole[] {
    const rows = this.query<{ id: string; name: string; description: string; permissions_json: string }>(
      'SELECT * FROM user_roles ORDER BY name ASC'
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      permissions: JSON.parse(r.permissions_json)
    }));
  }

  public getCustomers(): Customer[] {
    return this.query<Customer>('SELECT * FROM customers ORDER BY created_at DESC');
  }

  public getCustomerById(id: string): Customer | null {
    const list = this.query<Customer>('SELECT * FROM customers WHERE id = :id', { ':id': id });
    return list.length > 0 ? list[0] : null;
  }

  public getAppliances(): Appliance[] {
    return this.query<Appliance>('SELECT * FROM appliances ORDER BY created_at DESC');
  }

  public getApplianceById(id: string): Appliance | null {
    const list = this.query<Appliance>('SELECT * FROM appliances WHERE id = :id', { ':id': id });
    return list.length > 0 ? list[0] : null;
  }

  public getAppliancePhotos(applianceId: string): AppliancePhoto[] {
    return this.query<AppliancePhoto>(
      'SELECT * FROM appliance_photos WHERE appliance_id = :aid ORDER BY uploaded_at ASC',
      { ':aid': applianceId }
    );
  }

  public getPayments(): Payment[] {
    return this.query<Payment>('SELECT * FROM payments ORDER BY created_at DESC');
  }

  public getPaymentsForAppliance(applianceId: string): Payment[] {
    return this.query<Payment>(
      'SELECT * FROM payments WHERE appliance_id = :aid ORDER BY payment_date DESC, created_at DESC',
      { ':aid': applianceId }
    );
  }

  public getInvoices(): Invoice[] {
    const invoices = this.query<Invoice>('SELECT * FROM invoices ORDER BY created_at DESC');
    return invoices.map((inv) => {
      const items = this.query<InvoiceItem>('SELECT * FROM invoice_items WHERE invoice_id = :iid', { ':iid': inv.id });
      return { ...inv, items };
    });
  }

  public getParts(): Part[] {
    return this.query<Part>('SELECT * FROM parts ORDER BY part_name ASC');
  }

  public getStockMovements(): StockMovement[] {
    return this.query<StockMovement>('SELECT * FROM stock_movements ORDER BY created_at DESC');
  }

  public getSuppliers(): Supplier[] {
    return this.query<Supplier>('SELECT * FROM suppliers ORDER BY name ASC');
  }

  public getExpenses(): Expense[] {
    return this.query<Expense>('SELECT * FROM expenses ORDER BY expense_date DESC');
  }

  public getAuditLogs(): AuditLog[] {
    return this.query<AuditLog>('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100');
  }

  // --- Financial & Balance Calculations ---

  public calculateApplianceBalance(appliance: Appliance): {
    totalDue: number;
    totalPaid: number;
    balanceRemaining: number;
  } {
    const payments = this.getPaymentsForAppliance(appliance.id);
    const totalPaid = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const totalDue = Number(appliance.amount_received) + (Number(appliance.interest_charges) || 0);
    const balanceRemaining = Math.max(0, totalDue - totalPaid);
    return { totalDue, totalPaid, balanceRemaining };
  }

  // --- Stock & Parts Operations ---

  public issuePartToAppliance(partId: string, applianceId: string, quantity: number, technician: string): void {
    const parts = this.query<Part>('SELECT * FROM parts WHERE id = :id', { ':id': partId });
    if (!parts.length) throw new Error('Part not found');
    const part = parts[0];

    if (part.quantity < quantity) {
      throw new Error(`Insufficient stock. Current inventory is ${part.quantity}`);
    }

    const newQty = part.quantity - quantity;
    this.run('UPDATE parts SET quantity = :q, updated_at = :u WHERE id = :id', {
      ':q': newQty,
      ':u': new Date().toISOString(),
      ':id': partId
    });

    const movId = 'mov-' + Date.now();
    this.run(
      'INSERT INTO stock_movements (id, part_id, movement_type, quantity, reason, appliance_id, performed_by, created_at) VALUES (:id, :pid, :mt, :qty, :rs, :aid, :pb, :ca)',
      {
        ':id': movId,
        ':pid': partId,
        ':mt': 'OUT',
        ':qty': quantity,
        ':rs': `Issued to appliance repair`,
        ':aid': applianceId,
        ':pb': technician,
        ':ca': new Date().toISOString().replace('T', ' ').substring(0, 19)
      }
    );

    this.logAudit(technician, 'ISSUE_PART', 'PART', partId, `Issued ${quantity}x ${part.part_name} to appliance ${applianceId}`);
  }

  public recordStockMovement(
    partId: string,
    type: 'IN' | 'OUT' | 'ADJUST',
    quantity: number,
    reason: string,
    user: string
  ): void {
    const parts = this.query<Part>('SELECT * FROM parts WHERE id = :id', { ':id': partId });
    if (!parts.length) throw new Error('Part not found');
    const part = parts[0];

    let newQty = part.quantity;
    if (type === 'IN') newQty += quantity;
    else if (type === 'OUT') newQty = Math.max(0, newQty - quantity);
    else if (type === 'ADJUST') newQty = quantity;

    this.run('UPDATE parts SET quantity = :q, updated_at = :u WHERE id = :id', {
      ':q': newQty,
      ':u': new Date().toISOString(),
      ':id': partId
    });

    const movId = 'mov-' + Date.now();
    this.run(
      'INSERT INTO stock_movements (id, part_id, movement_type, quantity, reason, appliance_id, performed_by, created_at) VALUES (:id, :pid, :mt, :qty, :rs, NULL, :pb, :ca)',
      {
        ':id': movId,
        ':pid': partId,
        ':mt': type,
        ':qty': quantity,
        ':rs': reason,
        ':pb': user,
        ':ca': new Date().toISOString().replace('T', ' ').substring(0, 19)
      }
    );

    this.logAudit(user, `STOCK_${type}`, 'PART', partId, `${type} ${quantity} units for ${part.part_name}: ${reason}`);
  }

  public updateCustomerPhoto(customerId: string, photoUrl: string): void {
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    this.run('UPDATE customers SET photo_url = :photo, updated_at = :u WHERE id = :id', {
      ':photo': photoUrl,
      ':u': nowStr,
      ':id': customerId
    });
    this.logAudit('Admin', 'UPDATE_CUSTOMER_PHOTO', 'CUSTOMER', customerId, 'Uploaded/updated customer identification photo');
  }

  public updateCustomer(id: string, data: { name?: string; id_number?: string; phone?: string; email?: string; address?: string; notes?: string; photo_url?: string }): void {
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const existing = this.getCustomerById(id);
    if (!existing) throw new Error('Customer not found');

    this.run(
      `UPDATE customers SET 
        name = :name, 
        id_number = :id_number, 
        phone = :phone, 
        email = :email, 
        address = :address, 
        notes = :notes, 
        photo_url = :photo_url, 
        updated_at = :updated_at 
       WHERE id = :id`,
      {
        ':id': id,
        ':name': data.name !== undefined ? data.name : existing.name,
        ':id_number': data.id_number !== undefined ? data.id_number : existing.id_number,
        ':phone': data.phone !== undefined ? data.phone : existing.phone,
        ':email': data.email !== undefined ? data.email : existing.email,
        ':address': data.address !== undefined ? data.address : existing.address,
        ':notes': data.notes !== undefined ? data.notes : existing.notes,
        ':photo_url': data.photo_url !== undefined ? data.photo_url : (existing.photo_url || null),
        ':updated_at': nowStr
      }
    );
    this.logAudit('Admin', 'UPDATE_CUSTOMER', 'CUSTOMER', id, `Updated customer record for ${data.name || existing.name}`);
  }

  // --- Audit Logger ---

  public logAudit(userName: string, action: string, entityType: string, entityId: string, details: string): void {
    const id = 'aud-' + Date.now();
    const ca = new Date().toISOString().replace('T', ' ').substring(0, 19);
    try {
      this.db?.run(
        'INSERT INTO audit_logs (id, user_name, action, entity_type, entity_id, details, created_at) VALUES (:id, :un, :ac, :et, :ei, :dt, :ca)',
        {
          ':id': id,
          ':un': userName,
          ':ac': action,
          ':et': entityType,
          ':ei': entityId,
          ':dt': details,
          ':ca': ca
        }
      );
    } catch {
      // ignore log error
    }
  }

  // --- Backup & Restore Operations ---

  public exportDatabaseBinary(): Uint8Array {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.export();
  }

  public exportDatabaseJson(): string {
    const data = {
      app: 'PEKASA',
      version: '1.0',
      exported_at: new Date().toISOString(),
      users: this.getUsers(),
      roles: this.getUserRoles(),
      customers: this.getCustomers(),
      appliances: this.getAppliances(),
      photos: this.query<AppliancePhoto>('SELECT * FROM appliance_photos'),
      payments: this.getPayments(),
      invoices: this.getInvoices(),
      parts: this.getParts(),
      stock_movements: this.getStockMovements(),
      suppliers: this.getSuppliers(),
      expenses: this.getExpenses(),
      audit_logs: this.getAuditLogs()
    };
    return JSON.stringify(data, null, 2);
  }

  public async restoreFromSqliteBinary(bytes: Uint8Array): Promise<void> {
    const SQL = await initSqlAsm();
    const newDb = new SQL.Database(bytes);
    newDb.run('PRAGMA foreign_keys = ON;');
    this.db = newDb;
    await this.persist();
    this.notify();
  }

  public async restoreFromJson(jsonString: string): Promise<void> {
    const data = JSON.parse(jsonString);
    if (!this.db) return;

    // Reset tables
    this.db.run('PRAGMA foreign_keys = OFF;');
    const tables = [
      'user_roles', 'users', 'customers', 'appliances', 'appliance_photos',
      'payments', 'invoices', 'invoice_items', 'suppliers', 'parts',
      'stock_movements', 'expenses', 'audit_logs', 'sequence_counters'
    ];
    for (const t of tables) {
      this.db.run(`DROP TABLE IF EXISTS ${t};`);
    }

    await this.createInitialSchemaAndSeed();

    // If json has specific records, insert them
    if (Array.isArray(data.customers)) {
      this.db.run('DELETE FROM customers;');
      for (const c of data.customers) {
        this.run(
          'INSERT INTO customers (id, name, id_number, phone, email, address, photo_url, notes, created_at, updated_at) VALUES (:id, :name, :id_number, :phone, :email, :address, :purl, :notes, :created_at, :updated_at)',
          {
            ':id': c.id,
            ':name': c.name,
            ':id_number': c.id_number,
            ':phone': c.phone,
            ':email': c.email || '',
            ':address': c.address || '',
            ':purl': c.photo_url || null,
            ':notes': c.notes || '',
            ':created_at': c.created_at,
            ':updated_at': c.updated_at
          }
        );
      }
    }

    if (Array.isArray(data.appliances)) {
      this.db.run('DELETE FROM appliances;');
      for (const a of data.appliances) {
        this.run(
          `INSERT INTO appliances (id, appliance_number, customer_id, category, custom_category, brand, model, serial_number, condition, market_value, amount_received, funder, date_received, due_date, status, technician_name, interest_charges, notes, created_at, updated_at)
           VALUES (:id, :appliance_number, :customer_id, :category, :custom_category, :brand, :model, :serial_number, :condition, :market_value, :amount_received, :funder, :date_received, :due_date, :status, :technician_name, :interest_charges, :notes, :created_at, :updated_at)`,
          {
            ':id': a.id,
            ':appliance_number': a.appliance_number,
            ':customer_id': a.customer_id,
            ':category': a.category,
            ':custom_category': a.custom_category || null,
            ':brand': a.brand,
            ':model': a.model,
            ':serial_number': a.serial_number || '',
            ':condition': a.condition,
            ':market_value': a.market_value,
            ':amount_received': a.amount_received,
            ':funder': a.funder,
            ':date_received': a.date_received,
            ':due_date': a.due_date,
            ':status': a.status,
            ':technician_name': a.technician_name || '',
            ':interest_charges': a.interest_charges || 0,
            ':notes': a.notes || '',
            ':created_at': a.created_at,
            ':updated_at': a.updated_at
          }
        );
      }
    }

    this.db.run('PRAGMA foreign_keys = ON;');
    await this.persist();
    this.notify();
  }

  public async resetToDefaults(): Promise<void> {
    if (!this.db) return;
    this.db.run('PRAGMA foreign_keys = OFF;');
    const tables = [
      'user_roles', 'users', 'customers', 'appliances', 'appliance_photos',
      'payments', 'invoices', 'invoice_items', 'suppliers', 'parts',
      'stock_movements', 'expenses', 'audit_logs', 'sequence_counters'
    ];
    for (const t of tables) {
      this.db.run(`DROP TABLE IF EXISTS ${t};`);
    }
    await this.createInitialSchemaAndSeed();
    await this.persist();
    this.notify();
  }
}

function past2Days(d: Date): string {
  const p = new Date(d.getTime() - 2 * 86400000);
  return p.toISOString().split('T')[0];
}

export const sqliteService = new SQLiteService();
