import { jsPDF } from 'jspdf';
import { Payment, Customer, Appliance, Invoice, STORE_NAME, STORE_MOTTO, STORE_TEL } from '../types';
import { formatKES } from './numbering';

/**
 * Generates an official professional PDF receipt for PEKASA STORES
 * Features the requested official telephone number: 0727108749 / 0180366344
 */
export function downloadReceiptPDF(payment: Payment, customer: Customer, appliance?: Appliance, remainingBalance?: number) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 175] // POS thermal format (80mm width) or A6-compact
  });

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(STORE_NAME, 40, 11, { align: 'center' });
  
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'italic');
  const splitMotto = doc.splitTextToSize(`"${STORE_MOTTO}"`, 70);
  doc.text(splitMotto, 40, 15.5, { align: 'center' });

  const mottoOffset = splitMotto.length > 1 ? (splitMotto.length - 1) * 3 : 0;
  const telY = 20 + mottoOffset;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`Tel: ${STORE_TEL}`, 40, telY, { align: 'center' });

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Directors: Trevor & Peter | Nairobi, Kenya', 40, telY + 4, { align: 'center' });

  // Divider
  const div1Y = telY + 7;
  doc.setLineWidth(0.3);
  doc.line(5, div1Y, 75, div1Y);

  // Receipt Meta
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('OFFICIAL PAYMENT RECEIPT', 40, div1Y + 5, { align: 'center' });
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Receipt No: ${payment.receipt_number}`, 6, div1Y + 11);
  doc.text(`Date: ${payment.payment_date}`, 6, div1Y + 16);
  doc.text(`Method: ${payment.payment_method}`, 6, div1Y + 21);
  if (payment.mpesa_code) {
    doc.text(`M-Pesa Ref: ${payment.mpesa_code}`, 6, div1Y + 26);
  }
  doc.text(`Received By: ${payment.received_by}`, 6, payment.mpesa_code ? div1Y + 31 : div1Y + 26);

  const startY = payment.mpesa_code ? div1Y + 35 : div1Y + 30;
  doc.line(5, startY, 75, startY);

  // Customer & Appliance Info
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENT DETAILS:', 6, startY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${customer.name || 'Walk-in Client'}`, 6, startY + 9.5);
  doc.text(`National ID: ${customer.id_number || 'N/A'}`, 6, startY + 14);
  doc.text(`Client Phone: ${customer.phone || 'N/A'}`, 6, startY + 18.5);
  if (customer.address) {
    doc.text(`Address: ${customer.address}`, 6, startY + 23);
  }
  
  const appStartY = customer.address ? startY + 27 : startY + 22.5;

  if (appliance) {
    doc.setFont('helvetica', 'bold');
    doc.text('COLLATERAL / APPLIANCE:', 6, appStartY + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(`Category: ${appliance.category}`, 6, appStartY + 8.5);
    doc.text(`Brand/Model: ${appliance.brand} ${appliance.model}`, 6, appStartY + 12.5);
    doc.text(`Tag Code: ${appliance.appliance_number}`, 6, appStartY + 16.5);
  }

  const nextY = appliance ? appStartY + 20 : appStartY + 3;
  doc.line(5, nextY, 75, nextY);

  // Amount Block
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text('AMOUNT PAID:', 6, nextY + 6.5);
  doc.text(formatKES(payment.amount), 74, nextY + 6.5, { align: 'right' });

  if (typeof remainingBalance === 'number') {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Outstanding Balance:', 6, nextY + 12.5);
    doc.text(formatKES(remainingBalance), 74, nextY + 12.5, { align: 'right' });
  }

  // Footer notes & verification with Shop Telephone
  const footerY = nextY + 19;
  doc.line(5, footerY, 75, footerY);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`Customer Inquiries: ${STORE_TEL}`, 40, footerY + 4.5, { align: 'center' });
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'italic');
  doc.text('* Keep this receipt safe as proof of transaction.', 40, footerY + 8.5, { align: 'center' });
  doc.text(`* ${STORE_NAME} Relational System Verified.`, 40, footerY + 12, { align: 'center' });
  doc.text(`Thank you for trusting ${STORE_NAME}!`, 40, footerY + 16, { align: 'center' });

  doc.save(`${payment.receipt_number}_PEKASA_STORES.pdf`);
}

