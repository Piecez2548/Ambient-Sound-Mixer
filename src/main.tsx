import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// Installable web app (PWA). Not in Electron or the dev server.
if (import.meta.env.PROD && 'serviceWorker' in navigator && !(window as any).ambient?.isElectron) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
