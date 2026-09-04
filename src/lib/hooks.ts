'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSites } from './api';
import type { ProviderSummary } from './types';

// Load the list of sites/providers once for the site dropdown.
export function useSites() {
  const [sites, setSites] = useState<ProviderSummary[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    getSites()
      .then(setSites)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load sites'));
  }, []);
  return { sites, error };
}

// Generic loader: re-fetches when `deps` change or when refresh() is called.
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const fetcherRef = useRef(fetcher);
  const hasDataRef = useRef(false);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const load = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const initial = !hasDataRef.current;
    if (initial) setLoading(true);
    fetcherRef
      .current()
      .then((res) => {
        if (cancelled) return;
        hasDataRef.current = true;
        setData(res);
        setError('');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (!hasDataRef.current) setError(e instanceof Error ? e.message : 'Request failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, refreshKey]);

  return { data, error, loading, refresh: load };
}
