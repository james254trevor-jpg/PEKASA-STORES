import React from 'react';
import { STORE_LOCK_CONTACT, STORE_LOCK_MESSAGE } from '../lib/storeLock';

export const StoreLockScreen: React.FC = () => (
  <main className="min-h-screen grid place-items-center bg-slate-950 px-6 text-center text-slate-100">
    <div className="max-w-md space-y-4">
      <div className="text-6xl" aria-hidden="true">🔒</div>
      <h1 className="text-2xl font-bold tracking-wide">{STORE_LOCK_MESSAGE}</h1>
      <p className="text-base text-slate-400">{STORE_LOCK_CONTACT}</p>
    </div>
  </main>
);
