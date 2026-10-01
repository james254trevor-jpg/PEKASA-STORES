import React, { useState } from 'react';
import { sqliteService } from '../db/sqlite';
import { Appliance, Customer, Payment, Part, STORE_NAME, STORE_MOTTO } from '../types';
import { formatKES } from '../utils/numbering';
import { createDueReminderMessage, generateWhatsAppLink } from '../utils/messaging';
import { 
  Tv, 
  Coins, 
  Calendar, 
  AlertTriangle, 
  ArrowUpRight, 
  Plus, 
  PhoneCall, 
  MessageSquare, 
  Clock, 
  Users, 
  Wrench,
  Package,
  Layers,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  UserCheck
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
  onOpenNewAppliance: () => void;
  onOpenNewPayment: () => void;
  onSelectAppliance: (applianceId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenNewAppliance,
  onOpenNewPayment,
  onSelectAppliance
}) => {
  const appliances = sqliteService.getAppliances();
  const customers = sqliteService.getCustomers();
  const payments = sqliteService.getPayments();
  const parts = sqliteService.getParts();

  const [funderFilter, setFunderFilter] = useState<'ALL' | 'Trevor' | 'Peter'>('ALL');

  // Metrics computation
  const activeAppliances = appliances.filter(
    (a) => a.status === 'Active Collateral / Pawn' || a.status === 'In Repair' || a.status === 'Under Evaluation'
  );

  const totalDisbursed = appliances.reduce((acc, a) => acc + (Number(a.amount_received) || 0), 0);
  const totalRepayments = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  // Partner split: Trevor vs Peter
  const trevorDisbursed = appliances
    .filter((a) => a.funder === 'Trevor')
    .reduce((acc, a) => acc + (Number(a.amount_received) || 0), 0);

  const peterDisbursed = appliances
    .filter((a) => a.funder === 'Peter')
    .reduce((acc, a) => acc + (Number(a.amount_received) || 0), 0);

  const trevorCollections = payments
    .filter((p) => p.received_by === 'Trevor')
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  const peterCollections = payments
    .filter((p) => p.received_by === 'Peter')
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  // Calculate total outstanding balance
  let totalOutstanding = 0;
  appliances.forEach((app) => {
    if (app.status !== 'Redeemed' && app.status !== 'Sold') {
      const { balanceRemaining } = sqliteService.calculateApplianceBalance(app);
      totalOutstanding += balanceRemaining;
    }
  });

  // Low stock parts
  const lowStockParts = parts.filter((p) => p.quantity <= p.reorder_level);

  // Due date radar: appliances due soon or overdue (past 14 days)
  const today = new Date().toISOString().split('T')[0];
  const urgentAppliances = appliances
    .filter((a) => a.status !== 'Redeemed' && a.status !== 'Sold')
    .filter((a) => funderFilter === 'ALL' || a.funder === funderFilter)
    .map((app) => {
      const cust = customers.find((c) => c.id === app.customer_id);
      const { balanceRemaining } = sqliteService.calculateApplianceBalance(app);
      const isOverdue = app.due_date < today;
      const dueTime = new Date(app.due_date).getTime();
      const nowTime = new Date(today).getTime();
      const diffDays = Math.round((dueTime - nowTime) / (1000 * 60 * 60 * 24));
      return {
        app,
        cust,
        balanceRemaining,
        isOverdue,
        diffDays
      };
    })
    .filter((item) => item.diffDays <= 4)
    .sort((a, b) => a.diffDays - b.diffDays);

  const handleSendReminder = (item: typeof urgentAppliances[0]) => {
    if (!item.cust) return;
    const msg = createDueReminderMessage({
      customerName: item.cust.name,
      applianceCode: item.app.appliance_number,
      applianceDescription: `${item.app.brand} ${item.app.category}`,
      amountDue: item.balanceRemaining,
      dueDate: item.app.due_date,
      funderName: item.app.funder
    });
    const link = generateWhatsAppLink(item.cust.phone, msg);
    window.open(link, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions with Glassmorphism */}
      <div className="glass-panel p-5 rounded-2xl relative overflow-hidden border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white uppercase">
              {STORE_NAME} Dashboard
            </h1>
            <span className="text-[11px] font-mono font-bold text-[#0ABAB5] bg-[#0ABAB5]/10 border border-[#0ABAB5]/30 px-2 py-0.5 rounded-full">
              Live Ledger
            </span>
          </div>

          <p className="text-xs text-slate-300 mt-1 italic max-w-2xl">
            "{STORE_MOTTO}"
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onOpenNewPayment}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-white/15"
          >
            <Coins className="w-3.5 h-3.5 text-[#0ABAB5]" />
            <span>Record Payment</span>
          </button>

          <button
            onClick={onOpenNewAppliance}
            className="px-4 py-2 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-[#0ABAB5]/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Collateral Loan</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid (Tiffany Blue & Glassmorphism) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Appliances */}
        <div className="glass-card p-4 rounded-xl border border-white/10">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>In Custody & Collateral</span>
            <Tv className="w-4 h-4 text-[#0ABAB5]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white font-mono-numbers">
            {activeAppliances.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
            <span>Total Registered:</span>
            <span className="font-semibold text-slate-200 font-mono-numbers">{appliances.length} items</span>
          </div>
        </div>

        {/* Total Outstanding Portfolio */}
        <div className="glass-card p-4 rounded-xl border border-white/10">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Total Outstanding Due</span>
            <DollarSign className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-400 font-mono-numbers">
            {formatKES(totalOutstanding)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Principal + storage fees due
          </div>
        </div>

        {/* Total Repayments Collected */}
        <div className="glass-card p-4 rounded-xl border border-white/10">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Total Recovered</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400 font-mono-numbers">
            {formatKES(totalRepayments)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1 font-mono-numbers">
            <span>{payments.length} receipts</span>
            <span>·</span>
            <span>M-Pesa & Cash</span>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="glass-card p-4 rounded-xl border border-white/10">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Parts Inventory Alerts</span>
            <AlertTriangle className={`w-4 h-4 ${lowStockParts.length > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
          </div>
          <div className="mt-2 text-2xl font-bold text-white font-mono-numbers">
            {lowStockParts.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {lowStockParts.length > 0 ? (
              <span className="text-amber-400 font-medium">Items at or below reorder level</span>
            ) : (
              <span className="text-emerald-400">Stock levels healthy</span>
            )}
          </div>
        </div>
      </div>

      {/* PARTNER CAPITAL DISBURSEMENT LEDGER - EXPLICITLY DISPLAYS WHO GAVE OUT */}
      <div className="glass-panel p-5 rounded-xl border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#0ABAB5]" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Disbursement Ledger: Who Gave Out Money (Trevor vs Peter)
            </h2>
          </div>
          <span className="text-xs text-slate-300 font-mono-numbers">
            Total Capital In Circulation: <strong className="text-[#0ABAB5]">{formatKES(totalDisbursed)}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Trevor Money Out Card */}
          <div className="glass-card p-4 rounded-xl border border-[#0ABAB5]/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#0ABAB5]/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#0ABAB5] shadow-sm shadow-[#0ABAB5]" />
                <span className="text-sm font-extrabold text-[#0ABAB5]">Trevor Mbugua</span>
              </div>
              <span className="text-[11px] bg-[#0ABAB5]/10 text-[#0ABAB5] border border-[#0ABAB5]/30 px-2 py-0.5 rounded font-mono font-bold">
                Co-Director
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-3 mt-2 border-t border-white/10">
              <div>
                <span className="text-slate-400 text-[11px] block">Money Given Out by Trevor:</span>
                <p className="font-extrabold text-white text-base font-mono-numbers mt-0.5">{formatKES(trevorDisbursed)}</p>
                <span className="text-[10px] text-slate-400">
                  {appliances.filter((a) => a.funder === 'Trevor').length} loans advanced
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Repayments Collected by Trevor:</span>
                <p className="font-extrabold text-emerald-400 text-base font-mono-numbers mt-0.5">{formatKES(trevorCollections)}</p>
                <span className="text-[10px] text-slate-400">
                  {payments.filter((p) => p.received_by === 'Trevor').length} transactions
                </span>
              </div>
            </div>
          </div>

          {/* Peter Money Out Card */}
          <div className="glass-card p-4 rounded-xl border border-white/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-white shadow-sm shadow-white" />
                <span className="text-sm font-extrabold text-white">Peter Kamau</span>
              </div>
              <span className="text-[11px] bg-white/10 text-white border border-white/30 px-2 py-0.5 rounded font-mono font-bold">
                Co-Director
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-3 mt-2 border-t border-white/10">
              <div>
                <span className="text-slate-400 text-[11px] block">Money Given Out by Peter:</span>
                <p className="font-extrabold text-white text-base font-mono-numbers mt-0.5">{formatKES(peterDisbursed)}</p>
                <span className="text-[10px] text-slate-400">
                  {appliances.filter((a) => a.funder === 'Peter').length} loans advanced
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">Repayments Collected by Peter:</span>
                <p className="font-extrabold text-emerald-400 text-base font-mono-numbers mt-0.5">{formatKES(peterCollections)}</p>
                <span className="text-[10px] text-slate-400">
                  {payments.filter((p) => p.received_by === 'Peter').length} transactions
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Due Date Radar: Urgent Appliances & Overdue Alert */}
      <div className="glass-panel p-5 rounded-xl border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-rose-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              2-Week Due Date Radar & Overdue Alert
            </h2>
          </div>

          {/* Funder Filter Tabs */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 text-[11px] mr-1">Show Loans By:</span>
            {(['ALL', 'Trevor', 'Peter'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFunderFilter(f)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  funderFilter === f
                    ? 'bg-[#0ABAB5] text-black font-extrabold shadow'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                }`}
              >
                {f === 'ALL' ? 'All Loans' : `Given by ${f}`}
              </button>
            ))}
          </div>
        </div>

        {urgentAppliances.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[#0ABAB5]/60" />
            No overdue loans for this filter. All 14-day repayment deadlines are within safe limits.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 uppercase text-[11px] font-semibold">
                  <th className="py-2.5 px-3">Item Tag</th>
                  <th className="py-2.5 px-3">Appliance</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Who Gave Out Money</th>
                  <th className="py-2.5 px-3 text-right">Balance Due</th>
                  <th className="py-2.5 px-3">Due Date Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {urgentAppliances.map((item) => (
                  <tr key={item.app.id} className="hover:bg-white/[0.04] transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-[#0ABAB5] whitespace-nowrap">
                      <button
                        onClick={() => onSelectAppliance(item.app.id)}
                        className="hover:underline cursor-pointer"
                      >
                        {item.app.appliance_number}
                      </button>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-medium text-white">{item.app.category}</div>
                      <div className="text-[11px] text-slate-400">{item.app.brand} {item.app.model}</div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {item.cust?.photo_url ? (
                          <img
                            src={item.cust.photo_url}
                            alt={item.cust.name}
                            className="w-7 h-7 rounded-lg object-cover border border-[#0ABAB5]/40 shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center text-[#0ABAB5] font-bold text-[10px] shrink-0">
                            {item.cust ? item.cust.name.substring(0, 2).toUpperCase() : '??'}
                          </div>
                        )}
                        <div>
                          <div className="text-white font-medium">{item.cust?.name || 'Unknown'}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{item.cust?.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {item.app.funder === 'Trevor' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0ABAB5] bg-[#0ABAB5]/10 border border-[#0ABAB5]/30 px-2 py-0.5 rounded">
                          <UserCheck className="w-3 h-3" />
                          <span>Given by Trevor</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-white/10 border border-white/25 px-2 py-0.5 rounded">
                          <UserCheck className="w-3 h-3" />
                          <span>Given by Peter</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-numbers font-bold text-rose-400 whitespace-nowrap">
                      {formatKES(item.balanceRemaining)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {item.isOverdue ? (
                        <span className="inline-flex items-center gap-1 text-rose-400 font-semibold bg-rose-950/60 border border-rose-800/60 px-2 py-0.5 rounded text-[11px]">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Overdue ({Math.abs(item.diffDays)} days past due)</span>
                        </span>
                      ) : item.diffDays === 0 ? (
                        <span className="inline-flex items-center gap-1 text-amber-300 font-semibold bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded text-[11px]">
                          <Clock className="w-3 h-3" />
                          <span>Due Today ({item.app.due_date})</span>
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[11px] font-mono">
                          Due in {item.diffDays} days ({item.app.due_date})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleSendReminder(item)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                        title="Send reminder via WhatsApp"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Payments & Receipts */}
        <div className="glass-panel p-5 rounded-xl border border-white/10 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Recent Counter Payments & M-Pesa Receipts
            </h3>
            <button
              onClick={() => onNavigate('payments')}
              className="text-xs text-[#0ABAB5] hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>

          <div className="divide-y divide-white/5 text-xs">
            {payments.slice(0, 5).map((pay) => {
              const cust = customers.find((c) => c.id === pay.customer_id);
              return (
                <div key={pay.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-mono font-semibold text-[#0ABAB5]">{pay.receipt_number}</div>
                    <div className="text-slate-400 text-[11px]">
                      {cust?.name} · {pay.payment_method}
                      {pay.mpesa_code && <span className="text-emerald-400 font-mono ml-1">[{pay.mpesa_code}]</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-white font-mono-numbers">{formatKES(pay.amount)}</div>
                    <div className="text-[10px] text-slate-400">
                      Recv by <span className={pay.received_by === 'Trevor' ? 'text-[#0ABAB5] font-bold' : 'text-white font-bold'}>{pay.received_by}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recently Added Appliances with WHO GAVE OUT */}
        <div className="glass-panel p-5 rounded-xl border border-white/10 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Recently Recorded Appliances & Collateral
            </h3>
            <button
              onClick={() => onNavigate('appliances')}
              className="text-xs text-[#0ABAB5] hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>

          <div className="divide-y divide-white/5 text-xs">
            {appliances.slice(0, 5).map((app) => (
              <div
                key={app.id}
                onClick={() => onSelectAppliance(app.id)}
                className="py-2.5 flex items-center justify-between hover:bg-white/[0.04] px-2 rounded-lg cursor-pointer transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-[#0ABAB5]">{app.appliance_number}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                      app.funder === 'Trevor'
                        ? 'bg-[#0ABAB5]/15 text-[#0ABAB5] border border-[#0ABAB5]/30'
                        : 'bg-white/10 text-white border border-white/20'
                    }`}>
                      Given by {app.funder}
                    </span>
                  </div>
                  <div className="text-slate-300 text-[11px] mt-0.5">
                    {app.category} · {app.brand} {app.model}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-white font-mono-numbers">{formatKES(app.amount_received)}</div>
                  <div className="text-[10px] text-slate-400">Due: {app.due_date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
