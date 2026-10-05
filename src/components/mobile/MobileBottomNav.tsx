import React from 'react';
import { Home, ShoppingBag, Package, Users, Menu } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export type MobileTab = 'home' | 'sales' | 'inventory' | 'customers' | 'more';

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange
}) => {
  const { currentAccent } = useTheme();

  const navItems: { id: MobileTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'sales', label: 'Sales', icon: ShoppingBag },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'more', label: 'More', icon: Menu }
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/90 dark:bg-black/90 backdrop-blur-xl border-t border-white/10 px-2 py-1.5 safe-area-bottom shadow-2xl transition-colors"
      aria-label="Mobile navigation"
    >
      <div className="max-w-md mx-auto grid grid-cols-5 gap-1 items-center">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer select-none ${
                isActive
                  ? 'text-white'
                  : 'text-slate-400 hover:text-slate-200 active:scale-95'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all ${
                  isActive
                    ? 'shadow-md shadow-[#0ABAB5]/20 scale-105'
                    : 'bg-transparent'
                }`}
                style={isActive ? { backgroundColor: `${currentAccent.primary}20` } : undefined}
              >
                <Icon
                  className="w-5 h-5 transition-transform"
                  style={isActive ? { color: currentAccent.primary } : undefined}
                />
              </div>
              <span
                className={`text-[10px] tracking-tight mt-0.5 font-bold truncate max-w-full ${
                  isActive ? 'font-black' : 'font-medium'
                }`}
                style={isActive ? { color: currentAccent.primary } : undefined}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
