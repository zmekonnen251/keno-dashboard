'use client';

import { useEffect, useMemo, useState } from 'react';
import { getDraws } from '@/lib/api';
import type { Draw } from '@/lib/types';
import { formatTime } from '@/lib/format';
import { Card, Empty, Loading, ErrorBox } from '@/components/app';
import { BOARD_CSS } from './boardStyles';

// Compact keno boards for historical draws: tiles shrink so five boards fit
// side-by-side; every drawn number is highlighted and numbers that also appear
// in most of the window get a red "hot" dot.
const MINI_CSS = `
.draws-mini .keno-board { gap: 2px; }
.draws-mini .keno-tile { font-size: 8px; border-radius: 3px; }
@media (min-width: 1024px) {
  .draws-mini .keno-tile { font-size: 7px; }
}
`;

function drawStats(d: Draw): { sum: number; odd: number; even: number } {
  const nums = d.results || [];
  return {
    sum: nums.reduce((a, b) => a + b, 0),
    odd: nums.filter((n) => n % 2 === 1).length,
    even: nums.length - nums.filter((n) => n % 2 === 1).length,
  };
}

export function LastDrawsBoards({
  siteId,
  siteName,
  limit = 5,
}: {
  siteId: string;
  siteName?: string;
  limit?: number;
}) {
  const [draws, setDraws] = useState<Draw[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await getDraws(siteId, limit);
        if (!alive) return;
        setDraws(res.draws);
        setError('');
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    };
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [siteId, limit]);

  // Frequency of each number across the window (1..80 → times drawn).
  const freq = useMemo(() => {
    const m = new Map<number, number>();
    for (const d of draws ?? []) {
      for (const n of d.results || []) m.set(n, (m.get(n) ?? 0) + 1);
    }
    return m;
  }, [draws]);

  const insights = useMemo(() => {
    const windowSize = draws?.length ?? 0;
    const hot = windowSize
      ? [...freq.entries()]
          .filter(([, c]) => c >= 3)
          .sort((a, b) => b[1] - a[1] || a[0] - b[0])
          .slice(0, 10)
      : [];
    const every = windowSize
      ? [...freq.entries()].filter(([, c]) => c === windowSize).map(([n]) => n).sort((a, b) => a - b)
      : [];
    const sums = (draws ?? []).map(drawStats);
    const avgSum = sums.length ? Math.round(sums.reduce((a, s) => a + s.sum, 0) / sums.length) : 0;
    const avgOdd = sums.length ? sums.reduce((a, s) => a + s.odd, 0) / sums.length : 0;
    return { hot, every, avgSum, avgOdd, windowSize };
  }, [draws, freq]);

  if (error) return <ErrorBox message={error} />;
  if (!draws) return <Card title={`Last ${limit} draws (${siteName ?? siteId})`}><Loading rows={2} /></Card>;

  return (
    <Card
      title={`Last ${draws.length} draws · ${siteName ?? siteId}`}
      actions={
        <span className="text-xs text-muted-foreground">
          Avg sum <b>{insights.avgSum}</b> · Avg odd {insights.avgOdd.toFixed(1)}/20
        </span>
      }
    >
      <style>{BOARD_CSS}{MINI_CSS}</style>
      {draws.length === 0 ? (
        <Empty label={'No completed draws recorded for this site yet.'} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {draws.map((d, i) => {
              const nums = d.results || [];
              const s = drawStats(d);
              return (
                <div key={d.roundId ?? i} className="space-y-1.5">
                  <div className="draws-mini rounded-lg border border-white/10 bg-[#0b0f19] p-1.5">
                    <div className="keno-board">
                      {Array.from({ length: 80 }, (_, k) => k + 1).map((n) => {
                        const isDrawn = nums.includes(n);
                        const hotDot = isDrawn && (freq.get(n) ?? 0) >= Math.max(3, limit - 1);
                        return (
                          <div key={n} className={isDrawn ? 'keno-tile picked' : 'keno-tile'}>
                            {n}
                            {hotDot && <span className="keno-dot hot" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
                    <span className={i === 0 ? 'font-bold text-foreground' : ''}>
                      {i === 0 ? '● latest ' : ''}· {d.roundNo ?? '—'}
                    </span>
                    <span>Σ{s.sum} · {s.odd}o/{s.even}e</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{d.drawnAt ? formatTime(d.drawnAt) : ''}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
                Hot numbers (in ≥3 of the {insights.windowSize} draws)
              </div>
              {insights.hot.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {insights.hot.map(([n, c]) => (
                    <span
                      key={n}
                      className="rounded-md bg-red-500/15 px-2 py-0.5 font-mono text-xs font-bold text-red-600 dark:text-red-400"
                      title={`Drawn in ${c}/${insights.windowSize} draws`}
                    >
                      {n} ×{c}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">No number repeated across 3+ draws in this window.</span>
              )}
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
                Consistent (in every draw)
              </div>
              {insights.every.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {insights.every.map((n) => (
                    <span key={n} className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {n}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">No number appeared in all {insights.windowSize} draws.</span>
              )}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}