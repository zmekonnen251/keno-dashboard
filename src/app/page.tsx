'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, LogOut, RefreshCw, Sparkles } from 'lucide-react';
import { checkUser, getDraws, getTimeMatchedDraws, logout } from '@/lib/api';
import type { Draw, TimeMatchedDrawsResponse } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { BOARD_CSS } from '@/components/autoplay/boardStyles';
import { useRouter } from 'next/navigation';

// The public draw-history page. No login required — the keno boards render the
// actual draws recorded by the collectors, newest first, with pagination. A
// second view compares the same clock-time window across the last 7 days so
// recurring time-of-day patterns stand out.
const KENO_SITES = [
  { id: 'fungames_tolobirr', name: 'Fungames Tolobirr' },
  { id: 'fungames_shamo', name: 'Fungames Shamo' },
];
const PAGE_SIZES = [10, 20, 50];
const WINDOW_SIZES = [5, 10, 15, 20, 30];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

function clockOf(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function shortDate(date: string): string {
  const parts = date.split('-');
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : date;
}

function drawStats(d: Draw): { sum: number; odd: number; even: number } {
  const nums = d.results || [];
  const odd = nums.filter((n) => n % 2 === 1).length;
  return { sum: nums.reduce((a, b) => a + b, 0), odd, even: nums.length - odd };
}

// One keno board (80 tiles, drawn digits highlighted) plus its round stats.
function DrawCard({ draw, highlight }: { draw: Draw; highlight?: boolean }) {
  const nums = draw.results || [];
  const s = drawStats(draw);
  return (
    <div className="space-y-1.5">
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
          <span className={highlight ? 'font-bold text-primary' : 'font-semibold text-muted-foreground'}>
            {highlight ? '● latest' : 'Round'} #{draw.roundNo || '—'}
          </span>
          <span className="text-muted-foreground">Σ{s.sum} · {s.odd}o/{s.even}e</span>
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{formatStamp(draw.drawnAt)}</div>
      </div>
    </div>
  );
}

function SkeletonGrid({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-36 animate-pulse rounded-lg border border-white/10 bg-white/5" />
      ))}
    </div>
  );
}

