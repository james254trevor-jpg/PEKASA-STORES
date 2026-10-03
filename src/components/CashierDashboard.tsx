import React, { useState } from 'react';
import { sqliteService } from '../db/sqlite';
import { useAuth } from '../context/AuthContext';
import { Payment, Customer, RehaniLoan, CollateralItem, STORE_NAME, STORE_MOTTO } from '../types';
import { formatKES } from '../utils/numbering';
import { CashierSessionModal } from './CashierSessionModal';
import { PaymentVoidModal } from './PaymentVoidModal';
import { 
  DollarSign, 
  Coins, 
  Users, 
  Receipt, 
  FileText, 
  Plus, 
  Search, 
  Lock, 
  Unlock, 
  Printer, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  Clock, 
  Layers, 
  Smartphone,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface CashierDashboardProps {
  onNavigateTab: (tab: string) => void;
  onOpenIntake: () => void;
  onOpenPaymentForLoan?: (loan: RehaniLoan) => void;
  selectedBranchId: string;
}

export const CashierDashboard: React.FC<CashierDashboardProps> = ({
  onNavigateTab,
  onOpenIntake,
  selectedBranchId
}) => {
  const { currentUser, activeCashierSession, refreshActiveSession } = useAuth();

  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [selectedPaymentForVoid, setSelectedPaymentForVoid] = useState<Payment | null>(null);

  // Search in Cashier quick lookup
  const [searchQuery, setSearchQuery] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const allPayments = sqliteService.getPayments();
  const allLoans = sqliteService.getLoans(selectedBranchId);
  const allCustomers = sqliteService.getCustomers();
  const allCollateral = sqliteService.getCollaterals(selectedBranchId);

  // Today's Payments for this cashier or counter
  const todayPayments = allPayments.filter(
    (p) => (p.transaction_date === today || p.payment_date === today)
  );

  // Metrics specifically for today's cashier operations
  const todaysPaymentsTotal = todayPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const todaysCashCollected = todayPayments
    .filter((p) => p.payment_method === 'Cash')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const todaysMpesaCollected = todayPayments
    .filter((p) => p.payment_method === 'M-Pesa')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const todaysLoansProcessed = allLoans.filter(
    (l) => l.issue_date === today
  ).length;

  const todaysCustomersServed = new Set(todayPayments.map((p) => p.customer_id)).size;
  const todaysReceiptsIssued = todayPayments.length;

  // Active / Outstanding Loans
  const activeLoans = allLoans.filter((l) => l.status === 'ACTIVE' || l.status === 'DUE_SOON' || l.status === 'DUE_TODAY');
  const outstandingLoansCount = activeLoans.length;

  // Filtered recent items for quick search
  const filteredLoans = allLoans.filter((l) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const cust = allCustomers.find((c) => c.id === l.customer_id);
    const col = allCollateral.find((c) => c.id === l.collateral_id);
    return (
      l.loan_number.toLowerCase().includes(q) ||
      (cust && (cust.name.toLowerCase().includes(q) || cust.phone.includes(q))) ||
      (col && (col.item_name.toLowerCase().includes(q) || (col.serial_number && col.serial_number.toLowerCase().includes(q))))
    );
  }).slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Top Banner & Status Header */}
      <div className="p-5 bg-gradient-to-r from-[#0B2D4A] via-[#0F3B60] to-[#0B2D4A] border border-[#FFD700]/30 rounded-2xl text-white shadow-xl shadow-[#0B2D4A]/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#FFD700] bg-[#FFD700]/10 border border-[#FFD700]/30 px-2.5 py-0.5 rounded-full font-bold">
                Counter Cashier Terminal
              </span>
              <span className="text-xs text-slate-300">
                Operator: <strong className="text-white">{currentUser?.full_name || 'Cashier'}</strong>
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-white mt-1">
              PEKASA Counter & Cashier Desk
            </h2>
            <p className="text-xs text-slate-300 mt-0.5 max-w-xl">
              Daily customer service, payments receipting, loan intake verification, and cash drawer reconciliation.
            </p>
          </div>

          {/* Drawer Session Quick Widget */}
          <div className="flex items-center gap-3">
            {activeCashierSession ? (
              <div className="p-3 bg-slate-950/80 border border-emerald-500/40 rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <span className="size-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>DRAWER SESSION: OPEN</span>
                </div>
                <div className="flex gap-3 text-slate-300 text-[11px] font-mono">
                  <span>Float: {formatKES(activeCashierSession.opening_cash)}</span>
                  <span className="text-emerald-400">Cash In: +{formatKES(activeCashierSession.cash_collected)}</span>
                </div>
                <button
                  onClick={() => setIsSessionModalOpen(true)}
                  className="w-full mt-1 py-1 px-2.5 bg-rose-600/90 hover:bg-rose-500 text-white font-bold rounded text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <Lock className="w-3 h-3" />
                  <span>Close Session & Reconcile</span>
                </button>
              </div>
            ) : (
              <div className="p-3 bg-slate-950/80 border border-amber-500/40 rounded-xl text-xs space-y-1.5">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>SESSION NOT ACTIVATED</span>
                </div>
                <p className="text-[11px] text-slate-400">Declare opening cash float to begin shift</p>
                <button
                  onClick={() => setIsSessionModalOpen(true)}
                  className="w-full py-1 px-3 bg-[#FFD700] hover:bg-[#FFD700]/90 text-[#0B2D4A] font-bold rounded text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <Unlock className="w-3 h-3" />
                  <span>Open Daily Cashier Session</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TODAY'S METRICS SECTION */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <span>Today's Counter Performance</span>
            <span className="text-[10px] font-mono text-slate-400">({today})</span>
          </h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          {/* 1. Payments Received Today */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold">Payments Received</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-black font-mono text-emerald-400">
              {formatKES(todaysPaymentsTotal)}
            </div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between">
              <span>Cash: {formatKES(todaysCashCollected)}</span>
              <span>M-Pesa: {formatKES(todaysMpesaCollected)}</span>
            </div>
          </div>

          {/* 2. Loans Processed Today */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold">Loans Processed</span>
              <FileText className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-xl font-black font-mono text-white">
              {todaysLoansProcessed}
            </div>
            <div className="text-[10px] text-slate-400">
              <span>Intakes created today</span>
            </div>
          </div>

          {/* 3. Customers Served Today */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold">Customers Served</span>
              <Users className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-black font-mono text-amber-400">
              {todaysCustomersServed}
            </div>
            <div className="text-[10px] text-slate-400">
              <span>Unique customers at counter</span>
            </div>
          </div>

          {/* 4. Receipts Issued Today */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold">Receipts Issued</span>
              <Receipt className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-xl font-black font-mono text-purple-400">
              {todaysReceiptsIssued}
            </div>
            <div className="text-[10px] text-slate-400">
              <span>Serialized receipts</span>
            </div>
          </div>

          {/* 5. Outstanding Transactions */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2 col-span-2 md:col-span-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold">Active Loans</span>
              <Coins className="w-4 h-4 text-[#FFD700]" />
            </div>
            <div className="text-xl font-black font-mono text-[#FFD700]">
              {outstandingLoansCount}
            </div>
            <div className="text-[10px] text-slate-400">
              <span>Awaiting final redemption</span>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS ROW */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Quick Cashier Operations
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {/* New Customer */}
          <button
            onClick={() => onNavigateTab('customers')}
            className="p-3.5 bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 rounded-xl text-left transition-all group cursor-pointer"
          >
            <div className="p-2 w-fit rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
              <Users className="w-4 h-4" />
            </div>
            <div className="font-bold text-white text-xs mt-2">New Customer</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Search or register customer</div>
          </button>

          {/* New Loan & Collateral */}
          <button
            onClick={onOpenIntake}
            className="p-3.5 bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-[#FFD700]/50 rounded-xl text-left transition-all group cursor-pointer"
          >
            <div className="p-2 w-fit rounded-lg bg-[#FFD700]/10 text-[#FFD700] group-hover:bg-[#FFD700] group-hover:text-[#0B2D4A] transition-colors">
              <Plus className="w-4 h-4" />
            </div>
            <div className="font-bold text-white text-xs mt-2">New Loan / Rehani</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Intake collateral & ticket</div>
          </button>

          {/* Receive Payment */}
          <button
            onClick={() => onNavigateTab('payments')}
            className="p-3.5 bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 rounded-xl text-left transition-all group cursor-pointer"
          >
            <div className="p-2 w-fit rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="font-bold text-white text-xs mt-2">Receive Payment</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Cash / M-Pesa receipt</div>
          </button>

          {/* Drawer Session */}
          <button
            onClick={() => setIsSessionModalOpen(true)}
            className="p-3.5 bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 rounded-xl text-left transition-all group cursor-pointer"
          >
            <div className="p-2 w-fit rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors">
              <Coins className="w-4 h-4" />
            </div>
            <div className="font-bold text-white text-xs mt-2">Drawer Session</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Open, close & float check</div>
          </button>

          {/* Request Void */}
          <button
            onClick={() => {
              setSelectedPaymentForVoid(null);
              setIsVoidModalOpen(true);
            }}
            className="p-3.5 bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-rose-500/50 rounded-xl text-left transition-all group cursor-pointer"
          >
            <div className="p-2 w-fit rounded-lg bg-rose-500/10 text-rose-400 group-hover:bg-rose-500 group-hover:text-white transition-colors">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="font-bold text-white text-xs mt-2">Void / Correction</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Submit admin approval request</div>
          </button>

          {/* Loans & Custody */}
          <button
            onClick={() => onNavigateTab('loans')}
            className="p-3.5 bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/50 rounded-xl text-left transition-all group cursor-pointer"
          >
            <div className="p-2 w-fit rounded-lg bg-purple-500/10 text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors">
              <Layers className="w-4 h-4" />
            </div>
            <div className="font-bold text-white text-xs mt-2">Loans & Tickets</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Search collateral & status</div>
          </button>
        </div>
      </div>

      {/* QUICK LOAN & CUSTOMER LOOKUP */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Quick Counter Loan & Ticket Search
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Instantly find customer accounts, loan numbers, collateral items, or serial codes.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by loan #, customer, phone, serial..."
              className="w-full py-2 ps-9 pe-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:ring-1 focus:ring-amber-500"
            />
            <Search className="w-4 h-4 text-slate-500 absolute start-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Loan search results table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px] font-semibold bg-slate-950/40">
                <th className="py-2.5 px-3">Loan #</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Pawned Collateral Item</th>
                <th className="py-2.5 px-3 text-right">Balance Due</th>
                <th className="py-2.5 px-3">Due Date</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredLoans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No active loans found matching query.
                  </td>
                </tr>
              ) : (
                filteredLoans.map((l) => {
                  const cust = allCustomers.find((c) => c.id === l.customer_id);
                  const col = allCollateral.find((c) => c.id === l.collateral_id);
                  return (
                    <tr key={l.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#FFD700] whitespace-nowrap">
                        {l.loan_number}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-white">{cust?.name || 'Customer'}</div>
                        <div className="font-mono text-[10px] text-slate-400">{cust?.phone || '-'}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-200">{col?.item_name || 'Item'}</div>
                        <div className="text-[10px] text-slate-400">{col?.rack_shelf || 'Vault'}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                        {formatKES(l.balance_remaining)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap">
                        {l.due_date}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          l.status === 'ACTIVE' 
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50' 
                            : l.status === 'OVERDUE'
                              ? 'bg-rose-950 text-rose-400 border border-rose-800/50'
                              : 'bg-slate-800 text-slate-300'
                        }`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => onNavigateTab('payments')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[11px] cursor-pointer"
                        >
                          Receive Payment
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TODAY'S PAYMENTS & RECEIPTS TABLE */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Today's Issued Counter Receipts ({todayPayments.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Immutable receipt ledger. If a correction is needed, use the Request Void button.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('payments')}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>View All Payments</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px] font-semibold bg-slate-950/40">
                <th className="py-2.5 px-3">Receipt #</th>
                <th className="py-2.5 px-3">Time / Date</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3 text-right">Amount (KES)</th>
                <th className="py-2.5 px-3">Method</th>
                <th className="py-2.5 px-3">Cashier</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {todayPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No payments receipted yet today. Click "Receive Payment" to log a customer collection.
                  </td>
                </tr>
              ) : (
                todayPayments.map((p) => {
                  const cust = allCustomers.find((c) => c.id === p.customer_id);
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-300 whitespace-nowrap">
                        {p.receipt_number}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap text-[11px]">
                        {p.created_at ? p.created_at.split(' ')[1] : p.transaction_date}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-semibold text-white">{cust?.name || 'Walk-in'}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                        {formatKES(p.amount)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="inline-block bg-slate-800 text-slate-200 px-2 py-0.5 rounded text-[11px]">
                          {p.payment_method}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                        {p.received_by}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-2">
                        <button
                          onClick={() => {
                            setSelectedPaymentForVoid(p);
                            setIsVoidModalOpen(true);
                          }}
                          className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-[11px] font-semibold cursor-pointer"
                        >
                          Request Void
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CASHIER ROLE BOUNDARIES NOTICE */}
      <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex items-start gap-3 text-xs text-slate-400">
        <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-slate-300 block">Role-Based Security Boundary Enforced</span>
          <p className="leading-relaxed text-[11px]">
            Cashier privileges allow customer registration, loan creation, receipt issuance, and drawer tracking.
            System interest rates, loan forgiveness, collateral disposal, and database modifications require
            Administrator authorization by <strong>Trevor Mbugua</strong> or <strong>Peter Kamau</strong>.
          </p>
        </div>
      </div>

      {/* Modals */}
      <CashierSessionModal
        isOpen={isSessionModalOpen}
        onClose={() => setIsSessionModalOpen(false)}
        onSessionUpdated={() => refreshActiveSession()}
      />

      <PaymentVoidModal
        isOpen={isVoidModalOpen}
        onClose={() => setIsVoidModalOpen(false)}
        selectedPayment={selectedPaymentForVoid}
      />
    </div>
  );
};
