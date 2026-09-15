'use client';

// Centralised, persistent notification preferences. Stored in localStorage so
// they survive page reloads and are shared across the autoplay and rain pages.

const NOTIFY_KEY = 'keno_notify_pref';
const SOUND_KEY = 'keno_sound_pref';

export function getNotifyPref(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(NOTIFY_KEY) === '1';
  } catch {
    return false;
  }
}

export function setNotifyPref(on: boolean): void {
  try {
    if (typeof window === 'undefined') return;
    if (on) window.localStorage.setItem(NOTIFY_KEY, '1');
    else window.localStorage.removeItem(NOTIFY_KEY);
  } catch {}
}

export function getSoundPref(): boolean {
  try {
    if (typeof window === 'undefined') return true;
    const v = window.localStorage.getItem(SOUND_KEY);
    return v !== '0'; // default ON
  } catch {
    return true;
  }
}

export function setSoundPref(on: boolean): void {
  try {
    if (typeof window === 'undefined') return;
    if (on) window.localStorage.removeItem(SOUND_KEY); // default is on
    else window.localStorage.setItem(SOUND_KEY, '0');
  } catch {}
}
