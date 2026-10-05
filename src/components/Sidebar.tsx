import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getNavLinks, isNavLinkActive } from '../navigation';
import { ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { currentUser, isCashier } = useAuth();
  const { currentAccent } = useTheme();

  // Collapsed icon-only mode with localStorage persistence
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('pekasa_sidebar_collapsed');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('pekasa_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const isTrevor = currentUser?.username?.toLowerCase() === 'trevor';
  const partnerDeskTitle = isTrevor ? "Trevor's Desk" : "Peter's Desk";
  const navLinks = getNavLinks(isCashier, partnerDeskTitle);

  return (
    <aside
      className={`hidden lg:flex flex-col shrink-0 sticky top-0 h-screen overflow-y-auto bg-black/60 border-r border-white/10 backdrop-blur-xl transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-60'
      }`}
      aria-label="Main navigation"
    >
      <div className={`h-16 shrink-0 flex items-center border-b border-white/10 px-4 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed && (
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Navigation
          </span>
        )}
        <button
          onClick={toggleCollapsed}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar to Icons'}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-4 h-4 text-[#0ABAB5]" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>
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
              title={isCollapsed ? link.label : undefined}
              className={`w-full flex items-center rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                isCollapsed
                  ? 'justify-center p-3'
                  : 'gap-3 px-3 py-2.5 text-left'
              } ${
                isActive
                  ? 'bg-[#0ABAB5] text-black border-[#0ABAB5] font-extrabold shadow-lg shadow-[#0ABAB5]/20'
                  : link.isPersonal
                  ? 'bg-white/5 text-[#0ABAB5] border-[#0ABAB5]/30 hover:bg-[#0ABAB5]/10'
                  : 'text-slate-300 border-transparent hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="truncate">{link.label}</span>}
            </button>
          );
        })}
      </nav>

      {currentUser && (
        <button
          onClick={() => setActiveTab('profile')}
          className={`shrink-0 border-t border-white/10 text-xs text-left hover:bg-white/5 transition-colors cursor-pointer flex items-center w-full ${
            isCollapsed ? 'justify-center p-3.5' : 'gap-3 p-3.5'
          }`}
          title={isCollapsed ? `My Profile (${currentUser.full_name})` : 'Open My User Profile'}
        >
          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-white/20 flex items-center justify-center font-bold text-white text-xs overflow-hidden shrink-0">
            {currentUser.avatar_url ? (
              <img src={currentUser.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[#0ABAB5] font-black">{currentUser.full_name?.charAt(0) || 'U'}</span>
            )}
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="font-bold text-white truncate">{currentUser.full_name}</div>
              <div className="text-[11px] text-slate-400 truncate">{currentUser.role_title}</div>
            </div>
          )}
        </button>
      )}
    </aside>
  );
};
