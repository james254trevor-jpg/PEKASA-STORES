import { jsPDF } from 'jspdf';
import { Customer, CollateralItem, RehaniLoan, LedgerTransaction, STORE_NAME, STORE_MOTTO, STORE_TEL } from '../types';
import { formatKES } from './numbering';

/**
 * Generates an official Kenyan Pawnbrokers Act compliant PAWN TICKET / REHANI AGREEMENT
 */
export function downloadPawnTicketPDF(loan: RehaniLoan, customer: Customer, collateral: CollateralItem) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Top Header Banner
  doc.setFillColor(6, 9, 14); // Deep obsidian
  doc.rect(0, 0, 210, 40, 'F');

  doc.setTextColor(10, 186, 181); // Tiffany Blue
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(STORE_NAME, 14, 18);

  doc.setTextColor(241, 245, 249);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'italic');
  doc.text(`"${STORE_MOTTO}"`, 14, 25);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Official Tel: ${STORE_TEL} | Nairobi · Mombasa · Eldoret`, 14, 32);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PAWN TICKET / REHANI AGREEMENT', 196, 20, { align: 'right' });
  doc.setFontSize(11);
  doc.setTextColor(10, 186, 181);
  doc.text(`Loan No: ${loan.loan_number}`, 196, 28, { align: 'right' });
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Pawn Tag: ${collateral.collateral_number}`, 196, 34, { align: 'right' });

  // Body Setup
  doc.setTextColor(15, 23, 42);

  // Section 1: Customer & Collateral Location Summary Grid
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);

  // Box 1: Customer Details
  doc.setFillColor(248, 250, 252);
  doc.rect(14, 46, 88, 38, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('PAWNER / CUSTOMER DETAILS:', 18, 53);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Full Name: ${customer.name}`, 18, 60);
  doc.text(`National ID: ${customer.id_number}`, 18, 66);
  doc.text(`Phone: ${customer.phone} ${customer.alt_phone && customer.alt_phone !== 'N/A' ? '· Alt: ' + customer.alt_phone : ''}`, 18, 72);
  doc.text(`Address: ${customer.address || 'N/A'}, ${customer.county || 'Nairobi'}`, 18, 78);

  // Box 2: Physical Custody & Storage Location
  doc.setFillColor(248, 250, 252);
  doc.rect(108, 46, 88, 38, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('COLLATERAL STORAGE CUSTODY:', 112, 53);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Branch: ${collateral.branch_id === 'br-mombasa' ? 'Mombasa Coast' : collateral.branch_id === 'br-eldoret' ? 'Eldoret Rift' : 'Nairobi Main (HQ)'}`, 112, 60);
  doc.setFont('helvetica', 'bold');
  doc.text(`Location: ${collateral.storage_room} → ${collateral.rack_shelf}`, 112, 66);
  doc.setFont('helvetica', 'normal');
  doc.text(`Security Tag: ${collateral.security_tag || 'SEC-VERIFIED'}`, 112, 72);
  doc.text(`Disbursed By: Director ${loan.funder}`, 112, 78);

  // Section 2: Pledged Collateral Specification Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('PLEDGED COLLATERAL SPECIFICATION & CONDITION INSPECTION', 14, 92);

  doc.setFillColor(15, 23, 42);
  doc.rect(14, 95, 182, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.text('ITEM DESCRIPTION', 18, 100);
  doc.text('CATEGORY', 90, 100);
  doc.text('SERIAL / IMEI', 130, 100);
  doc.text('EST. MARKET VALUE', 192, 100, { align: 'right' });

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.rect(14, 102, 182, 22, 'S');

  doc.setFont('helvetica', 'bold');
  doc.text(collateral.item_name, 18, 108);
  doc.setFont('helvetica', 'normal');
  doc.text(`Brand/Model: ${collateral.brand} ${collateral.model} ${collateral.colour ? '(' + collateral.colour + ')' : ''}`, 18, 113);
  doc.text(`Accessories: ${collateral.accessories_included || 'Standard cables included'}`, 18, 118);

  doc.text(collateral.category, 90, 108);
  doc.text(collateral.serial_number || collateral.imei_1 || 'N/A', 130, 108);
  doc.setFont('helvetica', 'bold');
  doc.text(formatKES(collateral.market_value), 192, 108, { align: 'right' });

  // Condition Note Banner
  doc.setFillColor(241, 245, 249);
  doc.rect(14, 126, 182, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Condition Inspection:', 18, 132);
  doc.setFont('helvetica', 'normal');
  doc.text(`"${collateral.condition}"`, 55, 132);

  // Section 3: Loan Financials & Maturity Schedule
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('FINANCIAL DISBURSEMENT & CONTRACTUAL REPAYMENT SCHEDULE', 14, 144);

  // Financial Table
  doc.rect(14, 147, 182, 38, 'S');
  doc.line(14, 155, 196, 155);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Principal Disbursed:', 18, 152);
  doc.text(formatKES(loan.principal_amount), 80, 152);

  doc.text('Term Period:', 108, 152);
  doc.text(`${loan.term_days} Days`, 160, 152);

  doc.setFont('helvetica', 'normal');
  doc.text(`Agreed Markup / Interest (${loan.interest_rate_percent}%):`, 18, 161);
  doc.text(formatKES(loan.interest_amount), 80, 161);

  doc.text('Issue Date:', 108, 161);
  doc.text(loan.issue_date, 160, 161);

  doc.text('Storage & Vault Security Fee:', 18, 167);
  doc.text(formatKES(loan.storage_fee), 80, 167);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(225, 29, 72); // Rose
  doc.text('Contractual Due Date:', 108, 167);
  doc.text(loan.due_date, 160, 167);
  doc.setTextColor(15, 23, 42);

  doc.setFont('helvetica', 'normal');
  doc.text('Payment Method / Reference:', 18, 173);
  doc.text(`${loan.disbursement_method} [${loan.disbursement_reference || 'COUNTER'}]`, 80, 173);

  doc.text(`Grace Period (${loan.grace_period_days} Days):`, 108, 173);
  doc.text(`Expires: ${loan.maturity_date}`, 160, 173);

  doc.line(14, 177, 196, 177);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('TOTAL AMOUNT DUE TO REDEEM:', 18, 182);
  doc.text(formatKES(loan.total_amount_due), 80, 182);

  doc.text('CURRENT OUTSTANDING BALANCE:', 108, 182);
  doc.setTextColor(225, 29, 72);
  doc.text(formatKES(loan.balance_remaining), 160, 182);
  doc.setTextColor(15, 23, 42);

  // Section 4: Legal Terms & Pawnbrokers Act Compliance
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('TERMS & CONDITIONS OF PLEDGE (KENYAN PAWNBROKERS ACT STANDARDS):', 14, 193);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const termsText = [
    '1. The Pawner affirms that they are the lawful and sole owner of the pledged goods, and that the item is unencumbered by any third-party claim, hire purchase, or criminal investigation.',
    '2. The collateral is pledged as security for the principal advance, interest, and storage charges indicated above. The Pawner may redeem the item on or before the due date by repaying the full balance.',
    '3. Loan extensions / renewals require payment of accrued interest and the standard renewal handling fee prior to the expiration of the maturity date.',
    '4. In the event of default beyond the agreed grace period (Maturity Date), the Pawnbroker is entitled by law and agreement to dispose of the collateral by auction or private treaty to recover the debt.',
    '5. The Pawnbroker exercises reasonable security precautions for goods in vault custody. This ticket must be presented alongside the original National ID card upon collection.'
  ];

  let termY = 198;
  termsText.forEach((t) => {
    const split = doc.splitTextToSize(t, 182);
    doc.text(split, 14, termY);
    termY += split.length * 3.5;
  });

  // Section 5: Signature Blocks & Store Stamp
  const sigY = 238;
  doc.setLineWidth(0.3);
  doc.line(14, sigY, 70, sigY);
  doc.line(78, sigY, 134, sigY);
  doc.rect(142, sigY - 14, 54, 28, 'S');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('PAWNER SIGNATURE & DATE', 14, sigY + 4);
  doc.setFont('helvetica', 'normal');
  doc.text(customer.name, 14, sigY + 8);
  doc.text(`National ID: ${customer.id_number}`, 14, sigY + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('AUTHORIZED PEKASA SIGNATURE', 78, sigY + 4);
  doc.setFont('helvetica', 'normal');
  doc.text(`Director ${loan.funder} / Licensed Agent`, 78, sigY + 8);
  doc.text(`Issued: ${loan.issue_date}`, 78, sigY + 12);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('OFFICIAL BUSINESS SEAL', 169, sigY - 8, { align: 'center' });
  doc.setFontSize(6.5);
  doc.text('PEKASA STORES', 169, sigY - 2, { align: 'center' });
  doc.text('VERIFIED SECURITY STAMP', 169, sigY + 4, { align: 'center' });
  doc.setTextColor(15, 23, 42);

  // Bottom verification line
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.text(`* Verified Transaction Record · Ref: ${loan.loan_number} · Helpline: ${STORE_TEL}`, 105, 282, { align: 'center' });

  doc.save(`${loan.loan_number}_REHANI_PAWN_TICKET.pdf`);
}

/**
 * Generates an official payment receipt for PEKASA STORES
 */
export function downloadReceiptPDF(payment: LedgerTransaction, customer: Customer, collateral?: CollateralItem, remainingBalance?: number) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 180] // POS thermal format (80mm width)
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
  doc.text('Directors: Trevor & Peter | Nairobi · Mombasa · Eldoret', 40, telY + 4, { align: 'center' });

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
  doc.text(`Date: ${payment.transaction_date}`, 6, div1Y + 16);
  doc.text(`Method: ${payment.payment_method}`, 6, div1Y + 21);
  if (payment.mpesa_reference) {
    doc.text(`M-Pesa Ref: ${payment.mpesa_reference}`, 6, div1Y + 26);
  }
  doc.text(`Received By: ${payment.received_by}`, 6, payment.mpesa_reference ? div1Y + 31 : div1Y + 26);

  const startY = payment.mpesa_reference ? div1Y + 35 : div1Y + 30;
  doc.line(5, startY, 75, startY);

  // Customer & Collateral Info
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENT DETAILS:', 6, startY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${customer.name || 'Walk-in Client'}`, 6, startY + 9.5);
  doc.text(`National ID: ${customer.id_number || 'N/A'}`, 6, startY + 14);
  doc.text(`Client Tel: ${customer.phone || 'N/A'}`, 6, startY + 18.5);

  const colStartY = startY + 23;
  if (collateral) {
    doc.setFont('helvetica', 'bold');
    doc.text('COLLATERAL ITEM:', 6, colStartY);
    doc.setFont('helvetica', 'normal');
    doc.text(`Item: ${collateral.item_name}`, 6, colStartY + 4.5);
    doc.text(`Pawn Tag: ${collateral.collateral_number}`, 6, colStartY + 9);
    doc.text(`Location: ${collateral.storage_room} / ${collateral.rack_shelf}`, 6, colStartY + 13.5);
  }

  const nextY = collateral ? colStartY + 18 : colStartY + 3;
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
  doc.text(`* ${STORE_NAME} Rehani System Verified.`, 40, footerY + 12, { align: 'center' });
  doc.text(`Thank you for trusting ${STORE_NAME}!`, 40, footerY + 16, { align: 'center' });

  doc.save(`${payment.receipt_number}_RECEIPT.pdf`);
}

/**
 * Backward compatibility alias for invoices
 */
export function downloadInvoicePDF(invoice: any, customer: Customer, appliance?: any) {
  const doc = new jsPDF();
  doc.text('PEKASA INVOICE', 10, 10);
  doc.save(`${invoice.invoice_number || 'INV'}.pdf`);
}
