import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { GlobalSearch } from './GlobalSearch';
import { STORE_NAME, STORE_MOTTO } from '../types';
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
  X,
  AlertCircle,
  CheckCircle2,
  Sun,
  Moon,
  Palette
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenBackup: () => void;
  onSelectAppliance: (applianceId: string) => void;
  onSelectCustomer: (customerId: string) => void;
  onSearchInTab: (tab: string, query: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenBackup,
  onSelectAppliance,
  onSelectCustomer,
  onSearchInTab
}) => {
  const { currentUser, currentRole, users, switchUserWithPassword, logout } = useAuth();
  const { themeMode, toggleThemeMode, openThemePanel, currentAccent } = useTheme();

  const isTrevor = currentUser?.username?.toLowerCase() === 'trevor';
  const partnerDeskTitle = isTrevor ? "Trevor's Desk" : "Peter's Desk";

  // Password verification modal state for switching accounts
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const navLinks = [
    { id: 'portal', label: partnerDeskTitle, isPersonal: true },
    { id: 'dashboard', label: 'Store Dashboard' },
    { id: 'appliances', label: 'Appliances' },
    { id: 'customers', label: 'Customers' },
    { id: 'payments', label: 'Payments' },
    { id: 'inventory', label: 'Parts & Stock' },
    { id: 'partners', label: 'Admin & Reports' }
  ];

  const handleInitiateSwitch = (newUserId: string) => {
    if (newUserId === currentUser?.id) return;
    setTargetUserId(newUserId);
    setPasswordInput('');
    setSwitchError(null);
    setIsSwitchModalOpen(true);
  };

  const targetUser = users.find((u) => u.id === targetUserId);
  const isTargetPeter = targetUser?.username?.toLowerCase() === 'peter';
  const isTargetTrevor = targetUser?.username?.toLowerCase() === 'trevor';
  const recommendedPassword = isTargetPeter ? 'kamaupita' : isTargetTrevor ? 'Mbugua254' : '';

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
      setActiveTab('portal');
    } else {
      setSwitchError(result.error || 'Incorrect password.');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/10 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Wordmark & Store Motto */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setActiveTab('portal')}
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

        {/* Zone 2: Navigation Links with Tiffany & Glass styling */}
        <nav className="hidden lg:flex items-center gap-2 xl:gap-3 shrink-0">
          {navLinks.map((link) => {
            const isActive = activeTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => setActiveTab(link.id)}
                className={`text-xs xl:text-sm font-semibold tracking-wide transition-all whitespace-nowrap cursor-pointer px-3 py-1.5 rounded-xl border ${
                  isActive
                    ? 'bg-[#0ABAB5] text-black border-[#0ABAB5] font-extrabold shadow-lg shadow-[#0ABAB5]/20'
                    : link.isPersonal
                    ? 'bg-white/5 text-[#0ABAB5] border-[#0ABAB5]/30 hover:bg-[#0ABAB5]/10'
                    : 'text-slate-300 border-transparent hover:text-white hover:bg-white/5'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Global Search Bar (Center / Right) */}
        <div className="flex-1 max-w-xs md:max-w-sm hidden sm:block">
          <GlobalSearch
            onSelectAppliance={onSelectAppliance}
            onSelectCustomer={onSelectCustomer}
            onSearchInTab={onSearchInTab}
          />
        </div>

        {/* Zone 3: Primary actions & User Duty Switcher with Password Prompt */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Theme Mode Quick Switcher (Tiffany Dark <-> Professional Light) */}
          <button
            onClick={toggleThemeMode}
            title={themeMode === 'dark' ? 'Switch to Professional Light mode (Daytime operation)' : 'Switch to Tiffany Dark mode (Night operation)'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 border border-white/15 rounded-xl transition-all cursor-pointer"
          >
            {themeMode === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden xl:inline text-[11px]">Day Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5" style={{ color: currentAccent.primary }} />
                <span className="hidden xl:inline text-[11px]">Night Mode</span>
              </>
            )}
          </button>

          {/* Theme & Accent Colour Setting Panel Trigger */}
          <button
            onClick={openThemePanel}
            title="Theme Colour Settings (Saved to LocalStorage)"
            className="p-1.5 text-slate-300 bg-white/5 hover:bg-white/10 border border-white/15 rounded-xl transition-all cursor-pointer"
          >
            <Palette className="w-4 h-4" style={{ color: currentAccent.primary }} />
          </button>

          {/* Backup Database Quick Action */}
          <button
            onClick={onOpenBackup}
            title="Database Backup & Restore (SQLite)"
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 border border-white/15 rounded-xl transition-all whitespace-nowrap cursor-pointer"
          >
            <HardDrive className="w-3.5 h-3.5" style={{ color: currentAccent.primary }} />
            <span className="hidden xl:inline">Backup</span>
          </button>

          {/* Quick Counter Duty Switcher (Trevor <-> Peter with Password Auth) */}
          <div className="flex items-center bg-black/60 border border-white/15 rounded-xl p-1 shadow-inner">
            <span className="text-[11px] text-slate-400 pl-2 pr-1 hidden xl:inline font-mono">Duty:</span>
            <select
              value={currentUser?.id || ''}
              onChange={(e) => handleInitiateSwitch(e.target.value)}
              className="bg-transparent text-xs font-bold text-[#0ABAB5] focus:outline-none cursor-pointer pr-1"
              title="Switch between Trevor and Peter with password verification"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id} className="bg-slate-950 text-white">
                  {u.username === 'trevor' ? 'Trevor Mbugua (Admin)' : u.username === 'peter' ? 'Peter Kamau (Admin)' : u.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            title="Lock terminal"
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

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
          const isActive = activeTab === link.id;
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

      {/* ACCOUNT SWITCH PASSWORD VERIFICATION MODAL */}
      {isSwitchModalOpen && targetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4">
          <div className="w-full max-w-md glass-panel border border-white/20 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#0ABAB5]" />
                <h3 className="font-extrabold text-white text-base">Authorize Director Account Switch</h3>
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
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                isTargetPeter ? 'bg-white text-black' : 'bg-[#0ABAB5] text-black'
              }`}>
                {targetUser.full_name.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-extrabold text-white text-sm block truncate">
                  Switch to Director {targetUser.full_name}
                </span>
                <span className="text-[11px] text-slate-400">
                  Account: <strong className="text-white font-mono">@{targetUser.username}</strong> ({targetUser.role_title})
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmSwitch} className="space-y-4 text-xs">
              {switchError && (
                <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{switchError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Enter Password for {targetUser.full_name} *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter account password..."
                    className="w-full py-2.5 pl-3 pr-10 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Recommended Password Notice & Quick Fill Button */}
              {recommendedPassword && (
                <div className="p-3 rounded-xl bg-[#0ABAB5]/10 border border-[#0ABAB5]/30 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#0ABAB5] flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Recommended Authorization Password</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setPasswordInput(recommendedPassword)}
                      className="text-[10px] text-white font-mono bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded cursor-pointer border border-white/20"
                    >
                      Fill
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-300 font-mono">
                    Password for {targetUser.full_name}: <strong className="text-white bg-black/40 px-1.5 py-0.5 rounded font-bold">{recommendedPassword}</strong>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsSwitchModalOpen(false)}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold cursor-pointer border border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifying}
                  className="px-5 py-2.5 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-extrabold rounded-xl text-xs cursor-pointer shadow-lg shadow-[#0ABAB5]/20 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" />
                  <span>{isVerifying ? 'Verifying...' : `Verify & Switch to ${isTargetPeter ? 'Peter' : 'Trevor'}`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
