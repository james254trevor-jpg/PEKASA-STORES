import React from 'react';
import { X, Bell, CheckCircle2, AlertTriangle, Package, DollarSign, Clock, Shield } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export interface MobileNotificationItem {
  id: string;
  type: 'sale' | 'stock' | 'payment' | 'system';
  title: string;
  description: string;
  time: string;
  group: 'today' | 'yesterday' | 'earlier';
  unread: boolean;
}

interface MobileNotificationsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileNotificationsSheet: React.FC<MobileNotificationsSheetProps> = ({
  isOpen,
  onClose
}) => {
  const { currentAccent } = useTheme();

  const [notifications, setNotifications] = React.useState<MobileNotificationItem[]>([
    {
      id: 'notif-1',
      type: 'sale',
      title: 'New Cash Sale Recorded',
      description: 'Sony Bravia 55" 4K Smart TV sold for KSh 48,000.',
      time: '12 mins ago',
      group: 'today',
      unread: true
    },
    {
      id: 'notif-2',
      type: 'payment',
      title: 'M-Pesa Payment Received',
      description: 'Customer Mary Wambui paid KSh 8,500 via Till.',
      time: '1 hour ago',
      group: 'today',
      unread: true
    },
    {
      id: 'notif-3',
      type: 'stock',
      title: 'Low Stock Alert',
      description: 'Only 2 Refilled 13kg Gas Cylinders remaining.',
      time: '4 hours ago',
      group: 'today',
      unread: false
    },
    {
      id: 'notif-4',
      type: 'payment',
      title: 'Loan Maturity Notice',
      description: 'Rehani loan LN-2026-004521 reaches grace period today.',
      time: 'Yesterday, 4:15 PM',
      group: 'yesterday',
      unread: false
    },
    {
      id: 'notif-5',
      type: 'system',
      title: 'Automatic SQLite Backup Completed',
      description: 'Database snapshot verified and synced to offline storage.',
      time: 'Yesterday, 8:00 AM',
      group: 'yesterday',
      unread: false
    },
    {
      id: 'notif-6',
      type: 'sale',
      title: 'Intake Completed',
      description: 'Samsung Double Door Fridge added to vault.',
      time: '3 days ago',
      group: 'earlier',
      unread: false
    }
  ]);

  if (!isOpen) return null;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const getIcon = (type: MobileNotificationItem['type']) => {
    switch (type) {
      case 'sale':
        return <DollarSign className="w-4 h-4 text-emerald-400" />;
      case 'stock':
        return <Package className="w-4 h-4 text-amber-400" />;
      case 'payment':
        return <CheckCircle2 className="w-4 h-4 text-blue-400" />;
      default:
        return <Shield className="w-4 h-4 text-purple-400" />;
    }
  };

  const renderGroup = (groupName: 'today' | 'yesterday' | 'earlier', label: string) => {
    const items = notifications.filter((n) => n.group === groupName);
    if (items.length === 0) return null;

    return (
      <div className="space-y-3">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
          {label}
        </h4>
        <div className="space-y-2.5">
          {items.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                item.unread
                  ? 'bg-white/10 dark:bg-slate-800/80 border-white/20 dark:border-white/15 shadow-sm'
                  : 'bg-white/5 dark:bg-slate-900/60 border-white/10 dark:border-slate-800/80 text-slate-300'
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-white/10 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-white/10 mt-0.5">
                {getIcon(item.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h5 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {item.title}
                  </h5>
                  {item.unread && (
                    <span className="w-2 h-2 rounded-full bg-[#0ABAB5] shrink-0" />
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  {item.description}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-2">
                  <Clock className="w-3 h-3" />
                  <span>{item.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Backdrop tap to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Bottom Sheet Modal */}
      <div className="w-full max-h-[85vh] bg-slate-900/95 border-t border-white/15 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl animate-in slide-in-from-bottom duration-300">
        {/* Handlebar */}
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 mb-1" />

        {/* Header */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-[#0ABAB5]">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Notifications</h3>
              <p className="text-[11px] text-slate-400">Store alerts & activity updates</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={markAllRead}
              className="text-[11px] font-semibold text-[#0ABAB5] hover:underline px-2 py-1"
            >
              Mark all read
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {renderGroup('today', 'Today')}
          {renderGroup('yesterday', 'Yesterday')}
          {renderGroup('earlier', 'Earlier')}
        </div>
      </div>
    </div>
  );
};