/**
 * Generates an official professional PDF Invoice for PEKASA STORES
 */
export function downloadInvoicePDF(invoice: Invoice, customer: Customer, appliance?: Appliance) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Header Banner
  doc.setFillColor(6, 9, 14); // black / deep slate
  doc.rect(0, 0, 210, 38, 'F');

  doc.setTextColor(10, 186, 181); // Tiffany Blue
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(STORE_NAME, 14, 18);

  doc.setTextColor(241, 245, 249);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text(`"${STORE_MOTTO}"`, 14, 25);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Official Tel: ${STORE_TEL} | Nairobi, Kenya`, 14, 32);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('TAX INVOICE', 196, 20, { align: 'right' });
  doc.setFontSize(10);
  doc.text(`Ref: ${invoice.invoice_number}`, 196, 27, { align: 'right' });

  // Body
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);

  // Shop Details
  doc.setFont('helvetica', 'bold');
  doc.text('Issued By:', 14, 48);
  doc.setFont('helvetica', 'normal');
  doc.text(`${STORE_NAME} Management`, 14, 54);
  doc.text('Directors: Trevor & Peter', 14, 59);
  doc.text(`Helpline: ${STORE_TEL}`, 14, 64);
  doc.text('Nairobi, Kenya', 14, 69);

  // Customer Details
  doc.setFont('helvetica', 'bold');
  doc.text('Billed To:', 120, 48);
  doc.setFont('helvetica', 'normal');
  doc.text(customer.name, 120, 54);
  doc.text(`National ID: ${customer.id_number}`, 120, 59);
  doc.text(`Phone: ${customer.phone}`, 120, 64);
  doc.text(`Address: ${customer.address || 'N/A'}`, 120, 69);

  // Meta Table
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 75, 196, 75);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Invoice Date: ${invoice.issue_date}`, 14, 81);
  doc.text(`Due Date: ${invoice.due_date}`, 80, 81);
  doc.text(`Status: ${invoice.status}`, 150, 81);

  if (appliance) {
    doc.text(`Appliance Tag: ${appliance.appliance_number} (${appliance.category} - ${appliance.brand} ${appliance.model})`, 14, 88);
  }

  doc.line(14, 92, 196, 92);

  // Table Header
  const tableTop = 98;
  doc.setFillColor(241, 245, 249);
  doc.rect(14, tableTop, 182, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ITEM / SERVICE DESCRIPTION', 18, tableTop + 5.5);
  doc.text('QTY', 125, tableTop + 5.5);
  doc.text('RATE (KES)', 150, tableTop + 5.5);
  doc.text('AMOUNT (KES)', 192, tableTop + 5.5, { align: 'right' });

  let curY = tableTop + 14;
  doc.setFont('helvetica', 'normal');

  const items = invoice.items && invoice.items.length > 0 
    ? invoice.items 
    : [{ description: 'Appliance Repair & Handling Service', quantity: 1, unit_price: invoice.subtotal, total_price: invoice.subtotal }];

  items.forEach((item) => {
    doc.text(item.description, 18, curY);
    doc.text(String(item.quantity), 127, curY);
    doc.text(formatKES(item.unit_price).replace('KES', '').trim(), 155, curY);
    doc.text(formatKES(item.total_price).replace('KES', '').trim(), 192, curY, { align: 'right' });
    curY += 7;
  });

  doc.line(14, curY + 2, 196, curY + 2);

  // Totals
  const totalsY = curY + 10;
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', 140, totalsY);
  doc.text(formatKES(invoice.subtotal), 192, totalsY, { align: 'right' });

  doc.text('VAT / Taxes (0%):', 140, totalsY + 6);
  doc.text(formatKES(invoice.tax || 0), 192, totalsY + 6, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL AMOUNT:', 140, totalsY + 14);
  doc.text(formatKES(invoice.total_amount), 192, totalsY + 14, { align: 'right' });

  // Payment instructions
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Payment Terms: Immediate upon presentation. Cash or M-Pesa.', 14, totalsY + 28);
  doc.text(`Official Tel & M-Pesa Contact: ${STORE_TEL}`, 14, totalsY + 33);
  doc.text(`Thank you for doing business with ${STORE_NAME}.`, 14, totalsY + 38);

  doc.save(`${invoice.invoice_number}_PEKASA_STORES.pdf`);
}
