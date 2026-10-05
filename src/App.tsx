import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CloudSyncGate } from './components/CloudSyncGate';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { LoginModal } from './components/LoginModal';
import { DashboardView } from './components/DashboardView';
import { PartnerPersonalPortal } from './components/PartnerPersonalPortal';
import { LoansView } from './components/LoansView';
import { CollateralView } from './components/CollateralView';
import { SalesView } from './components/SalesView';
import { TreasuryExpensesView } from './components/TreasuryExpensesView';
import { AppliancesView } from './components/AppliancesView';
import { CustomersView } from './components/CustomersView';
import { PaymentsView } from './components/PaymentsView';
import { InventoryPartsView } from './components/InventoryPartsView';
import { PersonalGoodsView } from './components/PersonalGoodsView';
import { PartnersView } from './components/PartnersView';
import { BackupRestoreModal } from './components/BackupRestoreModal';
import { ThemeSettingsPanel } from './components/ThemeSettingsPanel';
import { AddCustomerWithItemsModal } from './components/AddCustomerWithItemsModal';
import { PublicHomePage } from './components/PublicHomePage';
import { UserProfileView } from './components/UserProfileView';
import { SettingsView } from './components/SettingsView';
import { MobileApp } from './components/mobile/MobileApp';
import LoginPage1 from '@/components/ui/login-page-1';
import { Appliance, STORE_NAME, STORE_MOTTO } from './types';
import { CashierDashboard } from './components/CashierDashboard';
import { Database, HardDrive, Shield, Sun, Moon, Palette, AlertTriangle, Smartphone, Laptop } from 'lucide-react';