export default function PublicHomePage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [siteId, setSiteId] = useState(KENO_SITES[0].id);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(0);
  const [draws, setDraws] = useState<Draw[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  // Time-matched view state.
  const [viewMode, setViewMode] = useState<'latest' | 'timematch'>('latest');
  const [windowMinutes, setWindowMinutes] = useState(10);
  const [anchorClock, setAnchorClock] = useState(''); // blank = now
  const [timeMatch, setTimeMatch] = useState<TimeMatchedDrawsResponse | null>(null);
  const [tmError, setTmError] = useState('');
  const [tmLoading, setTmLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(1);
  const topRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    checkUser()
      .then((r) => {
        setAuthed(!!r.authenticated);
        setIsAdmin(r.user?.role === 'admin');
      })
      .catch(() => setAuthed(false));
  }, []);

  async function onSignOut() {
    setSigningOut(true);
    try {
      await logout();
    } catch {
      // Ignore — the proxy re-checks the cookie when we navigate.
    } finally {
      setSigningOut(false);
    }
    router.push('/login');
    router.refresh();
  }

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

  // Time-matched history: the ±windowMinutes window around the anchor clock time
  // on each of the last 7 days, in the viewer's own timezone. The anchor is the
  // current time unless the user picked one; the timezone offset is the browser's
  // so "10:00" means 10:00 for the person looking at the screen.
  useEffect(() => {
    if (viewMode !== 'timematch') return;
    let alive = true;
    setTmLoading(true);
    const anchor = anchorClock
      ? (() => {
          const [h, m] = anchorClock.split(':').map(Number);
          const d = new Date();
          d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
          return d.toISOString();
        })()
      : undefined;
    getTimeMatchedDraws(siteId, {
      days: 7,
      windowMinutes,
      anchor,
      tzOffset: new Date().getTimezoneOffset(),
    })
      .then((res) => {
        if (!alive) return;
        setTimeMatch(res);
        setTmError('');
        setSelectedDay((prev) => (res.days.some((d) => d.daysAgo === prev) ? prev : res.days[0]?.daysAgo ?? 1));
      })
      .catch((e) => {
        if (!alive) return;
        setTmError(e instanceof Error ? e.message : String(e));
        setTimeMatch(null);
      })
      .finally(() => {
        if (alive) setTmLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [viewMode, siteId, windowMinutes, anchorClock, refreshTick]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const selected = timeMatch?.days.find((d) => d.daysAgo === selectedDay) ?? timeMatch?.days[0] ?? null;
  const activeClock = timeMatch?.anchorClock ?? anchorClock ?? '';

  const changeSite = (id: string) => {
    if (viewMode === 'latest') setBusy(true);
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
  const onRefresh = () => {
    if (viewMode === 'latest') setBusy(true);
    setRefreshTick((t) => t + 1);
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
            {isAdmin ? (
              <Button asChild variant="outline">
                <Link href="/overview">Open dashboard</Link>
              </Button>
            ) : authed ? (
              <>
                <span className="hidden text-xs text-muted-foreground sm:inline">View only</span>
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={onSignOut} disabled={signingOut}>
                  <LogOut className="h-4 w-4" />
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </Button>
              </>
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
          {viewMode === 'timematch' && (
            <p className="mt-1 text-sm text-muted-foreground">
              Comparing the ±{windowMinutes} min window around{' '}
              <span className="font-semibold text-foreground">{activeClock || 'now'}</span> on each of the
              last 7 days.
            </p>
          )}
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

          <div className="flex overflow-hidden rounded-lg border border-white/10">
            <button
              onClick={() => setViewMode('latest')}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === 'latest' ? 'bg-primary text-primary-foreground' : 'bg-white/5 text-muted-foreground hover:bg-white/10'
              }`}
            >
              Latest
            </button>
            <button
              onClick={() => setViewMode('timematch')}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === 'timematch' ? 'bg-primary text-primary-foreground' : 'bg-white/5 text-muted-foreground hover:bg-white/10'
              }`}
            >
              Time-matched
            </button>
          </div>

          {viewMode === 'timematch' && (
            <>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                ± Window
                <select
                  value={windowMinutes}
                  onChange={(e) => setWindowMinutes(Number(e.target.value))}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-foreground"
                >
                  {WINDOW_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s} min
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Time
                <input
                  type="time"
                  value={anchorClock}
                  onChange={(e) => setAnchorClock(e.target.value)}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-foreground"
                />
                <span className="text-[10px] opacity-70">(blank = now)</span>
              </label>
            </>
          )}

          {viewMode === 'latest' && (
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
          )}

          <Button
            variant="outline"
            size="sm"
            className={viewMode === 'latest' ? '' : 'ml-auto'}
            onClick={onRefresh}
            disabled={(viewMode === 'latest' && busy) || (viewMode === 'timematch' && tmLoading)}
          >
            <RefreshCw className={busy || tmLoading ? 'animate-spin' : ''} /> Refresh
          </Button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Draws */}
        {viewMode === 'latest' ? (
          <div className="mt-4">
            {!draws ? (
              <SkeletonGrid count={pageSize} />
            ) : draws.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-muted-foreground">
                No completed draws recorded for this site yet.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {draws.map((d, i) => (
                  <DrawCard key={d.roundId ?? i} draw={d} highlight={page === 0 && i === 0} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4">
            {tmError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {tmError}
              </div>
            ) : !timeMatch ? (
              <SkeletonGrid />
            ) : (
              <>
                {/* Day sub-tabs: yesterday .. last week. */}
                <div className="flex flex-wrap gap-1.5">
                  {timeMatch.days.map((day) => {
                    const active = day.daysAgo === selected?.daysAgo;
                    return (
                      <button
                        key={day.daysAgo}
                        onClick={() => setSelectedDay(day.daysAgo)}
                        className={`rounded-lg border px-3 py-1.5 text-left text-xs transition-colors ${
                          active
                            ? 'border-primary bg-primary/15 text-foreground'
                            : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'
                        }`}
                      >
                        <span className="block font-semibold">{day.label}</span>
                        <span className="block text-[10px] opacity-70">
                          {WEEKDAYS[day.weekday] ?? '—'} {shortDate(day.date)} · {day.draws.length}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {selected && (
                  <>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{selected.label}</span>
                      <span>
                        {clockOf(selected.from)}–{clockOf(selected.to)} · {selected.date}
                      </span>
                      <span className="rounded-full bg-white/5 px-2 py-0.5">
                        {selected.draws.length} draw{selected.draws.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    {selected.draws.length === 0 ? (
                      <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-muted-foreground">
                        No draws in this window on {selected.label.toLowerCase()} ({selected.date}).
                      </div>
                    ) : (
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        {selected.draws.map((d, i) => (
                          <DrawCard key={d.roundId ?? i} draw={d} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Pagination (latest view only) */}
        {viewMode === 'latest' && (
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
        )}

        <p className="mt-6 text-center text-[11px] text-muted-foreground/70">
          Draw history is shown for analysis only. No account information is exposed here.
        </p>
      </main>
    </div>
  );
}
