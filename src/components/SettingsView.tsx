import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme, THEME_PRESETS, ACCENT_COLORS } from '../context/ThemeContext';
import { CustomThemeConfig, BusinessSettings, NotificationSettings } from '../types';
import { sqliteService } from '../db/sqlite';
import { 
  Settings, 
  User, 
  Palette, 
  Bell, 
  Building2, 
  Shield, 
  Database, 
  Sun, 
  Moon, 
  Laptop, 
  Check, 
  RotateCcw, 
  Save, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  Download, 
  Upload, 
  Trash2, 
  Lock, 
  KeyRound, 
  Eye, 
  EyeOff, 
  Sparkles, 
  HelpCircle,
  HardDrive,
  FileSpreadsheet,
  FileJson,
  Volume2,
  VolumeX,
  Smartphone,
  Info
} from 'lucide-react';

interface SettingsViewProps {
  initialSection?: string;
  onNavigateToProfile?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ 
  initialSection = 'appearance',
  onNavigateToProfile 
}) => {
  const { 
    currentUser, 
    isAdmin, 
    isManager, 
    isCashier, 
    isTechnician, 
    businessSettings, 
    updateBusinessSettings,
    changeUserPassword,
    clearOperationalDataAdmin 
  } = useAuth();

  const { 
    themeMode, 
    effectiveTheme, 
    customTheme, 
    applyTheme, 
    resetTheme 
  } = useTheme();

  const [activeSection, setActiveSection] = useState<
    'account' | 'appearance' | 'notifications' | 'business' | 'security' | 'data'
  >((initialSection as any) || 'appearance');

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection as any);
    }
  }, [initialSection]);

  // --- APPEARANCE LOCAL DRAFT STATE (for Live Preview before Apply) ---
  const [draftTheme, setDraftTheme] = useState<CustomThemeConfig>({ ...customTheme });
  const [themeSavedBanner, setThemeSavedBanner] = useState<string | null>(null);

  // Sync draft if customTheme changes externally
  useEffect(() => {
    setDraftTheme({ ...customTheme });
  }, [customTheme]);

  const handleApplyDraftTheme = () => {
    applyTheme(draftTheme);
    setThemeSavedBanner('Theme preferences applied and saved to your profile!');
    setTimeout(() => setThemeSavedBanner(null), 3500);
  };

  const handleResetAppearance = () => {
    resetTheme();
    setDraftTheme({
      themeMode: 'dark',
      primaryColor: '#0ABAB5',
      secondaryColor: '#FFD700',
      backgroundColor: '#0f172a',
      sidebarColor: '#090e17',
      buttonColor: '#0ABAB5',
      textColor: '#f8fafc',
      presetName: 'default',
      sidebarStyle: 'standard',
      density: 'comfortable',
      fontSize: 'normal'
    });
    setThemeSavedBanner('Appearance restored to PEKASA STORE default!');
    setTimeout(() => setThemeSavedBanner(null), 3500);
  };

  // --- NOTIFICATION SETTINGS STATE ---
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(() => {
    try {
      const saved = localStorage.getItem('pekasa_notification_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      low_stock_alerts: true,
      new_customer_alerts: true,
      new_sales_alerts: true,
      payment_alerts: true,
      system_alerts: true,
      browser_notifications: false,
      sound_alerts: true
    };
  });
  const [notifSavedBanner, setNotifSavedBanner] = useState<string | null>(null);

  const handleToggleNotif = (key: keyof NotificationSettings) => {
    setNotifSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('pekasa_notification_settings', JSON.stringify(next));
      return next;
    });
    setNotifSavedBanner('Notification preferences saved.');
    setTimeout(() => setNotifSavedBanner(null), 2500);
  };

  const handleRequestBrowserNotification = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support desktop notifications.');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      handleToggleNotif('browser_notifications');
      new Notification('PEKASA STORES', {
        body: 'Browser notifications enabled for counter operations and receipts.',
        icon: '/favicon.ico'
      });
    } else {
      alert('Notification permission was declined in your browser settings.');
    }
  };

  // --- BUSINESS SETTINGS STATE (ADMIN ONLY) ---
  const [businessDraft, setBusinessDraft] = useState<BusinessSettings>({ ...businessSettings });
  const [businessSuccess, setBusinessSuccess] = useState<string | null>(null);
  const [businessError, setBusinessError] = useState<string | null>(null);
  const [isSavingBusiness, setIsSavingBusiness] = useState(false);

  useEffect(() => {
    setBusinessDraft({ ...businessSettings });
  }, [businessSettings]);

  const handleSaveBusinessSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setBusinessSuccess(null);
    setBusinessError(null);
    setIsSavingBusiness(true);

    try {
      await updateBusinessSettings(businessDraft);
      setBusinessSuccess('Business settings updated successfully! Changes will appear on future receipts, tickets, and headers.');
      setTimeout(() => setBusinessSuccess(null), 4000);
    } catch (err: any) {
      setBusinessError(err?.message || 'Failed to save business settings.');
    } finally {
      setIsSavingBusiness(false);
    }
  };

  // --- SECURITY SETTINGS STATE ---
  const [secCurrentPassword, setSecCurrentPassword] = useState('');
  const [secNewPassword, setSecNewPassword] = useState('');
  const [secConfirmPassword, setSecConfirmPassword] = useState('');
  const [showSecCurrent, setShowSecCurrent] = useState(false);
  const [showSecNew, setShowSecNew] = useState(false);
  const [secSuccess, setSecSuccess] = useState<string | null>(null);
  const [secError, setSecError] = useState<string | null>(null);
  const [sessionTimeout, setSessionTimeout] = useState<number>(businessSettings.session_timeout_minutes || 30);
  const [twoFactorActive, setTwoFactorActive] = useState<boolean>(currentUser?.two_factor_enabled || false);

  const handleSecurityPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecSuccess(null);
    setSecError(null);

    if (!secCurrentPassword) {
      setSecError('Current password is required.');
      return;
    }
    if (secNewPassword.length < 4) {
      setSecError('New password must be at least 4 characters long.');
      return;
    }
    if (secNewPassword !== secConfirmPassword) {
      setSecError('Passwords do not match.');
      return;
    }

    try {
      const res = await changeUserPassword(secCurrentPassword, secNewPassword);
      if (res.success) {
        setSecSuccess('Password updated successfully! Salt hash updated.');
        setSecCurrentPassword('');
        setSecNewPassword('');
        setSecConfirmPassword('');
        setTimeout(() => setSecSuccess(null), 4000);
      } else {
        setSecError(res.error || 'Failed to change password.');
      }
    } catch (err: any) {
      setSecError(err?.message || 'Password update failed.');
    }
  };

  // --- DATA SETTINGS STATE (ADMIN ONLY) ---
  const [dbStats, setDbStats] = useState(() => sqliteService.getDatabaseStats());
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [dataActionMessage, setDataActionMessage] = useState<string | null>(null);

  const refreshStats = () => {
    setDbStats(sqliteService.getDatabaseStats());
  };

  const handleExportBackupBinary = () => {
    try {
      const binary = sqliteService.exportDatabaseBinary();
      const blob = new Blob([binary as any], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pekasa_backup_${new Date().toISOString().split('T')[0]}.sqlite`;
      a.click();
      URL.revokeObjectURL(url);
      setDataActionMessage('SQLite database binary backup downloaded successfully.');
      setTimeout(() => setDataActionMessage(null), 4000);
    } catch (err: any) {
      alert('Export failed: ' + err?.message);
    }
  };

  const handleExportBackupJson = () => {
    try {
      const jsonStr = sqliteService.exportDatabaseJson();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pekasa_data_export_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setDataActionMessage('JSON database records export downloaded successfully.');
      setTimeout(() => setDataActionMessage(null), 4000);
    } catch (err: any) {
      alert('Export failed: ' + err?.message);
    }
  };

  const handleRestoreBinary = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('Warning: Restoring will overwrite the current SQLite database with the uploaded file. Proceed?')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        await sqliteService.restoreFromSqliteBinary(bytes);
        refreshStats();
        setDataActionMessage('Database successfully restored from binary backup.');
        setTimeout(() => setDataActionMessage(null), 4000);
      } catch (err: any) {
        alert('Restore failed: ' + err?.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmClearData = async () => {
    if (resetConfirmInput !== 'DELETE ALL OPERATIONAL DATA') {
      alert('Confirmation phrase does not match. Operation cancelled.');
      return;
    }

    try {
      await clearOperationalDataAdmin(true);
      refreshStats();
      setIsResetModalOpen(false);
      setResetConfirmInput('');
      setDataActionMessage('All operational transactions, collaterals, and customer records have been cleared. Admin accounts are preserved.');
      setTimeout(() => setDataActionMessage(null), 5000);
    } catch (err: any) {
      alert('Clear failed: ' + err?.message);
    }
  };

  // Nav Sections List
  const navSections = [
    { id: 'account', label: 'Account Settings', icon: User, adminOnly: false },
    { id: 'appearance', label: 'Appearance & Theme', icon: Palette, adminOnly: false },
    { id: 'notifications', label: 'Notification Settings', icon: Bell, adminOnly: false },
    { id: 'business', label: 'Business Settings', icon: Building2, adminOnly: true },
    { id: 'security', label: 'Security & Sessions', icon: Shield, adminOnly: false },
    { id: 'data', label: 'Data & Database', icon: Database, adminOnly: true }
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Banner */}
      <div className="glass-card rounded-2xl p-6 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-[#0ABAB5]" />
            <span>Application Settings & Customization</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure your personal appearance, business parameters, notification alerts, and security controls.
          </p>
        </div>

        {onNavigateToProfile && (
          <button
            onClick={onNavigateToProfile}
            className="px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <User className="w-3.5 h-3.5 text-[#0ABAB5]" />
            <span>Go to My Profile</span>
          </button>
        )}
      </div>

      {/* Main Container: Left Tabs + Right Content */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Left Side: Navigation Tabs */}
        <div className="md:col-span-1 space-y-1 glass-card p-3 rounded-2xl border border-white/10">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-3 py-1.5 block">
            Settings Menu
          </span>
          {navSections.map((sec) => {
            const Icon = sec.icon;
            const isRestricted = sec.adminOnly && !isAdmin;
            const isActive = activeSection === sec.id;

            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id as any)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-left ${
                  isActive
                    ? 'bg-[#0ABAB5] text-black shadow-md shadow-[#0ABAB5]/20 font-black'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{sec.label}</span>
                </div>
                {sec.adminOnly && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ml-1 shrink-0 ${
                    isActive ? 'bg-black/20 text-black' : 'bg-[#FFD700]/15 text-[#FFD700]'
                  }`}>
                    Admin
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Side: Tab Panel Content */}
        <div className="md:col-span-3 space-y-6">
          {/* ========================================================= */}
          {/* TAB 1: ACCOUNT SETTINGS                                  */}
          {/* ========================================================= */}
          {activeSection === 'account' && (
            <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-6">
              <div className="border-b border-white/10 pb-4">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-[#0ABAB5]" />
                  <span>Account & User Profile Settings</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage your account credentials, view session details, and access your profile card.
                </p>
              </div>

              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-slate-800 border border-white/20 flex items-center justify-center text-white text-xl font-black shrink-0 overflow-hidden">
                  {currentUser?.avatar_url ? (
                    <img src={currentUser.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{currentUser?.full_name?.charAt(0) || 'U'}</span>
                  )}
                </div>

                <div className="flex-1 text-center sm:text-left space-y-1">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h4 className="font-bold text-white text-base">{currentUser?.full_name}</h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#0ABAB5]/20 text-[#0ABAB5] border border-[#0ABAB5]/30">
                      {currentUser?.role_title}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">
                    Username: @{currentUser?.username} · {currentUser?.email || 'No email registered'}
                  </p>
                </div>

                {onNavigateToProfile && (
                  <button
                    onClick={onNavigateToProfile}
                    className="px-4 py-2 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-extrabold rounded-xl text-xs cursor-pointer shadow-md transition-all shrink-0"
                  >
                    Edit Full Profile
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <span className="text-slate-400 text-[11px] block font-semibold">Account Role Capabilities</span>
                  <p className="text-slate-300">
                    {isAdmin
                      ? 'Full executive administrator with unrestricted database, ledger, sales authorization, and settings access.'
                      : isManager
                      ? 'Branch manager with item intake, appraisal approvals, customer records, and store reporting access.'
                      : isCashier
                      ? 'Counter cashier with access to receipt issuance, payment entry, drawer balancing, and customer history.'
                      : 'Technician access for appliance testing, repair parts issuing, and inspection.'}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <span className="text-slate-400 text-[11px] block font-semibold">Security Status</span>
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Password Hash: SHA-256 + Salt</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Session storage protected. Password encrypted before verification.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: APPEARANCE & THEME (FULL CUSTOMIZATION)           */}
          {/* ========================================================= */}
          {activeSection === 'appearance' && (
            <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-6">
              <div className="border-b border-white/10 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Palette className="w-4 h-4 text-[#0ABAB5]" />
                    <span>Theme & Colour Customization</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Customize your colors, lightness, and layout without affecting business records.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleResetAppearance}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Restore default theme"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset to Default</span>
                  </button>
                  <button
                    onClick={handleApplyDraftTheme}
                    className="px-4 py-1.5 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-lg shadow-[#0ABAB5]/20 transition-all"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Apply Theme</span>
                  </button>
                </div>
              </div>

              {themeSavedBanner && (
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{themeSavedBanner}</span>
                </div>
              )}

              {/* Light / Dark / System Mode Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">
                  Display Mode (Light / Dark / System)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setDraftTheme({ ...draftTheme, themeMode: 'dark' })}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                      draftTheme.themeMode === 'dark'
                        ? 'bg-slate-900 border-[#0ABAB5] shadow-lg ring-2 ring-[#0ABAB5] text-white'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Moon className="w-5 h-5 mx-auto mb-1 text-slate-300" />
                    <span className="text-xs font-bold block">Dark Mode</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">High contrast slate</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDraftTheme({ ...draftTheme, themeMode: 'light' })}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                      draftTheme.themeMode === 'light'
                        ? 'bg-white border-[#0ABAB5] shadow-lg ring-2 ring-[#0ABAB5] text-slate-950 font-bold'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sun className="w-5 h-5 mx-auto mb-1 text-amber-500" />
                    <span className="text-xs font-bold block text-slate-900">Light Mode</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Clean daylight surface</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDraftTheme({ ...draftTheme, themeMode: 'system' })}
                    className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                      draftTheme.themeMode === 'system'
                        ? 'bg-slate-900 border-[#0ABAB5] shadow-lg ring-2 ring-[#0ABAB5] text-white'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Laptop className="w-5 h-5 mx-auto mb-1 text-[#0ABAB5]" />
                    <span className="text-xs font-bold block">System Default</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Matches OS settings</span>
                  </button>
                </div>
              </div>

              {/* Colour Presets */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">
                  Curated Colour Presets
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {Object.entries(THEME_PRESETS).map(([key, p]) => {
                    const isSelected = draftTheme.presetName === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setDraftTheme({
                            ...draftTheme,
                            presetName: key,
                            primaryColor: p.primary,
                            secondaryColor: p.secondary,
                            buttonColor: p.button
                          });
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                          isSelected
                            ? 'bg-white/15 border-[#0ABAB5] ring-2 ring-[#0ABAB5]/50'
                            : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div
                          className="w-5 h-5 rounded-full shrink-0 shadow-sm border border-white/20"
                          style={{ backgroundColor: p.primary }}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-bold text-white block truncate">{p.name.split(' ')[0]}</span>
                          <span className="text-[10px] text-slate-400 block truncate">{p.name.split('(')[0]}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Colour Pickers (Primary, Secondary, Background, Sidebar, Button) */}
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Custom Hex Colour Palette
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Primary Brand</label>
                    <div className="flex items-center gap-2 p-1.5 bg-black/40 border border-white/15 rounded-xl">
                      <input
                        type="color"
                        value={draftTheme.primaryColor}
                        onChange={(e) => setDraftTheme({ ...draftTheme, primaryColor: e.target.value, presetName: 'custom' })}
                        className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
                      />
                      <span className="text-xs font-mono text-white uppercase">{draftTheme.primaryColor}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Accent / Secondary</label>
                    <div className="flex items-center gap-2 p-1.5 bg-black/40 border border-white/15 rounded-xl">
                      <input
                        type="color"
                        value={draftTheme.secondaryColor}
                        onChange={(e) => setDraftTheme({ ...draftTheme, secondaryColor: e.target.value, presetName: 'custom' })}
                        className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
                      />
                      <span className="text-xs font-mono text-white uppercase">{draftTheme.secondaryColor}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Sidebar Color</label>
                    <div className="flex items-center gap-2 p-1.5 bg-black/40 border border-white/15 rounded-xl">
                      <input
                        type="color"
                        value={draftTheme.sidebarColor || '#090e17'}
                        onChange={(e) => setDraftTheme({ ...draftTheme, sidebarColor: e.target.value, presetName: 'custom' })}
                        className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
                      />
                      <span className="text-xs font-mono text-white uppercase">{draftTheme.sidebarColor || '#090E17'}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Button Color</label>
                    <div className="flex items-center gap-2 p-1.5 bg-black/40 border border-white/15 rounded-xl">
                      <input
                        type="color"
                        value={draftTheme.buttonColor || draftTheme.primaryColor}
                        onChange={(e) => setDraftTheme({ ...draftTheme, buttonColor: e.target.value, presetName: 'custom' })}
                        className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
                      />
                      <span className="text-xs font-mono text-white uppercase">{draftTheme.buttonColor || draftTheme.primaryColor}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Background Surface</label>
                    <div className="flex items-center gap-2 p-1.5 bg-black/40 border border-white/15 rounded-xl">
                      <input
                        type="color"
                        value={draftTheme.backgroundColor || '#0f172a'}
                        onChange={(e) => setDraftTheme({ ...draftTheme, backgroundColor: e.target.value, presetName: 'custom' })}
                        className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
                      />
                      <span className="text-xs font-mono text-white uppercase">{draftTheme.backgroundColor || '#0F172A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Layout Density & Font Size */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">Interface Density</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDraftTheme({ ...draftTheme, density: 'comfortable' })}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        draftTheme.density === 'comfortable'
                          ? 'bg-white/15 border-[#0ABAB5] text-white'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      Comfortable (Spacious)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraftTheme({ ...draftTheme, density: 'compact' })}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        draftTheme.density === 'compact'
                          ? 'bg-white/15 border-[#0ABAB5] text-white'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      Compact (Dense Counter)
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">System Font Size</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setDraftTheme({ ...draftTheme, fontSize: 'small' })}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        draftTheme.fontSize === 'small'
                          ? 'bg-white/15 border-[#0ABAB5] text-white'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      Small (14px)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraftTheme({ ...draftTheme, fontSize: 'normal' })}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        draftTheme.fontSize === 'normal'
                          ? 'bg-white/15 border-[#0ABAB5] text-white'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      Normal (16px)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraftTheme({ ...draftTheme, fontSize: 'large' })}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        draftTheme.fontSize === 'large'
                          ? 'bg-white/15 border-[#0ABAB5] text-white'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      Large (17px)
                    </button>
                  </div>
                </div>
              </div>

              {/* LIVE PREVIEW CARD */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#FFD700]" />
                  <span>Live Interactive Preview (Before Applying)</span>
                </span>
                
                <div
                  className="p-5 rounded-2xl border transition-all space-y-4"
                  style={{
                    backgroundColor: draftTheme.backgroundColor || (draftTheme.themeMode === 'light' ? '#f8fafc' : '#0f172a'),
                    borderColor: 'rgba(255,255,255,0.15)'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: draftTheme.primaryColor }}>
                      PEKASA STORES · Counter Terminal
                    </span>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                      style={{
                        backgroundColor: `${draftTheme.secondaryColor}25`,
                        color: draftTheme.secondaryColor,
                        border: `1px solid ${draftTheme.secondaryColor}50`
                      }}
                    >
                      {draftTheme.presetName?.toUpperCase() || 'CUSTOM'}
                    </span>
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-xs space-y-1">
                    <span className="text-slate-400 block text-[11px]">Collateral Sample Ticket</span>
                    <p className="font-semibold text-white">Samsung 55" Curved Smart 4K UHD TV (LN-2026-0042)</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl text-xs font-black shadow-md cursor-pointer transition-transform hover:scale-105"
                      style={{
                        backgroundColor: draftTheme.buttonColor || draftTheme.primaryColor,
                        color: '#000000'
                      }}
                    >
                      Disburse KES 25,000
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-xl text-xs font-bold border transition-colors"
                      style={{
                        borderColor: draftTheme.secondaryColor,
                        color: draftTheme.secondaryColor,
                        backgroundColor: `${draftTheme.secondaryColor}15`
                      }}
                    >
                      Print Receipt
                    </button>
                  </div>
                </div>
              </div>

              {/* Action buttons footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleResetAppearance}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-slate-300 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Default</span>
                </button>
                <button
                  type="button"
                  onClick={handleApplyDraftTheme}
                  className="px-6 py-2.5 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-black rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-[#0ABAB5]/20 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Apply Theme Changes</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: NOTIFICATIONS SETTINGS                            */}
          {/* ========================================================= */}
          {activeSection === 'notifications' && (
            <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-6">
              <div className="border-b border-white/10 pb-4">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#0ABAB5]" />
                  <span>Notification & Alert Preferences</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Control which operational events trigger sound effects, toast notices, or browser alerts.
                </p>
              </div>

              {notifSavedBanner && (
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{notifSavedBanner}</span>
                </div>
              )}

              <div className="space-y-3">
                <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">Low Stock / Spare Parts Alerts</span>
                    <span className="text-[11px] text-slate-400 block">Alert when inventory components fall below safety thresholds.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifSettings.low_stock_alerts}
                    onChange={() => handleToggleNotif('low_stock_alerts')}
                    className="w-5 h-5 accent-[#0ABAB5] cursor-pointer"
                  />
                </div>

                <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">New Customer Intake Notifications</span>
                    <span className="text-[11px] text-slate-400 block">Notify when a new client record is registered at the counter.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifSettings.new_customer_alerts}
                    onChange={() => handleToggleNotif('new_customer_alerts')}
                    className="w-5 h-5 accent-[#0ABAB5] cursor-pointer"
                  />
                </div>

                <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">Collateral Sales & Liquidation Notifications</span>
                    <span className="text-[11px] text-slate-400 block">Alert when an unredeemed item is sold or placed on the public shop floor.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifSettings.new_sales_alerts}
                    onChange={() => handleToggleNotif('new_sales_alerts')}
                    className="w-5 h-5 accent-[#0ABAB5] cursor-pointer"
                  />
                </div>

                <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">Payment & Receipt Confirmations</span>
                    <span className="text-[11px] text-slate-400 block">Notification popups when M-Pesa or cash repayments are logged.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifSettings.payment_alerts}
                    onChange={() => handleToggleNotif('payment_alerts')}
                    className="w-5 h-5 accent-[#0ABAB5] cursor-pointer"
                  />
                </div>

                <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">Audio Sound Effects</span>
                    <span className="text-[11px] text-slate-400 block">Play gentle sound confirmation on receipt print and successful intake.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifSettings.sound_alerts}
                    onChange={() => handleToggleNotif('sound_alerts')}
                    className="w-5 h-5 accent-[#0ABAB5] cursor-pointer"
                  />
                </div>

                <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">Browser Desktop Notifications</span>
                    <span className="text-[11px] text-slate-400 block">Receive alerts even when the browser tab is minimized or in the background.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRequestBrowserNotification}
                    className="px-3 py-1.5 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-bold text-xs rounded-lg cursor-pointer transition-colors"
                  >
                    {notifSettings.browser_notifications ? 'Enabled' : 'Request Permission'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: BUSINESS SETTINGS (ADMIN ONLY)                    */}
          {/* ========================================================= */}
          {activeSection === 'business' && (
            !isAdmin ? (
              <div className="glass-card rounded-2xl p-8 border border-rose-500/30 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
                  <Shield className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-white">Administrator Access Required</h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto">
                  Modifying business name, official store address, receipt footers, tax rates, and official currencies is strictly restricted to Senior Directors <strong>Trevor Mbugua</strong> and <strong>Peter Kamau</strong>.
                </p>
              </div>
            ) : (
              <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-6">
                <div className="border-b border-white/10 pb-4">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#FFD700]" />
                    <span>Official Business & Receipt Configuration</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    These settings are automatically reflected on thermal receipts, pawn tickets, invoices, and website headers.
                  </p>
                </div>

                {businessSuccess && (
                  <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{businessSuccess}</span>
                  </div>
                )}

                {businessError && (
                  <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl flex items-center gap-2.5 text-xs text-rose-300">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{businessError}</span>
                  </div>
                )}

                <form onSubmit={handleSaveBusinessSettings} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        Trading Business Name *
                      </label>
                      <input
                        type="text"
                        value={businessDraft.business_name}
                        onChange={(e) => setBusinessDraft({ ...businessDraft, business_name: e.target.value })}
                        required
                        className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 focus:border-[#FFD700] focus:outline-none rounded-xl text-sm text-white font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        Operational Currency Code
                      </label>
                      <select
                        value={businessDraft.currency}
                        onChange={(e) => setBusinessDraft({ ...businessDraft, currency: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 focus:border-[#FFD700] focus:outline-none rounded-xl text-sm text-white font-mono"
                      >
                        <option value="KES" className="bg-slate-900 text-white">KES - Kenyan Shilling</option>
                        <option value="USD" className="bg-slate-900 text-white">USD - US Dollar</option>
                        <option value="EUR" className="bg-slate-900 text-white">EUR - Euro</option>
                        <option value="GBP" className="bg-slate-900 text-white">GBP - British Pound</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Business Motto / Service Description
                    </label>
                    <textarea
                      rows={2}
                      value={businessDraft.business_motto}
                      onChange={(e) => setBusinessDraft({ ...businessDraft, business_motto: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 focus:border-[#FFD700] focus:outline-none rounded-xl text-xs text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        Primary Official Telephone *
                      </label>
                      <input
                        type="text"
                        value={businessDraft.business_phone}
                        onChange={(e) => setBusinessDraft({ ...businessDraft, business_phone: e.target.value })}
                        required
                        className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 focus:border-[#FFD700] focus:outline-none rounded-xl text-sm text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        Secondary / Partner Phone
                      </label>
                      <input
                        type="text"
                        value={businessDraft.business_phone_alt}
                        onChange={(e) => setBusinessDraft({ ...businessDraft, business_phone_alt: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 focus:border-[#FFD700] focus:outline-none rounded-xl text-sm text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        Official Store Email
                      </label>
                      <input
                        type="email"
                        value={businessDraft.business_email}
                        onChange={(e) => setBusinessDraft({ ...businessDraft, business_email: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 focus:border-[#FFD700] focus:outline-none rounded-xl text-sm text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        Physical Store Address (HQ)
                      </label>
                      <input
                        type="text"
                        value={businessDraft.business_address}
                        onChange={(e) => setBusinessDraft({ ...businessDraft, business_address: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 focus:border-[#FFD700] focus:outline-none rounded-xl text-sm text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        Invoice Prefix
                      </label>
                      <input
                        type="text"
                        value={businessDraft.invoice_prefix}
                        onChange={(e) => setBusinessDraft({ ...businessDraft, invoice_prefix: e.target.value.toUpperCase() })}
                        className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 focus:border-[#FFD700] focus:outline-none rounded-xl text-sm text-white font-mono uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        Receipt Prefix
                      </label>
                      <input
                        type="text"
                        value={businessDraft.receipt_prefix}
                        onChange={(e) => setBusinessDraft({ ...businessDraft, receipt_prefix: e.target.value.toUpperCase() })}
                        className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 focus:border-[#FFD700] focus:outline-none rounded-xl text-sm text-white font-mono uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        Tax / VAT Settings
                      </label>
                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="checkbox"
                          checked={businessDraft.tax_enabled}
                          onChange={(e) => setBusinessDraft({ ...businessDraft, tax_enabled: e.target.checked })}
                          className="w-4 h-4 accent-[#FFD700] cursor-pointer"
                        />
                        <span className="text-xs text-slate-300">Enable Tax Rate (0%)</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Receipt Footer Note
                    </label>
                    <input
                      type="text"
                      value={businessDraft.receipt_footer}
                      onChange={(e) => setBusinessDraft({ ...businessDraft, receipt_footer: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 focus:border-[#FFD700] focus:outline-none rounded-xl text-xs text-white font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-end pt-3">
                    <button
                      type="submit"
                      disabled={isSavingBusiness}
                      className="px-6 py-2.5 bg-[#FFD700] hover:bg-[#E6C200] text-black font-black rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-[#FFD700]/20 transition-all disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isSavingBusiness ? 'Saving...' : 'Save Business Settings'}</span>
                    </button>
                  </div>
                </form>
              </div>
            )
          )}

          {/* ========================================================= */}
          {/* TAB 5: SECURITY & SESSIONS                               */}
          {/* ========================================================= */}
          {activeSection === 'security' && (
            <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-6">
              <div className="border-b border-white/10 pb-4">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#0ABAB5]" />
                  <span>Security & Active Session Management</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Protect counter terminals, configure auto-lock timeouts, and view connected sessions.
                </p>
              </div>

              {secSuccess && (
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{secSuccess}</span>
                </div>
              )}

              {secError && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl flex items-center gap-2 text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{secError}</span>
                </div>
              )}

              {/* Password update section */}
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-[#FFD700]" />
                  <span>Update Terminal Password</span>
                </h4>

                <form onSubmit={handleSecurityPasswordChange} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Current Password *</label>
                    <div className="relative">
                      <input
                        type={showSecCurrent ? 'text' : 'password'}
                        value={secCurrentPassword}
                        onChange={(e) => setSecCurrentPassword(e.target.value)}
                        required
                        className="w-full px-3.5 py-2 bg-black/40 border border-white/15 rounded-xl text-xs text-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecCurrent(!showSecCurrent)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                      >
                        {showSecCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">New Password *</label>
                      <div className="relative">
                        <input
                          type={showSecNew ? 'text' : 'password'}
                          value={secNewPassword}
                          onChange={(e) => setSecNewPassword(e.target.value)}
                          required
                          className="w-full px-3.5 py-2 bg-black/40 border border-white/15 rounded-xl text-xs text-white font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecNew(!showSecNew)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                        >
                          {showSecNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Confirm New Password *</label>
                      <input
                        type={showSecNew ? 'text' : 'password'}
                        value={secConfirmPassword}
                        onChange={(e) => setSecConfirmPassword(e.target.value)}
                        required
                        className="w-full px-3.5 py-2 bg-black/40 border border-white/15 rounded-xl text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-1">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#FFD700] hover:bg-[#E6C200] text-black font-extrabold rounded-xl text-xs cursor-pointer transition-colors shadow-sm"
                    >
                      Update Password
                    </button>
                  </div>
                </form>
              </div>

              {/* Session timeout settings */}
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">Counter Inactivity Session Timeout</h4>
                    <p className="text-[11px] text-slate-400">Lock the counter terminal after a period of user inactivity.</p>
                  </div>
                  <select
                    value={sessionTimeout}
                    onChange={(e) => setSessionTimeout(Number(e.target.value))}
                    className="px-3 py-1.5 bg-black/50 border border-white/20 rounded-xl text-xs text-white font-bold"
                  >
                    <option value={15} className="bg-slate-900">15 Minutes</option>
                    <option value={30} className="bg-slate-900">30 Minutes</option>
                    <option value={60} className="bg-slate-900">1 Hour</option>
                    <option value={0} className="bg-slate-900">Never (Stay Active)</option>
                  </select>
                </div>
              </div>

              {/* Active Session & Device Card */}
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">Current Active Terminal Session</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Online Now
                  </span>
                </div>
                <div className="text-xs text-slate-300 space-y-1">
                  <div>Browser / Platform: {typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 60) + '...' : 'Browser Client'}</div>
                  <div className="text-slate-400 text-[11px]">Station: Kombani Commercial Centre, Kwale County</div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 6: DATA & DATABASE SETTINGS (ADMIN ONLY)             */}
          {/* ========================================================= */}
          {activeSection === 'data' && (
            !isAdmin ? (
              <div className="glass-card rounded-2xl p-8 border border-rose-500/30 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
                  <Database className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-white">Restricted Database Controls</h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto">
                  Database backups, schema restores, and data purges are strictly restricted to Directors <strong>Trevor Mbugua</strong> and <strong>Peter Kamau</strong>. Cashiers and operators cannot modify database storage.
                </p>
              </div>
            ) : (
              <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-6">
                <div className="border-b border-white/10 pb-4">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#0ABAB5]" />
                    <span>SQLite Storage & Data Backup / Restore</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Manage persistent IndexedDB and WebAssembly SQLite database snapshots.
                  </p>
                </div>

                {dataActionMessage && (
                  <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{dataActionMessage}</span>
                  </div>
                )}

                {/* Storage Health Snapshot */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Total Tables</span>
                    <span className="text-lg font-black text-white font-mono mt-0.5 block">{dbStats.totalTables}</span>
                  </div>
                  <div className="p-3.5 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Total Database Records</span>
                    <span className="text-lg font-black text-[#0ABAB5] font-mono mt-0.5 block">{dbStats.totalRows}</span>
                  </div>
                  <div className="p-3.5 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Collaterals In Vault</span>
                    <span className="text-lg font-black text-[#FFD700] font-mono mt-0.5 block">{dbStats.recordCounts['collateral_items'] || 0}</span>
                  </div>
                  <div className="p-3.5 bg-white/5 rounded-xl border border-white/10">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Storage Engine</span>
                    <span className="text-xs font-bold text-emerald-400 font-mono mt-2 block">IndexedDB + WASM</span>
                  </div>
                </div>

                {/* Export & Backup Tools */}
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Download className="w-4 h-4 text-[#0ABAB5]" />
                    <span>Export & Download Backups</span>
                  </h4>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={handleExportBackupBinary}
                      className="px-4 py-2 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-extrabold rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-md transition-all"
                    >
                      <HardDrive className="w-4 h-4" />
                      <span>Download SQLite Binary (.sqlite)</span>
                    </button>

                    <button
                      onClick={handleExportBackupJson}
                      className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white border border-white/20 font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer transition-all"
                    >
                      <FileJson className="w-4 h-4 text-[#FFD700]" />
                      <span>Export Clean JSON Snapshot</span>
                    </button>
                  </div>
                </div>

                {/* Restore Database */}
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Upload className="w-4 h-4 text-[#FFD700]" />
                    <span>Restore from SQLite Binary File</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Upload a previously downloaded `.sqlite` binary backup file to restore records.
                  </p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors">
                    <Upload className="w-4 h-4" />
                    <span>Select .sqlite File to Restore</span>
                    <input type="file" accept=".sqlite,.db" onChange={handleRestoreBinary} className="hidden" />
                  </label>
                </div>

                {/* Danger Zone: Clear Operational Data */}
                <div className="p-5 rounded-2xl border border-rose-500/30 bg-rose-950/20 space-y-3">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Danger Zone: Clear Operational Data</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Permanently clears all collateral, loans, receipts, and customer records while strictly preserving administrator accounts (Trevor & Peter).
                  </p>
                  <button
                    onClick={() => setIsResetModalOpen(true)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-md"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Reset Operational Records...</span>
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Confirmation Modal for Resetting Operational Data */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-rose-500/50 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-white uppercase tracking-wider">
                Confirm Operational Data Clear
              </h3>
              <p className="text-xs text-slate-300">
                This action is irreversible. All loans, customer records, payments, and collateral items will be permanently erased. Administrator accounts will remain active.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                Type <strong className="text-rose-400 font-mono">DELETE ALL OPERATIONAL DATA</strong> to confirm:
              </label>
              <input
                type="text"
                value={resetConfirmInput}
                onChange={(e) => setResetConfirmInput(e.target.value)}
                placeholder="DELETE ALL OPERATIONAL DATA"
                className="w-full px-3 py-2 bg-black/60 border border-rose-500/40 rounded-xl text-xs text-white font-mono text-center font-bold"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setIsResetModalOpen(false);
                  setResetConfirmInput('');
                }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-slate-300 font-bold rounded-xl text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetConfirmInput !== 'DELETE ALL OPERATIONAL DATA'}
                onClick={handleConfirmClearData}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-black rounded-xl text-xs cursor-pointer shadow-lg transition-all"
              >
                Confirm Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
