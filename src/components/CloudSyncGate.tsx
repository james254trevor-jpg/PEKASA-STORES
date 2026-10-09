import React, { useEffect, useState } from 'react';
import { supabaseCloudSync, type CloudSession } from '../lib/supabaseCloudSync';
import { sqliteService } from '../db/sqlite';

export const CloudSyncGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<CloudSession | null>(null);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [sync, setSync] = useState(supabaseCloudSync.getState());

  const openStore = async (nextSession: CloudSession) => {
    setBusy(true);
    setMessage('Loading this store account…');
    try {
      const bytes = await supabaseCloudSync.loadInitialSnapshot();
      if (bytes) sqliteService.stageCloudSnapshot(bytes);
      setSession(nextSession);
      setReady(true);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not connect to Supabase.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const unsubscribe = supabaseCloudSync.subscribe(() => setSync(supabaseCloudSync.getState()));
    supabaseCloudSync.restoreSession().then(async (saved) => {
      if (!mounted) return;
      if (saved) await openStore(saved);
      if (mounted) setChecking(false);
    }).catch(() => { if (mounted) setChecking(false); });
    return () => { mounted = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!ready || !session) return;
    const unsubscribe = supabaseCloudSync.subscribe(() => setSync(supabaseCloudSync.getState()));
    return () => {
      unsubscribe();
      supabaseCloudSync.stopLiveSync();
    };
  }, [ready, session]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (creating) {
        const created = await supabaseCloudSync.signUp(email.trim(), password);
        if (!created) {
          setMessage('Check your email to confirm the store account, then sign in here.');
        } else {
          await openStore(created);
        }
      } else {
        await openStore(await supabaseCloudSync.signIn(email.trim(), password));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not connect to Supabase.');
    } finally {
      setBusy(false);
    }
  };

  if (checking || (busy && !ready)) {
    return <div className="min-h-screen grid place-items-center bg-slate-950 text-slate-300">{message || 'Connecting to PEKASA cloud…'}</div>;
  }

  if (!ready || !session) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-950 px-4 py-10 text-slate-100">
        <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl border border-slate-700 bg-slate-900 p-7 shadow-2xl">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-400">PEKASA STORES</p>
            <h1 className="mt-2 text-2xl font-bold">Connect your store account</h1>
            <p className="mt-2 text-sm text-slate-400">Use the same Supabase account on your phone and PC to share store data. Sign in first on the device that currently has your store data.</p>
          </div>
          <label className="block space-y-1 text-sm">Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
          <label className="block space-y-1 text-sm">Password<input required minLength={8} type="password" autoComplete={creating ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
          {message && <p role="alert" className="rounded-lg bg-slate-800 p-3 text-sm text-amber-200">{message}</p>}
          <button disabled={busy} className="w-full rounded-lg bg-amber-400 px-4 py-2.5 font-bold text-slate-950 disabled:opacity-60">{busy ? 'Please wait…' : creating ? 'Create store account' : 'Sign in to store account'}</button>
          <button type="button" onClick={() => { setCreating(!creating); setMessage(''); }} className="w-full text-sm text-slate-300 underline">{creating ? 'Already have a store account? Sign in' : 'Create a new store account'}</button>
        </form>
      </main>
    );
  }

  return (
    <>
      {children}
      <div className="fixed bottom-3 right-3 z-[100] flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/90 px-3 py-1.5 text-xs text-slate-200 shadow-lg" title={sync.error || sync.email}>
        {sync.status !== 'ready' && sync.status !== 'synced' && <span>{sync.status === 'conflict' ? 'Store sync needs a choice' : sync.status === 'error' ? 'Store sync error' : 'Saving store data…'}</span>}
        {sync.status === 'error' && <button type="button" onClick={() => void supabaseCloudSync.retryPending()} className="underline">Retry</button>}
        <button type="button" disabled={sync.status === 'syncing' || sync.status === 'conflict' || sync.status === 'error'} onClick={async () => { await supabaseCloudSync.signOut(); window.location.reload(); }} className="underline disabled:opacity-50">Sign out</button>
      </div>
      {sync.conflict && <div className="fixed inset-0 z-[200] grid place-items-center bg-black/60 p-4"><section role="alertdialog" aria-modal="true" className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 text-slate-900 shadow-2xl"><h2 className="text-xl font-bold">Store data changed on another device</h2><p className="text-sm text-slate-600">Both devices have saved changes since the last sync. Choose which full store copy to keep. The other copy will be replaced.</p><div className="flex flex-col gap-2 sm:flex-row"><button onClick={() => void supabaseCloudSync.useCloudVersion()} className="flex-1 rounded-lg bg-slate-800 px-4 py-2 text-white">Use the other device’s copy</button><button onClick={() => void supabaseCloudSync.keepThisDeviceVersion()} className="flex-1 rounded-lg bg-amber-400 px-4 py-2 font-semibold">Keep this device’s copy</button></div></section></div>}
    </>
  );
};
