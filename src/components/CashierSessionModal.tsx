import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { CashierSession } from '../types';
import { formatKES } from '../utils/numbering';
import { 
  DollarSign, 
  Lock, 
  Unlock, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Calculator, 
  Calendar,
  Smartphone,
  Coins,
  ShieldAlert,
  Info
} from 'lucide-react';

interface CashierSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionToClose?: CashierSession | null;
  onSessionUpdated?: () => void;
}

export const CashierSessionModal: React.FC<CashierSessionModalProps> = ({
  isOpen,
  onClose,
  sessionToClose,
  onSessionUpdated
}) => {
  const { currentUser, activeCashierSession, openSession, closeSession } = useAuth();

  const currentSession = sessionToClose || activeCashierSession;
  const isClosing = !!currentSession && currentSession.status === 'OPEN';

  // Open Form State
  const [openingCash, setOpeningCash] = useState<number>(20000);
  const [openNotes, setOpenNotes] = useState<string>('Main Counter Drawer 1');

  // Close Form State
  const [actualCash, setActualCash] = useState<number>(
    currentSession ? (currentSession.opening_cash + currentSession.cash_collected) : 0
  );
  const [closeNotes, setCloseNotes] = useState<string>('');

  if (!isOpen) return null;

  // Expected Cash calculation (Immutable by cashier)
  const expectedCash = currentSession
    ? (currentSession.opening_cash + currentSession.cash_collected)
    : 0;

  const difference = isClosing ? actualCash - expectedCash : 0;

  const handleOpen = (e: React.FormEvent) => {
    e.preventDefault();
    if (openingCash < 0) {
      alert('Opening cash balance cannot be negative.');
      return;
    }

    try {
      openSession(openingCash, openNotes);
      if (onSessionUpdated) onSessionUpdated();
      onClose();
    } catch (err: any) {
      alert(err?.message || 'Failed to open session');
    }
  };

  const handleClose = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession) return;

    if (actualCash < 0) {
      alert('Actual cash in drawer cannot be negative.');
      return;
    }

    try {
      closeSession(actualCash, closeNotes);
      if (onSessionUpdated) onSessionUpdated();
      onClose();
    } catch (err: any) {
      alert(err?.message || 'Failed to close session');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border ${
              isClosing 
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' 
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}>
              {isClosing ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                {isClosing ? 'Close Daily Cashier Session' : 'Open Daily Cashier Session'}
              </h3>
              <p className="text-xs text-slate-400">
                Cashier: <strong className="text-slate-200">{currentUser?.full_name || 'Counter Operator'}</strong>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        {isClosing && currentSession ? (
          /* CLOSE CASHIER SESSION FORM */
          <form onSubmit={handleClose} className="p-6 space-y-5 text-xs">
            {/* Session Summary Card */}
            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Session Started:</span>
                <span className="font-mono text-slate-200">{currentSession.opened_at}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Opening Cash Float:</span>
                  <span className="font-bold font-mono text-white text-sm">
                    {formatKES(currentSession.opening_cash)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Cash Payments Received:</span>
                  <span className="font-bold font-mono text-emerald-400 text-sm">
                    +{formatKES(currentSession.cash_collected)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">M-Pesa Payments (Digital Till):</span>
                  <span className="font-bold font-mono text-cyan-400 text-sm">
                    {formatKES(currentSession.mpesa_collected)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Expected Physical Cash:</span>
                  <span className="font-black font-mono text-[#FFD700] text-sm">
                    {formatKES(expectedCash)}
                  </span>
                </div>
              </div>
            </div>

            {/* Cashier Actual Drawer Entry */}
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-200">
                Enter Actual Physical Cash in Drawer (KES) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={actualCash}
                  onChange={(e) => setActualCash(Number(e.target.value) || 0)}
                  className="w-full h-11 ps-9 pe-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-base font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
                <DollarSign className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                <Info className="w-3.5 h-3.5 text-amber-400" />
                <span>Count all notes and coins in the physical drawer before typing.</span>
              </p>
            </div>

            {/* Reconciliation Difference Alert */}
            <div className={`p-4 rounded-xl border space-y-2 ${
              difference === 0
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : difference < 0
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm">
                  {difference === 0 ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span>DRAWER BALANCED</span>
                    </>
                  ) : difference < 0 ? (
                    <>
                      <AlertTriangle className="w-5 h-5 text-rose-400 animate-pulse" />
                      <span>⚠️ CASH SHORTAGE</span>
                    </>
                  ) : (
                    <>
                      <Info className="w-5 h-5 text-amber-400" />
                      <span>CASH OVERAGE</span>
                    </>
                  )}
                </div>
                <div className="font-mono text-base font-black">
                  {difference === 0 ? (
                    <span className="text-emerald-400">KSh 0.00</span>
                  ) : difference < 0 ? (
                    <span className="text-rose-400">-KSh {Math.abs(difference).toLocaleString()}</span>
                  ) : (
                    <span className="text-amber-400">+KSh {difference.toLocaleString()}</span>
                  )}
                </div>
              </div>

              <div className="text-[11px] text-slate-300 leading-relaxed pt-1 border-t border-slate-800/60">
                {difference === 0 ? (
                  'Physical cash matches calculated transactions perfectly.'
                ) : difference < 0 ? (
                  `Drawer has a shortage of KSh ${Math.abs(difference).toLocaleString()}. Expected amount cannot be manually altered. This will be flagged for Trevor or Peter to review and approve.`
                ) : (
                  `Drawer has an overage of KSh ${difference.toLocaleString()}. This will be logged for Trevor or Peter to review and approve.`
                )}
              </div>
            </div>

            {/* Closing Notes */}
            <div className="space-y-1">
              <label className="block font-bold text-slate-300">Closing Reconciliation Notes (Optional)</label>
              <textarea
                rows={2}
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="e.g. Counter handed over to next shift, petty cash envelope sealed..."
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-900/40 transition-colors"
              >
                <Lock className="w-4 h-4" />
                <span>Submit & Close Cashier Shift</span>
              </button>
            </div>
          </form>
        ) : (
          /* OPEN CASHIER SESSION FORM */
          <form onSubmit={handleOpen} className="p-6 space-y-5 text-xs">
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-slate-300 text-xs">
                <span className="font-bold text-amber-300 block">Daily Cashier Drawer Activation</span>
                <p className="leading-relaxed text-[11px]">
                  Before issuing loans or recording cash payments, please declare your opening float.
                  All transactions today will be matched against your drawer closing count.
                </p>
              </div>
            </div>

            {/* Opening Cash Input */}
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-200">
                Opening Cash Balance (Float) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(Number(e.target.value) || 0)}
                  placeholder="e.g. 20000"
                  className="w-full h-11 ps-9 pe-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-base font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
                <DollarSign className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              </div>
              <div className="flex gap-2 pt-1">
                {[10000, 20000, 30000, 50000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setOpeningCash(preset)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded font-mono text-[11px] cursor-pointer"
                  >
                    KSh {preset.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Counter Reference / Notes */}
            <div className="space-y-1">
              <label className="block font-bold text-slate-300">Counter Desk / Drawer Reference</label>
              <input
                type="text"
                value={openNotes}
                onChange={(e) => setOpenNotes(e.target.value)}
                placeholder="e.g. Terminal 1 / Kahawa West Counter"
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#FFD700] hover:bg-[#FFD700]/90 text-[#0B2D4A] font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20 transition-colors"
              >
                <Unlock className="w-4 h-4" />
                <span>Open Cashier Session (KSh {openingCash.toLocaleString()})</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
