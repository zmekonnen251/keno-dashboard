'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { RainFreeBet } from '@/lib/types';
import { getRainFreeBets } from '@/lib/api';
import { BOARD_CSS } from './boardStyles';
import { formatTime } from '@/lib/format';

const BETTING_WINDOW_MS = 70000; // 70 seconds for betting
const DRAWING_DURATION_MS = 10000; // 10 seconds for drawing

interface FreeBetGameState {
  phase: 'betting_open' | 'drawing' | 'settled' | 'unknown';
  timer: number;
  roundNumber?: number;
}

function freeBetStatusLabel(b: RainFreeBet): { text: string; cls: string } {
  if (b.status === 'won') return { text: 'Won', cls: 'bg-emerald-600 text-white' };
  if (b.status === 'lost') return { text: 'Lost', cls: 'bg-zinc-600 text-white' };
  if (b.status === 'failed') return { text: 'Failed', cls: 'bg-rose-600 text-white' };
  if (b.status === 'bet_placed') return { text: 'Bet placed', cls: 'bg-sky-600 text-white' };
  if (b.status === 'claiming') return { text: 'Claiming', cls: 'bg-amber-500 text-black' };
  if (b.status === 'expired') return { text: 'Expired', cls: 'bg-muted text-muted-foreground' };
  return { text: 'Available', cls: 'bg-emerald-600 text-white' };
}

