import type { LucideIcon } from 'lucide-react';
import {
  Wallet,
  Users,
  FileText,
  Package,
  Receipt,
  Home,
  LayoutDashboard,
  BookOpen,
  Tag,
  Landmark,
  UserCog
} from 'lucide-react';

export interface NavLink {
  id: string;
  label: string;
  icon: LucideIcon;
  isPersonal?: boolean;
}

/**
 * Role-based navigation shared by the left sidebar (desktop)
 * and the compact nav bar (mobile).
 */
export const getNavLinks = (isCashier: boolean, partnerDeskTitle: string): NavLink[] =>
  isCashier
    ? [
        { id: 'cashier-desk', label: 'Cashier Desk', icon: Wallet },
        { id: 'customers', label: 'Customers', icon: Users },
        { id: 'loans', label: 'Loans & Tickets', icon: FileText },
        { id: 'collateral', label: 'Collateral Vault', icon: Package },
        { id: 'payments', label: 'Receive Payment', icon: Receipt }
      ]
    : [
        { id: 'portal', label: partnerDeskTitle, icon: Home, isPersonal: true },
        { id: 'dashboard', label: 'Command Center', icon: LayoutDashboard },
        { id: 'loans', label: 'Rehani Loans', icon: FileText },
        { id: 'collateral', label: 'Collateral Vault', icon: Package },
        { id: 'customers', label: 'Customers', icon: Users },
        { id: 'payments', label: 'Ledger', icon: BookOpen },
        { id: 'sales', label: 'Collateral Sales', icon: Tag },
        { id: 'treasury', label: 'Treasury & Expenses', icon: Landmark },
        { id: 'partners', label: 'Staff & Cashiers', icon: UserCog }
      ];

export const isNavLinkActive = (
  linkId: string,
  activeTab: string,
  isCashier: boolean
): boolean =>
  activeTab === linkId ||
  (isCashier && linkId === 'cashier-desk' && activeTab === 'portal');