const MainApp: React.FC = () => {
  const { currentUser, isLoading, login, loginError, isAdmin, isCashier } = useAuth();
  const { themeMode, toggleThemeMode, openThemePanel, currentAccent } = useTheme();

  // View mode: 'home' (public storefront homepage) | 'portal' (internal Rehani management) | 'login' (shadcn LoginPage1)
  const [viewMode, setViewMode] = useState<'home' | 'portal' | 'login'>('home');

  // Selected branch filter across the store
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');

  // Default tab depends on role: Cashier lands on cashier-desk, Admin lands on portal
  const [activeTab, setActiveTab] = useState<string>('portal');
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isAddCustomerWithItemsOpen, setIsAddCustomerWithItemsOpen] = useState(false);

  // Sync tab with role on login
  React.useEffect(() => {
    if (isCashier && (activeTab === 'portal' || activeTab === 'dashboard')) {
      setActiveTab('cashier-desk');
    }
  }, [isCashier]);

  // Cross-view state links
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [selectedCollateralId, setSelectedCollateralId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [applianceSearchQuery, setApplianceSearchQuery] = useState<string>('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [applianceForPayment, setApplianceForPayment] = useState<Appliance | null>(null);

  // Sub-navigation state for Staff & Cashiers secondary bar
  const [activeStaffSubTab, setActiveStaffSubTab] = useState<any>('cashiers');
  // Section state for Settings page
  const [settingsSection, setSettingsSection] = useState<string>('appearance');

  // Mobile View vs Desktop View management (defaults to auto based on viewport < 1024px)
  const [preferredViewMode, setPreferredViewMode] = useState<'auto' | 'mobile' | 'desktop'>(() => {
    try {
      const saved = localStorage.getItem('pekasa_view_mode');
      if (saved === 'mobile' || saved === 'desktop') return saved;
    } catch {}
    return 'auto';
  });

  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024;
    }
    return false;
  });

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isEffectiveMobile = preferredViewMode === 'mobile' || (preferredViewMode === 'auto' && isMobileScreen);

  const toggleMobileMode = () => {
    setPreferredViewMode((prev) => {
      const next = isEffectiveMobile ? 'desktop' : 'mobile';
      try {
        localStorage.setItem('pekasa_view_mode', next);
      } catch {}
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B2D4A] flex flex-col items-center justify-center text-slate-400 gap-4 p-4">
        <div className="w-14 h-14 rounded-2xl bg-[#FFD700]/10 border border-[#FFD700]/30 flex items-center justify-center text-[#FFD700] animate-pulse shadow-lg shadow-[#FFD700]/15">
          <Database className="w-7 h-7" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-xl font-black text-white tracking-wider uppercase">{STORE_NAME}</h2>
          <p className="text-xs text-[#FFD700] font-mono">Initializing WebAssembly SQLite Database...</p>
        </div>
      </div>
    );
  }

  // If in Public Homepage view
  if (viewMode === 'home') {
    return (
      <PublicHomePage
        onOpenPortal={() => {
          if (currentUser) {
            setViewMode('portal');
          } else {
            setViewMode('login');
          }
        }}
        isLoggedIn={!!currentUser}
      />
    );
  }

  // If in Login view (or not signed in when trying to view portal)
  if (viewMode === 'login' || !currentUser) {
    return (
      <LoginPage1
        onLogin={async (identifier, pass) => {
          const ok = await login(identifier, pass);
          if (ok) {
            setViewMode('portal');
          }
          return ok;
        }}
        onSuccess={() => setViewMode('portal')}
        onClose={() => setViewMode('home')}
        errorMessage={loginError}
      />
    );
  }

  const handleSelectApplianceFromOther = (applianceId: string) => {
    setSelectedCollateralId(applianceId);
    setActiveTab('collateral');
  };

  const handleSelectCustomerFromOther = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setActiveTab('customers');
  };

  const handleSearchInTab = (tab: string, query: string) => {
    if (tab === 'collateral' || tab === 'appliances') {
      setApplianceSearchQuery(query);
      setActiveTab('collateral');
    } else if (tab === 'customers') {
      setCustomerSearchQuery(query);
      setActiveTab('customers');
    } else {
      setActiveTab(tab);
    }
  };

  const handleOpenPaymentForAppliance = (appliance: Appliance) => {
    setApplianceForPayment(appliance);
    setActiveTab('payments');
  };

  // Dedicated Mobile Viewport Experience
  if (isEffectiveMobile) {
    return (
      <div className="relative min-h-screen bg-slate-950">
        <MobileApp
          onSwitchToDesktop={() => {
            setPreferredViewMode('desktop');
            try {
              localStorage.setItem('pekasa_view_mode', 'desktop');
            } catch {}
          }}
        />
        {/* Floating Desktop Switcher on wider screens if user forced mobile */}
        {typeof window !== 'undefined' && window.innerWidth >= 1024 && (
          <div className="fixed top-3 right-20 z-50">
            <button
              onClick={() => {
                setPreferredViewMode('desktop');
                try {
                  localStorage.setItem('pekasa_view_mode', 'desktop');
                } catch {}
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/20 text-xs font-bold text-white hover:bg-slate-800 flex items-center gap-1.5 shadow-xl cursor-pointer"
            >
              <Laptop className="w-3.5 h-3.5 text-[#0ABAB5]" />
              <span>Desktop View</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex font-sans transition-colors duration-200">
      {/* Left navigation panel (desktop) */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="flex-1 min-w-0 flex flex-col">
      {/* Top Header with Global Search, Avatar User Menu and Secondary Staff Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenBackup={() => setIsBackupOpen(true)}
        onSelectAppliance={handleSelectApplianceFromOther}
        onSelectCustomer={handleSelectCustomerFromOther}
        onSearchInTab={handleSearchInTab}
        onOpenAddCustomerWithItems={() => setIsAddCustomerWithItemsOpen(true)}
        onGoToHome={() => setViewMode('home')}
        activeStaffSubTab={activeStaffSubTab}
        onSelectStaffSubTab={(sub) => {
          setActiveStaffSubTab(sub);
          setActiveTab('partners');
        }}
        onNavigateToSettingsSection={(sec) => {
          setSettingsSection(sec);
          setActiveTab('settings');
        }}
        onToggleMobileMode={toggleMobileMode}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Cashier Dedicated Desk (Active when role is Cashier or tab is cashier-desk) */}
        {(activeTab === 'cashier-desk' || (isCashier && (activeTab === 'portal' || activeTab === 'dashboard'))) && (
          <CashierDashboard
            selectedBranchId={selectedBranchId}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onOpenIntake={() => setIsAddCustomerWithItemsOpen(true)}
          />
        )}

        {/* Personal Desk / Partner Portal (Landing page for Trevor & Peter) */}
        {!isCashier && activeTab === 'portal' && (
          <PartnerPersonalPortal
            user={currentUser}
            onNavigateToDashboard={() => setActiveTab('dashboard')}
            onOpenNewAppliance={() => {
              setSelectedCollateralId(null);
              setActiveTab('collateral');
            }}
            onOpenNewPayment={() => {
              setApplianceForPayment(null);
              setActiveTab('payments');
            }}
            onSelectAppliance={handleSelectApplianceFromOther}
            onSelectCustomer={handleSelectCustomerFromOther}
          />
        )}

        {/* Global Shop Command Center / Rehani Dashboard */}
        {!isCashier && activeTab === 'dashboard' && (
          <DashboardView
            selectedBranchId={selectedBranchId}
            onBranchChange={(bId) => setSelectedBranchId(bId)}
            onNavigate={(tab) => setActiveTab(tab)}
            onOpenNewLoan={() => {
              setSelectedLoanId(null);
              setActiveTab('loans');
            }}
            onOpenNewCollateral={() => {
              setSelectedCollateralId(null);
              setActiveTab('collateral');
            }}
            onOpenNewPayment={() => {
              setActiveTab('payments');
            }}
            onOpenAddCustomerWithItems={() => setIsAddCustomerWithItemsOpen(true)}
            onSelectLoan={(loanId) => {
              setSelectedLoanId(loanId);
              setActiveTab('loans');
            }}
            onSelectCustomer={(custId) => {
              setSelectedCustomerId(custId);
              setActiveTab('customers');
            }}
          />
        )}

        {/* Rehani Loans View (Pawn Tickets, LTV Limits, Grace Period & Renewals) */}
        {activeTab === 'loans' && (
          <LoansView
            selectedBranchId={selectedBranchId}
            initialSelectedLoanId={selectedLoanId}
            onSelectCustomer={(custId) => {
              setSelectedCustomerId(custId);
              setActiveTab('customers');
            }}
            onSelectCollateral={(colId) => {
              setSelectedCollateralId(colId);
              setActiveTab('collateral');
            }}
            onOpenAddCustomerWithItems={() => setIsAddCustomerWithItemsOpen(true)}
          />
        )}

        {/* Collateral Vault (Physical items, TV/Laptop Specs, Storage Rack/Shelf, IMEI Check) */}
        {(activeTab === 'collateral' || activeTab === 'appliances') && (
          <CollateralView
            selectedBranchId={selectedBranchId}
            initialSelectedCollateralId={selectedCollateralId}
            onSelectCustomer={(custId) => {
              setSelectedCustomerId(custId);
              setActiveTab('customers');
            }}
            onOpenNewLoanForCollateral={(colId) => {
              setSelectedCollateralId(colId);
              setActiveTab('loans');
            }}
            onOpenAddCustomerWithItems={() => setIsAddCustomerWithItemsOpen(true)}
          />
        )}

        {/* Customers View (Permanent CUS profiles, credit metrics, full history) */}
        {activeTab === 'customers' && (
          <CustomersView
            selectedCustomerId={selectedCustomerId}
            initialSearchQuery={customerSearchQuery}
            onClearSelectedCustomer={() => setSelectedCustomerId(null)}
            onSelectAppliance={(colId) => {
              setSelectedCollateralId(colId);
              setActiveTab('collateral');
            }}
            onOpenNewApplianceForCustomer={(_custId) => {
              setSelectedCollateralId(null);
              setActiveTab('collateral');
            }}
          />
        )}

        {/* Ledger & Payments (Immutable ledger, thermal receipts, M-Pesa tracking) */}
        {activeTab === 'payments' && (
          <PaymentsView
            initialApplianceForPayment={applianceForPayment}
            onClearInitialAppliance={() => setApplianceForPayment(null)}
          />
        )}

        {/* Collateral Sales (Statutory disposition workflow - Admin Exclusive) */}
        {activeTab === 'sales' && (
          isCashier ? (
            <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4 max-w-lg mx-auto my-12">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white text-base">Senior Partner Authorization Required</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Collateral liquidation and default sale authorization is reserved exclusively for Directors
                <strong> Trevor Mbugua</strong> and <strong>Peter Kamau</strong>.
              </p>
              <button
                onClick={() => setActiveTab('cashier-desk')}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow-md"
              >
                Return to Cashier Counter Desk
              </button>
            </div>
          ) : (
            <SalesView selectedBranchId={selectedBranchId} />
          )
        )}

        {/* Treasury & Operating Expenses (Admin Exclusive) */}
        {activeTab === 'treasury' && (
          isCashier ? (
            <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4 max-w-lg mx-auto my-12">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white text-base">Financials & Capital Vault Restricted</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Store treasury capital, partner drawings, bank balances, and P&L financial reports are protected and
                accessible only to Senior Partners.
              </p>
              <button
                onClick={() => setActiveTab('cashier-desk')}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow-md"
              >
                Return to Cashier Counter Desk
              </button>
            </div>
          ) : (
            <TreasuryExpensesView selectedBranchId={selectedBranchId} />
          )
        )}

        {/* Parts & Stock Inventory */}
        {activeTab === 'inventory' && <InventoryPartsView />}

        {/* Admin-only personal trades: independent of Rehani and shop stock */}
        {activeTab === 'personal-goods' && (
          isAdmin ? <PersonalGoodsView /> : <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center text-rose-700 dark:text-rose-300">Administrator access required.</div>
        )}

        {/* Admin, Staff Roles & System Reports (Admin Exclusive) */}
        {activeTab === 'partners' && (
          isCashier ? (
            <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4 max-w-lg mx-auto my-12">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white text-base">Administrator Hub Restricted</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Staff account provisioning, cashier permission matrix, and system audit logs require Senior Partner credentials.
              </p>
              <button
                onClick={() => setActiveTab('cashier-desk')}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow-md"
              >
                Return to Cashier Counter Desk
              </button>
            </div>
          ) : (
            <PartnersView
              activeSubTab={activeStaffSubTab}
              onSubTabChange={(sub) => setActiveStaffSubTab(sub)}
            />
          )
        )}

        {/* User Profile View (Photo upload, credentials, password change, audit) */}
        {activeTab === 'profile' && (
          <UserProfileView
            onNavigateToSettings={(sec) => {
              if (sec) setSettingsSection(sec);
              setActiveTab('settings');
            }}
          />
        )}

        {/* Settings & Appearance View (Full Theme Customizer, Notifications, Business, Security & Data) */}
        {activeTab === 'settings' && (
          <SettingsView
            initialSection={settingsSection}
            onNavigateToProfile={() => setActiveTab('profile')}
          />
        )}
      </main>

      {/* Footer with Glassmorphic styling & Theme controls */}
      <footer className="border-t border-white/10 bg-black/60 backdrop-blur-md py-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-black uppercase tracking-wider" style={{ color: currentAccent.primary }}>
              {STORE_NAME}
            </span>
            <span>·</span>
            <span className="italic max-w-md truncate text-slate-300">"{STORE_MOTTO}"</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-400">
            {/* Quick Daytime / Nighttime Switch in Footer */}
            <button
              onClick={toggleThemeMode}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer text-slate-200"
              title="Toggle between Tiffany Dark and Professional Light mode"
            >
              {themeMode === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Switch to Professional Light (Daytime)</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-[#0ABAB5]" />
                  <span>Switch to Tiffany Dark (Night)</span>
                </>
              )}
            </button>

            <button
              onClick={openThemePanel}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer text-slate-200 font-semibold"
              title="Open Theme & Accent Color Setting Panel"
            >
              <Palette className="w-3.5 h-3.5" style={{ color: currentAccent.primary }} />
              <span>Theme Panel</span>
            </button>

            <button
              onClick={toggleMobileMode}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer text-slate-200 font-semibold"
              title="Switch to Mobile-First Experience"
            >
              <Smartphone className="w-3.5 h-3.5 text-[#0ABAB5]" />
              <span>Mobile View</span>
            </button>

            <span>·</span>
            <button
              onClick={() => setIsBackupOpen(true)}
              className="hover:underline transition-colors cursor-pointer font-semibold"
              style={{ color: currentAccent.primary }}
            >
              Export SQLite Database
            </button>
          </div>
        </div>
      </footer>
      </div>

      {/* Floating Quick Theme Setting Button on bottom right for instant daytime/nighttime counter access */}
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2">
        <button
          onClick={toggleThemeMode}
          className="p-3 rounded-full bg-black/80 hover:bg-black text-white border border-white/20 shadow-2xl backdrop-blur-md cursor-pointer transition-all hover:scale-105 active:scale-95"
          title={themeMode === 'dark' ? 'Toggle Professional Light (Daytime)' : 'Toggle Tiffany Dark (Night)'}
        >
          {themeMode === 'dark' ? (
            <Sun className="w-5 h-5 text-amber-400" />
          ) : (
            <Moon className="w-5 h-5" style={{ color: currentAccent.primary }} />
          )}
        </button>

        <button
          onClick={openThemePanel}
          className="p-3 rounded-full shadow-2xl backdrop-blur-md cursor-pointer transition-all hover:scale-105 active:scale-95 text-black font-extrabold"
          style={{ backgroundColor: currentAccent.primary }}
          title="Open Theme Colour Setting Panel (Saved to LocalStorage)"
        >
          <Palette className="w-5 h-5" />
        </button>
      </div>

      {/* SQLite Backup & Restore Modal */}
      <BackupRestoreModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
      />

      {/* Unified Add Customer & Collateral Modal (Strict 2-Week & 30% Interest) */}
      <AddCustomerWithItemsModal
        isOpen={isAddCustomerWithItemsOpen}
        onClose={() => setIsAddCustomerWithItemsOpen(false)}
        defaultBranchId={selectedBranchId}
        onSuccess={(custId, loanId, colId) => {
          setSelectedCustomerId(custId);
          setSelectedLoanId(loanId);
          setSelectedCollateralId(colId);
        }}
      />

      {/* Theme Colour Setting Panel */}
      <ThemeSettingsPanel />
    </div>
  );
};

export default function App() {
  return (
    <CloudSyncGate>
      <ThemeProvider>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </ThemeProvider>
    </CloudSyncGate>
  );
}
