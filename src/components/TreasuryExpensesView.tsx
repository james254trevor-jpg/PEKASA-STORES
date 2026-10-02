import React, { useState } from 'react';
import { sqliteService } from '../db/sqlite';
import { OperatingExpense, TreasuryAccount, STORE_NAME } from '../types';
import { formatKES } from '../utils/numbering';
import { useAuth } from '../context/AuthContext';
import { 
  Wallet, 
  DollarSign, 
  TrendingUp, 
  Receipt, 
  Plus, 
  CreditCard, 
  Building2, 
  CheckCircle2, 
  X, 
  FileText, 
  PieChart, 
  Calendar,
  Lock,
  Layers
} from 'lucide-react';

interface TreasuryExpensesViewProps {
  selectedBranchId: string;
}

export const TreasuryExpensesView: React.FC<TreasuryExpensesViewProps> = ({ selectedBranchId }) => {
  const { currentUser } = useAuth();
  const treasury = sqliteService.getTreasury();
  const expenses = sqliteService.getExpenses();
  const metrics = sqliteService.getDashboardMetrics(selectedBranchId);
  const transactions = sqliteService.getTransactions();
  const sales = sqliteService.getSales();

  // Modal State
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [expCategory, setExpCategory] = useState<OperatingExpense['category']>('Electricity/Tokens');
  const [expDescription, setExpDescription] = useState('');
  const [expAmount, setExpAmount] = useState<number>(3000);
  const [expMethod, setExpMethod] = useState<'M-Pesa' | 'Cash' | 'Bank'>('M-Pesa');
  const [expPaidBy, setExpPaidBy] = useState<'Trevor' | 'Peter' | 'Shop Petty Cash'>('Shop Petty Cash');
  const [expRef, setExpRef] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);

  // Financial Income Computations
  const totalInterestEarned = transactions.reduce((sum, t) => sum + (Number(t.interest_portion) || 0), 0);
  const totalSaleProceeds = sales.reduce((sum, s) => sum + (Number(s.selling_price) || 0), 0);
  const grossIncome = totalInterestEarned + totalSaleProceeds;
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netBusinessProfit = grossIncome - totalExpenses;

  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expDescription.trim() || expAmount <= 0) {
      alert('Please fill in description and amount.');
      return;
    }

    const expId = 'exp-' + Date.now();
    const expCode = sqliteService.getNextSequence('EXP');
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    try {
      sqliteService.run(
        `INSERT INTO operating_expenses (
          id, expense_number, branch_id, category, description, amount,
          payment_method, paid_by, reference_code, approved_by, expense_date, created_at
        ) VALUES (
          :id, :exp_num, :brid, :cat, :desc, :amt,
          :method, :paidby, :ref, :appr, :edate, :now
        )`,
        {
          ':id': expId,
          ':exp_num': expCode,
          ':brid': selectedBranchId === 'ALL' ? 'br-nairobi' : selectedBranchId,
          ':cat': expCategory,
          ':desc': expDescription.trim(),
          ':amt': Number(expAmount),
          ':method': expMethod,
          ':paidby': expPaidBy,
          ':ref': expRef.trim() || null,
          ':appr': currentUser?.full_name || 'Director Trevor',
          ':edate': expDate,
          ':now': nowStr
        }
      );

      sqliteService.logAudit(
        currentUser?.full_name || 'Staff',
        'RECORD_EXPENSE',
        'EXPENSE',
        expId,
        `Recorded expense ${expCode}: ${expCategory} - KES ${expAmount} paid by ${expPaidBy}`
      );

      setIsAddExpenseOpen(false);
      setExpDescription('');
      setExpAmount(0);
      setExpRef('');

      alert(`Expense ${expCode} recorded successfully!`);
    } catch (err: any) {
      alert('Error recording expense: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-5 rounded-3xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-white uppercase">
              Business Treasury, Cash & Operating Expenses
            </h1>
            <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
              Live Cash Position
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Cash drawer in vault, M-Pesa till balance, bank accounts, partner equity, and net profit reconciliation.
          </p>
        </div>

        <button
          onClick={() => setIsAddExpenseOpen(true)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-600/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Record Shop Expense</span>
        </button>
      </div>

      {/* Cash In Business Cards (Prompt: KSh 850,000 total) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="glass-card p-4 rounded-2xl border border-white/10 space-y-1">
          <span className="text-slate-400 text-xs font-semibold flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Cash in Vault (Physical Drawer)</span>
          </span>
          <div className="text-xl sm:text-2xl font-black text-white font-mono-numbers">
            {formatKES(treasury.cash_in_vault)}
          </div>
          <span className="text-[10px] text-slate-400 block">Kasarani Head Office Safe</span>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-white/10 space-y-1">
          <span className="text-slate-400 text-xs font-semibold flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
            <span>M-Pesa Business Till</span>
          </span>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono-numbers">
            {formatKES(treasury.mpesa_till_balance)}
          </div>
          <span className="text-[10px] text-slate-400 block">Active Buy Goods Till</span>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-white/10 space-y-1">
          <span className="text-slate-400 text-xs font-semibold flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#0ABAB5]" />
            <span>Bank Operating Account</span>
          </span>
          <div className="text-xl sm:text-2xl font-black text-[#0ABAB5] font-mono-numbers">
            {formatKES(treasury.bank_balance)}
          </div>
          <span className="text-[10px] text-slate-400 block">Equity Bank Business Account</span>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 space-y-1">
          <span className="text-emerald-300 text-xs font-bold flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Total Liquid Cash in Business</span>
          </span>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono-numbers">
            {formatKES(treasury.cash_in_vault + treasury.mpesa_till_balance + treasury.bank_balance)}
          </div>
          <span className="text-[10px] text-emerald-300 block">Ready for loan disbursements</span>
        </div>
      </div>

      {/* Net Business Profit Statement */}
      <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span>Net Business Profit Calculation (Gross Income - Operating Expenses)</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10">
            <span className="text-slate-400 block text-[11px]">Loan Income (Interest & Fees):</span>
            <div className="text-lg font-black text-white font-mono-numbers mt-1">
              +{formatKES(totalInterestEarned)}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-black/40 border border-white/10">
            <span className="text-slate-400 block text-[11px]">Sale Proceeds (Defaulted Collateral):</span>
            <div className="text-lg font-black text-white font-mono-numbers mt-1">
              +{formatKES(totalSaleProceeds)}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-black/40 border border-rose-500/20">
            <span className="text-rose-400 block text-[11px]">Total Operating Expenses:</span>
            <div className="text-lg font-black text-rose-400 font-mono-numbers mt-1">
              -{formatKES(totalExpenses)}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40">
            <span className="text-emerald-300 font-bold block text-[11px]">Net Business Profit:</span>
            <div className="text-xl font-black text-emerald-400 font-mono-numbers mt-1">
              {formatKES(netBusinessProfit)}
            </div>
          </div>
        </div>
      </div>

      {/* Operating Expenses Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#0ABAB5]" />
            <span>Operating Expense Ledger ({expenses.length})</span>
          </h2>
          <span className="text-xs text-slate-400">Total: {formatKES(totalExpenses)}</span>
        </div>

        <div className="glass-panel rounded-2xl overflow-hidden border border-white/10 divide-y divide-white/5 text-xs">
          {expenses.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              No operating expenses recorded yet.
            </div>
          ) : (
            expenses.map((exp) => (
              <div key={exp.id} className="p-4 hover:bg-white/[0.03] transition-colors flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#0ABAB5]">{exp.expense_number}</span>
                    <span className="font-bold text-white bg-white/5 px-2 py-0.5 rounded border border-white/10">
                      {exp.category}
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">Paid by {exp.paid_by}</span>
                  </div>
                  <div className="text-slate-300 font-medium">
                    {exp.description}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {exp.expense_date} · via {exp.payment_method} {exp.reference_code ? `[${exp.reference_code}]` : ''} · Approved by {exp.approved_by}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-mono-numbers font-black text-rose-400 text-sm">
                    -{formatKES(exp.amount)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RECORD EXPENSE MODAL */}
      {isAddExpenseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 overflow-y-auto">
          <div className="w-full max-w-md glass-panel border border-white/20 rounded-3xl shadow-2xl p-6 space-y-4 my-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <span>Record Operating Expense</span>
              </h3>
              <button onClick={() => setIsAddExpenseOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpenseSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Expense Category *</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value as any)}
                  className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs cursor-pointer focus:outline-none focus:border-[#0ABAB5]"
                >
                  <option value="Electricity/Tokens" className="bg-slate-900">Electricity / KPLC Tokens</option>
                  <option value="Rent" className="bg-slate-900">Shop Rent</option>
                  <option value="Salaries" className="bg-slate-900">Salaries & Casual Wages</option>
                  <option value="Security" className="bg-slate-900">Security Patrol & Guard</option>
                  <option value="Transport" className="bg-slate-900">Transport & Fuel</option>
                  <option value="Repairs & Maintenance" className="bg-slate-900">Repairs & Workshop Tools</option>
                  <option value="Airtime & Internet" className="bg-slate-900">Airtime & Shop Wi-Fi</option>
                  <option value="M-Pesa / Bank Charges" className="bg-slate-900">M-Pesa / Bank Tariff Charges</option>
                  <option value="Shop Supplies" className="bg-slate-900">Shop Supplies & Stationery</option>
                  <option value="Legal & Licensing" className="bg-slate-900">County Licenses & Pawnbrokers Act Fees</option>
                  <option value="Other Expense" className="bg-slate-900">Other Expense</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Expense Description *</label>
                <input
                  type="text"
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  placeholder="e.g. KPLC tokens for Kasarani showroom"
                  className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-white mb-1">Amount (KES) *</label>
                  <input
                    type="number"
                    min="1"
                    value={expAmount}
                    onChange={(e) => setExpAmount(Number(e.target.value))}
                    className="w-full py-2.5 px-3 glass-input rounded-xl text-rose-400 font-mono-numbers font-black text-sm focus:outline-none focus:border-rose-400"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Paid By</label>
                  <select
                    value={expPaidBy}
                    onChange={(e) => setExpPaidBy(e.target.value as any)}
                    className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs cursor-pointer"
                  >
                    <option value="Shop Petty Cash" className="bg-slate-900">Shop Petty Cash</option>
                    <option value="Trevor" className="bg-slate-900">Director Trevor</option>
                    <option value="Peter" className="bg-slate-900">Director Peter</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Payment Method</label>
                  <select
                    value={expMethod}
                    onChange={(e) => setExpMethod(e.target.value as any)}
                    className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs cursor-pointer"
                  >
                    <option value="M-Pesa" className="bg-slate-900">M-Pesa</option>
                    <option value="Cash" className="bg-slate-900">Cash</option>
                    <option value="Bank" className="bg-slate-900">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">M-Pesa / Receipt Ref</label>
                  <input
                    type="text"
                    value={expRef}
                    onChange={(e) => setExpRef(e.target.value)}
                    placeholder="M-Pesa Code"
                    className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddExpenseOpen(false)}
                  className="px-4 py-2 bg-white/10 text-white rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md"
                >
                  Save Expense & Deduct Cash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
