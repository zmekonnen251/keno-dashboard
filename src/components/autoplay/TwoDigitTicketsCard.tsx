'use client';

import { useCallback, useEffect, useState } from 'react';
import { getTwoDigitTickets, placeManualBet, rainManualCashBet } from '@/lib/api';
import type { TwoDigitTicketsResponse } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CollapsibleCard } from './CollapsibleCard';

// 2-digit dynamic ticket generator: reads the ML/repetition two-spot pairs
// predicted from the last 1–3 draws ("same digits repeat next game") plus
// recurrence patterns, and lets you place any of them as a cash ticket in one
// click — cash account for fungames_tolobirr, rain cash wager for shamo.
export function TwoDigitTicketsCard({
  siteId,
  onMessage,
  onRefresh,
  defaultOpen = false,
}: {
  siteId: string;
  onMessage?: (msg: string) => void;
  onRefresh?: () => void;
  defaultOpen?: boolean;
}) {
  const [data, setData] = useState<TwoDigitTicketsResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [stake, setStake] = useState('2');
  const [placing, setPlacing] = useState<string | null>(null);

  const isShamo = siteId === 'fungames_shamo';
  const stakeNum = parseFloat(stake) || 0;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTwoDigitTickets(siteId, 8);
      setData(res);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function place(spots: [number, number]) {
    if (stakeNum < 2) {
      onMessage?.('Stake must be >= 2 ETB.');
      return;
    }
    const key = `${spots[0]}-${spots[1]}`;
    setPlacing(key);
    try {
      const res = isShamo
        ? await rainManualCashBet(null, [...spots], stakeNum)
        : await placeManualBet([...spots], stakeNum);
      if (res.ok) {
        const account = 'accountId' in res && res.accountId ? `#${res.accountId}` : 'auto-account';
        onMessage?.(`2-digit ticket [${spots.join(',')}] placed at ${stakeNum} ETB on ${account}.`);
        onRefresh?.();
      } else {
        const failReason = isShamo && 'result' in res && res.result && 'error' in res.result
          ? res.result.error
          : 'failReason' in res
            ? res.failReason
            : undefined;
        onMessage?.(`Bet failed: ${failReason || 'unknown error'}`);
      }
    } catch (e) {
      onMessage?.('Bet failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPlacing(null);
    }
  }

  return (
    <CollapsibleCard
      title='2-digit dynamic tickets — ML repeat prediction from last draws'
      defaultOpen={defaultOpen}
    >
      <div className='space-y-3'>
        <div className='flex flex-wrap items-center gap-3'>
          <div className='space-y-1.5'>
            <Label>Stake (ETB)</Label>
            <Input
              type='number'
              min='2'
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              placeholder='2'
              className='w-28'
            />
          </div>
          <div className='flex items-end gap-2'>
            <Button variant='outline' onClick={() => void load()} disabled={loading}>
              {loading ? 'Loading…' : data ? 'Refresh' : 'Generate'}
            </Button>
          </div>
          <p className='text-xs text-muted-foreground'>
            Pairs predicted from the last 1–3 draws (same digits can redraw next game) + repetitive patterns.
          </p>
        </div>

        {error && <p className='text-xs font-semibold text-destructive'>{error}</p>}

        {data && data.draws.length > 0 && (
          <div className='rounded-lg border border-border bg-muted/30 p-3'>
            <div className='mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground'>
              Last {data.draws.length} draw{data.draws.length > 1 ? 's' : ''}
            </div>
            <div className='flex flex-wrap gap-2'>
              {data.draws.map((d, di) => (
                <div key={`${d.roundId}-${di}`} className='flex flex-wrap items-center gap-1'>
                  {di > 0 && <span className='text-muted-foreground/50 text-xs'>←</span>}
                  <span className='flex flex-wrap gap-0.5'>
                    {d.results.map((n) => (
                      <span key={n} className='flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 font-mono text-[10px] font-extrabold text-emerald-300'>
                        {n}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data && data.tickets.length === 0 && !error && (
          <p className='py-2 text-center text-xs italic text-muted-foreground'>
            No two-digit suggestions yet — need at least one completed draw on record.
          </p>
        )}

        {data && data.tickets.length > 0 && (
          <div className='flex flex-wrap gap-2'>
            {data.tickets.map((t) => {
              const key = `${t.numbers[0]}-${t.numbers[1]}`;
              const placingThis = placing === key;
              return (
                <div key={key} className='min-w-44 flex-1 rounded-lg border border-white/10 bg-[#0b0f19] p-2'>
                  <div className='flex items-start justify-between gap-2'>
                    <div className='flex gap-1'>
                      {t.numbers.map((n) => (
                        <span key={n} className='flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 font-mono text-xs font-extrabold text-black ring-2 ring-amber-300'>
                          {n}
                        </span>
                      ))}
                    </div>
                    <span className='shrink-0 rounded border border-emerald-500/30 bg-emerald-500/10 p-0.5 text-emerald-300' title='Cash ticket'>
                      $
                    </span>
                  </div>
                  <div className='mt-1.5 flex flex-wrap gap-1'>
                    {t.reasons.slice(0, 3).map((r) => (
                      <span key={r} className='rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-300'>
                        {r}
                      </span>
                    ))}
                  </div>
                  <div className='mt-2'>
                    <Button
                      size='sm'
                      variant={isShamo ? 'secondary' : 'default'}
                      onClick={() => void place(t.numbers)}
                      disabled={placingThis || (isShamo && stakeNum < 2)}
                    >
                      {placingThis ? 'Placing…' : `Bet ${stakeNum || '—'} ETB`}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </CollapsibleCard>
  );
}