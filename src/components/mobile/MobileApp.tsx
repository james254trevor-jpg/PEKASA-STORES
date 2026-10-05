import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { CollateralItem, Customer, STORE_NAME, STORE_MOTTO } from '../../types';
import { MobileHeader } from './MobileHeader';
import { MobileBottomNav, MobileTab } from './MobileBottomNav';
import { MobileHomeView } from './MobileHomeView';
import { MobileSalesPOS } from './MobileSalesPOS';
import { MobileInventoryView } from './MobileInventoryView';
import { MobileProductDetailView } from './MobileProductDetailView';
import { MobileCustomersView } from './MobileCustomersView';
import { MobileCustomerProfileView } from './MobileCustomerProfileView';
import { MobileMoreView } from './MobileMoreView';
import { MobileNotificationsSheet } from './MobileNotificationsSheet';
import { MobileAddProductModal } from './MobileAddProductModal';
import { MobileAddCustomerModal } from './MobileAddCustomerModal';
import { UserProfileView } from '../UserProfileView';
import { SettingsView } from '../SettingsView';
import { BackupRestoreModal } from '../BackupRestoreModal';
import { LoansView } from '../LoansView';
import { CollateralView } from '../CollateralView';
import { PartnersView } from '../PartnersView';
import { TreasuryExpensesView } from '../TreasuryExpensesView';
import { Plus, X, ArrowLeft } from 'lucide-react';

interface MobileAppProps {
  onSwitchToDesktop?: () => void;
}

