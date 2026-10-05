import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';

createRoot(document.getElementById('root')!).render(
  <>
    <App />
    <PwaInstallPrompt />
  </>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('PEKASA offline support could not be enabled:', error);
    });
  });
}
