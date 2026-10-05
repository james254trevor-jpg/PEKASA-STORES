import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  MapPin, 
  MessageSquare, 
  ShoppingBag, 
  Clock, 
  Coins, 
  CreditCard, 
  CheckCircle2, 
  ChevronDown, 
  ChevronRight,
  User,
  ShieldAlert
} from 'lucide-react';
import { Customer, LedgerTransaction } from '../../types';
import { sqliteService } from '../../db/sqlite';
import { formatKES } from '../../utils/numbering';
import { generateWhatsAppLink } from '../../utils/messaging';
import { useTheme } from '../../context/ThemeContext';

interface MobileCustomerProfileViewProps {
  customer: Customer;
  onBack: () => void;
  onNewSaleForCustomer?: (customer: Customer) => void;
}

export const MobileCustomerProfileView: React.FC<MobileCustomerProfileViewProps> = ({
  customer,
  onBack,
  onNewSaleForCustomer
}) => {
  const { currentAccent } = useTheme();

  // Collapsible section toggles
  const [isOverviewOpen, setIsOverviewOpen] = useState(true);
  const [isTransactionsOpen, setIsTransactionsOpen] = useState(true);
  const [isContactOpen, setIsContactOpen] = useState(true);

  // Get customer's transactions
  const allPayments = sqliteService.getPayments();
  const customerPayments = allPayments.filter((p) => p.customer_id === customer.id);
  const allLoans = sqliteService.getLoans().filter((l) => l.customer_id === customer.id);

  // Summary figures
  const totalSpent = customerPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalPurchasesCount = customerPayments.length;
  const outstandingBalance = allLoans
    .filter((l) => l.status === 'ACTIVE' || l.status === 'DUE_SOON' || l.status === 'OVERDUE')
    .reduce((sum, l) => sum + (Number(l.balance_remaining) || 0), 0);

  const cleanPhone = customer.phone.replace(/[^0-9+]/g, '');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-24 animate-in fade-in duration-200">
      {/* Top Sticky Header */}
      <div className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 p-1.5 -ml-1 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-xs font-bold">Customers</span>
        </button>

        <span className="text-xs font-mono font-bold text-slate-400">
          {customer.customer_number}
        </span>

        {onNewSaleForCustomer && (
          <button
            onClick={() => onNewSaleForCustomer(customer)}
            className="px-3 py-1.5 rounded-xl bg-[#0ABAB5] text-black font-extrabold text-xs shadow-md shadow-[#0ABAB5]/20"
          >
            + Sale
          </button>
        )}
      </div>

      <div className="p-5 space-y-6 flex-1">
        {/* Profile Card Header (Avatar, Name, Phone, Email) */}
        <div className="text-center space-y-3 p-6 rounded-3xl bg-white/5 border border-white/10 shadow-sm backdrop-blur-md">
          <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-[#0ABAB5] overflow-hidden mx-auto flex items-center justify-center font-black text-2xl text-white shadow-xl shadow-[#0ABAB5]/20">
            {customer.photo_url ? (
              <img src={customer.photo_url} alt={customer.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[#0ABAB5] font-black">{customer.name.charAt(0)}</span>
            )}
          </div>

          <div>
            <h1 className="text-2xl font-black text-white">{customer.name}</h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{customer.phone}</p>
            {customer.email && (
              <p className="text-xs text-slate-400 mt-0.5">{customer.email}</p>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 pt-1">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                customer.status === 'Good Standing'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : customer.status === 'Watchlist'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              {customer.status}
            </span>
          </div>

          {/* Quick Contact Buttons */}
          <div className="flex items-center justify-center gap-3 pt-3 border-t border-white/10">
            <a
              href={`tel:${cleanPhone}`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Call</span>
            </a>

            <a
              href={generateWhatsAppLink(cleanPhone, `Habari ${customer.name}, this is PEKASA STORE.`)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
          </div>
        </div>

        {/* Section 1: Overview (Spacious Stats) */}
        <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
          <button
            onClick={() => setIsOverviewOpen(!isOverviewOpen)}
            className="w-full p-4 flex items-center justify-between text-left border-b border-white/5"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Overview
            </h3>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOverviewOpen ? 'rotate-180' : ''}`} />
          </button>

          {isOverviewOpen && (
            <div className="p-4 grid grid-cols-3 gap-2.5 text-center">
              <div className="p-3 rounded-xl bg-white/5">
                <span className="text-[10px] text-slate-400 block font-medium">Purchases</span>
                <span className="text-base font-black text-white mt-1 block">
                  {totalPurchasesCount}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/5">
                <span className="text-[10px] text-slate-400 block font-medium">Total Spent</span>
                <span className="text-sm font-black text-[#0ABAB5] mt-1 block">
                  {formatKES(totalSpent)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/5">
                <span className="text-[10px] text-slate-400 block font-medium">Outstanding</span>
                <span
                  className={`text-sm font-black mt-1 block ${
                    outstandingBalance > 0 ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {formatKES(outstandingBalance)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Transactions */}
        <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
          <button
            onClick={() => setIsTransactionsOpen(!isTransactionsOpen)}
            className="w-full p-4 flex items-center justify-between text-left border-b border-white/5"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Transactions ({customerPayments.length})
            </h3>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isTransactionsOpen ? 'rotate-180' : ''}`} />
          </button>

          {isTransactionsOpen && (
            <div className="p-4 space-y-2.5">
              {customerPayments.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No transactions found for this customer.</p>
              ) : (
                customerPayments.map((pay) => (
                  <div
                    key={pay.id}
                    className="p-3 rounded-xl bg-white/5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">Receipt #{pay.receipt_number}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {pay.payment_method} · {pay.payment_date || pay.transaction_date}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-emerald-400">{formatKES(pay.amount)}</div>
                      <span className="text-[9px] uppercase font-bold text-slate-500">Paid</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Section 3: Contact & Address */}
        <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
          <button
            onClick={() => setIsContactOpen(!isContactOpen)}
            className="w-full p-4 flex items-center justify-between text-left border-b border-white/5"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Contact & Identification
            </h3>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isContactOpen ? 'rotate-180' : ''}`} />
          </button>

          {isContactOpen && (
            <div className="p-4 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">National ID:</span>
                <span className="font-bold text-white">{customer.id_number || 'Not provided'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Phone:</span>
                <span className="font-bold text-white">{customer.phone}</span>
              </div>
              {customer.alt_phone && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Alt Phone:</span>
                  <span className="font-bold text-white">{customer.alt_phone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">County / City:</span>
                <span className="font-bold text-white">{customer.county || 'Nairobi'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Physical Address:</span>
                <span className="font-bold text-white text-right max-w-[200px] truncate">{customer.address || 'Nairobi, Kenya'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
