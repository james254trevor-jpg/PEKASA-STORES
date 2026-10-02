import React, { useState } from 'react';
import { sqliteService } from '../db/sqlite';
import { CollateralItem, CollateralSale, RehaniLoan, STORE_NAME, STORE_TEL } from '../types';
import { formatKES } from '../utils/numbering';
import { useAuth } from '../context/AuthContext';
import { 
  Tag, 
  Search, 
  DollarSign, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  User, 
  FileText, 
  Calendar, 
  CreditCard, 
  X, 
  ShoppingBag,
  ArrowRight,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

interface SalesViewProps {
  selectedBranchId: string;
}

export const SalesView: React.FC<SalesViewProps> = ({ selectedBranchId }) => {
  const { currentUser } = useAuth();
  const collaterals = sqliteService.getCollaterals(selectedBranchId);
  const loans = sqliteService.getLoans(selectedBranchId);
  const sales = sqliteService.getSales();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [selectedCollateralForSale, setSelectedCollateralForSale] = useState<CollateralItem | null>(null);

  // Sell Modal State
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('+254 ');
  const [buyerIdNumber, setBuyerIdNumber] = useState('');
  const [sellingPrice, setSellingPrice] = useState<number>(30000);
  const [salePaymentMethod, setSalePaymentMethod] = useState<'M-Pesa' | 'Cash' | 'Bank'>('M-Pesa');
  const [salePaymentRef, setSalePaymentRef] = useState('QHK' + Math.floor(1000000 + Math.random() * 9000000));
  const [authorizedBy, setAuthorizedBy] = useState<'Trevor' | 'Peter'>(
    currentUser?.username?.toLowerCase() === 'peter' ? 'Peter' : 'Trevor'
  );
  const [dispositionReason, setDispositionReason] = useState('Defaulted beyond statutory grace period, notices served');
  const [saleNotes, setSaleNotes] = useState('');

  // Items currently available for sale
  const itemsForSale = collaterals.filter((c) => c.status === 'Available for Sale');
  
  // Overdue items that can be cleared for sale
  const overdueEligible = loans.filter((l) => {
    if (l.status !== 'OVERDUE' && l.status !== 'DEFAULT_ENFORCEMENT') return false;
    const col = collaterals.find((c) => c.id === l.collateral_id);
    return col && col.status !== 'Available for Sale' && col.status !== 'Sold';
  });

  const matchingLoanForSelected = selectedCollateralForSale
    ? loans.find((l) => l.collateral_id === selectedCollateralForSale.id)
    : null;

  const outstandingLoanBalance = matchingLoanForSelected ? matchingLoanForSelected.balance_remaining : 0;
  const netProfitOrLoss = sellingPrice - outstandingLoanBalance;

  // Clear overdue item for sale (Kenyan Pawnbrokers Act Workflow)
  const handleAuthorizeForSale = (colId: string) => {
    const col = collaterals.find((c) => c.id === colId);
    if (!col) return;

    if (!confirm(`Authorize collateral ${col.collateral_number} (${col.item_name}) for sale? Please confirm that legal notice and grace period have expired.`)) {
      return;
    }

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    sqliteService.run(
      `UPDATE collateral_items SET status = 'Available for Sale', updated_at = :now WHERE id = :id`,
      { ':now': nowStr, ':id': colId }
    );

    sqliteService.logAudit(
      currentUser?.full_name || 'Director',
      'AUTHORIZE_FORFEITURE_SALE',
      'COLLATERAL',
      colId,
      `Cleared defaulted collateral ${col.collateral_number} for public sale`
    );

    alert(`Item ${col.collateral_number} is now legitimately available for sale in the showroom.`);
  };

  const handleOpenSellModal = (item: CollateralItem) => {
    setSelectedCollateralForSale(item);
    const mLoan = loans.find((l) => l.collateral_id === item.id);
    const est = item.estimated_resale_value || Math.round(item.market_value * 0.85);
    setSellingPrice(est);
    setIsSellModalOpen(true);
  };

  const handleConfirmSaleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCollateralForSale || !buyerName.trim() || sellingPrice <= 0) {
      alert('Please fill in buyer name and selling price.');
      return;
    }

    const saleId = 'sal-' + Date.now();
    const saleCode = sqliteService.getNextSequence('SAL');
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const today = new Date().toISOString().split('T')[0];

    try {
      // 1. Record Sale
      sqliteService.run(
        `INSERT INTO collateral_sales (
          id, sale_number, collateral_id, loan_id, customer_id, branch_id,
          original_market_value, outstanding_loan_balance, selling_price, profit_or_loss,
          buyer_name, buyer_phone, buyer_id_number, payment_method, payment_reference,
          authorized_by, disposition_reason, sale_date, notes
        ) VALUES (
          :id, :sal_num, :cid, :lid, :custid, :brid,
          :mkt, :bal, :sell_pr, :p_l,
          :bname, :bphone, :bid, :method, :ref,
          :auth, :reason, :sdate, :notes
        )`,
        {
          ':id': saleId,
          ':sal_num': saleCode,
          ':cid': selectedCollateralForSale.id,
          ':lid': matchingLoanForSelected?.id || 'N/A',
          ':custid': selectedCollateralForSale.customer_id,
          ':brid': selectedCollateralForSale.branch_id,
          ':mkt': selectedCollateralForSale.market_value,
          ':bal': outstandingLoanBalance,
          ':sell_pr': Number(sellingPrice),
          ':p_l': netProfitOrLoss,
          ':bname': buyerName.trim(),
          ':bphone': buyerPhone.trim(),
          ':bid': buyerIdNumber.trim() || null,
          ':method': salePaymentMethod,
          ':ref': salePaymentRef.trim() || null,
          ':auth': `Director ${authorizedBy}`,
          ':reason': dispositionReason,
          ':sdate': today,
          ':notes': saleNotes
        }
      );

      // 2. Update Collateral status to Sold
      sqliteService.run(
        `UPDATE collateral_items SET status = 'Sold', updated_at = :now WHERE id = :id`,
        { ':now': nowStr, ':id': selectedCollateralForSale.id }
      );

      // 3. Update Loan status to SOLD if applicable
      if (matchingLoanForSelected) {
        sqliteService.run(
          `UPDATE rehani_loans SET status = 'SOLD', updated_at = :now WHERE id = :id`,
          { ':now': nowStr, ':id': matchingLoanForSelected.id }
        );
      }

      // 4. Record in Immutable Ledger
      const txnCode = sqliteService.getNextSequence('TXN');
      const rctCode = sqliteService.getNextSequence('RCT');
      sqliteService.run(
        `INSERT INTO ledger_transactions (
          id, transaction_number, receipt_number, loan_id, collateral_id, customer_id, branch_id,
          transaction_type, amount, principal_portion, interest_portion, balance_after,
          payment_method, mpesa_reference, received_by, notes, transaction_date, created_at
        ) VALUES (
          :id, :txn, :rct, :lid, :cid, :custid, :brid,
          'COLLATERAL_SALE', :amt, :amt, 0, 0,
          :method, :ref, :recv, :notes, :tdate, :now
        )`,
        {
          ':id': 'txn-' + Date.now(),
          ':txn': txnCode,
          ':rct': rctCode,
          ':lid': matchingLoanForSelected?.id || null,
          ':cid': selectedCollateralForSale.id,
          ':custid': selectedCollateralForSale.customer_id,
          ':brid': selectedCollateralForSale.branch_id,
          ':amt': Number(sellingPrice),
          ':method': salePaymentMethod,
          ':ref': salePaymentRef,
          ':recv': `Director ${authorizedBy}`,
          ':notes': `Sale of defaulted collateral ${selectedCollateralForSale.collateral_number} to ${buyerName}`,
          ':tdate': today,
          ':now': nowStr
        }
      );

      sqliteService.logAudit(
        authorizedBy,
        'DISPOSE_COLLATERAL_SALE',
        'COLLATERAL',
        selectedCollateralForSale.id,
        `Sold defaulted collateral ${selectedCollateralForSale.collateral_number} to ${buyerName} for KES ${sellingPrice}. Net profit/loss: KES ${netProfitOrLoss}`
      );

      setIsSellModalOpen(false);
      setBuyerName('');
      setBuyerPhone('+254 ');
      setBuyerIdNumber('');

      alert(`Collateral ${selectedCollateralForSale.collateral_number} sold successfully (${saleCode})! Recorded in sales ledger.`);
    } catch (err: any) {
      alert('Error recording sale: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="glass-panel p-5 rounded-3xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-white uppercase">
              Collateral Sales & Legal Disposition
            </h1>
            <span className="text-[11px] font-mono font-bold text-purple-400 bg-purple-500/10 border border-purple-500/30 px-2.5 py-0.5 rounded-full">
              {itemsForSale.length} Available in Showroom
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Kenyan Pawnbrokers Act compliant workflow: statutory notices, grace period verification, director authorization, and sales reconciliation.
          </p>
        </div>
      </div>

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Items Available for Sale */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-purple-400 flex items-center gap-2">
              <Tag className="w-4 h-4 text-purple-400" />
              <span>Showroom Inventory · Ready for Sale ({itemsForSale.length})</span>
            </h2>
            <span className="text-[10px] font-mono text-slate-400">Cleared for Sale</span>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden border border-purple-500/20 divide-y divide-white/5">
            {itemsForSale.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No defaulted collateral currently cleared for sale.
              </div>
            ) : (
              itemsForSale.map((item) => (
                <div key={item.id} className="p-4 hover:bg-white/[0.03] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-purple-400 text-xs">{item.collateral_number}</span>
                      <span className="font-bold text-white text-xs truncate">{item.item_name}</span>
                    </div>

                    <div className="text-xs text-slate-300">
                      Brand: <strong className="text-white">{item.brand} {item.model}</strong> · Category: {item.category}
                    </div>

                    <div className="text-[10px] text-slate-400 font-mono">
                      Location: {item.storage_room} → {item.rack_shelf}
                    </div>

                    <div className="text-xs text-slate-300 pt-1">
                      Original Valuation: {formatKES(item.market_value)}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400">Target Resale:</div>
                      <div className="font-mono-numbers font-black text-purple-400 text-base">
                        {formatKES(item.estimated_resale_value || Math.round(item.market_value * 0.85))}
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenSellModal(item)}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-purple-600/20"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>Sell to Buyer</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Past Sales History */}
          <div className="space-y-3 pt-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Completed Collateral Dispositions ({sales.length})</span>
            </h3>

            <div className="glass-panel rounded-2xl overflow-hidden border border-white/10 divide-y divide-white/5 text-xs">
              {sales.length === 0 ? (
                <div className="p-6 text-center text-slate-500 italic">
                  No completed collateral sales recorded yet.
                </div>
              ) : (
                sales.map((s) => (
                  <div key={s.id} className="p-3.5 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-purple-400">{s.sale_number}</span>
                        <span className="text-white font-bold">{s.buyer_name}</span>
                        <span className="text-slate-400 font-mono text-[10px]">({s.buyer_phone})</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Sold {s.sale_date} · Authorized by {s.authorized_by} · via {s.payment_method}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono-numbers font-black text-white text-sm">
                        {formatKES(s.selling_price)}
                      </div>
                      <div className={`text-[10px] font-mono font-bold flex items-center justify-end gap-1 ${
                        s.profit_or_loss >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {s.profit_or_loss >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        <span>{s.profit_or_loss >= 0 ? '+' : ''}{formatKES(s.profit_or_loss)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Overdue Items Eligible for Legal Disposition Clearance */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Overdue Items Pending Disposition ({overdueEligible.length})</span>
            </h2>
            <span className="text-[10px] font-mono text-rose-400">Legal Stage</span>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden border border-rose-500/20 divide-y divide-white/5 text-xs">
            {overdueEligible.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                No defaulted loans currently pending legal clearance.
              </div>
            ) : (
              overdueEligible.map((l) => {
                const col = collaterals.find((c) => c.id === l.collateral_id);
                if (!col) return null;
                return (
                  <div key={l.id} className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-rose-400">{l.loan_number}</span>
                      <span className="font-mono text-slate-400 text-[10px]">Due: {l.due_date}</span>
                    </div>

                    <div className="font-bold text-white">
                      {col.item_name}
                    </div>

                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span>Debt: <strong className="text-rose-400">{formatKES(l.balance_remaining)}</strong></span>
                      <span>Valuation: <strong>{formatKES(col.market_value)}</strong></span>
                    </div>

                    <button
                      onClick={() => handleAuthorizeForSale(col.id)}
                      className="w-full py-1.5 px-3 bg-purple-600/80 hover:bg-purple-500 text-white font-bold rounded-lg text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Verify Notices & Clear for Showroom Sale</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* SELL TO BUYER MODAL */}
      {isSellModalOpen && selectedCollateralForSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 overflow-y-auto">
          <div className="w-full max-w-lg glass-panel border border-white/20 rounded-3xl shadow-2xl p-6 space-y-5 my-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-purple-400" />
                <h3 className="font-extrabold text-white text-base">Record Sale of Collateral</h3>
              </div>
              <button onClick={() => setIsSellModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmSaleSubmit} className="space-y-4 text-xs">
              <div className="p-3.5 bg-black/40 border border-white/10 rounded-2xl space-y-1">
                <div className="font-bold text-white text-sm">{selectedCollateralForSale.item_name}</div>
                <div className="text-slate-400 text-[11px]">Pawn Tag: {selectedCollateralForSale.collateral_number}</div>
                <div className="flex items-center justify-between pt-1 border-t border-white/10 text-xs">
                  <span>Outstanding Loan Debt: <strong>{formatKES(outstandingLoanBalance)}</strong></span>
                  <span>Est. Market Value: <strong>{formatKES(selectedCollateralForSale.market_value)}</strong></span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-white mb-1">Buyer Full Name *</label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="e.g. Mary Wanjiku"
                  className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Buyer Phone *</label>
                  <input
                    type="text"
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    placeholder="+254 7..."
                    className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Buyer National ID (Optional)</label>
                  <input
                    type="text"
                    value={buyerIdNumber}
                    onChange={(e) => setBuyerIdNumber(e.target.value)}
                    placeholder="e.g. 24119830"
                    className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                  />
                </div>
              </div>

              {/* Selling Price & Net Profit */}
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-black/40 border border-white/10 rounded-2xl">
                <div>
                  <label className="block font-bold text-white mb-1">Agreed Selling Price (KES) *</label>
                  <input
                    type="number"
                    min="1"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(Number(e.target.value))}
                    className="w-full py-2.5 px-3 glass-input rounded-xl text-purple-400 font-mono-numbers font-black text-base focus:outline-none focus:border-purple-400"
                    required
                  />
                </div>

                <div className="flex flex-col justify-center">
                  <span className="text-[10px] text-slate-400 block">Net Profit / Loss Against Debt:</span>
                  <div className={`font-mono-numbers font-black text-base ${
                    netProfitOrLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {netProfitOrLoss >= 0 ? '+' : ''}{formatKES(netProfitOrLoss)}
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Payment Method</label>
                  <select
                    value={salePaymentMethod}
                    onChange={(e) => setSalePaymentMethod(e.target.value as any)}
                    className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs cursor-pointer"
                  >
                    <option value="M-Pesa" className="bg-slate-900">M-Pesa</option>
                    <option value="Cash" className="bg-slate-900">Cash</option>
                    <option value="Bank" className="bg-slate-900">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Payment Reference</label>
                  <input
                    type="text"
                    value={salePaymentRef}
                    onChange={(e) => setSalePaymentRef(e.target.value)}
                    placeholder="M-Pesa code"
                    className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono text-xs"
                  />
                </div>
              </div>

              {/* Director Authorization */}
              <div>
                <label className="block font-bold text-white mb-1">Director Authorizing Sale *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAuthorizedBy('Trevor')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                      authorizedBy === 'Trevor' ? 'bg-[#0ABAB5] text-black border-[#0ABAB5]' : 'bg-white/5 text-slate-300 border-white/10'
                    }`}
                  >
                    Director Trevor Mbugua
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuthorizedBy('Peter')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                      authorizedBy === 'Peter' ? 'bg-white text-black border-white' : 'bg-white/5 text-slate-300 border-white/10'
                    }`}
                  >
                    Director Peter Kamau
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsSellModalOpen(false)}
                  className="px-4 py-2 bg-white/10 text-white rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl text-xs shadow-md"
                >
                  Confirm Sale & Complete Disposal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
