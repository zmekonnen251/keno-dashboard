'use client';

import { apiFetch } from './api-client';

// The VAPID public key is needed to create or reuse a browser push subscription.
// It can come from the NEXT_PUBLIC_ env or from the server (the dashboard proxy
// passes through /api/push/vapid-public-key; any signed-in user may fetch it).

const CACHE_KEY = 'keno_vapid_key';

function envVapid(): string | null {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  return key && key.length > 0 ? key : null;
}

// Synchronous fast-path: return the key if it is already in the env or the
// localStorage cache. Used by `pushSupported()` so React initial renders are
// immediate (no flash of "unsupported").
function cachedVapid(): string | null {
  if (envVapid()) return envVapid();
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(CACHE_KEY) || null;
  } catch {
    return null;
  }
}

// Fetch the VAPID key from the server (admin cookie is sent via the proxy)
// and cache it so future calls are instant. Falls back to null when the
// server does not have VAPID keys configured.
async function fetchVapid(): Promise<string | null> {
  try {
    const res = await apiFetch<{ publicKey: string | null }>('api/push/vapid-public-key');
    if (res.publicKey) {
      try { window.localStorage.setItem(CACHE_KEY, res.publicKey); } catch {}
      return res.publicKey;
    }
  } catch {}
  return null;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/sw.js');
}

// Sync check: does this browser *look* capable + configured? Used in the initial
// render so the toggle shows "Push on" when a localStorage flag was left behind.
export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    cachedVapid() != null
  );
}

// Subscribe (or re-subscribe) this browser for push. Re-uses an existing
// Service Worker subscription when present, so it is safe to call on every
// page load — the server POST is idempotent.
export async function subscribePush(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;
    const key = cachedVapid() ?? (await fetchVapid());
    if (!key) return false;
    const reg = await registration();
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
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

// Re-post the existing browser subscription to the server without creating a
// new one. Used after page reload so the server always has a current entry
// (subscriptions can be evicted by browser updates / token rotation).
export async function rePostSubscription(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return false;
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
