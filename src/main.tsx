import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './index.css';

// Global error and promise rejection suppressor to protect preview iframe stability
if (typeof window !== 'undefined') {
  window.onerror = function (msg, src, line, col, err) {
    console.warn('[Global] Suppressed window error:', msg, err);
    return true;
  };

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      console.warn('[Global] Suppressed unhandled rejection:', event.reason);
      event.preventDefault();
    },
    true
  );

  window.addEventListener(
    'error',
    (event) => {
      console.warn('[Global] Suppressed event error:', event.message || event.error);
      event.preventDefault();
    },
    true
  );

  // Safe Service Worker registration
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      try {
        navigator.serviceWorker
          .register('/sw.js')
          .catch((err) => console.warn('[SW] Registration failed:', err));
      } catch (err) {
        console.warn('[SW] Could not initialize service worker:', err);
      }
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);


