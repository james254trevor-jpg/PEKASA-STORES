/**
 * Customers on Supabase (replaces sqliteService.getCustomers / getCustomerById / updateCustomer /
 * updateCustomerPhoto and the customer INSERT inside CustomersView).
 * Which customers a person can see or change is decided by the database (their branch and role).
 */
import type { Customer } from '../../types.ts';
import { formatSequenceCode } from '../../utils/numbering.ts';
import { RemoteClient, RemoteError } from './client.ts';

type LoanStat = { customer_id: string; principal_amount: number; amount_paid: number; balance_remaining: number; status: string };

export type NewCustomer = Pick<Customer, 'name' | 'id_number' | 'phone'> &
  Partial<Pick<Customer, 'alt_phone' | 'address' | 'county' | 'photo_url' | 'id_photo_url' | 'notes' | 'status'>>;

const now = () => new Date().toISOString().replace('T', ' ').substring(0, 19);

export class CustomersRepo {
  private db: RemoteClient;

  constructor(db: RemoteClient) {
    this.db = db;
  }

  /** Same shape as the old getCustomers(): each customer with their loan totals. */
  async list(): Promise<Customer[]> {
    const [rows, loans] = await Promise.all([
      this.db.select<Customer>('customers', 'select=*&order=created_at.desc'),
      this.db.select<LoanStat>('rehani_loans', 'select=customer_id,principal_amount,amount_paid,balance_remaining,status')
    ]);
    const byCustomer = new Map<string, LoanStat[]>();
    for (const l of loans) byCustomer.set(l.customer_id, [...(byCustomer.get(l.customer_id) || []), l]);

    return rows.map((c) => {
      const ls = byCustomer.get(c.id) || [];
      const sum = (xs: LoanStat[], k: 'principal_amount' | 'amount_paid' | 'balance_remaining') =>
        xs.reduce((t, l) => t + (Number(l[k]) || 0), 0);
      return {
        ...c,
        previous_loans_count: ls.length,
        total_borrowed: sum(ls, 'principal_amount'),
        total_repaid: sum(ls, 'amount_paid'),
        current_balance: sum(
          ls.filter((l) => l.status !== 'REDEEMED' && l.status !== 'SOLD'),
          'balance_remaining'
        ),
        defaults_count: Number(c.defaults_count) || 0
      };
    });
  }

  async getById(id: string): Promise<Customer | null> {
    const rows = await this.db.select<Customer>('customers', `select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
    return rows[0] ?? null;
  }

  /** The number comes from the database, so two cashiers can never be given the same one. */
  async create(input: NewCustomer): Promise<Customer> {
    const seq = await this.db.rpc<number>('next_sequence', { p_prefix: 'CUS' });
    const stamp = now();
    const row = {
      id: `cus-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      customer_number: formatSequenceCode('CUS', seq, 2026),
      name: input.name.trim(),
      id_number: input.id_number.trim(),
      phone: input.phone.trim(),
      alt_phone: input.alt_phone || 'N/A',
      address: input.address ?? '',
      county: input.county ?? '',
      photo_url: input.photo_url ?? null,
      id_photo_url: input.id_photo_url ?? null,
      status: input.status ?? 'Good Standing',
      notes: input.notes ?? '',
      defaults_count: 0,
      created_at: stamp,
      updated_at: stamp
    };
    try {
      return await this.db.insert<Customer>('customers', row);
    } catch (e) {
      if (e instanceof RemoteError && (e.status === 409 || e.code === '23505')) {
        throw new RemoteError(409, 'A customer with this ID number already exists.', e.code);
      }
      if (e instanceof RemoteError && (e.status === 403 || e.code === '42501')) {
        throw new RemoteError(403, 'You are not allowed to register customers.', e.code);
      }
      throw e;
    }
  }

  /** Only the fields given are changed (mirrors the old COALESCE-style update). */
  async update(id: string, data: Partial<Customer>): Promise<void> {
    const allowed = ['name', 'id_number', 'phone', 'alt_phone', 'address', 'county', 'photo_url', 'status', 'notes'] as const;
    const patch: Record<string, unknown> = { updated_at: now() };
    for (const k of allowed) if (data[k] !== undefined && data[k] !== null && data[k] !== '') patch[k] = data[k];
    const rows = await this.db.update('customers', `id=eq.${encodeURIComponent(id)}`, patch);
    // The database silently hides rows from other branches: zero rows back means "not yours / not found".
    if (!rows.length) throw new RemoteError(404, 'Customer not found, or you do not have access to it.');
  }

  updatePhoto(id: string, photoUrl: string): Promise<void> {
    return this.update(id, { photo_url: photoUrl });
  }
}
