import React, { useState } from 'react';
import { sqliteService } from '../db/sqlite';
import { 
  RehaniLoan, 
  CollateralItem, 
  Customer, 
  LoanStatus, 
  STORE_NAME, 
  STORE_TEL 
} from '../types';
import { formatKES, calculateLoanDueDate, calculateMaturityDate } from '../utils/numbering';
import { downloadPawnTicketPDF, downloadReceiptPDF } from '../utils/pdfGenerator';
import { 
  generateWhatsAppLink, 
  createLoanDisbursalMessage, 
  createOverdueNoticeMessage, 
  createDueSoonReminderMessage,
  createRenewalConfirmationMessage 
} from '../utils/messaging';
import { useAuth } from '../context/AuthContext';
import { 
  Coins, 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Printer, 
  Download, 
  MessageSquare, 
  RotateCcw, 
  Package, 
  User, 
  CreditCard, 
  Building2, 
  X, 
  AlertTriangle, 
  MapPin, 
  FileText,
  ShieldAlert,
  HelpCircle,
  Eye
} from 'lucide-react';

interface LoansViewProps {
  selectedBranchId: string;
  initialSelectedLoanId?: string | null;
  onSelectCustomer?: (customerId: string) => void;
  onSelectCollateral?: (collateralId: string) => void;
  onOpenAddCustomerWithItems?: () => void;
}

