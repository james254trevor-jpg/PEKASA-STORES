import React from 'react';
import { Bell, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { STORE_NAME } from '../../types';

interface MobileHeaderProps {
  title?: string;
  subtitle?: string;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  unreadCount?: number;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  subtitle,
  onOpenNotifications,
  onOpenProfile,
  unreadCount = 2
}) => {
  const { currentUser } = useAuth();
  const { currentAccent } = useTheme();

  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 dark:bg-black/80 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between transition-colors">
      {/* Left: Store Wordmark or Current Section Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div 
          className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-black shrink-0 shadow-md shadow-[#0ABAB5]/20"
          style={{ backgroundColor: currentAccent.primary }}
        >
          <span className="text-base font-black">P</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-black tracking-tight text-white truncate leading-tight">
            {title || STORE_NAME}
          </h1>
          {subtitle && (
            <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right: Notifications & Profile Avatar */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Notification Bell */}
        <button
          onClick={onOpenNotifications}
          className="relative w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 flex items-center justify-center text-slate-200 transition-colors"
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </button>

        {/* Profile Avatar Button */}
        <button
          onClick={onOpenProfile}
          className="w-9 h-9 rounded-xl bg-slate-800 border border-white/20 overflow-hidden flex items-center justify-center font-bold text-xs text-white shrink-0 hover:border-[#0ABAB5] transition-all"
          title="My Profile & Settings"
          aria-label="My Profile"
        >
          {currentUser?.avatar_url ? (
            <img src={currentUser.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[#0ABAB5] font-black">{currentUser?.full_name?.charAt(0) || 'U'}</span>
          )}
        </button>
      </div>
    </header>
  );
};
