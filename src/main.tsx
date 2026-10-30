import {createRoot} from 'react-dom/client';
import './index.css';
import { STORE_LOCKED } from './lib/storeLock';
import { StoreLockScreen } from './components/StoreLockScreen';

const root = createRoot(document.getElementById('root')!);

if (STORE_LOCKED) {
  // Locked: the app, the Supabase login and cloud sync are never loaded.
  root.render(<StoreLockScreen />);
} else {
  void Promise.all([
    import('./App.tsx'),
    import('./components/PwaInstallPrompt'),
  ]).then(([{ default: App }, { PwaInstallPrompt }]) => {
    root.render(
      <>
        <App />
        <PwaInstallPrompt />
      </>,
    );
  });
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('PEKASA offline support could not be enabled:', error);
    });
  });
}
