import {createRoot} from 'react-dom/client';
import App from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import './index.css';

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', () => {
    const now = Date.now();
    const lastReload = parseInt(sessionStorage.getItem('mst_last_preload_reload') || '0', 10);
    if (now - lastReload > 12000) {
      sessionStorage.setItem('mst_last_preload_reload', String(now));
      window.location.reload();
    }
  });
}

createRoot(document.getElementById('root')!).render(<AppErrorBoundary><App /></AppErrorBoundary>);