export function RainFreeBetView({ autoRefresh = true }: { autoRefresh?: boolean }) {
  const [freeBets, setFreeBets] = useState<RainFreeBet[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [gameState, setGameState] = useState<FreeBetGameState>({
    phase: 'unknown',
    timer: 0,
  });
  const [lastPhaseChange, setLastPhaseChange] = useState<number>(Date.now());

  // Enhanced game state detection with timer
  useEffect(() => {
    const updateGameState = () => {
      const now = Date.now();
      const roundDuration = BETTING_WINDOW_MS + DRAWING_DURATION_MS;
      const roundNumber = Math.floor(now / roundDuration);
      const roundStart = roundNumber * roundDuration;
      const timeInRound = now - roundStart;

      let newPhase: FreeBetGameState['phase'] = 'unknown';
      let timer = 0;

      if (timeInRound < BETTING_WINDOW_MS) {
        // Betting phase
        newPhase = 'betting_open';
        timer = BETTING_WINDOW_MS - timeInRound;
      } else if (timeInRound < roundDuration) {
        // Drawing phase
        newPhase = 'drawing';
        timer = roundDuration - timeInRound;
      } else {
        // Settled phase
        newPhase = 'settled';
        timer = roundDuration - timeInRound;
      }

      if (newPhase !== gameState.phase) {
        setLastPhaseChange(now);
      }

      setGameState({ phase: newPhase, timer, roundNumber });
    };

    updateGameState();
    const interval = setInterval(updateGameState, 1000);
    return () => clearInterval(interval);
  }, [gameState.phase]);

  // Format timer as MM:SS
  const formatTimer = (ms: number) => {
    const seconds = Math.ceil(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get phase color and label
  const getPhaseInfo = (phase: FreeBetGameState['phase']) => {
    switch (phase) {
      case 'betting_open':
        return { color: 'text-emerald-400', label: 'BETTING OPEN', bgColor: 'bg-emerald-500/20' };
      case 'drawing':
        return { color: 'text-amber-400', label: 'DRAWING', bgColor: 'bg-amber-500/20' };
      case 'settled':
        return { color: 'text-blue-400', label: 'SETTLED', bgColor: 'bg-blue-500/20' };
      default:
        return { color: 'text-slate-400', label: 'UNKNOWN', bgColor: 'bg-slate-500/20' };
    }
  };

  const phaseInfo = getPhaseInfo(gameState.phase);

  // Poll for free bets
  useEffect(() => {
    if (!autoRefresh) return;
    let cancelled = false;
    const tick = () =>
      void (async () => {
        try {
          setLoading(true);
          const res = await getRainFreeBets();
          if (!cancelled) setFreeBets(res.bets);
        } catch {
          // keep last list
        } finally {
          setLoading(false);
        }
      })();
    void tick();
    const t = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [autoRefresh]);

  // Filter bets that are in betting state (bet_placed or claiming)
  const bettingBets = useMemo(() => {
    if (!freeBets) return [];
    return freeBets.filter(b => b.status === 'bet_placed' || b.status === 'claiming');
  }, [freeBets]);

  return (
    <div className='overflow-hidden rounded-xl border border-white/10 bg-[#0b0f19] text-slate-100'>
      <style>{BOARD_CSS}</style>

      {/* Enhanced Header with Game State and Timer */}
      <div className='flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5'>
        <div className='flex items-center gap-3'>
          {/* Game Status Indicator */}
          <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${phaseInfo.bgColor}`}>
            <span className={`h-2 w-2 rounded-full ${gameState.phase === 'betting_open' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`}></span>
            <span className={`text-xs font-bold uppercase tracking-wider ${phaseInfo.color}`}>
              {phaseInfo.label}
            </span>
          </div>

          {/* Timer */}
          {gameState.timer > 0 && (
            <div className='flex items-center gap-2'>
              <div className='rounded bg-white/5 px-3 py-1.5 font-mono text-sm font-bold text-white'>
                {formatTimer(gameState.timer)}
              </div>
              {gameState.roundNumber && (
                <span className='text-xs text-slate-400'>Round #{gameState.roundNumber}</span>
              )}
            </div>
          )}
        </div>

        <div className='flex items-center gap-2 text-xs'>
          <span className='text-slate-400'>
            {bettingBets.length} betting
          </span>
          <span className='text-slate-400'>
            •
          </span>
          <span className='text-slate-400'>
            {freeBets?.filter(b => b.status === 'available' || b.status === 'failed').length || 0} available
          </span>
        </div>
      </div>

      {/* Betting tickets */}
      {bettingBets.length > 0 && (
        <div className='border-b border-white/10 px-4 py-3'>
          <div className='mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-400'>
            Betting tickets ({bettingBets.length})
          </div>
          <div className='flex flex-wrap gap-2'>
            {bettingBets.map((b) => {
              const s = freeBetStatusLabel(b);
              return (
                <div
                  key={b.id}
                  className={`min-w-44 flex-1 rounded-lg border p-2 border-sky-500/40 bg-sky-500/10 shadow-[0_0_8px_rgba(14,165,233,0.2)]`}
                >
                  <div className='flex flex-wrap gap-1'>
                    {(b.chosen_spots || []).map((n) => (
                      <span
                        key={n}
                        className='flex h-6 w-6 items-center justify-center rounded font-mono text-[11px] font-extrabold bg-sky-500 text-white'
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                  <div className='mt-1.5 flex items-center justify-between gap-2 text-xs'>
                    <span className='truncate text-slate-400'>
                      {b.account_name ?? `#${b.account_id}`} · +{b.wager_amount} ETB
                    </span>
                    <span className={`shrink-0 font-bold ${s.cls}`}>
                      {s.text}
                    </span>
                  </div>
                  {b.bet_placed_at && (
                    <div className='mt-1 text-[11px] text-slate-500'>
                      Placed {formatTime(b.bet_placed_at)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available free bets */}
      <div className='p-3'>
        <div className='mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-400'>
          Available free bets ({freeBets?.filter(b => b.status === 'available' || b.status === 'failed').length || 0})
        </div>
        {loading && !freeBets ? (
          <p className='py-4 text-center text-xs italic text-slate-500'>Loading free bets…</p>
        ) : !freeBets || freeBets.length === 0 ? (
          <p className='py-4 text-center text-xs italic text-slate-500'>No free bets available.</p>
        ) : (
          <div className='space-y-2 max-h-60 overflow-y-auto'>
            {freeBets
              .filter(b => b.status === 'available' || b.status === 'failed')
              .slice(0, 20)
              .map((b) => {
                const s = freeBetStatusLabel(b);
                return (
                  <div
                    key={b.id}
                    className='flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/3 px-3 py-2'
                  >
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-center gap-2'>
                        <span className='font-medium text-sm'>
                          {b.account_name ?? `#${b.account_id}`}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${s.cls}`}>
                          {s.text}
                        </span>
                      </div>
                      <div className='mt-1 flex items-center gap-3 text-xs text-slate-400'>
                        <span>+{b.wager_amount} ETB</span>
                        {b.expires_at && (
                          <span>Expires {formatTime(b.expires_at)}</span>
                        )}
                      </div>
                    </div>
                    {b.rain_id && (
                      <div className='text-[10px] text-slate-500 font-mono'>
                        {b.rain_id.slice(0, 8)}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
