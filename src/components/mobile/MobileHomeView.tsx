import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { sqliteService } from '../../db/sqlite';
import { formatKES } from '../../utils/numbering';
import { 
  ShoppingBag, 
  Plus, 
  Package, 
  Users, 
  ArrowUpRight, 
  TrendingUp, 
  Clock, 
  Receipt, 
  ChevronRight, 
  Coins, 
  DollarSign,
  ChevronDown,
  Layers,
  Sparkles
} from 'lucide-react';

interface MobileHomeViewProps {
  onNavigateTab: (tab: 'home' | 'sales' | 'inventory' | 'customers' | 'more') => void;
  onOpenNewSale: () => void;
  onOpenAddItem: () => void;
  onOpenAddCustomer: () => void;
  onViewActivityDetails?: (item: any) => void;
}

export const MobileHomeView: React.FC<MobileHomeViewProps> = ({
  onNavigateTab,
  onOpenNewSale,
  onOpenAddItem,
  onOpenAddCustomer,
  onViewActivityDetails
}) => {
  const { currentUser } = useAuth();
  const { currentAccent } = useTheme();

  const [showMoreStats, setShowMoreStats] = useState(false);

  // Time greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const displayName = currentUser?.full_name?.split(' ')[0] || 'Trevor';

  // Compute live data
  const today = new Date().toISOString().split('T')[0];
  const allPayments = sqliteService.getPayments();
  const allSales = sqliteService.getSales();
  const allCollateral = sqliteService.getCollaterals();
  const allCustomers = sqliteService.getCustomers();
  const allLoans = sqliteService.getLoans();

  // Today's Payments & Direct Sales
  const todaysPayments = allPayments.filter(
    (p) => (p.transaction_date === today || p.payment_date === today)
  );
  const todaysSalesRecords = allSales.filter((s) => s.sale_date === today);

  const todaysSalesAmount = 
    todaysPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) +
    todaysSalesRecords.reduce((sum, s) => sum + (Number(s.selling_price) || 0), 0);

  // Estimated profit today: 25% of payments interest portion or sale margins
  const todaysProfit = 
    todaysPayments.reduce((sum, p) => sum + (Number(p.interest_portion) || (Number(p.amount) * 0.25)), 0) +
    todaysSalesRecords.reduce((sum, s) => sum + (Number(s.profit_or_loss) || 0), 0);

  // Items in stock (Active items in shop / available)
  const itemsInStockCount = allCollateral.filter(
    (c) => c.status === 'Available for Sale' || c.status === 'Held (Active Loan)'
  ).length;

  // Extended stats
  const totalVaultValue = allCollateral.reduce((sum, c) => sum + (Number(c.market_value) || 0), 0);
  const activeLoansCount = allLoans.filter((l) => l.status === 'ACTIVE' || l.status === 'DUE_SOON').length;
  const customersCount = allCustomers.length;

  // Recent activity (latest 5 events)
  const recentActivities = allPayments.slice(0, 5).map((pay) => {
    const cust = allCustomers.find((c) => c.id === pay.customer_id);
    const item = allCollateral.find((c) => c.id === pay.collateral_id || c.id === pay.appliance_id);
    return {
      id: pay.id,
      title: item ? `${item.item_name}` : cust ? `Payment from ${cust.name}` : `Receipt #${pay.receipt_number}`,
      desc: pay.payment_method + (pay.mpesa_code ? ` · ${pay.mpesa_code}` : ''),
      time: pay.transaction_date || pay.payment_date || 'Today',
      amount: formatKES(pay.amount),
      status: 'Paid',
      type: 'payment'
    };
  });

  return (
    <div className="space-y-7 pb-28 pt-2">
      {/* 1. Welcoming Hero Banner */}
      <div className="px-1">
        <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          {getGreeting()}, {displayName}
        </h2>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
          Here's your store overview.
        </p>
      </div>

      {/* 2. Primary Statistics (Spacious, Minimal Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Today's Sales */}
        <div className="p-5 rounded-2xl bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 shadow-sm backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Today's Sales</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {formatKES(todaysSalesAmount)}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-500 font-bold">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Store revenue today</span>
          </div>
        </div>

        {/* Today's Profit */}
        <div className="p-5 rounded-2xl bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 shadow-sm backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Today's Profit</span>
            <div 
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${currentAccent.primary}20`, color: currentAccent.primary }}
            >
              <Coins className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {formatKES(todaysProfit)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Estimated net margin
          </div>
        </div>

        {/* Items in Stock */}
        <div className="p-5 rounded-2xl bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 shadow-sm backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Items in Stock</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Package className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {itemsInStockCount}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Available & pledged inventory
          </div>
        </div>
      </div>

      {/* Expandable "View More Stats" */}
      <div className="px-1">
        <button
          onClick={() => setShowMoreStats(!showMoreStats)}
          className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>{showMoreStats ? 'Hide details' : 'View more stats'}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMoreStats ? 'rotate-180' : ''}`} />
        </button>

        {showMoreStats && (
          <div className="mt-3 p-4 rounded-2xl bg-white/40 dark:bg-slate-900/60 border border-white/10 space-y-3 animate-in fade-in duration-200">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Total Vault Valuation:</span>
              <span className="font-bold text-white">{formatKES(totalVaultValue)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Active Pledged Loans:</span>
              <span className="font-bold text-white">{activeLoansCount} active contracts</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Registered Customers:</span>
              <span className="font-bold text-white">{customersCount} clients</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Quick Actions (2-Column Spacious Grid, Large Touch Targets) */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 px-1">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 gap-3.5">
          {/* + New Sale */}
          <button
            onClick={onOpenNewSale}
            className="p-5 rounded-2xl bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-extrabold flex flex-col items-start justify-between min-h-[110px] shadow-lg shadow-[#0ABAB5]/20 active:scale-95 transition-all text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-black/15 flex items-center justify-center text-black">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm block font-black">+ New Sale</span>
              <span className="text-[11px] opacity-80 font-medium">Quick POS Checkout</span>
            </div>
          </button>

          {/* + Add Item */}
          <button
            onClick={onOpenAddItem}
            className="p-5 rounded-2xl bg-white/70 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-white/15 text-slate-900 dark:text-white font-bold flex flex-col items-start justify-between min-h-[110px] active:scale-95 transition-all text-left shadow-sm"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm block font-black">+ Add Item</span>
              <span className="text-[11px] text-slate-400 font-medium">Intake to Inventory</span>
            </div>
          </button>

          {/* + Customer */}
          <button
            onClick={onOpenAddCustomer}
            className="p-5 rounded-2xl bg-white/70 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-white/15 text-slate-900 dark:text-white font-bold flex flex-col items-start justify-between min-h-[110px] active:scale-95 transition-all text-left shadow-sm"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm block font-black">+ Customer</span>
              <span className="text-[11px] text-slate-400 font-medium">Register New Client</span>
            </div>
          </button>

          {/* View Inventory */}
          <button
            onClick={() => onNavigateTab('inventory')}
            className="p-5 rounded-2xl bg-white/70 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-white/15 text-slate-900 dark:text-white font-bold flex flex-col items-start justify-between min-h-[110px] active:scale-95 transition-all text-left shadow-sm"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm block font-black">View Inventory</span>
              <span className="text-[11px] text-slate-400 font-medium">Browse All Stock</span>
            </div>
          </button>
        </div>
      </div>

      {/* 4. Recent Activity (Clean List Rows, No Dense Tables) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Recent Activity
          </h3>
          <button
            onClick={() => onNavigateTab('sales')}
            className="text-xs font-bold text-[#0ABAB5] hover:underline flex items-center gap-1"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentActivities.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white/5 dark:bg-slate-900/50 border border-white/10 text-center space-y-2">
            <Clock className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-xs text-slate-400">No activity recorded today yet.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentActivities.map((act) => (
              <div
                key={act.id}
                onClick={() => onViewActivityDetails && onViewActivityDetails(act)}
                className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-3.5 hover:bg-white dark:hover:bg-slate-800/90 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                  <Receipt className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {act.title}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    <span>{act.desc}</span>
                    <span>·</span>
                    <span>{act.time}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-black text-sm text-slate-900 dark:text-white">
                    {act.amount}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block mt-0.5">
                    {act.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
