'use client';

import { apiFetch } from './api-client';

function vapidPublicKey(): string | null {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  return key && key.length > 0 ? key : null;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    vapidPublicKey() != null
  );
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/sw.js');
}

// Subscribe this browser for full-match win pushes. Returns true when the
// server stored the subscription.
export async function subscribePush(): Promise<boolean> {
  try {
    if (!pushSupported()) return false;
    const reg = await registration();
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey() as string),
      }));
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
    await apiFetch('api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } }),
    });
    window.localStorage.setItem('keno_push_active', '1');
    return true;
  } catch {
    return false;
  }
}

export async function unsubscribePush(): Promise<void> {
  try {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      try {
        await apiFetch('api/push/unsubscribe', {
          method: 'POST',
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
      } catch {
        // Still unsubscribe locally even if the server call fails.
      }
      await sub.unsubscribe();
    }
  } finally {
    if (typeof window !== 'undefined') window.localStorage.removeItem('keno_push_active');
  }
}

export function isPushActive(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem('keno_push_active') === '1';
  } catch {
    return false;
  }
}
