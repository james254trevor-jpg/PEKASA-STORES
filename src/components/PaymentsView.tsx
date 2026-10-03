import React, { useState } from 'react';
import { sqliteService } from '../db/sqlite';
import { Payment, Customer, Appliance, Invoice, PaymentMethod, STORE_NAME, STORE_MOTTO, STORE_TEL } from '../types';
import { formatKES } from '../utils/numbering';
import { downloadReceiptPDF, downloadInvoicePDF } from '../utils/pdfGenerator';
import { generateWhatsAppLink, createPaymentReceiptMessage } from '../utils/messaging';
import { useAuth } from '../context/AuthContext';
import { PaymentVoidModal } from './PaymentVoidModal';
import { 
  Coins, 
  Search, 
  Plus, 
  Download, 
  Printer, 
  MessageSquare, 
  CreditCard, 
  Banknote, 
  Building, 
  Smartphone, 
  X, 
  CheckCircle2, 
  FileText, 
  DollarSign, 
  Phone, 
  Eye, 
  Receipt,
  AlertTriangle
} from 'lucide-react';

interface PaymentsViewProps {
  initialApplianceForPayment?: Appliance | null;
  onClearInitialAppliance?: () => void;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  initialApplianceForPayment,
  onClearInitialAppliance
}) => {
  const { currentUser } = useAuth();
  const payments = sqliteService.getPayments();
  const appliances = sqliteService.getAppliances();
  const customers = sqliteService.getCustomers();
  const invoices = sqliteService.getInvoices();

  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(!!initialApplianceForPayment);
  
  // State for on-screen receipt preview & thermal printing
  const [previewReceipt, setPreviewReceipt] = useState<{
    payment: Payment;
    customer: Customer;
    appliance?: Appliance;
    remainingBalance: number;
  } | null>(null);

  // State for Void / Correction Request
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [selectedPaymentForVoid, setSelectedPaymentForVoid] = useState<Payment | null>(null);

  // New Payment Form State
  const [selectedApplianceId, setSelectedApplianceId] = useState<string>(
    initialApplianceForPayment?.id || appliances[0]?.id || ''
  );
  const [amount, setAmount] = useState<number>(5000);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('M-Pesa');
  const [mpesaCode, setMpesaCode] = useState('QHK' + Math.floor(1000000 + Math.random() * 9000000));
  const [mpesaPhone, setMpesaPhone] = useState('+254 7');
  const [mpesaSender, setMpesaSender] = useState('');
  const [receivedBy, setReceivedBy] = useState<string>(currentUser?.username === 'peter' ? 'Peter' : 'Trevor');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Selected appliance in form
  const formAppliance = appliances.find((a) => a.id === selectedApplianceId);
  const formCustomer = formAppliance
    ? customers.find((c) => c.id === formAppliance.customer_id)
    : null;
  const formBalance = formAppliance
    ? sqliteService.calculateApplianceBalance(formAppliance)
    : { totalDue: 0, totalPaid: 0, balanceRemaining: 0 };

  const filteredPayments = payments.filter((pay) => {
    const cust = customers.find((c) => c.id === pay.customer_id);
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      pay.receipt_number.toLowerCase().includes(q) ||
      (pay.mpesa_code && pay.mpesa_code.toLowerCase().includes(q)) ||
      (cust && cust.name.toLowerCase().includes(q)) ||
      (cust && cust.phone.includes(q)) ||
      (cust && cust.id_number.includes(q)) ||
      pay.received_by.toLowerCase().includes(q);

    const matchesMethod = methodFilter === 'ALL' || pay.payment_method === methodFilter;
    return matchesSearch && matchesMethod;
  });

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAppliance || !formCustomer || amount <= 0) {
      alert('Please select a valid appliance and amount.');
      return;
    }

    const rctCode = sqliteService.getNextSequence('RCT');
    const payId = 'pay-' + Date.now();
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    try {
      sqliteService.run(
        `INSERT INTO payments (
          id, receipt_number, appliance_id, customer_id, amount, payment_method,
          mpesa_code, mpesa_phone, mpesa_sender, received_by, notes, payment_date, created_at
        ) VALUES (
          :id, :receipt_number, :appliance_id, :customer_id, :amount, :payment_method,
          :mpesa_code, :mpesa_phone, :mpesa_sender, :received_by, :notes, :payment_date, :created_at
        )`,
        {
          ':id': payId,
          ':receipt_number': rctCode,
          ':appliance_id': formAppliance.id,
          ':customer_id': formCustomer.id,
          ':amount': Number(amount),
          ':payment_method': paymentMethod,
          ':mpesa_code': paymentMethod === 'M-Pesa' ? mpesaCode.trim() : null,
          ':mpesa_phone': paymentMethod === 'M-Pesa' ? mpesaPhone.trim() : null,
          ':mpesa_sender': paymentMethod === 'M-Pesa' ? mpesaSender.trim() : null,
          ':received_by': receivedBy,
          ':notes': notes,
          ':payment_date': paymentDate,
          ':created_at': nowStr
        }
      );

      // Check if appliance is fully settled
      const newBal = formBalance.balanceRemaining - amount;
      if (newBal <= 0) {
        sqliteService.run('UPDATE appliances SET status = :st WHERE id = :id', {
          ':st': 'Redeemed',
          ':id': formAppliance.id
        });
      }

      sqliteService.logAudit(
        currentUser?.full_name || 'Admin',
        'RECORD_PAYMENT',
        'PAYMENT',
        payId,
        `Issued receipt ${rctCode} for KES ${amount} via ${paymentMethod} (Recv by ${receivedBy})`
      );

      // Automatically credit active cashier daily session
      if (currentUser?.id) {
        sqliteService.recordCashierCollection(currentUser.id, paymentMethod, Number(amount));
      }

      const newPaymentObj: Payment = {
        id: payId,
        transaction_number: rctCode,
        receipt_number: rctCode,
        branch_id: 'br-nairobi',
        transaction_type: 'PARTIAL_PAYMENT',
        appliance_id: formAppliance.id,
        collateral_id: formAppliance.id,
        customer_id: formCustomer.id,
        amount: Number(amount),
        principal_portion: Number(amount),
        interest_portion: 0,
        balance_after: Math.max(0, newBal),
        payment_method: paymentMethod,
        mpesa_reference: paymentMethod === 'M-Pesa' ? mpesaCode.trim() : undefined,
        mpesa_code: paymentMethod === 'M-Pesa' ? mpesaCode.trim() : undefined,
        mpesa_phone: paymentMethod === 'M-Pesa' ? mpesaPhone.trim() : undefined,
        mpesa_sender: paymentMethod === 'M-Pesa' ? mpesaSender.trim() : undefined,
        received_by: receivedBy,
        notes: notes,
        transaction_date: paymentDate,
        payment_date: paymentDate,
        created_at: nowStr
      };

      setIsRecordPaymentOpen(false);
      onClearInitialAppliance?.();

      // Automatically open receipt preview with shop telephone
      setPreviewReceipt({
        payment: newPaymentObj,
        customer: formCustomer,
        appliance: formAppliance,
        remainingBalance: Math.max(0, newBal)
      });
    } catch (err: any) {
      alert('Error recording payment: ' + err.message);
    }
  };

  const handleOpenReceiptForExisting = (p: Payment) => {
    const cust = customers.find((c) => c.id === p.customer_id);
    const app = appliances.find((a) => a.id === p.appliance_id);
    const remaining = app ? sqliteService.calculateApplianceBalance(app).balanceRemaining : 0;
    
    setPreviewReceipt({
      payment: p,
      customer: cust || {
        id: 'cust-unknown',
        customer_number: 'CUS-NA',
        name: 'Client',
        id_number: 'N/A',
        phone: 'N/A',
        alt_phone: 'N/A',
        email: '',
        address: '',
        county: 'Nairobi',
        status: 'Good Standing',
        notes: '',
        previous_loans_count: 0,
        total_borrowed: 0,
        total_repaid: 0,
        current_balance: 0,
        defaults_count: 0,
        created_at: '',
        updated_at: ''
      },
      appliance: app,
      remainingBalance: remaining
    });
  };

  const handleSendWhatsAppReceipt = (p: Payment) => {
    const cust = customers.find((c) => c.id === p.customer_id);
    const app = appliances.find((a) => a.id === p.appliance_id);
    if (!cust) return;

    const remaining = app ? sqliteService.calculateApplianceBalance(app).balanceRemaining : 0;
    const msg = createPaymentReceiptMessage({
      customerName: cust.name,
      receiptNumber: p.receipt_number,
      amountPaid: p.amount,
      paymentMethod: p.payment_method,
      mpesaRef: p.mpesa_code,
      remainingBalance: remaining,
      loanNumber: app ? (app.appliance_number || app.collateral_number) : 'N/A'
    });
    window.open(generateWhatsAppLink(cust.phone, msg), '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Title & Action Bar with Tiffany and Glassmorphic styling */}
      <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white uppercase">
              Payments, M-Pesa & Official Receipts
            </h1>
            <span className="text-[11px] font-mono font-bold text-[#0ABAB5] bg-[#0ABAB5]/10 border border-[#0ABAB5]/30 px-2 py-0.5 rounded-full">
              Tel: {STORE_TEL}
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Sequential receipts (RCT-2026-XXXXX), automated balance ledger, M-Pesa tracking, and thermal printouts.
          </p>
        </div>

        <button
          onClick={() => setIsRecordPaymentOpen(true)}
          className="px-4 py-2.5 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-[#0ABAB5]/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Record Counter Payment</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 rounded-xl border border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-2">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search receipt (RCT-2026-...), M-Pesa code, customer name, phone, or recipient..."
              className="w-full pl-9 pr-4 py-2.5 glass-input rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-[#0ABAB5]"
            />
          </div>

          <div>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="w-full py-2.5 px-3 glass-input rounded-xl text-xs text-white focus:outline-none focus:border-[#0ABAB5] cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Payment Methods</option>
              <option value="M-Pesa" className="bg-slate-900">M-Pesa</option>
              <option value="Cash" className="bg-slate-900">Cash</option>
              <option value="Bank" className="bg-slate-900">Bank Transfer</option>
              <option value="Card" className="bg-slate-900">Card / POS</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payments Ledger Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-white/10 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 uppercase text-[11px] font-semibold bg-black/40">
                <th className="py-3 px-4">Receipt No</th>
                <th className="py-3 px-4">Appliance Tag</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-right">Amount (KES)</th>
                <th className="py-3 px-4">Method & Reference</th>
                <th className="py-3 px-4">Received By</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Receipt Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No payment records found matching query.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => {
                  const cust = customers.find((c) => c.id === p.customer_id);
                  const app = appliances.find((a) => a.id === p.appliance_id);
                  return (
                    <tr key={p.id} className="hover:bg-white/[0.04] transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#0ABAB5] whitespace-nowrap">
                        <button
                          onClick={() => handleOpenReceiptForExisting(p)}
                          className="hover:underline cursor-pointer flex items-center gap-1.5"
                          title="View on-screen receipt with Tel: 0727108749 / 0180366344"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>{p.receipt_number}</span>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                        {app ? app.appliance_number : 'General'}
                        <div className="text-[10px] text-slate-400">{app?.category}</div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {cust?.photo_url ? (
                            <img
                              src={cust.photo_url}
                              alt={cust.name}
                              className="w-7 h-7 rounded-lg object-cover border border-[#0ABAB5]/40 shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center text-[#0ABAB5] font-bold text-[10px] shrink-0">
                              {cust ? cust.name.substring(0, 2).toUpperCase() : 'CL'}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-white">{cust?.name || 'Customer'}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{cust?.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-numbers font-bold text-emerald-400 text-sm whitespace-nowrap">
                        {formatKES(p.amount)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-200">{p.payment_method}</div>
                        {p.mpesa_code && (
                          <div className="font-mono text-[11px] text-[#0ABAB5]">
                            {p.mpesa_code} {p.mpesa_sender ? `· ${p.mpesa_sender}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px]">
                        <span className={p.received_by === 'Trevor' ? 'text-[#0ABAB5] font-bold' : 'text-white font-bold'}>
                          {p.received_by}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-slate-400">
                        {p.payment_date}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenReceiptForExisting(p)}
                            className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 border border-white/15 rounded-xl text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                            title="View / Print Receipt with Tel 0727108749 / 0180366344"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#0ABAB5]" />
                            <span>View</span>
                          </button>

                          <button
                            onClick={() => downloadReceiptPDF(p, cust || ({} as any), app)}
                            className="px-2.5 py-1.5 bg-[#0ABAB5]/15 hover:bg-[#0ABAB5]/30 text-[#0ABAB5] border border-[#0ABAB5]/30 rounded-xl text-[11px] flex items-center gap-1 cursor-pointer transition-colors font-bold"
                            title="Download Official PDF Receipt"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>

                          <button
                            onClick={() => handleSendWhatsAppReceipt(p)}
                            className="p-1.5 bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-xl cursor-pointer transition-colors"
                            title="Send Receipt to Customer WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setSelectedPaymentForVoid(p);
                              setIsVoidModalOpen(true);
                            }}
                            className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 rounded-xl text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Submit Payment Void / Correction Request for Admin Approval"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            <span>Void</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECORD PAYMENT MODAL */}
      {isRecordPaymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 overflow-y-auto">
          <div className="w-full max-w-lg glass-panel border border-white/15 rounded-2xl shadow-2xl overflow-hidden my-8">
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-black/50">
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <Coins className="w-4 h-4 text-[#0ABAB5]" />
                <span>Record Counter Payment & Issue Receipt</span>
              </h2>
              <button
                onClick={() => {
                  setIsRecordPaymentOpen(false);
                  onClearInitialAppliance?.();
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-6 space-y-4 text-xs">
              {/* Select Appliance */}
              <div>
                <label className="block font-bold text-slate-300 mb-1">Select Appliance / Collateral Tag *</label>
                <select
                  value={selectedApplianceId}
                  onChange={(e) => setSelectedApplianceId(e.target.value)}
                  className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5] cursor-pointer"
                  required
                >
                  {appliances.map((a) => {
                    const c = customers.find((cust) => cust.id === a.customer_id);
                    const bal = sqliteService.calculateApplianceBalance(a).balanceRemaining;
                    return (
                      <option key={a.id} value={a.id} className="bg-slate-900 text-white">
                        {a.appliance_number} - {a.brand} {a.model} ({c?.name || 'Client'}) [Due: KES {bal}]
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Client & Collateral Snapshot Box */}
              {formAppliance && formCustomer && (
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Client:</span>
                    <span className="font-bold text-white">{formCustomer.name} (ID: {formCustomer.id_number})</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Client Phone:</span>
                    <span className="font-mono text-[#0ABAB5] font-bold">{formCustomer.phone}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/10 pt-2">
                    <span className="text-slate-400">Current Outstanding:</span>
                    <span className="font-mono-numbers font-black text-rose-400 text-sm">
                      {formatKES(formBalance.balanceRemaining)}
                    </span>
                  </div>
                </div>
              )}

              {/* Amount to Pay */}
              <div>
                <label className="block font-bold text-slate-300 mb-1">Amount to Pay (KES) *</label>
                <input
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono-numbers text-base font-bold focus:outline-none focus:border-[#0ABAB5]"
                  required
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block font-bold text-slate-300 mb-1.5">Payment Method *</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['M-Pesa', 'Cash', 'Bank', 'Card'] as PaymentMethod[]).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        paymentMethod === method
                          ? 'bg-[#0ABAB5] text-black border-[#0ABAB5] shadow-md shadow-[#0ABAB5]/20'
                          : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* M-Pesa Fields */}
              {paymentMethod === 'M-Pesa' && (
                <div className="p-3.5 bg-black/40 border border-[#0ABAB5]/30 rounded-xl space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#0ABAB5]">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>M-Pesa Transaction Verification</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-mono">M-Pesa Code (e.g. QHK7492041)</label>
                      <input
                        type="text"
                        value={mpesaCode}
                        onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                        className="w-full py-2 px-3 glass-input rounded-lg text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-mono">Sender Phone</label>
                      <input
                        type="text"
                        value={mpesaPhone}
                        onChange={(e) => setMpesaPhone(e.target.value)}
                        className="w-full py-2 px-3 glass-input rounded-lg text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Received By & Payment Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Received By (Partner)</label>
                  <select
                    value={receivedBy}
                    onChange={(e) => setReceivedBy(e.target.value)}
                    className="w-full py-2.5 px-3 glass-input rounded-xl text-[#0ABAB5] font-bold text-xs focus:outline-none focus:border-[#0ABAB5] cursor-pointer"
                  >
                    <option value="Trevor" className="bg-slate-900 text-white">Trevor (Director)</option>
                    <option value="Peter" className="bg-slate-900 text-white">Peter (Director)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5] cursor-pointer"
                    required
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-slate-300 mb-1">Transaction Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Counter cash, final clearance, partial payment"
                  className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                />
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setIsRecordPaymentOpen(false);
                    onClearInitialAppliance?.();
                  }}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold cursor-pointer border border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-extrabold rounded-xl text-xs cursor-pointer shadow-lg shadow-[#0ABAB5]/20 flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Record & Generate Official Receipt</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ON-SCREEN PRINTABLE THERMAL RECEIPT MODAL (FEATURES TEL: 0727108749 / 0180366344) */}
      {previewReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 overflow-y-auto">
          <div className="w-full max-w-sm glass-panel border border-white/20 rounded-2xl shadow-2xl overflow-hidden my-6">
            {/* Modal Actions Header */}
            <div className="p-3.5 bg-black/60 border-b border-white/10 flex items-center justify-between no-print">
              <span className="text-xs font-bold text-[#0ABAB5] flex items-center gap-1.5">
                <Receipt className="w-4 h-4" />
                <span>Official Receipt Preview</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadReceiptPDF(previewReceipt.payment, previewReceipt.customer, previewReceipt.appliance, previewReceipt.remainingBalance)}
                  className="px-2.5 py-1 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white font-semibold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  onClick={() => setPreviewReceipt(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Thermal Receipt Body */}
            <div className="p-6 bg-white text-black font-mono text-xs space-y-3 print-receipt-container">
              {/* Receipt Header */}
              <div className="text-center space-y-1 border-b border-black pb-3">
                <h2 className="text-xl font-black uppercase tracking-wider">{STORE_NAME}</h2>
                <p className="text-[10px] italic leading-tight text-slate-700">
                  "{STORE_MOTTO}"
                </p>
                <div className="text-xs font-bold text-black pt-1">
                  Tel: {STORE_TEL}
                </div>
                <p className="text-[10px] text-slate-600">
                  Nairobi, Kenya · Directors: Trevor & Peter
                </p>
              </div>

              {/* Receipt Metadata */}
              <div className="text-center py-1">
                <span className="font-extrabold text-sm uppercase tracking-wide">
                  OFFICIAL PAYMENT RECEIPT
                </span>
              </div>

              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-400 pb-2.5">
                <div className="flex justify-between">
                  <span>Receipt No:</span>
                  <span className="font-bold">{previewReceipt.payment.receipt_number}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date & Time:</span>
                  <span>{previewReceipt.payment.payment_date}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Method:</span>
                  <span className="font-bold">{previewReceipt.payment.payment_method}</span>
                </div>
                {previewReceipt.payment.mpesa_code && (
                  <div className="flex justify-between font-bold">
                    <span>M-Pesa Ref:</span>
                    <span>{previewReceipt.payment.mpesa_code}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Received By:</span>
                  <span className="font-bold">{previewReceipt.payment.received_by}</span>
                </div>
              </div>

              {/* Client Information */}
              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-400 pb-2.5">
                <div className="font-bold uppercase text-[10px] text-slate-600">Client Details:</div>
                <div className="flex justify-between">
                  <span>Name:</span>
                  <span className="font-bold">{previewReceipt.customer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>National ID:</span>
                  <span>{previewReceipt.customer.id_number}</span>
                </div>
                <div className="flex justify-between">
                  <span>Client Tel:</span>
                  <span className="font-bold">{previewReceipt.customer.phone}</span>
                </div>
                {previewReceipt.customer.address && (
                  <div className="flex justify-between">
                    <span>Address:</span>
                    <span>{previewReceipt.customer.address}</span>
                  </div>
                )}
              </div>

              {/* Collateral / Appliance Details */}
              {previewReceipt.appliance && (
                <div className="space-y-1 text-[11px] border-b border-dashed border-slate-400 pb-2.5">
                  <div className="font-bold uppercase text-[10px] text-slate-600">Collateral / Item:</div>
                  <div className="flex justify-between">
                    <span>Category:</span>
                    <span className="font-bold">{previewReceipt.appliance.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Brand / Model:</span>
                    <span>{previewReceipt.appliance.brand} {previewReceipt.appliance.model}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tag Code:</span>
                    <span className="font-bold">{previewReceipt.appliance.appliance_number}</span>
                  </div>
                </div>
              )}

              {/* Financial Breakdown */}
              <div className="space-y-1.5 pt-1 border-b border-black pb-3">
                <div className="flex justify-between items-center text-sm font-black">
                  <span>AMOUNT PAID:</span>
                  <span>{formatKES(previewReceipt.payment.amount)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Outstanding Balance:</span>
                  <span className="font-bold">{formatKES(previewReceipt.remainingBalance)}</span>
                </div>
              </div>

              {/* Receipt Footer with Store Contact Numbers */}
              <div className="text-center text-[10px] text-slate-600 pt-1 space-y-1">
                <p className="font-bold text-black text-xs">
                  Customer Helpline: {STORE_TEL}
                </p>
                <p>* Keep this receipt safe as proof of transaction.</p>
                <p>* {STORE_NAME} Relational System Verified.</p>
                <p className="font-bold text-black">Thank you for doing business with {STORE_NAME}!</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Void / Correction Request Modal */}
      <PaymentVoidModal
        isOpen={isVoidModalOpen}
        onClose={() => setIsVoidModalOpen(false)}
        selectedPayment={selectedPaymentForVoid}
      />
    </div>
  );
};
