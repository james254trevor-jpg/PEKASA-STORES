import React from 'react';
import { 
  ShoppingBag, 
  Truck, 
  Wrench, 
  BarChart3, 
  Users, 
  Bell, 
  Settings, 
  Building2, 
  HardDrive, 
  HelpCircle, 
  LogOut, 
  ChevronRight, 
  Lock, 
  ShieldCheck, 
  FileText, 
  Package, 
  Palette,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { STORE_NAME, STORE_TEL } from '../../types';

interface MobileMoreViewProps {
  onOpenPurchases: () => void;
  onOpenSuppliers: () => void;
  onOpenRepairs: () => void;
  onOpenReports: () => void;
  onOpenEmployees: () => void;
  onOpenNotifications: () => void;
  onOpenSettings: (section?: string) => void;
  onOpenBusinessProfile: () => void;
  onOpenBackup: () => void;
  onOpenHelp: () => void;
  onOpenLoans: () => void;
  onOpenCollateral: () => void;
  onOpenPersonalGoods: () => void;
}

export const MobileMoreView: React.FC<MobileMoreViewProps> = ({
  onOpenPurchases,
  onOpenSuppliers,
  onOpenRepairs,
  onOpenReports,
  onOpenEmployees,
  onOpenNotifications,
  onOpenSettings,
  onOpenBusinessProfile,
  onOpenBackup,
  onOpenHelp,
  onOpenLoans,
  onOpenCollateral,
  onOpenPersonalGoods
}) => {
  const { currentUser, isAdmin, logout } = useAuth();
  const { currentAccent } = useTheme();

  return (
    <div className="space-y-6 pb-28 pt-2">
      {/* 1. Header */}
      <div className="px-1">
        <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          More
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Secondary features, management & configuration
        </p>
      </div>

      {/* User Mini Card */}
      <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-slate-800 border border-white/20 overflow-hidden flex items-center justify-center font-bold text-white shrink-0">
            {currentUser?.avatar_url ? (
              <img src={currentUser.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[#0ABAB5] font-black">{currentUser?.full_name?.charAt(0) || 'U'}</span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
              {currentUser?.full_name}
            </h3>
            <p className="text-xs text-[#0ABAB5] font-semibold mt-0.5">
              {currentUser?.role_title}
            </p>
          </div>
        </div>

        <button
          onClick={() => onOpenSettings('profile')}
          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-200 transition-colors shrink-0"
        >
          Profile
        </button>
      </div>

      {/* Group 1: Commerce & Trade */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
          Commerce & Trade
        </h3>
        <div className="rounded-2xl bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 overflow-hidden divide-y divide-slate-100 dark:divide-white/5 shadow-sm">
          <button
            onClick={onOpenLoans}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-white block">
                  Rehani Loans & Pawn Tickets
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Collateral cash contracts & maturities
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          <button
            onClick={onOpenCollateral}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-white block">
                  Collateral Vault
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Storage racks, tags & item verification
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          <button
            onClick={onOpenPurchases}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-white block">
                  Purchases & Intake
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Buy second-hand items from clients
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          <button
            onClick={onOpenSuppliers}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-white block">
                  Suppliers
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Parts & wholesale contacts
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          <button
            onClick={onOpenRepairs}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-white block">
                  Repairs & Technicians
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Appliance diagnosis & servicing
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {isAdmin && (
        <section className="space-y-2.5">
          <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-slate-400">Personal Trade</h3>
          <button onClick={onOpenPersonalGoods} className="w-full rounded-2xl border border-teal-500/20 bg-white/70 p-4 text-left shadow-sm transition-colors hover:bg-white dark:bg-slate-900/80 dark:hover:bg-white/10">
            <span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-500"><ShoppingBag className="h-4 w-4" /></span><span><span className="block text-sm font-bold text-slate-900 dark:text-white">Personal Goods</span><span className="text-xs text-slate-500 dark:text-slate-400">Your own buy-and-sell items, kept separate from Rehani</span></span><ChevronRight className="ml-auto h-4 w-4 text-slate-400" /></span>
          </button>
        </section>
      )}

      {/* Group 2: Analytics & Team */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
          Reports & Employees
        </h3>
        <div className="rounded-2xl bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 overflow-hidden divide-y divide-slate-100 dark:divide-white/5 shadow-sm">
          <button
            onClick={onOpenReports}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-white block">
                  Reports & Financials
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Sales figures, P&L, capital & drawings
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {isAdmin && (
            <button
              onClick={onOpenEmployees}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-sm text-slate-900 dark:text-white block">
                    Employees & Cashiers
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Roles, sessions, reconciliations & void requests
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* Group 3: Settings & Configuration */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
          Settings & Preferences
        </h3>
        <div className="rounded-2xl bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 overflow-hidden divide-y divide-slate-100 dark:divide-white/5 shadow-sm">
          <button
            onClick={() => onOpenSettings('appearance')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Palette className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-white block">
                  Appearance & Theme
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Dark mode, accent colours, styles
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          <button
            onClick={onOpenNotifications}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-white block">
                  Notification Settings
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Low-stock alerts, sales & payments
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          <button
            onClick={() => onOpenSettings('business')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-white block">
                  Business Profile
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Logo, contact numbers, address & receipt footer
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          <button
            onClick={onOpenBackup}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-white block">
                  Backup & Database
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  SQLite export, binary backups & restore
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          <button
            onClick={onOpenHelp}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-white block">
                  Help & Contact Helpline
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Support hotline: {STORE_TEL}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Group 4: Session & Logout */}
      <div className="pt-2">
        <button
          onClick={logout}
          className="w-full p-4 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 font-bold text-sm flex items-center justify-center gap-2.5 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Lock Terminal / Logout</span>
        </button>
      </div>
    </div>
  );
};
