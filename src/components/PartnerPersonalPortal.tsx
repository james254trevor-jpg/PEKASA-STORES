import React, { useState } from 'react';
import { sqliteService } from '../db/sqlite';
import { User, Appliance, Customer, Payment } from '../types';
import { formatKES } from '../utils/numbering';
import { createDueReminderMessage, generateWhatsAppLink } from '../utils/messaging';
import { 
  UserCheck, 
  Coins, 
  Tv, 
  Clock, 
  AlertTriangle, 
  ArrowUpRight, 
  Plus, 
  MessageSquare, 
  CheckCircle2, 
  Layers, 
  Receipt,
  Eye,
  TrendingUp,
  SlidersHorizontal,
  LayoutDashboard
} from 'lucide-react';

interface PartnerPersonalPortalProps {
  user: User;
  onNavigateToDashboard: () => void;
  onOpenNewAppliance: () => void;
  onOpenNewPayment: () => void;
  onSelectAppliance: (applianceId: string) => void;
  onSelectCustomer?: (customerId: string) => void;
}

export const PartnerPersonalPortal: React.FC<PartnerPersonalPortalProps> = ({
  user,
  onNavigateToDashboard,
  onOpenNewAppliance,
  onOpenNewPayment,
  onSelectAppliance,
  onSelectCustomer
}) => {
  const isTrevor = user.username.toLowerCase() === 'trevor';
  const partnerName = isTrevor ? 'Trevor' : 'Peter';

  const appliances = sqliteService.getAppliances();
  const customers = sqliteService.getCustomers();
  const payments = sqliteService.getPayments();

  const [statusFilter, setStatusFilter] = useState('ALL');

  // Filter appliances funded by this specific partner
  const myAppliances = appliances.filter((a) => a.funder === partnerName);
  const myPaymentsCollected = payments.filter((p) => p.received_by === partnerName);

  // Financial calculations for this partner
  const totalDisbursed = myAppliances.reduce((acc, a) => acc + (Number(a.amount_received) || 0), 0);
  const totalCollected = myPaymentsCollected.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  let totalOutstanding = 0;
  myAppliances.forEach((a) => {
    if (a.status !== 'Redeemed' && a.status !== 'Sold') {
      const { balanceRemaining } = sqliteService.calculateApplianceBalance(a);
      totalOutstanding += balanceRemaining;
    }
  });

  const activeFunded = myAppliances.filter(
    (a) => a.status === 'Active Collateral / Pawn' || a.status === 'In Repair' || a.status === 'Under Evaluation'
  );

  const today = new Date().toISOString().split('T')[0];
  const overdueMyAppliances = myAppliances.filter(
    (a) => a.due_date < today && a.status !== 'Redeemed' && a.status !== 'Sold'
  );

  const displayedAppliances = myAppliances.filter((a) => {
    if (statusFilter === 'ALL') return true;
    return a.status === statusFilter;
  });

  const handleSendReminder = (app: Appliance) => {
    const cust = customers.find((c) => c.id === app.customer_id);
    if (!cust) return;
    const { balanceRemaining } = sqliteService.calculateApplianceBalance(app);
    const msg = createDueReminderMessage({
      customerName: cust.name,
      applianceCode: app.appliance_number,
      applianceDescription: `${app.brand} ${app.category}`,
      amountDue: balanceRemaining,
      dueDate: app.due_date,
      funderName: partnerName
    });
    window.open(generateWhatsAppLink(cust.phone, msg), '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner */}
      <div className="glass-panel p-6 rounded-2xl relative overflow-hidden border border-white/10">
        <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-[#0ABAB5]/10 blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-mono text-[#0ABAB5] bg-[#0ABAB5]/10 border border-[#0ABAB5]/30 px-3 py-1 rounded-full mb-2">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Personal Partner Portal · {user.role_title}</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Welcome back, Director {user.full_name}
            </h1>
            
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Here is your personal portfolio of cash disbursed, collections received by you, active collateral, and client due dates.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onNavigateToDashboard}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-white/15"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-[#0ABAB5]" />
              <span>Full Store Dashboard</span>
            </button>

            <button
              onClick={onOpenNewAppliance}
              className="px-4 py-2 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-[#0ABAB5]/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Disburse Money (as {partnerName})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Partner Personal KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Capital Disbursed by this partner */}
        <div className="glass-card p-4 rounded-xl border border-white/10">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Money Given Out ({partnerName})</span>
            <Coins className="w-4 h-4 text-[#0ABAB5]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white font-mono-numbers">
            {formatKES(totalDisbursed)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {myAppliances.length} items funded by you
          </div>
        </div>

        {/* Total Collections Received by this partner */}
        <div className="glass-card p-4 rounded-xl border border-white/10">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Collected by {partnerName}</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400 font-mono-numbers">
            {formatKES(totalCollected)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {myPaymentsCollected.length} receipts issued
          </div>
        </div>

        {/* Outstanding on his portfolio */}
        <div className="glass-card p-4 rounded-xl border border-white/10">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Outstanding to Recover</span>
            <Clock className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-400 font-mono-numbers">
            {formatKES(totalOutstanding)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Principal + storage charges due
          </div>
        </div>

        {/* Overdue Items Alert */}
        <div className="glass-card p-4 rounded-xl border border-white/10">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Overdue (Past 2 Weeks)</span>
            <AlertTriangle className={`w-4 h-4 ${overdueMyAppliances.length > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
          </div>
          <div className="mt-2 text-2xl font-bold text-white font-mono-numbers">
            {overdueMyAppliances.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {overdueMyAppliances.length > 0 ? (
              <span className="text-amber-400 font-semibold">Requires your phone/WhatsApp call</span>
            ) : (
              <span className="text-emerald-400">No overdue items in your portfolio</span>
            )}
          </div>
        </div>
      </div>

      {/* Overdue radar for this partner */}
      {overdueMyAppliances.length > 0 && (
        <div className="glass-panel p-5 rounded-xl border border-amber-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Attention Required: Items Funded by You Overdue Past 14-Day Cycle
              </h3>
            </div>
            <span className="text-xs text-amber-400 font-mono">
              {overdueMyAppliances.length} client{overdueMyAppliances.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="divide-y divide-white/10 text-xs">
            {overdueMyAppliances.map((app) => {
              const cust = customers.find((c) => c.id === app.customer_id);
              const { balanceRemaining } = sqliteService.calculateApplianceBalance(app);
              return (
                <div key={app.id} className="py-2.5 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="font-mono font-bold text-[#0ABAB5] mr-2">{app.appliance_number}</span>
                    <span className="text-white font-semibold">{app.category} ({app.brand} {app.model})</span>
                    <span className="text-slate-400 ml-2">· Client: {cust?.name} ({cust?.phone})</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono-numbers font-bold text-rose-400">{formatKES(balanceRemaining)}</span>
                    <button
                      onClick={() => handleSendReminder(app)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>WhatsApp Client</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* My Funded Appliances Table */}
      <div className="glass-panel rounded-xl overflow-hidden border border-white/10 space-y-3 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Tv className="w-4 h-4 text-[#0ABAB5]" />
              <span>Appliances & Collateral Funded by {partnerName}</span>
            </h2>
            <p className="text-xs text-slate-400">
              Complete records of items where you personally provided the cash advance.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1 px-2.5 bg-black/60 border border-white/15 rounded-lg text-xs text-white focus:outline-none focus:border-[#0ABAB5] cursor-pointer"
            >
              <option value="ALL">All Statuses ({myAppliances.length})</option>
              <option value="Active Collateral / Pawn">Active Collateral / Pawn</option>
              <option value="In Repair">In Repair</option>
              <option value="Ready for Collection">Ready for Collection</option>
              <option value="Redeemed">Redeemed</option>
              <option value="Defaulted">Defaulted</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 uppercase text-[11px]">
                <th className="py-2.5 px-3">Tag Code</th>
                <th className="py-2.5 px-3">Item Details</th>
                <th className="py-2.5 px-3">Client</th>
                <th className="py-2.5 px-3 text-right">Cash Advanced</th>
                <th className="py-2.5 px-3 text-right">Balance Due</th>
                <th className="py-2.5 px-3">Due Date</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {displayedAppliances.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No items in this category funded by {partnerName}.
                  </td>
                </tr>
              ) : (
                displayedAppliances.map((app) => {
                  const cust = customers.find((c) => c.id === app.customer_id);
                  const { balanceRemaining } = sqliteService.calculateApplianceBalance(app);
                  const isOverdue = app.due_date < today && app.status !== 'Redeemed' && app.status !== 'Sold';

                  return (
                    <tr
                      key={app.id}
                      onClick={() => onSelectAppliance(app.id)}
                      className="hover:bg-white/[0.04] transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-3 font-mono font-bold text-[#0ABAB5] whitespace-nowrap">
                        {app.appliance_number}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-semibold text-white">{app.category}</div>
                        <div className="text-[11px] text-slate-400">{app.brand} {app.model}</div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {cust?.photo_url ? (
                            <img
                              src={cust.photo_url}
                              alt={cust.name}
                              className="w-7 h-7 rounded-lg object-cover border border-[#0ABAB5]/40 shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center text-[#0ABAB5] font-bold text-[10px] shrink-0">
                              {cust ? cust.name.substring(0, 2).toUpperCase() : '??'}
                            </div>
                          )}
                          <div>
                            <div className="text-white font-medium">{cust?.name || 'Unknown'}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{cust?.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono-numbers font-bold text-white whitespace-nowrap">
                        {formatKES(app.amount_received)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-numbers font-bold text-rose-400 whitespace-nowrap">
                        {formatKES(balanceRemaining)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px]">
                        <span className={isOverdue ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                          {app.due_date}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-white/5 border border-white/10 text-slate-200">
                          {app.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onSelectAppliance(app.id)}
                            className="p-1 text-slate-400 hover:text-white rounded transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
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
    </div>
  );
};
