import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { GlobalSearch } from './GlobalSearch';
import { CashierSessionModal } from './CashierSessionModal';
import { STORE_NAME, STORE_MOTTO } from '../types';
import { formatKES } from '../utils/numbering';
import { getNavLinks, isNavLinkActive } from '../navigation';
import { 
  Database, 
  LogOut, 
  ArrowRightLeft, 
  ShieldCheck, 
  Download, 
  HardDrive, 
  UserCheck, 
  LayoutDashboard,
  KeyRound,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  X,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Sun,
  Moon,
  Palette,
  Coins,
  DollarSign,
  ChevronDown,
  User,
  Settings,
  Shield,
  UserCog,
  Users,
  Wrench,
  Truck,
  Clock,
  Receipt,
  Smartphone
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenBackup: () => void;
  onSelectAppliance: (applianceId: string) => void;
  onSelectCustomer: (customerId: string) => void;
  onSearchInTab: (tab: string, query: string) => void;
  onOpenAddCustomerWithItems?: () => void;
  onGoToHome?: () => void;
  onNavigateToSettingsSection?: (section: string) => void;
  activeStaffSubTab?: string;
  onSelectStaffSubTab?: (subTab: string) => void;
  onToggleMobileMode?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenBackup,
  onSelectAppliance,
  onSelectCustomer,
  onSearchInTab,
  onOpenAddCustomerWithItems,
  onGoToHome,
  onNavigateToSettingsSection,
  activeStaffSubTab,
  onSelectStaffSubTab,
  onToggleMobileMode
}) => {
  const { 
    currentUser, 
    currentRole, 
    users, 
    isAdmin, 
    isCashier, 
    activeCashierSession, 
    refreshActiveSession, 
    switchUserWithPassword, 
    logout 
  } = useAuth();
  
  const { themeMode, toggleThemeMode, openThemePanel, currentAccent } = useTheme();

  const isTrevor = currentUser?.username?.toLowerCase() === 'trevor';
  const partnerDeskTitle = isTrevor ? "Trevor's Desk" : "Peter's Desk";

  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Password verification modal state for switching accounts
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Role-based nav links (shown in the left sidebar on desktop, and in the compact bar below on mobile)
  const navLinks = getNavLinks(isCashier, partnerDeskTitle, isAdmin);

  const handleInitiateSwitch = (newUserId: string) => {
    if (newUserId === currentUser?.id) return;
    setTargetUserId(newUserId);
    setPasswordInput('');
    setSwitchError(null);
    setIsSwitchModalOpen(true);
  };

  const targetUser = users.find((u) => u.id === targetUserId);

  const handleConfirmSwitch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim() || !targetUserId) {
      setSwitchError('Please enter the password.');
      return;
    }

    setIsVerifying(true);
    setSwitchError(null);

    const result = await switchUserWithPassword(targetUserId, passwordInput);
    setIsVerifying(false);

    if (result.success) {
      setIsSwitchModalOpen(false);
      setPasswordInput('');
      setActiveTab(targetUser?.role_id === 'role-cashier' ? 'cashier-desk' : 'portal');
    } else {
      setSwitchError(result.error || 'Incorrect password.');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/10 text-white">
      <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Wordmark & Store Motto */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setActiveTab(isCashier ? 'cashier-desk' : 'portal')}
            className="flex flex-col text-left group cursor-pointer"
            title={STORE_MOTTO}
          >
            <span className="text-xl sm:text-2xl font-black tracking-wider text-[#0ABAB5] group-hover:text-[#1FD2CD] transition-colors uppercase">
              {STORE_NAME}
            </span>
            <span className="text-[9px] text-slate-400 font-medium hidden sm:block max-w-[220px] truncate leading-tight">
              We buy & sell second hand goods
            </span>
          </button>
          
          <span className="hidden xl:inline-flex items-center gap-1 text-[11px] font-mono text-[#0ABAB5] bg-[#0ABAB5]/10 border border-[#0ABAB5]/30 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0ABAB5] animate-pulse" />
            <span>SQLite Active</span>
          </span>
        </div>

        {/* Global Search Bar */}
        <div className="flex-1 max-w-xs md:max-w-sm hidden sm:block">
          <GlobalSearch
            onSelectAppliance={onSelectAppliance}
            onSelectCustomer={onSelectCustomer}
            onSearchInTab={onSearchInTab}
          />
        </div>

        {/* Primary actions & Drawer widget */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {/* Public Storefront Link */}
          {onGoToHome && (
            <button
              onClick={onGoToHome}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#FFD700] bg-[#FFD700]/10 hover:bg-[#FFD700]/20 border border-[#FFD700]/30 rounded-xl transition-all shadow-sm cursor-pointer"
              title="View Public PEKASA STORE Website"
            >
              <span>🌐 Storefront</span>
            </button>
          )}

          {/* Cashier Drawer Session Trigger Button */}
          {isCashier && (
            <button
              onClick={() => setIsSessionModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                activeCashierSession
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-amber-500/15 border-amber-500/50 text-amber-300 hover:bg-amber-500/25 animate-pulse'
              }`}
              title="Open or Close Daily Cashier Session"
            >
              {activeCashierSession ? (
                <>
                  <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Session: OPEN ({formatKES(activeCashierSession.opening_cash)})</span>
                  <span className="sm:hidden">Open</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Open Drawer</span>
                </>
              )}
            </button>
          )}

          {/* Quick Intake Button */}
          {onOpenAddCustomerWithItems && (
            <button
              onClick={onOpenAddCustomerWithItems}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-black bg-[#0ABAB5] hover:bg-[#1FD2CD] rounded-xl transition-all shadow-md shadow-[#0ABAB5]/20 cursor-pointer"
              title="Add Customer Details & Intake Collateral in One Unified Screen"
            >
              <span>+ Customer & Item</span>
            </button>
          )}

          {/* Backup Database Quick Action (Admins only) */}
          {isAdmin && (
            <button
              onClick={onOpenBackup}
              title="Database Backup & Restore (SQLite)"
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 border border-white/15 rounded-xl transition-all whitespace-nowrap cursor-pointer"
            >
              <HardDrive className="w-3.5 h-3.5" style={{ color: currentAccent.primary }} />
              <span className="hidden xl:inline">Backup</span>
            </button>
          )}

          {/* Theme Mode Quick Switcher */}
          <button
            onClick={toggleThemeMode}
            title={themeMode === 'dark' ? 'Day Mode' : 'Night Mode'}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 border border-white/15 rounded-xl transition-all cursor-pointer"
          >
            {themeMode === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5" style={{ color: currentAccent.primary }} />
            )}
          </button>

          {/* Quick Mobile View Switcher */}
          {onToggleMobileMode && (
            <button
              onClick={onToggleMobileMode}
              title="Switch to Mobile Phone View"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 border border-white/15 rounded-xl transition-all cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-[#0ABAB5]" />
              <span className="hidden xl:inline">Mobile UI</span>
            </button>
          )}

          {/* User Profile Avatar Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 transition-all cursor-pointer"
              title="User Account & Settings Menu"
            >
              <div className="w-7 h-7 rounded-lg bg-slate-800 border border-white/20 flex items-center justify-center text-xs font-bold text-white overflow-hidden shrink-0">
                {currentUser?.avatar_url ? (
                  <img src={currentUser.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[#0ABAB5] font-black">{currentUser?.full_name?.charAt(0) || 'U'}</span>
                )}
              </div>
              <span className="text-xs font-bold text-white hidden sm:inline max-w-[120px] truncate">
                {currentUser?.full_name?.split(' ')[0]}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-white/15 rounded-2xl shadow-2xl p-2 z-50 text-xs space-y-1 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-2 border-b border-white/10">
                    <div className="font-bold text-white truncate">{currentUser?.full_name}</div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between mt-0.5">
                      <span>@{currentUser?.username}</span>
                      <span className="text-[#0ABAB5] font-bold">{currentUser?.role_title}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setActiveTab('profile');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 text-left transition-colors cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5 text-[#0ABAB5]" />
                    <span>My Profile</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      if (onNavigateToSettingsSection) onNavigateToSettingsSection('appearance');
                      setActiveTab('settings');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 text-left transition-colors cursor-pointer"
                  >
                    <Palette className="w-3.5 h-3.5 text-[#FFD700]" />
                    <span>Appearance & Theme</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      if (onNavigateToSettingsSection) onNavigateToSettingsSection('account');
                      setActiveTab('settings');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 text-left transition-colors cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-blue-400" />
                    <span>Settings</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      if (onNavigateToSettingsSection) onNavigateToSettingsSection('security');
                      setActiveTab('settings');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 text-left transition-colors cursor-pointer"
                  >
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Security & Sessions</span>
                  </button>

                  {onToggleMobileMode && (
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onToggleMobileMode();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 text-left transition-colors cursor-pointer"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-[#0ABAB5]" />
                      <span>Switch to Mobile View</span>
                    </button>
                  )}

                  <div className="border-t border-white/10 pt-1">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 text-left transition-colors cursor-pointer font-bold"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Lock Terminal / Logout</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* User Duty Switcher */}
          <div className="flex items-center bg-black/60 border border-white/15 rounded-xl p-1 shadow-inner">
            <span className="text-[11px] text-slate-400 pl-2 pr-1 hidden xl:inline font-mono">Duty:</span>
            <select
              value={currentUser?.id || ''}
              onChange={(e) => handleInitiateSwitch(e.target.value)}
              className="bg-transparent text-xs font-bold text-[#0ABAB5] focus:outline-none cursor-pointer pr-1"
              title="Switch user account with password verification"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id} className="bg-slate-950 text-white">
                  {u.username === 'trevor' 
                    ? 'Trevor (Admin)' 
                    : u.username === 'peter' 
                      ? 'Peter (Admin)' 
                      : `${u.full_name} (${u.role_title})`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* SECONDARY SUB-NAVIGATION BAR FOR STAFF & CASHIERS */}
      {activeTab === 'partners' && (
        <div className="bg-slate-900/95 border-b border-white/10 px-4 sm:px-6 lg:px-8 py-2 overflow-x-auto flex items-center gap-2 text-xs no-scrollbar">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#FFD700] flex items-center gap-1.5 shrink-0 pr-2 border-r border-white/10">
            <UserCog className="w-3.5 h-3.5" />
            <span>Staff Portal:</span>
          </span>
          {[
            { id: 'cashiers', label: 'Cashier Accounts & Roles', icon: Users },
            { id: 'sessions', label: 'Cashier Sessions & Drawers', icon: Coins },
            { id: 'voids', label: 'Reconciliations & Voids', icon: AlertTriangle },
            { id: 'financials', label: 'Partner Capital & Shares', icon: DollarSign },
            { id: 'technicians', label: 'Technicians & Hardware', icon: Wrench },
            { id: 'expenses', label: 'Operating Expenses', icon: Receipt },
            { id: 'suppliers', label: 'Suppliers Directory', icon: Truck },
            { id: 'audit', label: 'Security & Audit Logs', icon: Clock }
          ].map((tab) => {
            const Icon = tab.icon;
            const isSubActive = (activeStaffSubTab || 'cashiers') === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectStaffSubTab && onSelectStaffSubTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                  isSubActive
                    ? 'bg-[#0ABAB5] text-black shadow-md shadow-[#0ABAB5]/20 font-black'
                    : 'bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 border border-white/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Mobile Global Search Bar */}
      <div className="sm:hidden px-4 pb-2.5">
        <GlobalSearch
          onSelectAppliance={onSelectAppliance}
          onSelectCustomer={onSelectCustomer}
          onSearchInTab={onSearchInTab}
        />
      </div>

      {/* Mobile navigation bar */}
      <div className="lg:hidden flex items-center justify-around border-t border-white/10 py-2 bg-black/80 overflow-x-auto px-2 gap-1">
        {navLinks.map((link) => {
          const isActive = isNavLinkActive(link.id, activeTab, isCashier);
          return (
            <button
              key={link.id}
              onClick={() => setActiveTab(link.id)}
              className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-[#0ABAB5] text-black font-extrabold'
                  : 'text-slate-300 hover:text-white bg-white/5'
              }`}
            >
              {link.label}
            </button>
          );
        })}
      </div>

      {/* Cashier Session Drawer Modal */}
      <CashierSessionModal
        isOpen={isSessionModalOpen}
        onClose={() => setIsSessionModalOpen(false)}
        onSessionUpdated={() => refreshActiveSession()}
      />

      {/* ACCOUNT SWITCH PASSWORD VERIFICATION MODAL */}
      {isSwitchModalOpen && targetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4">
          <div className="w-full max-w-md glass-panel border border-white/20 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#0ABAB5]" />
                <h3 className="font-extrabold text-white text-base">Authorize Account Switch</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSwitchModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Account Badge */}
            <div className="p-3.5 rounded-xl bg-black/50 border border-white/15 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#0ABAB5]/20 border border-[#0ABAB5]/40 flex items-center justify-center text-[#0ABAB5] font-black text-sm">
                {targetUser.full_name.charAt(0)}
              </div>
              <div>
                <div className="font-bold text-white text-sm">{targetUser.full_name}</div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Username: <span className="text-[#0ABAB5]">{targetUser.username}</span> · Role: {targetUser.role_title}
                </div>
              </div>
            </div>

            {switchError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{switchError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmSwitch} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Enter Password for {targetUser.full_name}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter password..."
                    autoFocus
                    className="w-full py-2.5 ps-3 pe-10 bg-black/60 border border-white/20 rounded-xl text-white text-sm font-mono focus:border-[#0ABAB5] focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsSwitchModalOpen(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifying}
                  className="px-5 py-2 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-extrabold rounded-xl text-xs cursor-pointer shadow-md shadow-[#0ABAB5]/20 disabled:opacity-50"
                >
                  {isVerifying ? 'Verifying...' : 'Authenticate Switch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
