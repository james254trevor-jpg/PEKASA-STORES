/**
 * Sequential numbering helper for PEKASA
 * Generates:
 * - APP-2026-00001 (Appliances)
 * - INV-2026-00001 (Invoices)
 * - RCT-2026-00001 (Receipts)
 */

export function formatSequenceCode(prefix: 'APP' | 'INV' | 'RCT', sequenceNumber: number, year: number = 2026): string {
  const padded = String(sequenceNumber).padStart(5, '0');
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
 * Calculates due date strictly 14 days (2 weeks) from date recorded
 */
export function calculateDueDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) {
      const now = new Date();
      now.setDate(now.getDate() + 14);
      return now.toISOString().split('T')[0];
    }
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  } catch {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 14);
    return fallback.toISOString().split('T')[0];
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
  }).format(amount);
}
