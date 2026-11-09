'use client';

import { useCallback, useEffect, useState } from 'react';
import { getRainFreeBets, getTwoDigitTickets, placeManualBet, playRainFreeBet, rainManualCashBet } from '@/lib/api';
import type { RainFreeBet, TwoDigitTicketsResponse } from '@/lib/types';
import { isPlayableFreeBet } from '@/lib/freeBet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CollapsibleCard } from './CollapsibleCard';

// 2-digit dynamic ticket generator: reads the ML/repetition two-spot pairs
// predicted from the last 1–3 draws ("same digits repeat next game") plus
// recurrence patterns, and lets you place any of them in one click — cash
// ticket for fungames_tolobirr, rain cash wager for shamo, or (shamo only)
// on a rain free bet whose wager is the bonus amount itself.
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

  // Fund mode: cash (stake in ETB) vs rain free bet (wager = bonus amount).
  // Free bets only exist on shamo rain accounts, so the toggle is shamo-only.
  const [betMode, setBetMode] = useState<'cash' | 'free'>('cash');
  const [freeBets, setFreeBets] = useState<RainFreeBet[]>([]);
  const [freeBetAuto, setFreeBetAuto] = useState(true);
  const [selectedFreeBetId, setSelectedFreeBetId] = useState<number | null>(null);

  const load = useCallback(async (silent = true) => {
    if (!silent) setLoading(true);
    try {
      const res = await getTwoDigitTickets(siteId, 8);
      setData(res);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [siteId]);

  const loadFreeBets = useCallback(async () => {
    try {
      const fb = await getRainFreeBets();
      if (Array.isArray(fb?.bets)) setFreeBets(fb.bets);
    } catch {
      /* non-fatal: the picker just shows whatever we already have */
    }
  }, []);

  // Auto-refresh the two-digit picks every 30s (silent — no spinner) so the
  // ticket teams track freshly settled draws without a manual Refresh tap.
  useEffect(() => {
    void load(true);
    const t = setInterval(() => void load(true), 30000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (isShamo) void loadFreeBets();
  }, [isShamo, loadFreeBets]);

  const playableFreeBets = freeBets.filter((b) => isPlayableFreeBet(b));
  const bestFreeBet = playableFreeBets.length
    ? [...playableFreeBets].sort(
        (a, b) => b.wager_amount - a.wager_amount || (a.granted_at ?? '').localeCompare(b.granted_at ?? ''),
      )[0]
    : null;
  const activeFreeBet =
    freeBetAuto || selectedFreeBetId === null
      ? bestFreeBet
      : playableFreeBets.find((b) => b.id === selectedFreeBetId) ?? null;

  /** Free-bet path: play the pair on the active rain free bet (auto-best when
   *  Auto-Mode is on, otherwise the user-selected one). Wager = its own amount. */
  async function placeFreeBet(spots: [number, number]) {
    const bet = activeFreeBet;
    if (!bet) {
      onMessage?.('No playable free bet available — connect an account with a fresh rain bonus.');
      return;
    }
    const key = `${spots[0]}-${spots[1]}`;
    setPlacing(key);
    try {
      const res = await playRainFreeBet(bet.id, [...spots]);
      if (res.ok && res.result?.ok) {
        onMessage?.(
          `2-digit ticket [${spots.join(',')}] played as free bet — wager ${bet.wager_amount} ETB` +
            (bet.account_name ? ` · ${bet.account_name}` : '') + '.',
        );
        onRefresh?.();
        void loadFreeBets();
        void load(true);
      } else {
        onMessage?.(`Free-bet play failed: ${res.result?.error || 'unknown error'}`);
      }
    } catch (e) {
      onMessage?.('Free bet failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPlacing(null);
    }
  }

  async function place(spots: [number, number]) {
    if (betMode === 'free') {
      await placeFreeBet(spots);
      return;
    }
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
        void load(true);
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

  const noFreeBet = betMode === 'free' && !activeFreeBet;

  return (
    <CollapsibleCard
      title='2-digit dynamic tickets — ML repeat prediction from last draws'
      defaultOpen={defaultOpen}
    >
      <div className='space-y-3'>
        {isShamo && (
          <div className='flex flex-wrap items-center gap-2'>
            <span className='text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground'>
              Bet with:
            </span>
            <button
              type='button'
              onClick={() => setBetMode('cash')}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                betMode === 'cash'
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-border bg-muted/40 text-foreground hover:bg-muted/70'
              }`}
            >
              💰 Cash
            </button>
            <button
              type='button'
              onClick={() => {
                setBetMode('free');
                void loadFreeBets();
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                betMode === 'free'
                  ? 'border-amber-600 bg-amber-600 text-white'
                  : 'border-border bg-muted/40 text-foreground hover:bg-muted/70'
              }`}
            >
              🎁 Free Bet
            </button>
          </div>
        )}

        <div className='flex flex-wrap items-center gap-3'>
          {isShamo && betMode === 'free' ? (
            <div className='space-y-2'>
              <Label>Free bet — wager = bonus amount</Label>
              {playableFreeBets.length === 0 ? (
                <p className='text-xs italic text-muted-foreground'>
                  No playable free bet right now — rain bonuses on enabled accounts unlock automatically.
                </p>
              ) : (
                <>
                  <div className='flex max-w-xl flex-wrap gap-1.5'>
                    <button
                      type='button'
                      onClick={() => { setFreeBetAuto(true); setSelectedFreeBetId(null); }}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                        freeBetAuto
                          ? 'border-amber-600 bg-amber-600 text-white'
                          : 'border-border bg-muted/40 text-foreground hover:bg-muted/70'
                      }`}
                    >
                      ✨ Auto — {bestFreeBet ? `${bestFreeBet.wager_amount} ETB` : '—'}
                    </button>
                    {playableFreeBets.map((b) => {
                      const active = !freeBetAuto && selectedFreeBetId === b.id;
                      return (
                        <button
                          key={b.id}
                          type='button'
                          onClick={() => { setFreeBetAuto(false); setSelectedFreeBetId(b.id); }}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                            active
                              ? 'border-amber-600 bg-amber-600 text-white'
                              : 'border-border bg-muted/40 text-foreground hover:bg-muted/70'
                          }`}
                        >
                          {b.account_name ? b.account_name : `#${b.account_id}`} · {b.wager_amount} ETB
                        </button>
                      );
                    })}
                  </div>
                  {activeFreeBet && (
                    <p className='text-xs text-muted-foreground'>
                      Playing wager {activeFreeBet.wager_amount} ETB{activeFreeBet.account_name ? ` · ${activeFreeBet.account_name}` : ''}
                    </p>
                  )}
                </>
              )}
            </div>
          ) : (
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
          )}
          <div className='flex items-end gap-2'>
            <Button variant='outline' onClick={() => void load(false)} disabled={loading}>
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
                      <span key={n} className='flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 font-mono text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300'>
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
              const isFree = betMode === 'free';
              return (
                <div key={key} className='min-w-44 flex-1 rounded-lg border border-border bg-black/5 p-2 dark:border-white/10 dark:bg-[#0b0f19]'>
                  <div className='flex items-start justify-between gap-2'>
                    <div className='flex gap-1'>
                      {t.numbers.map((n) => (
                        <span key={n} className='flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 font-mono text-xs font-extrabold text-black ring-2 ring-amber-300'>
                          {n}
                        </span>
                      ))}
                    </div>
                    <span
                      className={`shrink-0 rounded border p-0.5 ${
                        isFree
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      }`}
                      title={isFree ? 'Free bet' : 'Cash ticket'}
                    >
                      {isFree ? '🎁' : '$'}
                    </span>
                  </div>
                  <div className='mt-1.5 flex flex-wrap gap-1'>
                    {t.reasons.slice(0, 3).map((r) => (
                      <span key={r} className='rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-white/5 dark:text-slate-300'>
                        {r}
                      </span>
                    ))}
                  </div>
                  <div className='mt-2'>
                    <Button
                      size='sm'
                      variant={isFree ? 'secondary' : isShamo ? 'secondary' : 'default'}
                      onClick={() => void place(t.numbers)}
                      disabled={placingThis || noFreeBet}
                    >
                      {placingThis
                        ? 'Placing…'
                        : isFree
                          ? activeFreeBet
                            ? `Bet ${activeFreeBet.wager_amount} ETB free`
                            : 'No free bet'
                          : `Bet ${stakeNum || '—'} ETB`}
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