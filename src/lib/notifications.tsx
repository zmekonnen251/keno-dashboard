'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

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
const MAX_STORED = 50;

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

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(loadStored);
  const [lastReadAt, setLastReadAt] = useState<number>(loadLastReadAt);

  const notify = useCallback((n: Omit<AppNotification, 'at'> & { at?: number }) => {
    const item: AppNotification = { ...n, at: n.at ?? Date.now() };
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
    setNotifications([]);
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
