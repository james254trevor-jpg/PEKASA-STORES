import React, { useState } from 'react';
import { sqliteService } from '../db/sqlite';
import { Payment } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatKES } from '../utils/numbering';
import { AlertTriangle, ShieldCheck, X, FileText, CheckCircle2, Clock } from 'lucide-react';

interface PaymentVoidModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPayment?: Payment | null;
  onSubmitted?: () => void;
}

export const PaymentVoidModal: React.FC<PaymentVoidModalProps> = ({
  isOpen,
  onClose,
  selectedPayment,
  onSubmitted
}) => {
  const { currentUser } = useAuth();
  const payments = sqliteService.getPayments();

  const [paymentId, setPaymentId] = useState<string>(selectedPayment?.id || payments[0]?.id || '');
  const [reason, setReason] = useState<string>('Customer changed payment method from Cash to M-Pesa');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentPay = payments.find((p) => p.id === paymentId) || selectedPayment;
  const customers = sqliteService.getCustomers();
  const customer = currentPay ? customers.find((c) => c.id === currentPay.customer_id) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPay) {
      alert('Please select a payment to void.');
      return;
    }
    if (!reason.trim()) {
      alert('A valid reason is required for administrative audit approval.');
      return;
    }

    setIsSubmitting(true);
    try {
      sqliteService.submitPaymentVoidRequest({
        payment_id: currentPay.id,
        receipt_number: currentPay.receipt_number,
        loan_number: currentPay.loan_id || currentPay.appliance_id,
        customer_name: customer?.name || 'Walk-in Customer',
        amount: currentPay.amount,
        cashier_id: currentUser?.id || 'cashier',
        cashier_name: currentUser?.full_name || 'Cashier Desk',
        reason: reason.trim()
      });

      setSuccessMessage(`Void request submitted successfully for receipt ${currentPay.receipt_number}. Pending Director approval.`);
      setTimeout(() => {
        if (onSubmitted) onSubmitted();
        onClose();
      }, 1800);
    } catch (err: any) {
      alert(err?.message || 'Failed to submit void request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Request Payment Void / Correction</h3>
              <p className="text-[11px] text-slate-400">Requires Administrative Approval from Trevor or Peter</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMessage ? (
          <div className="p-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
            <h4 className="font-bold text-white text-base">Request Submitted</h4>
            <p className="text-xs text-slate-300 leading-relaxed">{successMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1 text-slate-300 text-[11px]">
              <div className="flex items-center gap-1.5 font-bold text-amber-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Anti-Fraud Compliance Notice</span>
              </div>
              <p>
                Cashiers cannot silently delete transaction receipts. All corrections generate an immutable
                audit request that must be reviewed by Director Trevor or Peter.
              </p>
            </div>

            {/* Select Payment if not pre-selected */}
            {!selectedPayment && (
              <div className="space-y-1">
                <label className="block font-bold text-slate-300">Select Receipt to Void</label>
                <select
                  value={paymentId}
                  onChange={(e) => setPaymentId(e.target.value)}
                  className="w-full p-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-amber-500"
                >
                  {payments.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.receipt_number} - KES {Number(p.amount).toLocaleString()} ({p.payment_method}) - {p.received_by}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Target Payment Details */}
            {currentPay && (
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Receipt Number:</span>
                  <span className="font-mono font-bold text-amber-300">{currentPay.receipt_number}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Customer:</span>
                  <span className="font-bold text-white">{customer?.name || 'Customer'}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Amount:</span>
                  <span className="font-mono font-bold text-emerald-400">{formatKES(currentPay.amount)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Payment Method:</span>
                  <span className="font-medium text-slate-300">{currentPay.payment_method}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Recorded Date:</span>
                  <span className="font-mono text-slate-400">{currentPay.transaction_date || currentPay.created_at}</span>
                </div>
              </div>
            )}

            {/* Reason */}
            <div className="space-y-1">
              <label className="block font-bold text-slate-300">
                Correction Reason <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="State the exact error and corrective action..."
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-amber-500"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !currentPay}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow-md disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Request to Admin'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
