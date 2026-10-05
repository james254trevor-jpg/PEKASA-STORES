import React, { useState, useMemo } from 'react';
import { Search, Plus, Users, User, Phone, ArrowRight, X } from 'lucide-react';
import { Customer } from '../../types';
import { sqliteService } from '../../db/sqlite';
import { formatKES } from '../../utils/numbering';

interface MobileCustomersViewProps {
  onSelectCustomer: (customer: Customer) => void;
  onOpenAddCustomer: () => void;
}

export const MobileCustomersView: React.FC<MobileCustomersViewProps> = ({
  onSelectCustomer,
  onOpenAddCustomer
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const allCustomers = sqliteService.getCustomers();
  const allPayments = sqliteService.getPayments();
  const allLoans = sqliteService.getLoans();

  const filteredCustomers = useMemo(() => {
    return allCustomers.filter((c) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.customer_number.toLowerCase().includes(q) ||
        (c.id_number && c.id_number.includes(q))
      );
    });
  }, [allCustomers, searchQuery]);

  return (
    <div className="space-y-5 pb-28 pt-2">
      {/* 1. Header with Page Title & Add Button */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Customers
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {filteredCustomers.length} registered clients
          </p>
        </div>

        <button
          onClick={onOpenAddCustomer}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-extrabold text-xs shadow-md shadow-[#0ABAB5]/20 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Customer</span>
        </button>
      </div>

      {/* 2. Prominent Search Field */}
      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search customers by name, phone or ID..."
          className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/80 border border-slate-200 dark:border-white/15 text-sm text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-[#0ABAB5] shadow-sm transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 3. Customer List Cards (Spacious, Minimal, Clear) */}
      {filteredCustomers.length === 0 ? (
        <div className="p-10 rounded-3xl bg-white/40 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 text-center space-y-3">
          <Users className="w-12 h-12 text-slate-500 mx-auto" />
          <h4 className="text-base font-bold text-slate-900 dark:text-white">No customers found</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
            {searchQuery ? 'Try a different name or phone number.' : 'Register your first customer.'}
          </p>
          <button
            onClick={onOpenAddCustomer}
            className="px-4 py-2 rounded-xl bg-[#0ABAB5] text-black text-xs font-black shadow-md"
          >
            Register Customer
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCustomers.map((cust) => {
            const customerPayments = allPayments.filter((p) => p.customer_id === cust.id);
            const customerLoans = allLoans.filter((l) => l.customer_id === cust.id);
            const purchasesCount = customerPayments.length;
            const outstandingBalance = customerLoans
              .filter((l) => l.status === 'ACTIVE' || l.status === 'DUE_SOON' || l.status === 'OVERDUE')
              .reduce((sum, l) => sum + (Number(l.balance_remaining) || 0), 0);

            const lastTxnDate = customerPayments[0]?.payment_date || cust.created_at?.split(' ')[0] || 'Recent';

            return (
              <div
                key={cust.id}
                onClick={() => onSelectCustomer(cust)}
                className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 hover:border-[#0ABAB5]/50 transition-all cursor-pointer shadow-sm active:scale-[0.99] backdrop-blur-md space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-slate-800 border border-white/10 overflow-hidden flex items-center justify-center font-bold text-base text-white shrink-0">
                      {cust.photo_url ? (
                        <img src={cust.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[#0ABAB5] font-black">{cust.name.charAt(0)}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white truncate">
                        {cust.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        {cust.phone}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shrink-0 ${
                      cust.status === 'Good Standing'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : cust.status === 'Watchlist'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {cust.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-100 dark:border-white/5 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Purchases:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                      {purchasesCount} {purchasesCount === 1 ? 'item' : 'items'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block">Balance:</span>
                    <span
                      className={`font-black mt-0.5 block ${
                        outstandingBalance > 0 ? 'text-amber-400' : 'text-emerald-500'
                      }`}
                    >
                      {formatKES(outstandingBalance)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Last Active:</span>
                    <span className="font-medium text-slate-500 dark:text-slate-400 mt-0.5 block">
                      {lastTxnDate}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
