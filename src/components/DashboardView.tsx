import React, { useState } from 'react';
import { sqliteService } from '../db/sqlite';
import { RehaniLoan, CollateralItem, Customer, STORE_NAME, STORE_TEL } from '../types';
import { formatKES } from '../utils/numbering';
import { generateWhatsAppLink, createOverdueNoticeMessage, createDueSoonReminderMessage } from '../utils/messaging';
import { 
  Coins, 
  Wallet, 
  Package, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  CreditCard, 
  TrendingUp, 
  Tag, 
  Users, 
  BarChart3, 
  ShieldAlert, 
  Plus, 
  PhoneCall, 
  MessageSquare, 
  ArrowUpRight, 
  FileText, 
  MapPin, 
  Building2, 
  Filter, 
  RefreshCw,
  Eye,
  AlertTriangle
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
  onOpenNewLoan: () => void;
  onOpenNewCollateral: () => void;
  onOpenNewPayment: () => void;
  onOpenAddCustomerWithItems?: () => void;
  onSelectLoan?: (loanId: string) => void;
  onSelectCustomer?: (customerId: string) => void;
  selectedBranchId: string;
  onBranchChange: (branchId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenNewLoan,
  onOpenNewCollateral,
  onOpenNewPayment,
  onOpenAddCustomerWithItems,
  onSelectLoan,
  onSelectCustomer,
  selectedBranchId,
  onBranchChange
}) => {
  const branches = sqliteService.getBranches();
  const metrics = sqliteService.getDashboardMetrics(selectedBranchId);
  const loans = sqliteService.getLoans(selectedBranchId);
  const customers = sqliteService.getCustomers();
  const collaterals = sqliteService.getCollaterals(selectedBranchId);

  // Filter overdue and approaching loans
  const overdueLoans = loans.filter((l) => l.status === 'OVERDUE' || l.status === 'DEFAULT_ENFORCEMENT');
  const approachingLoans = loans.filter((l) => {
    if (l.status === 'REDEEMED' || l.status === 'SOLD') return false;
    const nowTime = new Date().getTime();
    const dueTime = new Date(l.due_date).getTime();
    const diffDays = Math.ceil((dueTime - nowTime) / (1000 * 3600 * 24));
    return diffDays >= 0 && diffDays <= 7;
  });

  const handleSendOverdueWhatsApp = (loan: RehaniLoan) => {
    const cust = customers.find((c) => c.id === loan.customer_id);
    const col = collaterals.find((c) => c.id === loan.collateral_id);
    if (!cust) return;

    const msg = createOverdueNoticeMessage({
      customerName: cust.name,
      loanNumber: loan.loan_number,
      collateralItem: col ? col.item_name : 'Pledged Goods',
      maturityDate: loan.maturity_date,
      balanceDue: loan.balance_remaining
    });

    window.open(generateWhatsAppLink(cust.phone, msg), '_blank');
  };

  const handleSendApproachingWhatsApp = (loan: RehaniLoan) => {
    const cust = customers.find((c) => c.id === loan.customer_id);
    const col = collaterals.find((c) => c.id === loan.collateral_id);
    if (!cust) return;

    const msg = createDueSoonReminderMessage({
      customerName: cust.name,
      loanNumber: loan.loan_number,
      collateralItem: col ? col.item_name : 'Collateral Item',
      dueDate: loan.due_date,
      balanceDue: loan.balance_remaining
    });

    window.open(generateWhatsAppLink(cust.phone, msg), '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Store Status, Multi-Branch Selector & Quick Action Buttons */}
      <div className="glass-panel p-5 rounded-3xl border border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-white uppercase">
              {STORE_NAME} · Rehani Command Center
            </h1>
            <span className="text-[11px] font-mono font-bold text-[#0ABAB5] bg-[#0ABAB5]/10 border border-[#0ABAB5]/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0ABAB5] animate-pulse" />
              <span>Kenyan Pawnbrokers Standard</span>
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Real-time collateral vault, loan maturity schedules, immutable ledger, and legal disposition tracking.
          </p>
        </div>

        {/* Branch Filter & Primary Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 bg-black/40 border border-white/15 rounded-xl px-2.5 py-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#0ABAB5]" />
            <select
              value={selectedBranchId}
              onChange={(e) => onBranchChange(e.target.value)}
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-white">All Branches Combined</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                  {b.name} ({b.city})
                </option>
              ))}
            </select>
          </div>

          {onOpenAddCustomerWithItems && (
            <button
              onClick={onOpenAddCustomerWithItems}
              className="px-4 py-2 bg-gradient-to-r from-[#0ABAB5] to-[#1FD2CD] hover:brightness-110 text-black font-black rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-[#0ABAB5]/25"
              title="Register Customer, Collateral Vault Item & Issue 2-Week Rehani Loan in One Screen"
            >
              <Users className="w-4 h-4 text-black" />
              <span>+ Add Customer & Item</span>
            </button>
          )}

          <button
            onClick={onOpenNewLoan}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/15 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#0ABAB5]" />
            <span>New Rehani Loan</span>
          </button>

          <button
            onClick={onOpenNewCollateral}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/15 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Package className="w-4 h-4 text-[#0ABAB5]" />
            <span>Intake Collateral</span>
          </button>

          <button
            onClick={onOpenNewPayment}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/15 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <span>Repayment</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Figures (Requested Exact 12 Key Metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
        {/* Metric 1: Cash currently issued as loans */}
        <div className="glass-card p-4 rounded-2xl border border-white/10 relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-semibold flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>Outstanding Loans</span>
            </span>
            <span className="text-[10px] text-amber-400 font-mono font-bold">Issued</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono-numbers">
            {formatKES(metrics.outstandingLoans)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Principal: <strong className="text-slate-200">{formatKES(metrics.totalOutstandingPrincipal)}</strong>
          </div>
        </div>

        {/* Metric 2: Cash available in the business */}
        <div className="glass-card p-4 rounded-2xl border border-white/10 relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-semibold flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cash in Business</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-mono font-bold">Liquid</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono-numbers">
            {formatKES(metrics.cashInBusiness)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Vault, Till & Bank Balances
          </div>
        </div>

        {/* Metric 3: Total collateral currently held */}
        <div 
          onClick={() => onNavigate('collateral')}
          className="glass-card p-4 rounded-2xl border border-white/10 relative overflow-hidden group cursor-pointer hover:border-[#0ABAB5]/40 transition-all"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-semibold flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-[#0ABAB5]" />
              <span>Collateral Held</span>
            </span>
            <span className="text-[10px] text-[#0ABAB5] font-mono font-bold">In Custody</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono-numbers">
            {metrics.collateralHeldCount} <span className="text-xs font-normal text-slate-400">items</span>
          </div>
          <div className="text-[11px] text-[#0ABAB5] mt-1 flex items-center gap-1 group-hover:underline">
            <span>View Storage Vault</span>
            <ArrowUpRight className="w-3 h-3" />
          </div>
        </div>

        {/* Metric 4: Overdue loans */}
        <div 
          onClick={() => onNavigate('loans')}
          className="glass-card p-4 rounded-2xl border border-rose-500/20 bg-rose-950/10 relative overflow-hidden group cursor-pointer hover:border-rose-500/40 transition-all"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-semibold flex items-center gap-1.5 text-rose-300">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Overdue Loans</span>
            </span>
            <span className="text-[10px] text-rose-400 font-mono font-bold">Action Needed</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-400 font-mono-numbers">
            {metrics.overdueLoansCount} <span className="text-xs font-normal text-rose-300">loans</span>
          </div>
          <div className="text-[11px] text-rose-300 mt-1 flex items-center gap-1">
            <span>Maturity date passed</span>
          </div>
        </div>

        {/* Metric 5: Loans approaching maturity */}
        <div 
          onClick={() => onNavigate('loans')}
          className="glass-card p-4 rounded-2xl border border-amber-500/20 relative overflow-hidden group cursor-pointer hover:border-amber-500/40 transition-all"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-semibold flex items-center gap-1.5 text-amber-300">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Due Soon (&lt; 7 Days)</span>
            </span>
            <span className="text-[10px] text-amber-400 font-mono font-bold">Notice Ready</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono-numbers">
            {metrics.approachingMaturityCount} <span className="text-xs font-normal text-amber-300">loans</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Approaching maturity deadline
          </div>
        </div>

        {/* Metric 6: Active loans */}
        <div 
          onClick={() => onNavigate('loans')}
          className="glass-card p-4 rounded-2xl border border-white/10 relative overflow-hidden group cursor-pointer hover:border-emerald-500/40 transition-all"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-semibold flex items-center gap-1.5 text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Active Loans</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-mono font-bold">Good Standing</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono-numbers">
            {metrics.activeLoansCount} <span className="text-xs font-normal text-slate-400">contracts</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Within contractual period
          </div>
        </div>

        {/* Metric 7: Today's collections */}
        <div 
          onClick={() => onNavigate('payments')}
          className="glass-card p-4 rounded-2xl border border-white/10 relative overflow-hidden group cursor-pointer hover:border-[#0ABAB5]/40 transition-all"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-semibold flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-[#0ABAB5]" />
              <span>Today's Collections</span>
            </span>
            <span className="text-[10px] text-[#0ABAB5] font-mono font-bold">Receipted</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono-numbers">
            {formatKES(metrics.todaysCollections)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Cash & M-Pesa Counter Intake
          </div>
        </div>

        {/* Metric 8: Today's profit */}
        <div className="glass-card p-4 rounded-2xl border border-white/10 relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-semibold flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Today's Net Profit</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-mono font-bold">Interest - Exp</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono-numbers">
            {formatKES(metrics.todaysProfit)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Interest & Fees minus expenses
          </div>
        </div>

        {/* Metric 9: Items currently available for sale */}
        <div 
          onClick={() => onNavigate('sales')}
          className="glass-card p-4 rounded-2xl border border-purple-500/20 bg-purple-950/10 relative overflow-hidden group cursor-pointer hover:border-purple-500/40 transition-all"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-semibold flex items-center gap-1.5 text-purple-300">
              <Tag className="w-3.5 h-3.5 text-purple-400" />
              <span>Available for Sale</span>
            </span>
            <span className="text-[10px] text-purple-400 font-mono font-bold">Disposal</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-purple-400 font-mono-numbers">
            {metrics.itemsForSaleCount} <span className="text-xs font-normal text-purple-300">items</span>
          </div>
          <div className="text-[11px] text-purple-300 mt-1 flex items-center gap-1">
            <span>Cleared for sale by Director</span>
          </div>
        </div>

        {/* Metric 10: Total customers */}
        <div 
          onClick={() => onNavigate('customers')}
          className="glass-card p-4 rounded-2xl border border-white/10 relative overflow-hidden group cursor-pointer hover:border-[#0ABAB5]/40 transition-all"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-semibold flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#0ABAB5]" />
              <span>Total Customers</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Registry</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono-numbers">
            {metrics.totalCustomersCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Permanent client profiles
          </div>
        </div>

        {/* Metric 11: Total outstanding principal */}
        <div className="glass-card p-4 rounded-2xl border border-white/10 relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-semibold flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-[#0ABAB5]" />
              <span>Outstanding Principal</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Pure Capital</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono-numbers">
            {formatKES(metrics.totalOutstandingPrincipal)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Excludes accrued interest
          </div>
        </div>

        {/* Metric 12: High-risk / overdue customers */}
        <div 
          onClick={() => onNavigate('customers')}
          className="glass-card p-4 rounded-2xl border border-rose-500/20 relative overflow-hidden group cursor-pointer hover:border-rose-500/40 transition-all"
        >
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-semibold flex items-center gap-1.5 text-rose-300">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>High-Risk / Watchlist</span>
            </span>
            <span className="text-[10px] text-rose-400 font-mono font-bold">Risk Hub</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-400 font-mono-numbers">
            {metrics.highRiskCustomersCount} <span className="text-xs font-normal text-rose-300">clients</span>
          </div>
          <div className="text-[11px] text-rose-300 mt-1">
            Repeat defaults or overdue
          </div>
        </div>
      </div>

      {/* Two Column Section: Action Table for Overdue Loans & Maturity Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Overdue Loans Requiring Immediate Enforcement */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>Overdue Loans Requiring Follow-up ({overdueLoans.length})</span>
            </h2>
            <button
              onClick={() => onNavigate('loans')}
              className="text-xs text-rose-400 hover:underline flex items-center gap-1 cursor-pointer font-bold"
            >
              <span>View All Overdue</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden border border-rose-500/20 divide-y divide-white/5">
            {overdueLoans.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                ✓ Excellent! No loans currently overdue.
              </div>
            ) : (
              overdueLoans.map((l) => {
                const cust = customers.find((c) => c.id === l.customer_id);
                const col = collaterals.find((c) => c.id === l.collateral_id);
                return (
                  <div key={l.id} className="p-4 hover:bg-white/[0.03] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-rose-400 text-xs">{l.loan_number}</span>
                        <span className="text-white font-bold text-xs">{cust?.name || 'Customer'}</span>
                        <span className="font-mono text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                          ID: {cust?.id_number}
                        </span>
                      </div>

                      <div className="text-xs text-slate-300 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-slate-400" />
                        <span>{col ? col.item_name : 'Collateral'}</span>
                        <span className="text-[10px] text-slate-400">({col?.rack_shelf})</span>
                      </div>

                      <div className="text-[11px] text-rose-400 flex items-center gap-2 font-mono">
                        <span>Due Date: {l.due_date}</span>
                        <span>·</span>
                        <span>Grace Expires: {l.maturity_date}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <div className="text-right mr-2">
                        <div className="text-[10px] text-slate-400">Balance Due:</div>
                        <div className="font-mono-numbers font-black text-rose-400 text-sm">
                          {formatKES(l.balance_remaining)}
                        </div>
                      </div>

                      <button
                        onClick={() => handleSendOverdueWhatsApp(l)}
                        className="p-2 bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-xl cursor-pointer transition-all shadow-md"
                        title="Send Overdue Notice via WhatsApp"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>

                      {cust?.phone && (
                        <a
                          href={`tel:${cust.phone}`}
                          className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl cursor-pointer transition-all border border-white/15"
                          title="Call Customer"
                        >
                          <PhoneCall className="w-4 h-4 text-[#0ABAB5]" />
                        </a>
                      )}

                      <button
                        onClick={() => onSelectLoan?.(l.id)}
                        className="px-2.5 py-1.5 bg-[#0ABAB5]/15 hover:bg-[#0ABAB5]/30 text-[#0ABAB5] border border-[#0ABAB5]/30 rounded-xl text-xs font-bold cursor-pointer transition-all"
                      >
                        Process
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Loans Approaching Maturity (< 7 Days) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Approaching Maturity ({approachingLoans.length})</span>
            </h2>
            <span className="text-[11px] font-mono text-amber-400">Notice Window</span>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden border border-amber-500/20 divide-y divide-white/5">
            {approachingLoans.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No active loans reaching maturity within 7 days.
              </div>
            ) : (
              approachingLoans.map((l) => {
                const cust = customers.find((c) => c.id === l.customer_id);
                const col = collaterals.find((c) => c.id === l.collateral_id);
                const nowTime = new Date().getTime();
                const dueTime = new Date(l.due_date).getTime();
                const diffDays = Math.ceil((dueTime - nowTime) / (1000 * 3600 * 24));

                return (
                  <div key={l.id} className="p-3.5 hover:bg-white/[0.03] transition-colors flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-400 text-xs">{l.loan_number}</span>
                        <span className="text-white font-bold text-xs truncate">{cust?.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-300 truncate">
                        {col ? col.item_name : 'Collateral Item'}
                      </div>
                      <div className="text-[10px] text-amber-300 font-mono mt-0.5">
                        Due in {diffDays} day{diffDays === 1 ? '' : 's'} ({l.due_date})
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="font-mono-numbers font-bold text-white text-xs">
                          {formatKES(l.balance_remaining)}
                        </div>
                      </div>

                      <button
                        onClick={() => handleSendApproachingWhatsApp(l)}
                        className="p-1.5 bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-lg cursor-pointer"
                        title="Send Due Reminder"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
