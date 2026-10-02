/**
 * Customer WhatsApp & SMS notification generator for PEKASA STORES Rehani Management System
 * Official Helpline Numbers: 0727108749 / 0180366344
 */

import { formatKES } from './numbering';
import { STORE_NAME, STORE_TEL } from '../types';

export function cleanKenyanPhone(phone: string): string {
  let clean = phone.replace(/[^0-9+]/g, '');
  if (clean.startsWith('0')) {
    clean = '254' + clean.substring(1);
  } else if (clean.startsWith('+')) {
    clean = clean.substring(1);
  }
  return clean;
}

export function generateWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = cleanKenyanPhone(phone);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

export function createLoanDisbursalMessage(data: {
  customerName: string;
  loanNumber: string;
  collateralNumber: string;
  collateralItem: string;
  principalAmount: number;
  funder: string;
  dueDate: string;
  maturityDate: string;
  totalDue: number;
}): string {
  return `Habari ${data.customerName}, this is ${STORE_NAME}.
We confirm issuance of your Rehani Loan (Pawn Ticket: ${data.loanNumber}).
Pledged Collateral: ${data.collateralItem} (Ref: ${data.collateralNumber}).
Principal Disbursed: ${formatKES(data.principalAmount)} (Disbursed by Director ${data.funder}).
Due Date: ${data.dueDate} (Grace Period expires: ${data.maturityDate}).
Total Amount to Redeem: ${formatKES(data.totalDue)}.
Kindly retain your Pawn Ticket. For inquiries, contact ${STORE_TEL}.
Thank you for choosing ${STORE_NAME}.`;
}

export function createPaymentReceiptMessage(data: {
  customerName: string;
  receiptNumber: string;
  amountPaid: number;
  paymentMethod: string;
  mpesaRef?: string;
  remainingBalance: number;
  loanNumber: string;
}): string {
  const mpesaNote = data.mpesaRef ? ` [M-Pesa: ${data.mpesaRef}]` : '';
  return `Habari ${data.customerName}, ${STORE_NAME} confirms receipt of ${formatKES(data.amountPaid)} via ${data.paymentMethod}${mpesaNote}.
Receipt No: ${data.receiptNumber}
Rehani Loan Ref: ${data.loanNumber}
Remaining Outstanding Balance: ${formatKES(data.remainingBalance)}.
Official Tel: ${STORE_TEL}
Thank you for doing business with ${STORE_NAME}.`;
}

export function createDueSoonReminderMessage(data: {
  customerName: string;
  loanNumber: string;
  collateralItem: string;
  dueDate: string;
  balanceDue: number;
}): string {
  return `Habari ${data.customerName}, friendly reminder from ${STORE_NAME} regarding your Rehani Loan (${data.loanNumber}) for ${data.collateralItem}.
Contractual due date is approaching: ${data.dueDate}.
Current amount due to redeem: ${formatKES(data.balanceDue)}.
You may visit the shop to redeem your item or renew your loan before the deadline.
Helpline: ${STORE_TEL}.`;
}

export function createOverdueNoticeMessage(data: {
  customerName: string;
  loanNumber: string;
  collateralItem: string;
  maturityDate: string;
  balanceDue: number;
}): string {
  return `URGENT NOTICE from ${STORE_NAME}:
Habari ${data.customerName}, your Rehani Loan (${data.loanNumber}) for ${data.collateralItem} is now OVERDUE.
Outstanding Balance: ${formatKES(data.balanceDue)}.
Your grace period will expire on ${data.maturityDate}.
To prevent legal forfeiture and public disposition of your pledged collateral, kindly visit Trevor or Peter at PEKASA immediately or call ${STORE_TEL}.`;
}

export function createRenewalConfirmationMessage(data: {
  customerName: string;
  loanNumber: string;
  renewalNumber: string;
  feePaid: number;
  newDueDate: string;
  outstandingBalance: number;
}): string {
  return `Habari ${data.customerName}, ${STORE_NAME} confirms your Rehani Loan renewal (${data.renewalNumber}).
Loan Ref: ${data.loanNumber}.
Renewal fee paid: ${formatKES(data.feePaid)}.
Your new extended maturity date is: ${data.newDueDate}.
Current balance: ${formatKES(data.outstandingBalance)}.
Official Helpline: ${STORE_TEL}.`;
}

// Backward compatibility alias
export const createPawnDisbursalMessage = (d: any) => createLoanDisbursalMessage({
  customerName: d.customerName,
  loanNumber: d.applianceCode,
  collateralNumber: d.applianceCode,
  collateralItem: d.applianceItem,
  principalAmount: d.amountReceived,
  funder: d.funder,
  dueDate: d.dueDate,
  maturityDate: d.dueDate,
  totalDue: d.amountReceived
});

export function createDueReminderMessage(data: {
  customerName: string;
  applianceCode?: string;
  applianceDescription?: string;
  amountDue?: number;
  dueDate?: string;
  funderName?: string;
  loanNumber?: string;
  collateralItem?: string;
  balanceDue?: number;
}): string {
  const code = data.loanNumber || data.applianceCode || 'LOAN';
  const item = data.collateralItem || data.applianceDescription || 'Pledged Item';
  const due = data.dueDate || '';
  const bal = data.balanceDue ?? data.amountDue ?? 0;
  return `Habari ${data.customerName}, friendly reminder from ${STORE_NAME}.
Your Rehani account for ${item} (Ref: ${code}) is due on ${due}.
Amount due: ${formatKES(bal)}.
Kindly visit PEKASA STORES or contact ${STORE_TEL}.`;
}

export function createRepairReadyMessage(data: {
  customerName: string;
  applianceCode?: string;
  applianceDescription?: string;
  balanceDue?: number;
}): string {
  const code = data.applianceCode || '';
  const item = data.applianceDescription || 'Appliance/Collateral';
  const bal = data.balanceDue ?? 0;
  return `Habari ${data.customerName}, this is ${STORE_NAME}.
Your item ${item} (${code}) is ready.
Balance remaining: ${formatKES(bal)}.
Official Tel: ${STORE_TEL}. Thank you!`;
}
