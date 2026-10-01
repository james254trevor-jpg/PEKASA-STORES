/**
 * Customer WhatsApp & SMS notification generator for PEKASA STORES
 * Features official phone numbers: 0727108749 / 0180366344
 */

import { formatKES } from './numbering';
import { STORE_NAME, STORE_TEL } from '../types';

export function cleanKenyanPhone(phone: string): string {
  // Normalize Kenyan phone numbers (+254, 07..., 01...)
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

export interface ReminderData {
  customerName: string;
  applianceCode: string;
  applianceDescription: string;
  amountDue: number;
  dueDate: string;
  funderName: string;
}

export function createPawnDisbursalMessage(data: {
  customerName: string;
  applianceCode: string;
  applianceItem: string;
  amountReceived: number;
  funder: string;
  dueDate: string;
}): string {
  return `Habari ${data.customerName}, this is ${STORE_NAME}.
We confirm receipt of your ${data.applianceItem} (Ref: ${data.applianceCode}).
Cash disbursed: ${formatKES(data.amountReceived)} (Disbursed by Director ${data.funder}).
Due Date (2-Week Cycle): ${data.dueDate}.
Kindly retain your transaction receipt.
Helpline: ${STORE_TEL}
Thank you for trusting ${STORE_NAME}.`;
}

export function createPaymentReceiptMessage(data: {
  customerName: string;
  receiptNumber: string;
  amountPaid: number;
  paymentMethod: string;
  mpesaRef?: string;
  remainingBalance: number;
  applianceCode: string;
}): string {
  const mpesaNote = data.mpesaRef ? ` [M-Pesa: ${data.mpesaRef}]` : '';
  return `Habari ${data.customerName}, ${STORE_NAME} confirms receipt of ${formatKES(data.amountPaid)} via ${data.paymentMethod}${mpesaNote}.
Receipt No: ${data.receiptNumber}
Appliance Ref: ${data.applianceCode}
Remaining Outstanding Balance: ${formatKES(data.remainingBalance)}.
Official Tel: ${STORE_TEL}
Thank you for choosing ${STORE_NAME}.`;
}

export function createDueReminderMessage(data: ReminderData): string {
  return `Habari ${data.customerName}, friendly reminder from ${STORE_NAME} regarding your item ${data.applianceDescription} (${data.applianceCode}).
The scheduled due date is ${data.dueDate}.
Current outstanding amount: ${formatKES(data.amountDue)}.
Please make arrangements with Trevor or Peter to renew or redeem your item before the due date.
Official Tel: ${STORE_TEL}`;
}

export function createRepairReadyMessage(data: {
  customerName: string;
  applianceCode: string;
  applianceItem: string;
  repairCost: number;
}): string {
  return `Habari ${data.customerName}, your ${data.applianceItem} (${data.applianceCode}) has been serviced and is ready for collection at ${STORE_NAME}.
Total amount payable: ${formatKES(data.repairCost)}.
Kindly come by with your National ID for collection.
Store Tel: ${STORE_TEL}`;
}
