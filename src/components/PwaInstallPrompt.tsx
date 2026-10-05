import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const DISMISSED_KEY = 'pekasa_install_prompt_dismissed_v1';

export const PwaInstallPrompt: React.FC = () => {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [installed, setInstalled] = useState(false);
  const [isAppleMobile, setIsAppleMobile] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setHidden(standalone || localStorage.getItem(DISMISSED_KEY) === 'true');
    setIsAppleMobile(/iPhone|iPad|iPod/i.test(navigator.userAgent));

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setHidden(localStorage.getItem(DISMISSED_KEY) === 'true');
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowHelp(false);
      setHidden(true);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (hidden || installed) return null;

  const install = async () => {
    if (!installPrompt) {
      setShowHelp((current) => !current);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (choice.outcome === 'accepted') setHidden(true);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setHidden(true);
  };

  return (
    <aside className="fixed bottom-4 left-4 z-[120] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-white/15 bg-slate-950/95 p-4 text-white shadow-2xl backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#0ABAB5]/15 text-[#0ABAB5]">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold">Install PEKASA STORES</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">Add the app to your phone for quick access from your home screen.</p>
        </div>
        <button onClick={dismiss} type="button" aria-label="Dismiss install message" className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      <button onClick={() => void install()} type="button" className="mt-3 w-full rounded-xl bg-[#0ABAB5] px-4 py-2.5 text-sm font-extrabold text-slate-950 hover:bg-[#35d4ce]">
        {installPrompt ? 'Install app' : isAppleMobile ? 'Show iPhone install steps' : 'How to install'}
      </button>
      {showHelp && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-relaxed text-slate-200">
          {isAppleMobile
            ? 'In Safari, tap Share, then choose Add to Home Screen and tap Add.'
            : 'Open your browser menu and choose Install app or Add to Home screen.'}
        </div>
      )}
    </aside>
  );
};
