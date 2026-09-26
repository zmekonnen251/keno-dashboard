'use client';

import { useEffect, useMemo, useState } from 'react';
import { getMlLive } from '@/lib/api';
import type { MlLiveResponse } from '@/lib/types';
import { CollapsibleCard } from './CollapsibleCard';

// Random Pick-10 mean hits on a 20/80 draw (10 distinct balls drawn from 80).
const RANDOM_PICK10_HITS = 2.5;

function NumberChip({ n, tone }: { n: number; tone: 'blue' | 'amber' | 'slate' }) {
  const cls =
    tone === 'amber'
      ? 'bg-amber-400 text-black ring-2 ring-amber-300'
      : tone === 'blue'
        ? 'bg-blue-500/30 text-blue-700 ring-1 ring-blue-400/30 dark:text-blue-200'
        : 'bg-muted text-slate-600 dark:bg-white/10 dark:text-slate-300';
  return (
    <span className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px] font-extrabold ${cls}`}>
      {n}
    </span>
  );
}

// Live ML predictor output (recurrence_v1) for the current site: the prediction
// itself, the per-number predictor output (probabilities + trigger reasons) and
// the ticket-recurrence averages. Honest insight telemetry — the model is
// evaluated at chance on clean data, so this is an insights tool, not an edge.
export function MlPredictorCard({ siteId }: { siteId: string }) {
  const [data, setData] = useState<MlLiveResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await getMlLive(siteId);
        if (!alive) return;
        setData(res);
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
  }, [siteId]);

  const pred = data?.prediction ?? null;
  const ins = data?.insights ?? null;

  const numberRows = useMemo(() => {
    const np = pred?.numberPredictions ?? [];
    if (np.length) {
      return [...np].sort((a, b) => a.number - b.number);
    }
    return (pred?.numbers ?? []).map((n) => ({ number: n, probability: 0, trigger_reason: '' }));
  }, [pred]);

  const maxProb = useMemo(
    () => Math.max(1e-6, ...numberRows.map((r) => r.probability)),
    [numberRows],
  );

  const recNums = useMemo(() => {
    const mid = ins?.numbers ?? {};
    return Object.entries(mid)
      .map(([k, v]) => ({ num: Number(k), ...v }))
      .sort((a, b) => a.num - b.num);
  }, [ins]);

  const runs = ins?.runs ?? [];
  const metrics = ins?.metrics ?? null;

  if (error) {
    return (
      <CollapsibleCard title='ML prediction & recurrence' defaultOpen={false}>
        <p className='text-xs text-rose-500 dark:text-rose-400'>{error}</p>
      </CollapsibleCard>
    );
  }

  if (!data) {
    return (
      <CollapsibleCard title='ML prediction & recurrence' defaultOpen={false}>
        <p className='text-xs text-muted-foreground'>Loading ML predictor…</p>
      </CollapsibleCard>
    );
  }

  if (data.status !== 'ok' || !pred) {
    return (
      <CollapsibleCard title='ML prediction & recurrence' defaultOpen={false}>
        <p className='text-xs text-muted-foreground'>
          {data.message ?? `ML predictor unavailable (${data.status}).`}
        </p>
      </CollapsibleCard>
    );
  }

  return (
    <CollapsibleCard title='ML prediction & recurrence — predictor output & ticket recurrence averages' defaultOpen={true}>
      <div className='space-y-3'>
        {/* Prediction */}
        <div className='rounded-lg border border-border bg-black/5 p-3 dark:border-white/10 dark:bg-white/5'>
          <div className='flex flex-wrap items-center gap-1'>
            {pred.numbers.map((n) => (
              <NumberChip key={n} n={n} tone={pred.ticket.includes(n) ? 'amber' : 'blue'} />
            ))}
          </div>
          <div className='mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground'>
            <span>
              Ticket: <b className='text-foreground'>[{pred.ticket.join(', ')}]</b>
            </span>
            <span>
              Top-10 avg prob <b className='text-foreground'>{(pred.confidence * 100).toFixed(2)}%</b>
              <span className='text-muted-foreground/70'> (chance ≈ 12.5%)</span>
            </span>
            {ins && <span>ledger {ins.n_draws} draws</span>}
          </div>
          {pred.disclaimer && (
            <p className='mt-2 text-[11px] italic text-muted-foreground'>{pred.disclaimer}</p>
          )}
        </div>

        {/* Predictor output: per-number score + trigger reason */}
        <div>
          <div className='mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground'>
            Predictor output — per-number score
          </div>
          <div className='space-y-1.5'>
            {numberRows.map((r) => (
              <div key={r.number} className='grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-2 text-xs'>
                <NumberChip n={r.number} tone='slate' />
                <div className='min-w-0'>
                  <div className='flex items-center gap-2'>
                    <div className='h-2 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10'>
                      <div
                        className='h-full rounded-full bg-blue-400/70 transition-all duration-500'
                        style={{ width: `${Math.max(4, (r.probability / maxProb) * 100)}%` }}
                      />
                    </div>
                    <span className='w-14 shrink-0 text-right font-mono text-muted-foreground'>
                      {(r.probability * 100).toFixed(3)}%
                    </span>
                  </div>
                  <div
                    className='mt-0.5 truncate text-[11px] text-muted-foreground'
                    title={r.trigger_reason || undefined}
                  >
                    {r.trigger_reason || 'frequency'}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {metrics && metrics.holdout_samples > 0 && (
            <p className='mt-2 text-[11px] text-muted-foreground'>
              Holdout eval ({metrics.holdout_samples} rounds): mean top-10 hits{' '}
              <b className='text-foreground'>{metrics.mean_pick10_hits}</b> vs random ≈{' '}
              {RANDOM_PICK10_HITS} · ticket-3 hits <b className='text-foreground'>{metrics.mean_ticket3_hits}</b>.
            </p>
          )}
        </div>

        {/* Ticket recurrence averages */}
        {ins && (
          <div>
            <div className='mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground'>
              Ticket recurrence — average gaps
            </div>
            {recNums.length > 0 ? (
              <div className='grid grid-cols-1 gap-1.5 sm:grid-cols-2'>
                {recNums.map((r) => (
                  <div key={r.num} className='rounded border border-border bg-black/5 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-white/5'>
                    <div className='flex items-center justify-between gap-2'>
                      <span className='flex items-center gap-1.5'>
                        <NumberChip n={r.num} tone='slate' />
                        <span className='text-muted-foreground'>seen {r.count}×</span>
                      </span>
                      <span className='text-[10px] text-muted-foreground'>
                        {(r.freq * 100).toFixed(2)}% / draw
                      </span>
                    </div>
                    <div className='mt-1 text-foreground'>
                      {r.avg_gap_draws != null ? (
                        <>
                          recurs every <b>{r.avg_gap_draws}</b> draws on average
                        </>
                      ) : (
                        'no recorded occurrences'
                      )}
                    </div>
                    {r.top_hour != null && (
                      <div className='text-[10px] text-muted-foreground'>
                        drifts to hour {r.top_hour}:00 (time lift ×{r.top_hour_lift})
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className='text-xs text-muted-foreground'>
                No recurrence averages available for the current picks.
              </p>
            )}

            {runs.length > 0 && (
              <div className='mt-2'>
                <div className='mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80'>
                  Top recurring runs — average gaps
                </div>
                <div className='space-y-1'>
                  {runs.slice(0, 8).map((r, i) => (
                    <div key={i} className='flex items-center gap-2 text-xs'>
                      <span className='shrink-0 font-mono text-blue-600 dark:text-blue-300'>[{r.run.join(',')}]</span>
                      <span className='text-muted-foreground'>
                        {r.type} · lift ×{r.lift} · every ~{r.avg_gap_min} min
                      </span>
                      <span className='ml-auto text-muted-foreground'>seen {r.obs}×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </CollapsibleCard>
  );
}