export const MobileApp: React.FC<MobileAppProps> = ({ onSwitchToDesktop }) => {
  const { currentUser, isAdmin } = useAuth();
  const { currentAccent } = useTheme();

  // Navigation tab: 'home' | 'sales' | 'inventory' | 'customers' | 'more' | 'profile' | 'settings' | 'loans' | 'collateral' | 'reports' | 'employees' | 'suppliers' | 'repairs'
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [activeSubView, setActiveSubView] = useState<string | null>(null);

  // Selected item / customer for full screen details
  const [selectedProduct, setSelectedProduct] = useState<CollateralItem | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [posProductToSell, setPosProductToSell] = useState<CollateralItem | null>(null);

  // Settings initial section
  const [settingsSection, setSettingsSection] = useState<string>('appearance');

  // Modals & Bottom Sheets
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);

  // Handle switching to product detail
  const handleOpenProduct = (product: CollateralItem) => {
    setSelectedProduct(product);
  };

  // Handle selling an item directly from product detail
  const handleSellProduct = (product: CollateralItem) => {
    setSelectedProduct(null);
    setPosProductToSell(product);
    setActiveTab('sales');
    setActiveSubView(null);
  };

  // Title for top header
  const getHeaderTitle = () => {
    if (activeSubView === 'profile') return 'My Profile';
    if (activeSubView === 'settings') return 'Settings';
    if (activeSubView === 'loans') return 'Rehani Loans';
    if (activeSubView === 'collateral') return 'Collateral Vault';
    if (activeSubView === 'reports') return 'Store Reports';
    if (activeSubView === 'employees') return 'Staff & Cashiers';
    if (activeSubView === 'suppliers') return 'Suppliers';
    if (activeSubView === 'repairs') return 'Technician Hub';

    switch (activeTab) {
      case 'home':
        return STORE_NAME;
      case 'sales':
        return 'Point of Sale';
      case 'inventory':
        return 'Inventory';
      case 'customers':
        return 'Customers';
      case 'more':
        return 'Menu & Tools';
      default:
        return STORE_NAME;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* 1. Dedicated Mobile Top Header */}
      {!selectedProduct && !selectedCustomer && (
        <MobileHeader
          title={getHeaderTitle()}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onOpenProfile={() => {
            setActiveSubView('profile');
          }}
          unreadCount={2}
        />
      )}

      {/* Subview Back Header (if viewing a secondary page like settings or reports) */}
      {activeSubView && !selectedProduct && !selectedCustomer && (
        <div className="bg-slate-900 border-b border-white/10 px-4 py-2 flex items-center justify-between">
          <button
            onClick={() => setActiveSubView(null)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to main</span>
          </button>
          <span className="text-xs font-mono text-slate-400 capitalize">{activeSubView}</span>
        </div>
      )}

      {/* 2. Scrollable Content Area */}
      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-3">
        {/* Full-Screen Product Details View */}
        {selectedProduct ? (
          <MobileProductDetailView
            product={selectedProduct}
            onBack={() => setSelectedProduct(null)}
            onSellItem={handleSellProduct}
            onEditItem={() => {
              // Could open edit item
            }}
          />
        ) : selectedCustomer ? (
          /* Full-Screen Customer Profile View */
          <MobileCustomerProfileView
            customer={selectedCustomer}
            onBack={() => setSelectedCustomer(null)}
            onNewSaleForCustomer={(cust) => {
              setSelectedCustomer(null);
              setActiveTab('sales');
            }}
          />
        ) : activeSubView === 'profile' ? (
          /* User Profile View */
          <UserProfileView
            onNavigateToSettings={(sec) => {
              if (sec) setSettingsSection(sec);
              setActiveSubView('settings');
            }}
          />
        ) : activeSubView === 'settings' ? (
          /* Settings View */
          <SettingsView
            initialSection={settingsSection}
            onNavigateToProfile={() => setActiveSubView('profile')}
          />
        ) : activeSubView === 'loans' ? (
          /* Loans View */
          <LoansView selectedBranchId="ALL" onOpenAddCustomerWithItems={() => setIsAddProductOpen(true)} />
        ) : activeSubView === 'collateral' ? (
          /* Collateral View */
          <CollateralView selectedBranchId="ALL" onOpenAddCustomerWithItems={() => setIsAddProductOpen(true)} />
        ) : activeSubView === 'reports' ? (
          /* Reports View */
          <TreasuryExpensesView selectedBranchId="ALL" />
        ) : activeSubView === 'employees' ? (
          /* Staff & Cashiers View */
          <PartnersView activeSubTab="cashiers" />
        ) : activeSubView === 'suppliers' ? (
          /* Suppliers View */
          <PartnersView activeSubTab="suppliers" />
        ) : activeSubView === 'repairs' ? (
          /* Repairs View */
          <PartnersView activeSubTab="technicians" />
        ) : (
          /* Primary 5 Tabs */
          <>
            {activeTab === 'home' && (
              <MobileHomeView
                onNavigateTab={(tab) => {
                  setActiveTab(tab);
                  setActiveSubView(null);
                }}
                onOpenNewSale={() => {
                  setPosProductToSell(null);
                  setActiveTab('sales');
                }}
                onOpenAddItem={() => setIsAddProductOpen(true)}
                onOpenAddCustomer={() => setIsAddCustomerOpen(true)}
              />
            )}

            {activeTab === 'sales' && (
              <MobileSalesPOS
                initialProduct={posProductToSell}
                onClearInitialProduct={() => setPosProductToSell(null)}
                onDone={() => setActiveTab('home')}
              />
            )}

            {activeTab === 'inventory' && (
              <MobileInventoryView
                onSelectProduct={handleOpenProduct}
                onOpenAddItem={() => setIsAddProductOpen(true)}
              />
            )}

            {activeTab === 'customers' && (
              <MobileCustomersView
                onSelectCustomer={(cust) => setSelectedCustomer(cust)}
                onOpenAddCustomer={() => setIsAddCustomerOpen(true)}
              />
            )}

            {activeTab === 'more' && (
              <MobileMoreView
                onOpenPurchases={() => {
                  setPosProductToSell(null);
                  setActiveTab('sales');
                }}
                onOpenSuppliers={() => setActiveSubView('suppliers')}
                onOpenRepairs={() => setActiveSubView('repairs')}
                onOpenReports={() => setActiveSubView('reports')}
                onOpenEmployees={() => setActiveSubView('employees')}
                onOpenNotifications={() => setIsNotificationsOpen(true)}
                onOpenSettings={(sec) => {
                  if (sec) setSettingsSection(sec);
                  setActiveSubView('settings');
                }}
                onOpenBusinessProfile={() => {
                  setSettingsSection('business');
                  setActiveSubView('settings');
                }}
                onOpenBackup={() => setIsBackupOpen(true)}
                onOpenHelp={() => alert(`Official Helpline: 0727108749 / 0180366344\nDirectors: Trevor Mbugua & Peter Kamau\nNairobi, Kenya`)}
                onOpenLoans={() => setActiveSubView('loans')}
                onOpenCollateral={() => setActiveSubView('collateral')}
              />
            )}
          </>
        )}
      </main>

      {/* 3. Floating Action Button (FAB) (Only on main tabs) */}
      {!selectedProduct && !selectedCustomer && !activeSubView && activeTab !== 'sales' && (
        <div className="fixed bottom-20 right-5 z-40">
          <button
            onClick={() => setIsFabOpen(!isFabOpen)}
            className="w-14 h-14 rounded-full bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black shadow-2xl shadow-[#0ABAB5]/30 flex items-center justify-center font-black active:scale-95 transition-all"
            aria-label="Quick Actions"
          >
            {isFabOpen ? <X className="w-6 h-6 stroke-[3]" /> : <Plus className="w-6 h-6 stroke-[3]" />}
          </button>

          {/* FAB Action Menu Popup */}
          {isFabOpen && (
            <div className="absolute bottom-16 right-0 mb-2 w-48 bg-slate-900 border border-white/20 rounded-2xl shadow-2xl p-2 space-y-1 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => {
                  setIsFabOpen(false);
                  setPosProductToSell(null);
                  setActiveTab('sales');
                  setActiveSubView(null);
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-white hover:bg-white/10 flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>New Sale POS</span>
              </button>

              <button
                onClick={() => {
                  setIsFabOpen(false);
                  setIsAddProductOpen(true);
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-white hover:bg-white/10 flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span>+ Add Product</span>
              </button>

              <button
                onClick={() => {
                  setIsFabOpen(false);
                  setIsAddCustomerOpen(true);
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-white hover:bg-white/10 flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <span>+ Add Customer</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. Fixed Bottom Navigation Bar (Hidden when on product/customer details) */}
      {!selectedProduct && !selectedCustomer && (
        <MobileBottomNav
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setActiveSubView(null);
          }}
        />
      )}

      {/* 5. Modals & Bottom Sheets */}
      <MobileNotificationsSheet
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />

      <MobileAddProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        onSuccess={() => {
          setActiveTab('inventory');
          setActiveSubView(null);
        }}
      />

      <MobileAddCustomerModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        onSuccess={(c) => {
          setSelectedCustomer(c);
        }}
      />

      <BackupRestoreModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
      />
    </div>
  );
};
