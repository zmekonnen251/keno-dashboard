'use client';

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { getSites } from '@/lib/api';
import type { ProviderSummary } from '@/lib/types';

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
  const [sites, setSites] = useState<ProviderSummary[]>([]);
  const [siteId, setSiteIdState] = useState('fungames_shamo');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSites()
      .then((s) => {
        setSites(s);
        const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
        if (saved && s.some((x) => x.id === saved)) setSiteIdState(saved);
        else if (s.length) setSiteIdState(s[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function setSiteId(id: string) {
    setSiteIdState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {}
  }

  const value = useMemo<SiteCtx>(() => {
    const site = sites.find((s) => s.id === siteId);
    return {
      sites,
      siteId,
      siteName: site?.name || siteId,
      setSiteId,
      loading,
    };
  }, [sites, siteId, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSite(): SiteCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSite must be used within SiteProvider');
  return ctx;
}
