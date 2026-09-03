'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    // Defer registration until the page has settled to avoid competing with
    // the initial render and the dev-server HMR websocket.
    const id = window.setTimeout(() => {
      navigator.serviceWorker
        .register('/sw.js')
        .catch(() => {
          /* ignore — dev or unsupported */
        });
    }, 1000);
    return () => window.clearTimeout(id);
  }, []);

  return null;
}
