/**
 * Sequential numbering & Financial helpers for PEKASA STORES Rehani Management System
 * Generates:
 * - LN-2026-004521 (Rehani Loan)
 * - COL-2026-000842 (Collateral Item)
 * - CUS-2026-000125 (Permanent Customer)
 * - RCT-2026-000001 (Payment Receipt)
 * - TXN-2026-000001 (Immutable Ledger Transaction)
 * - RNW-2026-000001 (Loan Renewal / Extension)
 * - SAL-2026-000001 (Collateral Disposition / Sale)
 * - EXP-2026-000001 (Operating Expense)
 */

export type SequencePrefix = 'LN' | 'COL' | 'CUS' | 'RCT' | 'TXN' | 'RNW' | 'SAL' | 'EXP' | 'APP' | 'INV';

export function formatSequenceCode(prefix: SequencePrefix, sequenceNumber: number, year: number = 2026): string {
  const padded = String(sequenceNumber).padStart(6, '0');
  return `${prefix}-${year}-${padded}`;
}

export function parseSequenceNumber(code: string): number {
  const parts = code.split('-');
  if (parts.length === 3) {
    const num = parseInt(parts[2], 10);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

/**
 * Calculates due date based on configurable loan period days (default 30 days)
 */
export function calculateLoanDueDate(dateString: string, termDays: number = 30): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) {
      const now = new Date();
      now.setDate(now.getDate() + termDays);
      return now.toISOString().split('T')[0];
    }
    d.setDate(d.getDate() + termDays);
    return d.toISOString().split('T')[0];
  } catch {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + termDays);
    return fallback.toISOString().split('T')[0];
  }
}

/**
 * Backward-compatible due date helper (14 days)
 */
export function calculateDueDate(dateString: string): string {
  return calculateLoanDueDate(dateString, 14);
}

/**
 * Calculate maturity date after grace period
 */
export function calculateMaturityDate(dueDateString: string, graceDays: number = 7): string {
  try {
    const d = new Date(dueDateString);
    if (isNaN(d.getTime())) {
      const now = new Date();
      now.setDate(now.getDate() + graceDays);
      return now.toISOString().split('T')[0];
    }
    d.setDate(d.getDate() + graceDays);
    return d.toISOString().split('T')[0];
  } catch {
    return dueDateString;
  }
}

/**
 * Format currency in Kenyan Shillings (KES)
 */
export function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
}
