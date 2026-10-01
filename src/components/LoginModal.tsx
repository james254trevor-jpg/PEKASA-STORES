import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { STORE_NAME, STORE_MOTTO } from '../types';
import { Lock, Shield, User as UserIcon, AlertCircle, KeyRound, Database, Sparkles } from 'lucide-react';

export const LoginModal: React.FC = () => {
  const { login, loginError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setIsSubmitting(true);
    await login(username.trim(), password.trim());
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-2xl px-4 py-8">
      {/* Background ambient lighting for glassmorphism */}
      <div className="absolute w-96 h-96 rounded-full bg-[#0ABAB5]/15 blur-3xl -top-12 -left-12 pointer-events-none" />
      <div className="absolute w-96 h-96 rounded-full bg-[#20B2AA]/10 blur-3xl -bottom-12 -right-12 pointer-events-none" />

      <div className="w-full max-w-md glass-panel border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative z-10">
        {/* Top Header */}
        <div className="p-8 text-center border-b border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0ABAB5]/10 border border-[#0ABAB5]/30 text-[#0ABAB5] mb-4 shadow-lg shadow-[#0ABAB5]/10">
            <Lock className="w-7 h-7" />
          </div>
          
          <h1 className="text-3xl font-extrabold tracking-tight text-white uppercase flex items-center justify-center gap-2">
            <span>{STORE_NAME}</span>
          </h1>

          <p className="text-xs font-medium text-slate-300 mt-2.5 max-w-sm mx-auto leading-relaxed italic">
            "{STORE_MOTTO}"
          </p>

          <div className="mt-4 inline-flex items-center gap-2 text-[11px] text-[#0ABAB5] bg-[#0ABAB5]/10 border border-[#0ABAB5]/25 px-3 py-1 rounded-full font-mono">
            <Database className="w-3.5 h-3.5" />
            <span>SQLite Offline Storage · Authenticated Session</span>
          </div>
        </div>

        {/* Form Body - Admin details are hidden as requested */}
        <div className="p-8 space-y-5">
          {loginError && (
            <div className="flex items-center gap-3 p-3.5 text-xs text-rose-300 bg-rose-950/40 border border-rose-800/60 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Authorized Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full pl-10 pr-4 py-2.5 bg-black/60 border border-white/15 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#0ABAB5] focus:ring-1 focus:ring-[#0ABAB5] transition-all font-mono"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Secret Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-black/60 border border-white/15 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#0ABAB5] focus:ring-1 focus:ring-[#0ABAB5] transition-all font-mono"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-[#0ABAB5] hover:bg-[#1FD2CD] active:scale-[0.99] text-black font-extrabold rounded-xl text-sm transition-all shadow-lg shadow-[#0ABAB5]/25 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-3"
            >
              <Shield className="w-4 h-4" />
              <span>{isSubmitting ? 'Verifying Credentials...' : 'Sign In to Store Portal'}</span>
            </button>
          </form>

          <div className="text-center pt-2">
            <span className="text-[11px] text-slate-500 font-mono">
              Protected by SHA-256 Cryptographic Hash · Internal Terminal Only
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-3 bg-black/70 text-center border-t border-white/10 text-[11px] text-slate-400 flex items-center justify-center gap-2">
          <Sparkles className="w-3 h-3 text-[#0ABAB5]" />
          <span>{STORE_NAME} Management System</span>
        </div>
      </div>
    </div>
  );
};
