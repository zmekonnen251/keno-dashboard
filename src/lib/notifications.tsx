'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

export interface AppNotification {
  id: string;
  kind: 'win' | 'info' | 'error';
  text: string;
  at: number;
  // Optional account phone for win notifications (enables copy button).
  phone?: string;
}

interface NotificationCenter {
  notifications: AppNotification[];
  unread: number;
  notify: (n: Omit<AppNotification, 'at'> & { at?: number }) => void;
  clear: () => void;
  markAllRead: () => void;
}

const Ctx = createContext<NotificationCenter | null>(null);
const STORAGE_KEY = 'keno_notifications';
const SEEN_KEY = 'keno_notifications_seen';
const MAX_STORED = 50;
// Kept much larger than MAX_STORED: ids evicted from the visible list must stay
// deduped, otherwise live feeds (wins, ML alerts) re-announce them on the next
// sign-in as if they were new.
const MAX_SEEN = 1000;

function loadStored(): AppNotification[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AppNotification[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_STORED) : [];
  } catch {
    return [];
  }
}

function loadLastReadAt(): number {
  try {
    if (typeof window === 'undefined') return 0;
    return Number(window.localStorage.getItem('keno_notifications_read_at') || 0);
  } catch {
    // Ignore storage errors — notifications simply start unread.
    return 0;
  }
}

function loadSeenIds(): string[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function persistSeen(seen: Set<string>): void {
  try {
    const ids = [...seen].slice(-MAX_SEEN);
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage errors.
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(loadStored);
  const [lastReadAt, setLastReadAt] = useState<number>(loadLastReadAt);
  // Every id ever delivered (or dismissed) in this browser. Hydrated from the
  // persisted list too, so older sessions' visible items are never re-added.
  const seenRef = useRef<Set<string> | null>(null);
  if (seenRef.current === null) {
    const seen = new Set<string>(loadSeenIds());
    for (const n of notifications) seen.add(n.id);
    seenRef.current = seen;
  }

  const notify = useCallback((n: Omit<AppNotification, 'at'> & { at?: number }) => {
    const item: AppNotification = { ...n, at: n.at ?? Date.now() };
    const seen = seenRef.current!;
    if (seen.has(item.id)) return;
    seen.add(item.id);
    persistSeen(seen);
    setNotifications((prev) => {
      if (prev.some((x) => x.id === item.id)) return prev;
      const next = [item, ...prev].slice(0, MAX_STORED);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors.
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setNotifications((prev) => {
      for (const n of prev) seenRef.current!.add(n.id);
      persistSeen(seenRef.current!);
      return [];
    });
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  }, []);

  const markAllRead = useCallback(() => {
    const now = Date.now();
    setLastReadAt(now);
    try {
      window.localStorage.setItem('keno_notifications_read_at', String(now));
    } catch {
      // Ignore storage errors.
    }
    // Opening the bell dismisses what is listed; remember those ids so a feed
    // replay cannot resurrect them as unread after a clear/eviction.
    setNotifications((prev) => {
      for (const n of prev) seenRef.current!.add(n.id);
      persistSeen(seenRef.current!);
      return prev;
    });
  }, []);

  const unread = useMemo(
    () => notifications.filter((n) => n.at > lastReadAt).length,
    [notifications, lastReadAt],
  );

  const value = useMemo(
    () => ({ notifications, unread, notify, clear, markAllRead }),
    [notifications, unread, notify, clear, markAllRead],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications(): NotificationCenter {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}
