'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, RefreshCw, Sparkles } from 'lucide-react';
import { checkAuth, getDraws } from '@/lib/api';
import type { Draw } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { BOARD_CSS } from '@/components/autoplay/boardStyles';

// The public draw-history page. No login required — the keno boards render the
// actual draws recorded by the collectors, newest first, with pagination.
const KENO_SITES = [
  { id: 'fungames_tolobirr', name: 'Fungames Tolobirr' },
  { id: 'fungames_shamo', name: 'Fungames Shamo' },
];
const PAGE_SIZES = [10, 20, 50];

const MINI_CSS = `
.draws-mini .keno-board { gap: 2px; }
.draws-mini .keno-tile { font-size: 8px; border-radius: 3px; }
@media (min-width: 1024px) {
  .draws-mini .keno-tile { font-size: 7px; }
}
`;

function formatStamp(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
}

function drawStats(d: Draw): { sum: number; odd: number; even: number } {
  const nums = d.results || [];
  return {
    sum: nums.reduce((a, b) => a + b, 0),
    odd: nums.filter((n) => n % 2 === 1).length,
    even: nums.length - nums.filter((n) => n % 2 === 1).length,
  };
}

export default function PublicHomePage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [siteId, setSiteId] = useState(KENO_SITES[0].id);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(0);
  const [draws, setDraws] = useState<Draw[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const topRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    checkAuth()
      .then((r) => setAuthed(!!r.authenticated))
      .catch(() => setAuthed(false));
  }, []);

  // Fetch the current page; re-runs whenever the site, page size, page, or a
  // manual refresh changes. The setState calls all happen after the await
  // (matches the LastDrawsBoards pattern), so no busy flag here.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await getDraws(siteId, pageSize, page * pageSize);
        if (!alive) return;
        setDraws(res.draws);
        setTotal(res.total);
        setError('');
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
        setDraws(null);
      } finally {
        if (alive) setBusy(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [siteId, pageSize, page, refreshTick]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const changeSite = (id: string) => {
    setBusy(true);
    setSiteId(id);
    setPage(0);
  };
  const changePageSize = (size: number) => {
    setBusy(true);
    setPageSize(size);
    setPage(0);
  };
  const goTo = (p: number) => {
    setBusy(true);
    setPage(p);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-full bg-background text-foreground">
      <style>{BOARD_CSS}{MINI_CSS}</style>

      {/* Public nav */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="text-sm font-bold sm:text-base">Live Keno Draws</span>
          </Link>
          <div className="flex items-center gap-2">
            {authed === true ? (
              <Button asChild variant="outline">
                <Link href="/overview">Open dashboard</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/login">Login</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div ref={topRef} className="scroll-mt-20">
          <h1 className="text-xl font-bold sm:text-2xl">Keno draw history</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Recorded {siteId === KENO_SITES[0].id ? 'Fungames Tolobirr' : 'Fungames Shamo'} draws —
            newest first. Each board is one round; drawn digits are highlighted.
          </p>
        </div>

        {/* Toolbar */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-white/10">
            {KENO_SITES.map((s) => (
              <button
                key={s.id}
                onClick={() => changeSite(s.id)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  s.id === siteId ? 'bg-primary text-primary-foreground' : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>

          <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            Per page
            <select
              value={pageSize}
              onChange={(e) => changePageSize(Number(e.target.value))}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-foreground"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setBusy(true);
              setRefreshTick((t) => t + 1);
            }}
            disabled={busy}
          >
            <RefreshCw className={busy ? 'animate-spin' : ''} /> Refresh
          </Button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Draws */}
        <div className="mt-4">
          {!draws ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: pageSize }).map((_, i) => (
                <div key={i} className="h-36 animate-pulse rounded-lg border border-white/10 bg-white/5" />
              ))}
            </div>
          ) : draws.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-muted-foreground">
              No completed draws recorded for this site yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {draws.map((d, i) => {
                const nums = d.results || [];
                const s = drawStats(d);
                const isLatest = page === 0 && i === 0;
                return (
                  <div key={d.roundId ?? i} className="space-y-1.5">
                    <div className="draws-mini rounded-lg border border-white/10 bg-[#0b0f19] p-1.5">
                      <div className="keno-board">
                        {Array.from({ length: 80 }, (_, k) => k + 1).map((n) => (
                          <div key={n} className={nums.includes(n) ? 'keno-tile picked' : 'keno-tile'}>
                            {n}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="text-[10px]">
                      <div className="flex items-center justify-between gap-1">
                        <span className={isLatest ? 'font-bold text-primary' : 'font-semibold text-muted-foreground'}>
                          {isLatest ? '● latest' : 'Round'} #{d.roundNo || '—'}
                        </span>
                        <span className="text-muted-foreground">Σ{s.sum} · {s.odd}o/{s.even}e</span>
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {formatStamp(d.drawnAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <span className="text-xs text-muted-foreground">
            {total.toLocaleString()} draws recorded · page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0 || busy} onClick={() => goTo(page - 1)}>
              <ArrowLeft /> Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1 || busy} onClick={() => goTo(page + 1)}>
              Next <ArrowRight />
            </Button>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground/70">
          Unauthenticated viewer — draws are shown purely for analysis. No account information is exposed.
        </p>
      </main>
    </div>
  );
}