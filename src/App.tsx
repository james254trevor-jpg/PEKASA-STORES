import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { LoginModal } from './components/LoginModal';
import { DashboardView } from './components/DashboardView';
import { PartnerPersonalPortal } from './components/PartnerPersonalPortal';
import { AppliancesView } from './components/AppliancesView';
import { CustomersView } from './components/CustomersView';
import { PaymentsView } from './components/PaymentsView';
import { InventoryPartsView } from './components/InventoryPartsView';
import { PartnersView } from './components/PartnersView';
import { BackupRestoreModal } from './components/BackupRestoreModal';
import { ThemeSettingsPanel } from './components/ThemeSettingsPanel';
import { Appliance, STORE_NAME, STORE_MOTTO } from './types';
import { Database, HardDrive, Shield, Sun, Moon, Palette } from 'lucide-react';

const MainApp: React.FC = () => {
  const { currentUser, isLoading } = useAuth();
  const { themeMode, toggleThemeMode, openThemePanel, currentAccent } = useTheme();

  // Each partner lands directly on their personal desk upon sign in
  const [activeTab, setActiveTab] = useState<string>('portal');
  const [isBackupOpen, setIsBackupOpen] = useState(false);

  // Cross-view state links
  const [selectedApplianceId, setSelectedApplianceId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [applianceSearchQuery, setApplianceSearchQuery] = useState<string>('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [applianceForPayment, setApplianceForPayment] = useState<Appliance | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#06090e] flex flex-col items-center justify-center text-slate-400 gap-4 p-4">
        <div className="w-14 h-14 rounded-2xl bg-[#0ABAB5]/10 border border-[#0ABAB5]/30 flex items-center justify-center text-[#0ABAB5] animate-pulse shadow-lg shadow-[#0ABAB5]/15">
          <Database className="w-7 h-7" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-xl font-black text-white tracking-wider uppercase">{STORE_NAME}</h2>
          <p className="text-xs text-[#0ABAB5] font-mono">Initializing WebAssembly SQLite Database...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginModal />;
  }

  const handleSelectApplianceFromOther = (applianceId: string) => {
    setSelectedApplianceId(applianceId);
    setActiveTab('appliances');
  };

  const handleSelectCustomerFromOther = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setActiveTab('customers');
  };

  const handleSearchInTab = (tab: string, query: string) => {
    if (tab === 'appliances') {
      setApplianceSearchQuery(query);
      setActiveTab('appliances');
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

  return (
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-200">
      {/* Top Header with Global Search and Theme Controls */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenBackup={() => setIsBackupOpen(true)}
        onSelectAppliance={handleSelectApplianceFromOther}
        onSelectCustomer={handleSelectCustomerFromOther}
        onSearchInTab={handleSearchInTab}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Personal Desk / Partner Portal (Landing page for Trevor & Peter) */}
        {activeTab === 'portal' && (
          <PartnerPersonalPortal
            user={currentUser}
            onNavigateToDashboard={() => setActiveTab('dashboard')}
            onOpenNewAppliance={() => {
              setSelectedApplianceId(null);
              setApplianceSearchQuery('');
              setActiveTab('appliances');
            }}
            onOpenNewPayment={() => {
              setApplianceForPayment(null);
              setActiveTab('payments');
            }}
            onSelectAppliance={handleSelectApplianceFromOther}
            onSelectCustomer={handleSelectCustomerFromOther}
          />
        )}

        {/* Global Shop Dashboard */}
        {activeTab === 'dashboard' && (
          <DashboardView
            onSelectAppliance={handleSelectApplianceFromOther}
            onSelectCustomer={handleSelectCustomerFromOther}
            onOpenNewAppliance={() => {
              setSelectedApplianceId(null);
              setActiveTab('appliances');
            }}
            onOpenNewPayment={() => {
              setApplianceForPayment(null);
              setActiveTab('payments');
            }}
            onOpenNewCustomer={() => {
              setSelectedCustomerId(null);
              setActiveTab('customers');
            }}
            onOpenPersonalPortal={() => {
              setActiveTab('portal');
            }}
          />
        )}

        {/* Appliances View */}
        {activeTab === 'appliances' && (
          <AppliancesView
            selectedApplianceId={selectedApplianceId}
            initialSearchQuery={applianceSearchQuery}
            onClearSelectedAppliance={() => setSelectedApplianceId(null)}
            onOpenPaymentForAppliance={handleOpenPaymentForAppliance}
          />
        )}

        {/* Customers View */}
        {activeTab === 'customers' && (
          <CustomersView
            selectedCustomerId={selectedCustomerId}
            initialSearchQuery={customerSearchQuery}
            onClearSelectedCustomer={() => setSelectedCustomerId(null)}
            onSelectAppliance={handleSelectApplianceFromOther}
            onOpenNewApplianceForCustomer={(custId) => {
              setSelectedApplianceId(null);
              setActiveTab('appliances');
            }}
          />
        )}

        {/* Payments View */}
        {activeTab === 'payments' && (
          <PaymentsView
            initialApplianceForPayment={applianceForPayment}
            onClearInitialAppliance={() => setApplianceForPayment(null)}
          />
        )}

        {activeTab === 'inventory' && <InventoryPartsView />}

        {activeTab === 'partners' && <PartnersView />}
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

      {/* Theme Colour Setting Panel */}
      <ThemeSettingsPanel />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