export const LoansView: React.FC<LoansViewProps> = ({
  selectedBranchId,
  initialSelectedLoanId,
  onSelectCustomer,
  onSelectCollateral,
  onOpenAddCustomerWithItems
}) => {
  const { currentUser } = useAuth();
  const loans = sqliteService.getLoans(selectedBranchId);
  const customers = sqliteService.getCustomers();
  const collaterals = sqliteService.getCollaterals(selectedBranchId);

  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(initialSelectedLoanId || loans[0]?.id || null);

  // Modal States
  const [isNewLoanModalOpen, setIsNewLoanModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);

  // New Loan Form State
  const [newCustomerId, setNewCustomerId] = useState<string>(customers[0]?.id || '');
  const [newCollateralId, setNewCollateralId] = useState<string>(
    collaterals.find((c) => c.status !== 'Held (Active Loan)')?.id || collaterals[0]?.id || ''
  );
  const [newPrincipal, setNewPrincipal] = useState<number>(20000);
  const [newInterestRate, setNewInterestRate] = useState<number>(30); // 30% per 2 weeks
  const [newStorageFee, setNewStorageFee] = useState<number>(500);
  const [newTermDays, setNewTermDays] = useState<number>(14); // Strictly maximum 14 days (2 weeks)
  const [newGraceDays, setNewGraceDays] = useState<number>(7);
  const [newIssueDate, setNewIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newFunder, setNewFunder] = useState<'Trevor' | 'Peter'>(
    currentUser?.username?.toLowerCase() === 'peter' ? 'Peter' : 'Trevor'
  );
  const [newDisbursementMethod, setNewDisbursementMethod] = useState<'Cash' | 'M-Pesa' | 'Bank'>('M-Pesa');
  const [newDisbursementRef, setNewDisbursementRef] = useState<string>('QHK' + Math.floor(1000000 + Math.random() * 9000000));
  const [newLoanNotes, setNewLoanNotes] = useState<string>('');

  // Selected collateral for LTV inspection
  const selectedCollateralForNew = collaterals.find((c) => c.id === newCollateralId);
  const ltvValuation = selectedCollateralForNew
    ? sqliteService.calculateMaxLoan(selectedCollateralForNew.category, selectedCollateralForNew.market_value)
    : { maxLTVPercent: 55, maxAllowedLoan: 25000 };

  const isLoanAboveLTV = selectedCollateralForNew && newPrincipal > ltvValuation.maxAllowedLoan;

  // Repayment modal state
  const [repayAmount, setRepayAmount] = useState<number>(5000);
  const [repayMethod, setRepayMethod] = useState<'M-Pesa' | 'Cash' | 'Bank'>('M-Pesa');
  const [repayMpesaRef, setRepayMpesaRef] = useState<string>('QHK' + Math.floor(1000000 + Math.random() * 9000000));
  const [repayNotes, setRepayNotes] = useState<string>('');

  // Renewal modal state (Strictly maximum 14 days / 2 weeks)
  const [renewalPeriodDays, setRenewalPeriodDays] = useState<number>(14);
  const [renewalFee, setRenewalFee] = useState<number>(6000); // 30% standard
  const [renewalMethod, setRenewalMethod] = useState<'M-Pesa' | 'Cash' | 'Bank'>('M-Pesa');
  const [renewalRef, setRenewalRef] = useState<string>('RNW' + Math.floor(1000000 + Math.random() * 9000000));
  const [renewalNotes, setRenewalNotes] = useState<string>('');

  // Calculations for new loan
  const calculatedInterestAmount = Math.round((newPrincipal * newInterestRate) / 100);
  const calculatedTotalDue = Number(newPrincipal) + calculatedInterestAmount + Number(newStorageFee);
  const calculatedDueDate = calculateLoanDueDate(newIssueDate, newTermDays);
  const calculatedMaturityDate = calculateMaturityDate(calculatedDueDate, newGraceDays);

  const selectedLoan = loans.find((l) => l.id === selectedLoanId);
  const selectedLoanCustomer = selectedLoan ? customers.find((c) => c.id === selectedLoan.customer_id) : null;
  const selectedLoanCollateral = selectedLoan ? collaterals.find((c) => c.id === selectedLoan.collateral_id) : null;
  const selectedLoanTransactions = selectedLoan ? sqliteService.getTransactions(selectedLoan.id) : [];
  const selectedLoanRenewals = selectedLoan ? sqliteService.getRenewals(selectedLoan.id) : [];

  // Filter loans based on search and status tabs
  const filteredLoans = loans.filter((l) => {
    const cust = customers.find((c) => c.id === l.customer_id);
    const col = collaterals.find((c) => c.id === l.collateral_id);
    const q = searchQuery.toLowerCase().trim();

    const matchesSearch = !q ||
      l.loan_number.toLowerCase().includes(q) ||
      (cust && (cust.name.toLowerCase().includes(q) || cust.phone.includes(q) || cust.id_number.includes(q))) ||
      (col && (col.collateral_number.toLowerCase().includes(q) || col.item_name.toLowerCase().includes(q) || (col.serial_number && col.serial_number.toLowerCase().includes(q))));

    if (!matchesSearch) return false;

    if (activeTab === 'ALL') return true;
    if (activeTab === 'ACTIVE') return l.status === 'ACTIVE';
    if (activeTab === 'DUE_SOON') {
      const nowTime = new Date().getTime();
      const dueTime = new Date(l.due_date).getTime();
      const diffDays = Math.ceil((dueTime - nowTime) / (1000 * 3600 * 24));
      return l.status !== 'REDEEMED' && l.status !== 'SOLD' && diffDays >= 0 && diffDays <= 7;
    }
    if (activeTab === 'OVERDUE') return l.status === 'OVERDUE' || l.status === 'DEFAULT_ENFORCEMENT';
    if (activeTab === 'REDEEMED') return l.status === 'REDEEMED';
    if (activeTab === 'SOLD') return l.status === 'SOLD';

    return l.status === activeTab;
  });

  // Handle Create New Rehani Loan
  const handleCreateLoanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerId || !newCollateralId || newPrincipal <= 0) {
      alert('Please select valid customer, collateral, and loan principal amount.');
      return;
    }

    const loanId = 'ln-' + Date.now();
    const loanCode = sqliteService.getNextSequence('LN');
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    try {
      // 1. Insert Loan
      sqliteService.run(
        `INSERT INTO rehani_loans (
          id, loan_number, customer_id, collateral_id, branch_id,
          principal_amount, interest_rate_percent, interest_amount, storage_fee, total_amount_due,
          amount_paid, balance_remaining, term_days, issue_date, due_date, grace_period_days, maturity_date,
          funder, disbursement_method, disbursement_reference, status, renewals_count, staff_issuer, notes, created_at, updated_at
        ) VALUES (
          :id, :loan_number, :customer_id, :collateral_id, :branch_id,
          :principal_amount, :interest_rate_percent, :interest_amount, :storage_fee, :total_amount_due,
          0, :balance_remaining, :term_days, :issue_date, :due_date, :grace_period_days, :maturity_date,
          :funder, :disbursement_method, :disbursement_reference, 'ACTIVE', 0, :staff_issuer, :notes, :created_at, :updated_at
        )`,
        {
          ':id': loanId,
          ':loan_number': loanCode,
          ':customer_id': newCustomerId,
          ':collateral_id': newCollateralId,
          ':branch_id': selectedBranchId === 'ALL' ? 'br-nairobi' : selectedBranchId,
          ':principal_amount': Number(newPrincipal),
          ':interest_rate_percent': Number(newInterestRate),
          ':interest_amount': calculatedInterestAmount,
          ':storage_fee': Number(newStorageFee),
          ':total_amount_due': calculatedTotalDue,
          ':balance_remaining': calculatedTotalDue,
          ':term_days': Number(newTermDays),
          ':issue_date': newIssueDate,
          ':due_date': calculatedDueDate,
          ':grace_period_days': Number(newGraceDays),
          ':maturity_date': calculatedMaturityDate,
          ':funder': newFunder,
          ':disbursement_method': newDisbursementMethod,
          ':disbursement_reference': newDisbursementRef,
          ':staff_issuer': currentUser?.full_name || `Director ${newFunder}`,
          ':notes': newLoanNotes,
          ':created_at': nowStr,
          ':updated_at': nowStr
        }
      );

      // 2. Mark Collateral as Held
      sqliteService.run(
        `UPDATE collateral_items SET status = 'Held (Active Loan)', updated_at = :now WHERE id = :cid`,
        { ':now': nowStr, ':cid': newCollateralId }
      );

      // 3. Record Initial Ledger Transaction
      const txnCode = sqliteService.getNextSequence('TXN');
      const rctCode = sqliteService.getNextSequence('RCT');
      sqliteService.run(
        `INSERT INTO ledger_transactions (
          id, transaction_number, receipt_number, loan_id, collateral_id, customer_id, branch_id,
          transaction_type, amount, principal_portion, interest_portion, balance_after,
          payment_method, mpesa_reference, received_by, notes, transaction_date, created_at
        ) VALUES (
          :id, :txn, :rct, :lid, :cid, :custid, :brid,
          'LOAN_ISSUED', :amt, :amt, 0, :bal,
          :method, :ref, :recv, :notes, :tdate, :now
        )`,
        {
          ':id': 'txn-' + Date.now(),
          ':txn': txnCode,
          ':rct': rctCode,
          ':lid': loanId,
          ':cid': newCollateralId,
          ':custid': newCustomerId,
          ':brid': selectedBranchId === 'ALL' ? 'br-nairobi' : selectedBranchId,
          ':amt': Number(newPrincipal),
          ':bal': calculatedTotalDue,
          ':method': newDisbursementMethod,
          ':ref': newDisbursementRef,
          ':recv': `Director ${newFunder}`,
          ':notes': `Loan capital disbursed for ${selectedCollateralForNew?.item_name || 'Collateral'}`,
          ':tdate': newIssueDate,
          ':now': nowStr
        }
      );

      sqliteService.logAudit(
        newFunder,
        'ISSUE_REHANI_LOAN',
        'LOAN',
        loanId,
        `Issued Rehani Loan ${loanCode} KES ${newPrincipal} funded by Director ${newFunder} due on ${calculatedDueDate}`
      );

      setIsNewLoanModalOpen(false);
      setSelectedLoanId(loanId);

      const createdCust = customers.find((c) => c.id === newCustomerId);
      const createdCol = collaterals.find((c) => c.id === newCollateralId);

      // Immediate Pawn Ticket PDF prompt
      if (createdCust && createdCol) {
        const fullLoanObj: RehaniLoan = {
          id: loanId,
          loan_number: loanCode,
          customer_id: newCustomerId,
          collateral_id: newCollateralId,
          branch_id: selectedBranchId === 'ALL' ? 'br-nairobi' : selectedBranchId,
          principal_amount: Number(newPrincipal),
          interest_rate_percent: Number(newInterestRate),
          interest_amount: calculatedInterestAmount,
          storage_fee: Number(newStorageFee),
          total_amount_due: calculatedTotalDue,
          amount_paid: 0,
          balance_remaining: calculatedTotalDue,
          term_days: Number(newTermDays),
          issue_date: newIssueDate,
          due_date: calculatedDueDate,
          grace_period_days: Number(newGraceDays),
          maturity_date: calculatedMaturityDate,
          funder: newFunder,
          disbursement_method: newDisbursementMethod,
          disbursement_reference: newDisbursementRef,
          status: 'ACTIVE',
          renewals_count: 0,
          staff_issuer: `Director ${newFunder}`,
          created_at: nowStr,
          updated_at: nowStr
        };

        if (confirm(`Rehani Loan ${loanCode} issued successfully! Would you like to download the official Pawn Ticket now?`)) {
          downloadPawnTicketPDF(fullLoanObj, createdCust, createdCol);
        }
      }
    } catch (err: any) {
      alert('Failed to issue Rehani Loan: ' + err.message);
    }
  };

  // Handle Repayment (Partial or Full)
  const handleRepaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan || repayAmount <= 0) return;

    const newBalance = Math.max(0, selectedLoan.balance_remaining - repayAmount);
    const newStatus: LoanStatus = newBalance === 0 ? 'REDEEMED' : selectedLoan.status;
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const today = new Date().toISOString().split('T')[0];

    const txnCode = sqliteService.getNextSequence('TXN');
    const rctCode = sqliteService.getNextSequence('RCT');

    try {
      // 1. Update Loan
      sqliteService.run(
        `UPDATE rehani_loans SET
          amount_paid = amount_paid + :paid,
          balance_remaining = :bal,
          status = :st,
          updated_at = :now
         WHERE id = :id`,
        {
          ':paid': Number(repayAmount),
          ':bal': newBalance,
          ':st': newStatus,
          ':now': nowStr,
          ':id': selectedLoan.id
        }
      );

      // 2. If completely settled, update collateral status to Redeemed
      if (newBalance === 0) {
        sqliteService.run(
          `UPDATE collateral_items SET status = 'Redeemed', updated_at = :now WHERE id = :cid`,
          { ':now': nowStr, ':cid': selectedLoan.collateral_id }
        );
      }

      // 3. Insert Immutable Ledger Transaction
      sqliteService.run(
        `INSERT INTO ledger_transactions (
          id, transaction_number, receipt_number, loan_id, collateral_id, customer_id, branch_id,
          transaction_type, amount, principal_portion, interest_portion, balance_after,
          payment_method, mpesa_reference, received_by, notes, transaction_date, created_at
        ) VALUES (
          :id, :txn, :rct, :lid, :cid, :custid, :brid,
          :ttype, :amt, :princ, :intr, :bal,
          :method, :ref, :recv, :notes, :tdate, :now
        )`,
        {
          ':id': 'txn-' + Date.now(),
          ':txn': txnCode,
          ':rct': rctCode,
          ':lid': selectedLoan.id,
          ':cid': selectedLoan.collateral_id,
          ':custid': selectedLoan.customer_id,
          ':brid': selectedLoan.branch_id,
          ':ttype': newBalance === 0 ? 'FULL_SETTLEMENT' : 'PARTIAL_PAYMENT',
          ':amt': Number(repayAmount),
          ':princ': Math.round(Number(repayAmount) * 0.8),
          ':intr': Math.round(Number(repayAmount) * 0.2),
          ':bal': newBalance,
          ':method': repayMethod,
          ':ref': repayMethod === 'M-Pesa' ? repayMpesaRef : null,
          ':recv': currentUser?.full_name || 'Counter Staff',
          ':notes': repayNotes || `Counter repayment against ${selectedLoan.loan_number}`,
          ':tdate': today,
          ':now': nowStr
        }
      );

      sqliteService.logAudit(
        currentUser?.full_name || 'Staff',
        'RECORD_REPAYMENT',
        'LOAN',
        selectedLoan.id,
        `Recorded repayment ${rctCode} KES ${repayAmount} for loan ${selectedLoan.loan_number}. Balance remaining: KES ${newBalance}`
      );

      setIsRepayModalOpen(false);
      setRepayAmount(0);
      setRepayNotes('');

      alert(`Payment recorded successfully! Receipt ${rctCode} issued. New Balance: ${formatKES(newBalance)}`);
    } catch (err: any) {
      alert('Error recording repayment: ' + err.message);
    }
  };

  // Handle Loan Renewal
  const handleRenewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;

    const rnwCode = sqliteService.getNextSequence('RNW');
    const today = new Date().toISOString().split('T')[0];
    const newDueDate = calculateLoanDueDate(today, renewalPeriodDays);
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    try {
      // 1. Insert Renewal Record
      sqliteService.run(
        `INSERT INTO loan_renewals (
          id, renewal_number, loan_id, previous_due_date, new_due_date,
          previous_principal, accrued_interest_paid, renewal_charge, total_paid,
          payment_method, reference_code, approved_by, renewal_date, notes
        ) VALUES (
          :id, :rnw, :lid, :prevdue, :newdue,
          :pprinc, :accrued, :rcharge, :total,
          :method, :ref, :appr, :rdate, :notes
        )`,
        {
          ':id': 'rnw-' + Date.now(),
          ':rnw': rnwCode,
          ':lid': selectedLoan.id,
          ':prevdue': selectedLoan.due_date,
          ':newdue': newDueDate,
          ':pprinc': selectedLoan.principal_amount,
          ':accrued': selectedLoan.interest_amount,
          ':rcharge': Number(renewalFee),
          ':total': Number(renewalFee),
          ':method': renewalMethod,
          ':ref': renewalRef,
          ':appr': currentUser?.full_name || 'Director Trevor',
          ':rdate': today,
          ':notes': renewalNotes || 'Standard 30-day renewal extension granted'
        }
      );

      // 2. Update Loan Status and Due Date
      sqliteService.run(
        `UPDATE rehani_loans SET
          due_date = :newdue,
          maturity_date = :newmat,
          status = 'ACTIVE',
          renewals_count = renewals_count + 1,
          updated_at = :now
         WHERE id = :id`,
        {
          ':newdue': newDueDate,
          ':newmat': calculateMaturityDate(newDueDate, selectedLoan.grace_period_days),
          ':now': nowStr,
          ':id': selectedLoan.id
        }
      );

      sqliteService.logAudit(
        currentUser?.full_name || 'Staff',
        'RENEW_LOAN',
        'LOAN',
        selectedLoan.id,
        `Renewed loan ${selectedLoan.loan_number} (${rnwCode}) with new due date ${newDueDate}. Extension fee KES ${renewalFee}`
      );

      setIsRenewModalOpen(false);
      alert(`Loan successfully renewed (${rnwCode})! New maturity due date: ${newDueDate}`);
    } catch (err: any) {
      alert('Failed to renew loan: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="glass-panel p-5 rounded-3xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-white uppercase">
              Rehani Loans & Pawn Tickets
            </h1>
            <span className="text-[11px] font-mono font-bold text-[#0ABAB5] bg-[#0ABAB5]/10 border border-[#0ABAB5]/30 px-2.5 py-0.5 rounded-full">
              {loans.length} Contracts
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Standard contractual cycles, automatic LTV limits, immutable repayment ledgers, and formal renewal workflows.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onOpenAddCustomerWithItems && (
            <button
              onClick={onOpenAddCustomerWithItems}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer border border-white/15"
              title="Add Customer Details & Intake Collateral in One Unified Screen"
            >
              <Package className="w-4 h-4 text-[#0ABAB5]" />
              <span>+ Add Customer & Item</span>
            </button>
          )}

          <button
            onClick={() => setIsNewLoanModalOpen(true)}
            className="px-4 py-2.5 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-extrabold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#0ABAB5]/20"
          >
            <Plus className="w-4 h-4" />
            <span>New Rehani Loan & Ticket</span>
          </button>
        </div>
      </div>

      {/* Lifecycle Status Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
        {[
          { id: 'ALL', label: 'All Loans' },
          { id: 'ACTIVE', label: 'Active (🟢)' },
          { id: 'DUE_SOON', label: 'Due Soon (🟡)' },
          { id: 'OVERDUE', label: 'Overdue (🔴)' },
          { id: 'REDEEMED', label: 'Redeemed (🔵)' },
          { id: 'SOLD', label: 'Disposed / Sold (🟣)' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap border ${
              activeTab === tab.id
                ? 'bg-[#0ABAB5] text-black border-[#0ABAB5] font-extrabold shadow-md'
                : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search Loan # (LN-2026-...), Collateral Tag (COL-...), Customer Name, National ID, Phone, or Serial Number..."
          className="w-full pl-10 pr-4 py-2.5 glass-input rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-[#0ABAB5]"
        />
      </div>

      {/* Split Grid: Loan List on Left, Active Detail Drawer on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Table / List */}
        <div className="lg:col-span-6 space-y-3">
          <div className="glass-panel rounded-2xl overflow-hidden border border-white/10 divide-y divide-white/5 max-h-[720px] overflow-y-auto">
            {filteredLoans.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No Rehani loans matching current filter.
              </div>
            ) : (
              filteredLoans.map((l) => {
                const isSelected = l.id === selectedLoanId;
                const cust = customers.find((c) => c.id === l.customer_id);
                const col = collaterals.find((c) => c.id === l.collateral_id);
                const isOverdue = l.status === 'OVERDUE' || l.status === 'DEFAULT_ENFORCEMENT';

                return (
                  <div
                    key={l.id}
                    onClick={() => setSelectedLoanId(l.id)}
                    className={`p-4 cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-[#0ABAB5]/15 border-l-4 border-[#0ABAB5]'
                        : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#0ABAB5] text-xs">{l.loan_number}</span>
                        <span className="font-bold text-white text-xs truncate">{cust?.name}</span>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          isOverdue ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                          l.status === 'REDEEMED' ? 'bg-blue-500/20 text-blue-300' :
                          'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          {l.status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-300 truncate">
                        {col ? col.item_name : 'Collateral Item'}
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center gap-2 font-mono">
                        <span>Due: {l.due_date}</span>
                        <span>·</span>
                        <span>Funder: <strong className="text-white">{l.funder}</strong></span>
                        {l.renewals_count > 0 && (
                          <span className="text-amber-400">({l.renewals_count}x Renewed)</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-slate-400">Balance:</div>
                      <div className={`font-mono-numbers font-black text-sm ${
                        l.balance_remaining === 0 ? 'text-emerald-400' : 'text-white'
                      }`}>
                        {formatKES(l.balance_remaining)}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                        Principal: {formatKES(l.principal_amount)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Detail Inspection & Action Drawer */}
        <div className="lg:col-span-6">
          {selectedLoan && selectedLoanCustomer && selectedLoanCollateral ? (
            <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-6">
              {/* Header Box */}
              <div className="flex items-start justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-white font-mono">{selectedLoan.loan_number}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-[#0ABAB5]/15 text-[#0ABAB5] border border-[#0ABAB5]/30">
                      {selectedLoan.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Issued {selectedLoan.issue_date} by Director {selectedLoan.funder}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadPawnTicketPDF(selectedLoan, selectedLoanCustomer, selectedLoanCollateral)}
                    className="px-3 py-1.5 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-extrabold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                    title="Download Official Pawn Ticket / Rehani Agreement"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Pawn Ticket</span>
                  </button>
                </div>
              </div>

              {/* Collateral & Physical Storage Card */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                    Collateral Asset & Storage Vault
                  </span>
                  <span className="font-mono text-[#0ABAB5] font-bold">{selectedLoanCollateral.collateral_number}</span>
                </div>

                <div className="font-bold text-white text-sm">
                  {selectedLoanCollateral.item_name}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Brand / Model:</span>
                    <span className="text-white">{selectedLoanCollateral.brand} {selectedLoanCollateral.model}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Serial / IMEI:</span>
                    <span className="font-mono text-slate-200">{selectedLoanCollateral.serial_number || selectedLoanCollateral.imei_1 || 'N/A'}</span>
                  </div>
                </div>

                {/* Storage Location Badge */}
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs mt-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#0ABAB5]" />
                    <div>
                      <span className="text-slate-400 text-[10px] block">Vault Location:</span>
                      <strong className="text-white font-mono">
                        {selectedLoanCollateral.storage_room} → {selectedLoanCollateral.rack_shelf}
                      </strong>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 bg-black/40 px-2 py-0.5 rounded border border-white/10">
                    Tag: {selectedLoanCollateral.security_tag || 'SEC-ACTIVE'}
                  </span>
                </div>
              </div>

              {/* Customer Info Card */}
              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Pawner / Customer:</div>
                  <div className="font-extrabold text-white text-xs">{selectedLoanCustomer.name}</div>
                  <div className="text-[11px] font-mono text-[#0ABAB5]">{selectedLoanCustomer.phone} · ID: {selectedLoanCustomer.id_number}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const msg = createDueSoonReminderMessage({
                        customerName: selectedLoanCustomer.name,
                        loanNumber: selectedLoan.loan_number,
                        collateralItem: selectedLoanCollateral.item_name,
                        dueDate: selectedLoan.due_date,
                        balanceDue: selectedLoan.balance_remaining
                      });
                      window.open(generateWhatsAppLink(selectedLoanCustomer.phone, msg), '_blank');
                    }}
                    className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl cursor-pointer"
                    title="WhatsApp Customer"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Financial Snapshot */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-black/40 border border-white/10">
                  <span className="text-slate-400 text-[10px] block">Principal Disbursed:</span>
                  <div className="font-mono-numbers font-bold text-white text-sm mt-0.5">
                    {formatKES(selectedLoan.principal_amount)}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-white/10">
                  <span className="text-slate-400 text-[10px] block">Total Amount Due:</span>
                  <div className="font-mono-numbers font-bold text-white text-sm mt-0.5">
                    {formatKES(selectedLoan.total_amount_due)}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-rose-500/20">
                  <span className="text-rose-400 text-[10px] block">Outstanding Balance:</span>
                  <div className="font-mono-numbers font-black text-rose-400 text-sm mt-0.5">
                    {formatKES(selectedLoan.balance_remaining)}
                  </div>
                </div>
              </div>

              {/* Action Buttons: Repayment, Renewal */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => {
                    setRepayAmount(Math.min(5000, selectedLoan.balance_remaining));
                    setIsRepayModalOpen(true);
                  }}
                  disabled={selectedLoan.balance_remaining <= 0}
                  className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-emerald-600/20"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Collect Payment (Partial/Full)</span>
                </button>

                <button
                  onClick={() => setIsRenewModalOpen(true)}
                  disabled={selectedLoan.balance_remaining <= 0}
                  className="py-3 px-4 rounded-2xl bg-[#0ABAB5] hover:bg-[#1FD2CD] disabled:opacity-40 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-[#0ABAB5]/20"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Renew / Extend Loan</span>
                </button>
              </div>

              {/* Immutable Transaction History for this Loan */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px] block">
                  Immutable Payment Ledger ({selectedLoanTransactions.length})
                </span>

                {selectedLoanTransactions.length === 0 ? (
                  <div className="text-xs text-slate-500 italic p-3 text-center bg-black/20 rounded-xl">
                    No repayments recorded yet.
                  </div>
                ) : (
                  <div className="divide-y divide-white/5 rounded-xl border border-white/10 overflow-hidden text-xs bg-black/40">
                    {selectedLoanTransactions.map((tx) => (
                      <div key={tx.id} className="p-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[#0ABAB5]">{tx.receipt_number}</span>
                            <span className="text-white font-semibold">{tx.transaction_type}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {tx.transaction_date} · via {tx.payment_method} {tx.mpesa_reference ? `[${tx.mpesa_reference}]` : ''} · Recv by {tx.received_by}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-mono-numbers font-black text-emerald-400">
                            {formatKES(tx.amount)}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Bal: {formatKES(tx.balance_after)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="glass-panel p-12 rounded-3xl border border-white/10 text-center text-slate-400">
              <Coins className="w-12 h-12 mx-auto mb-3 text-slate-600" />
              <p className="text-sm">Select a loan from the left to view detailed custody, ledger, and renewals.</p>
            </div>
          )}
        </div>
      </div>

      {/* CREATE NEW REHANI LOAN MODAL */}
      {isNewLoanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 overflow-y-auto">
          <div className="w-full max-w-2xl glass-panel border border-white/20 rounded-3xl shadow-2xl p-6 space-y-5 my-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-[#0ABAB5]" />
                <h3 className="font-extrabold text-white text-base">Issue New Rehani Loan & Pawn Ticket</h3>
              </div>
              <button
                onClick={() => setIsNewLoanModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLoanSubmit} className="space-y-4 text-xs">
              {/* Select Customer */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-300">Select Pawner / Customer *</label>
                  {onOpenAddCustomerWithItems && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewLoanModalOpen(false);
                        onOpenAddCustomerWithItems();
                      }}
                      className="text-[10px] text-[#0ABAB5] hover:underline font-bold font-mono cursor-pointer"
                    >
                      + Register New Customer & Item Together
                    </button>
                  )}
                </div>
                <select
                  value={newCustomerId}
                  onChange={(e) => setNewCustomerId(e.target.value)}
                  className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5] cursor-pointer"
                  required
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                      {c.name} (ID: {c.id_number} · Tel: {c.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Collateral */}
              <div>
                <label className="block font-bold text-slate-300 mb-1">Select Pledged Collateral Item *</label>
                <select
                  value={newCollateralId}
                  onChange={(e) => setNewCollateralId(e.target.value)}
                  className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5] cursor-pointer"
                  required
                >
                  {collaterals.map((c) => (
                    <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                      {c.collateral_number} - {c.item_name} ({c.category}) [Mkt Value: KSh {c.market_value}]
                    </option>
                  ))}
                </select>
              </div>

              {/* LTV Safety Limit Inspection Banner */}
              {selectedCollateralForNew && (
                <div className={`p-3.5 rounded-2xl border transition-all ${
                  isLoanAboveLTV
                    ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                    : 'bg-[#0ABAB5]/10 border-[#0ABAB5]/30 text-slate-300'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      {isLoanAboveLTV ? <AlertTriangle className="w-4 h-4 text-rose-400" /> : <CheckCircle2 className="w-4 h-4 text-[#0ABAB5]" />}
                      <span>LTV Valuation & Safe Loan Limit</span>
                    </span>
                    <span className="font-mono text-xs font-bold text-white">
                      Max LTV: {ltvValuation.maxLTVPercent}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span>Collateral Market Value: <strong>{formatKES(selectedCollateralForNew.market_value)}</strong></span>
                    <span>Max Recommended Loan: <strong className="text-emerald-400 font-mono">{formatKES(ltvValuation.maxAllowedLoan)}</strong></span>
                  </div>

                  {isLoanAboveLTV && (
                    <div className="mt-2 text-rose-300 text-[11px] font-bold flex items-center gap-1">
                      ⚠️ WARNING: Loan of {formatKES(newPrincipal)} is above your configured collateral limit ({formatKES(ltvValuation.maxAllowedLoan)}). Requires Director Override.
                    </div>
                  )}
                </div>
              )}

              {/* Principal Amount & Term */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-white mb-1">Principal Loan Disbursed (KES) *</label>
                  <input
                    type="number"
                    min="100"
                    value={newPrincipal}
                    onChange={(e) => setNewPrincipal(Number(e.target.value))}
                    className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono-numbers font-black text-base focus:outline-none focus:border-[#0ABAB5]"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-300">Loan Period (Max 14 Days) *</label>
                    <span className="text-[10px] text-rose-400 font-bold font-mono">Max 2 Weeks</span>
                  </div>
                  <select
                    value={newTermDays}
                    onChange={(e) => setNewTermDays(Math.min(14, Number(e.target.value)))}
                    className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5] cursor-pointer"
                  >
                    <option value="7" className="bg-slate-900">7 Days (1 Week)</option>
                    <option value="14" className="bg-slate-900">14 Days (2 Weeks - Maximum Allowed)</option>
                  </select>
                </div>
              </div>

              {/* Interest Rate & Storage Fees */}
              <div className="grid grid-cols-3 gap-3 p-3.5 bg-black/40 border border-white/10 rounded-2xl">
                <div>
                  <label className="block text-[11px] text-amber-400 mb-1 font-bold">Interest Rate (% per 2 Wks)</label>
                  <input
                    type="number"
                    value={newInterestRate}
                    onChange={(e) => setNewInterestRate(Number(e.target.value))}
                    className="w-full py-2 px-2.5 glass-input rounded-lg text-amber-400 font-mono font-bold text-xs focus:outline-none focus:border-amber-400"
                  />
                  <span className="text-[9px] text-slate-400 mt-0.5 block">Standard: 30%</span>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Storage & Vault Fee (KES)</label>
                  <input
                    type="number"
                    value={newStorageFee}
                    onChange={(e) => setNewStorageFee(Number(e.target.value))}
                    className="w-full py-2 px-2.5 glass-input rounded-lg text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Grace Period (Days)</label>
                  <input
                    type="number"
                    value={newGraceDays}
                    onChange={(e) => setNewGraceDays(Number(e.target.value))}
                    className="w-full py-2 px-2.5 glass-input rounded-lg text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                  />
                </div>
              </div>

              {/* Due Date & Total Due Preview Box */}
              <div className="p-3.5 rounded-2xl bg-black/60 border border-[#0ABAB5]/40 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Calculated Due Date:</div>
                  <div className="font-mono text-rose-400 font-black text-sm">{calculatedDueDate}</div>
                  <div className="text-[10px] text-slate-400">Grace period expires: {calculatedMaturityDate}</div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase">Total to Redeem:</div>
                  <div className="font-mono-numbers font-black text-[#0ABAB5] text-lg">
                    {formatKES(calculatedTotalDue)}
                  </div>
                </div>
              </div>

              {/* Capital Funder (Director Trevor vs Peter) */}
              <div>
                <label className="block font-bold text-white mb-1.5">Capital Disbursed By (Partner) *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewFunder('Trevor')}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      newFunder === 'Trevor'
                        ? 'bg-[#0ABAB5]/20 border-[#0ABAB5] text-white shadow-md'
                        : 'bg-white/5 border-white/10 text-slate-300'
                    }`}
                  >
                    <span className="font-extrabold text-sm block text-[#0ABAB5]">Trevor Mbugua</span>
                    <span className="text-[10px] text-slate-400">Capital Advance by Trevor</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewFunder('Peter')}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      newFunder === 'Peter'
                        ? 'bg-white/20 border-white text-white shadow-md'
                        : 'bg-white/5 border-white/10 text-slate-300'
                    }`}
                  >
                    <span className="font-extrabold text-sm block text-white">Peter Kamau</span>
                    <span className="text-[10px] text-slate-400">Capital Advance by Peter</span>
                  </button>
                </div>
              </div>

              {/* Disbursement Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Disbursement Method</label>
                  <select
                    value={newDisbursementMethod}
                    onChange={(e) => setNewDisbursementMethod(e.target.value as any)}
                    className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5] cursor-pointer"
                  >
                    <option value="M-Pesa" className="bg-slate-900">M-Pesa Disbursal</option>
                    <option value="Cash" className="bg-slate-900">Cash Disbursal</option>
                    <option value="Bank" className="bg-slate-900">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Transaction Reference</label>
                  <input
                    type="text"
                    value={newDisbursementRef}
                    onChange={(e) => setNewDisbursementRef(e.target.value)}
                    placeholder="M-Pesa Code or Receipt Ref"
                    className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsNewLoanModalOpen(false)}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold cursor-pointer border border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-black rounded-xl text-xs cursor-pointer shadow-lg shadow-[#0ABAB5]/20 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Issue Loan & Generate Pawn Ticket</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REPAYMENT MODAL */}
      {isRepayModalOpen && selectedLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4">
          <div className="w-full max-w-md glass-panel border border-white/20 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span>Collect Repayment ({selectedLoan.loan_number})</span>
              </h3>
              <button onClick={() => setIsRepayModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRepaySubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-black/40 border border-white/10 rounded-xl flex items-center justify-between">
                <span className="text-slate-400">Current Balance Remaining:</span>
                <span className="font-mono-numbers font-black text-rose-400 text-sm">
                  {formatKES(selectedLoan.balance_remaining)}
                </span>
              </div>

              <div>
                <label className="block font-bold text-white mb-1">Repayment Amount (KES) *</label>
                <input
                  type="number"
                  min="1"
                  max={selectedLoan.balance_remaining}
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(Number(e.target.value))}
                  className="w-full py-2.5 px-3 glass-input rounded-xl text-emerald-400 font-mono-numbers font-black text-base focus:outline-none focus:border-emerald-400"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['M-Pesa', 'Cash', 'Bank'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setRepayMethod(m)}
                      className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                        repayMethod === m ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-white/5 text-slate-300 border-white/10'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {repayMethod === 'M-Pesa' && (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">M-Pesa Confirmation Code</label>
                  <input
                    type="text"
                    value={repayMpesaRef}
                    onChange={(e) => setRepayMpesaRef(e.target.value.toUpperCase())}
                    className="w-full py-2 px-3 glass-input rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                    required
                  />
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsRepayModalOpen(false)}
                  className="px-4 py-2 bg-white/10 text-white rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md"
                >
                  Record Payment & Issue Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENEWAL / EXTENSION MODAL */}
      {isRenewModalOpen && selectedLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4">
          <div className="w-full max-w-md glass-panel border border-white/20 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-[#0ABAB5]" />
                <span>Renew / Extend Loan ({selectedLoan.loan_number})</span>
              </h3>
              <button onClick={() => setIsRenewModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRenewSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-black/40 border border-white/10 rounded-xl space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Due Date:</span>
                  <span className="font-mono text-white font-bold">{selectedLoan.due_date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Principal Protected:</span>
                  <span className="font-mono text-white">{formatKES(selectedLoan.principal_amount)}</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-300">Extension Period (Max 14 Days) *</label>
                  <span className="text-[10px] text-rose-400 font-bold font-mono">Max 2 Weeks</span>
                </div>
                <select
                  value={renewalPeriodDays}
                  onChange={(e) => {
                    const days = Math.min(14, Number(e.target.value));
                    setRenewalPeriodDays(days);
                    // auto calculate 30% interest fee
                    if (selectedLoan) {
                      const calculatedFee = Math.round(selectedLoan.principal_amount * 0.30);
                      setRenewalFee(calculatedFee);
                    }
                  }}
                  className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5] cursor-pointer"
                >
                  <option value="14" className="bg-slate-900">14 Days (2 Weeks - Maximum Allowed)</option>
                  <option value="7" className="bg-slate-900">7 Days (1 Week Extension)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-white mb-1">Renewal Extension Fee Collected (KES) *</label>
                <input
                  type="number"
                  min="0"
                  value={renewalFee}
                  onChange={(e) => setRenewalFee(Number(e.target.value))}
                  className="w-full py-2.5 px-3 glass-input rounded-xl text-[#0ABAB5] font-mono-numbers font-bold text-sm focus:outline-none focus:border-[#0ABAB5]"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Payment Method</label>
                <select
                  value={renewalMethod}
                  onChange={(e) => setRenewalMethod(e.target.value as any)}
                  className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs cursor-pointer"
                >
                  <option value="M-Pesa" className="bg-slate-900">M-Pesa</option>
                  <option value="Cash" className="bg-slate-900">Cash</option>
                  <option value="Bank" className="bg-slate-900">Bank Transfer</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsRenewModalOpen(false)}
                  className="px-4 py-2 bg-white/10 text-white rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-extrabold rounded-xl text-xs shadow-md"
                >
                  Approve Renewal & Extend Maturity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
