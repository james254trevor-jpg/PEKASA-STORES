import React from 'react';
import { useAuth } from '../context/AuthContext';
import { getNavLinks, isNavLinkActive } from '../navigation';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { currentUser, isCashier } = useAuth();

  const isTrevor = currentUser?.username?.toLowerCase() === 'trevor';
  const partnerDeskTitle = isTrevor ? "Trevor's Desk" : "Peter's Desk";
  const navLinks = getNavLinks(isCashier, partnerDeskTitle);

  return (
    <aside
      className="hidden lg:flex flex-col w-60 shrink-0 sticky top-0 h-screen overflow-y-auto bg-black/60 border-r border-white/10 backdrop-blur-xl"
      aria-label="Main navigation"
    >
      <div className="h-16 shrink-0 flex items-center px-5 border-b border-white/10">
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
          Navigation
        </span>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = isNavLinkActive(link.id, activeTab, isCashier);
          return (
            <button
              key={link.id}
              onClick={() => setActiveTab(link.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm font-semibold text-left transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#0ABAB5] text-black border-[#0ABAB5] font-extrabold shadow-lg shadow-[#0ABAB5]/20'
                  : link.isPersonal
                  ? 'bg-white/5 text-[#0ABAB5] border-[#0ABAB5]/30 hover:bg-[#0ABAB5]/10'
                  : 'text-slate-300 border-transparent hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{link.label}</span>
            </button>
          );
        })}
      </nav>

      {currentUser && (
        <div className="shrink-0 p-4 border-t border-white/10 text-xs">
          <div className="font-bold text-white truncate">{currentUser.full_name}</div>
          <div className="text-slate-400 truncate">{currentUser.role_title}</div>
        </div>
      )}
    </aside>
  );
};
