'use client';

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { getSites } from '@/lib/api';
import type { ProviderSummary } from '@/lib/types';
import { useSession } from './session-provider';

// Viewers are restricted to the shamo rain-autoplay experience, so they never
// load or switch the provider list (which is an admin-only endpoint).
const VIEWER_SITE_ID = 'fungames_shamo';
const VIEWER_SITE_NAME = 'Fungames Shamo';

// The selector only offers the sites this dashboard actually operates. Other
// provider rows stay in the server registry for historical draws and legacy
// tooling, but they are not switch targets here.
const SELECTABLE_SITE_IDS = new Set(['fungames_tolobirr', 'casagames', 'fungames_shamo']);

interface SiteCtx {
  sites: ProviderSummary[];
  siteId: string;
  siteName: string;
  setSiteId: (id: string) => void;
  loading: boolean;
}

const Ctx = createContext<SiteCtx | null>(null);

const STORAGE_KEY = 'keno-dashboard-site';

export function SiteProvider({ children }: { children: ReactNode }) {
  const { isAdmin, loading: sessionLoading } = useSession();
  const [sites, setSites] = useState<ProviderSummary[]>([]);
  const [siteId, setSiteIdState] = useState(VIEWER_SITE_ID);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    if (!isAdmin) {
      // The viewer experience is pinned to the shamo rain autoplay page.
      setSiteIdState(VIEWER_SITE_ID);
      setSites([]);
      setLoading(false);
      return;
    }
    getSites()
      .then((all) => {
        const s = all.filter((x) => SELECTABLE_SITE_IDS.has(x.id));
        setSites(s);
        const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
        if (saved && s.some((x) => x.id === saved)) setSiteIdState(saved);
        else if (s.length) setSiteIdState(s[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAdmin, sessionLoading]);

  function setSiteId(id: string) {
    const next = isAdmin ? id : VIEWER_SITE_ID;
    setSiteIdState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  const value = useMemo<SiteCtx>(() => {
    const site = sites.find((s) => s.id === siteId);
    return {
      sites,
      siteId,
      siteName: site?.name || (isAdmin ? siteId : VIEWER_SITE_NAME),
      setSiteId,
      loading,
    };
  }, [sites, siteId, loading, isAdmin]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSite(): SiteCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSite must be used within SiteProvider');
  return ctx;
}
