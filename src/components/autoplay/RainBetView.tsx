/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { RainFreeBet, RainCashBet, RainAutoplayConfig } from '@/lib/types';
import { paytableWin } from '@/lib/kenoOdds';
import { notificationPermission, playWinSound, playDrawSound, playBettingOpenSound, pushWinNotification, requestNotificationPermission } from '@/lib/sound';
import { isPushActive, pushSupported, subscribePush, unsubscribePush, rePostSubscription } from '@/lib/push';
import { getNotifyPref, setNotifyPref, getSoundPref, setSoundPref } from '@/lib/notifyPrefs';
import { useNotifications } from '@/lib/notifications';
import { useLiveDraw } from '@/lib/useLiveDraw';
import { DollarSign, CloudRain } from 'lucide-react';
import { BOARD_CSS } from './boardStyles';

const BETTING_WINDOW_MS = 70000;
const DRAWING_DURATION_MS = 10000;

interface GameState {
  phase: 'betting_open' | 'drawing' | 'settled' | 'unknown';
  timer: number;
  roundNumber?: number;
}

function statusInfo(b: { status: RainFreeBet['status'] | RainCashBet['status']; winAmount?: number | null }): { text: string; tone: string } {
  if (b.status === 'won') return { text: 'Won', tone: '#4ade80' };
  if (b.status === 'lost') return { text: 'Lost', tone: '#64748b' };
  if (b.status === 'failed') return { text: 'Failed', tone: '#f87171' };
  if (b.status === 'bet_placed') return { text: 'Bet placed', tone: '#38bdf8' };
  if (b.status === 'claiming') return { text: 'Claiming', tone: '#f59e0b' };
  if (b.status === 'expired') return { text: 'Expired', tone: '#94a3b8' };
  return { text: 'Available', tone: '#4ade80' };
}

interface UnifiedBet {
  id: string;
  accountId: number;
  accountName: string;
  spots: number[];
  stake: number;
  wagerAmount: number;
  betType: 'free_bet' | 'cash';
  status: RainFreeBet['status'] | RainCashBet['status'];
  winAmount: number | null;
  matched: number | null;
  drawnSpots: number[];
  freeBetId?: string;
  requestId: string;
  betPlacedAt: string | number | null;
  failReason?: string;
  roundNumber: number;
}

export function RainBetView({ 
  freeBets, 
  cashBets, 
  config,
  autoRefresh = true 
}: { 
  freeBets?: RainFreeBet[]; 
  cashBets?: RainCashBet[];
  config?: RainAutoplayConfig | null;
  autoRefresh?: boolean;
}) {
  const { status, observer, drawn, updatedAt } = useLiveDraw('shamo');
  const [soundOn, setSoundOn] = useState(() => getSoundPref());
  const [notifyOn, setNotifyOn] = useState(() => getNotifyPref());
  const [pushOn, setPushOn] = useState(() => isPushActive());
  const [alerts, setAlerts] = useState<{ id: string; text: string; at: number }[]>([]);
  // Persist celebrated keys in localStorage to survive page refreshes
  const getStoredCelebrated = (): Set<string> => {
    try {
      const stored = localStorage.getItem('rainBetCelebrated');
      if (stored) return new Set(JSON.parse(stored));
    } catch {}
    return new Set();
  };

  const celebratedRef = useRef<Set<string>>(getStoredCelebrated());

  const saveCelebrated = () => {
    try {
      localStorage.setItem('rainBetCelebrated', JSON.stringify([...celebratedRef.current]));
    } catch {}
  };
  const { notify } = useNotifications();
  const [gameState, setGameState] = useState<GameState>({
    phase: 'unknown',
    timer: 0,
  });
  const [lastPhaseChange, setLastPhaseChange] = useState<number>(Date.now);

  // Convert free bets and cash bets to unified format
  const unifiedBets = useMemo((): UnifiedBet[] => {
    const bets: UnifiedBet[] = [];
    const roundDuration = BETTING_WINDOW_MS + DRAWING_DURATION_MS;
    
    const getRoundNumber = (timestamp: string | number | null): number => {
      if (!timestamp) return 0;
      const ts = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
      return Math.floor(ts / roundDuration);
    };
    
    if (freeBets) {
      for (const b of freeBets) {
        if (b.status === 'bet_placed' || b.status === 'claiming' || b.status === 'won' || b.status === 'lost') {
          bets.push({
            id: `fb-${b.id}`,
            accountId: b.account_id,
            accountName: b.account_name ?? `#${b.account_id}`,
            spots: b.chosen_spots || [],
            stake: 0,
            wagerAmount: b.wager_amount,
            betType: 'free_bet',
            status: b.status,
            winAmount: b.won_amount || null,
            matched: b.matched_spots?.length || null,
            drawnSpots: b.drawn_spots || [],
            freeBetId: b.free_bet_id,
            requestId: b.request_id || `fb-${b.id}`,
            betPlacedAt: b.bet_placed_at ?? null,
            failReason: b.error ?? undefined,
            roundNumber: getRoundNumber(b.bet_placed_at),
          });
        }
      }
    }
    
    if (cashBets) {
      for (const b of cashBets) {
        bets.push({
          id: `cb-${b.requestId}`,
          accountId: b.accountId,
          accountName: b.accountName,
          spots: b.spots,
          stake: b.stake,
          wagerAmount: b.stake,
          betType: 'cash',
          status: b.status,
          winAmount: b.winAmount,
          matched: b.matched,
          drawnSpots: b.drawnSpots || [],
          requestId: b.requestId,
          betPlacedAt: b.placedAt,
          failReason: b.failReason,
          roundNumber: getRoundNumber(b.placedAt),
        });
      }
    }
    
    return bets.sort((a, b) => {
      const ta = typeof a.betPlacedAt === 'number' ? a.betPlacedAt : new Date(a.betPlacedAt || 0).getTime();
      const tb = typeof b.betPlacedAt === 'number' ? b.betPlacedAt : new Date(b.betPlacedAt || 0).getTime();
      return tb - ta;
    });
  }, [freeBets, cashBets]);

  // Game state detection
  useEffect(() => {
    const updateGameState = () => {
      const now = Date.now();
      const roundDuration = BETTING_WINDOW_MS + DRAWING_DURATION_MS;
      const roundNumber = Math.floor(now / roundDuration);
      const roundStart = roundNumber * roundDuration;
      const timeInRound = now - roundStart;

      let newPhase: GameState['phase'] = 'unknown';
      let timer = 0;

      if (timeInRound < BETTING_WINDOW_MS) {
        newPhase = 'betting_open';
        timer = BETTING_WINDOW_MS - timeInRound;
      } else if (timeInRound < roundDuration) {
        newPhase = 'drawing';
        timer = roundDuration - timeInRound;
      } else {
        newPhase = 'settled';
        timer = roundDuration - timeInRound;
      }

      if (newPhase !== gameState.phase && soundOn) {
        if (newPhase === 'betting_open' && gameState.phase !== 'betting_open') playBettingOpenSound();
        else if (newPhase === 'drawing' && gameState.phase !== 'drawing') playDrawSound();
        setLastPhaseChange(now);
      }

      setGameState({ phase: newPhase, timer, roundNumber });
    };

    updateGameState();
    const interval = setInterval(updateGameState, 1000);
    return () => clearInterval(interval);
  }, [status, drawn, updatedAt, gameState.phase, soundOn]);

  const formatTimer = (ms: number) => {
    const seconds = Math.ceil(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getPhaseInfo = (phase: GameState['phase']) => {
    switch (phase) {
      case 'betting_open': return { color: 'text-emerald-400', label: 'BETTING OPEN', bgColor: 'bg-emerald-500/20' };
      case 'drawing': return { color: 'text-amber-400', label: 'DRAWING', bgColor: 'bg-amber-500/20' };
      case 'settled': return { color: 'text-blue-400', label: 'SETTLED', bgColor: 'bg-blue-500/20' };
      default: return { color: 'text-slate-400', label: 'UNKNOWN', bgColor: 'bg-slate-500/20' };
    }
  };

  const phaseInfo = getPhaseInfo(gameState.phase);
  const done = drawn.length >= 20;

  // Win celebration for free bets
  useEffect(() => {
    for (const b of unifiedBets) {
      if (b.betType !== 'free_bet') continue;
      if (b.status !== 'won') continue;
      const key = `freebet-${b.accountId}-${b.requestId}`;
      if (celebratedRef.current.has(key)) continue;
      celebratedRef.current.add(key);
      saveCelebrated();
      const spots = b.spots || [];
      const winAmount = b.winAmount ?? paytableWin(spots.length, spots.length, b.stake) ?? 0;
      const text = `🎁 Free Bet Full Match! [${spots.join(',')}] on ${b.accountName} — +${winAmount} ETB`;
      if (soundOn) playWinSound();
      if (!pushOn && notifyOn) pushWinNotification('Free Bet Full Match!', text);
      notify({ id: `rainwin-${key}`, kind: 'win', text, phone: b.accountName });
      setAlerts((prev) => [{ id: key, text, at: Date.now() }, ...prev].slice(0, 5));
    }
    if (celebratedRef.current.size > 200) {
      celebratedRef.current = new Set([...celebratedRef.current].slice(-100));
    }
  }, [unifiedBets, soundOn, notifyOn, pushOn, notify]);

  // Win celebration for cash bets
  useEffect(() => {
    for (const b of unifiedBets) {
      if (b.betType !== 'cash') continue;
      if (b.status !== 'won') continue;
      const key = `cash-${b.accountId}-${b.requestId}`;
      if (celebratedRef.current.has(key)) continue;
      celebratedRef.current.add(key);
      saveCelebrated();
      const spots = b.spots || [];
      const est = paytableWin(spots.length, spots.length, b.stake) ?? b.winAmount ?? 0;
      const text = `💰 Cash Full Match! [${spots.join(',')}] on ${b.accountName} — +${est} ETB`;
      if (soundOn) playWinSound();
      if (!pushOn && notifyOn) pushWinNotification('Cash Full Match!', text);
      notify({ id: `rainwin-${key}`, kind: 'win', text, phone: b.accountName });
      setAlerts((prev) => [{ id: key, text, at: Date.now() }, ...prev].slice(0, 5));
    }
  }, [unifiedBets, soundOn, notifyOn, pushOn, notify]);

  async function onToggleNotifications() {
    if (pushOn || notifyOn) {
      await unsubscribePush();
      setPushOn(false);
      setNotifyOn(false);
      setNotifyPref(false);
      return;
    }
    if (pushSupported() && (await subscribePush())) {
      setPushOn(true);
      setNotifyOn(true);
      setNotifyPref(true);
      return;
    }
    const perm = await requestNotificationPermission();
    const granted = perm === 'granted';
    setNotifyOn(granted);
    setNotifyPref(granted);
  }

  function onToggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundPref(next);
  }

  // Round bucket keyed to the live-draw stream: tickets stay visible while the
  // same draw is running (betting / drawing / settled / between games) and are
  // only dropped once the stream shows a brand-new draw start (resets 20 -> 0).
  const roundResetRef = useRef<number>(Date.now());
  const seededRef = useRef(false);
  const prevDrawnLenRef = useRef<number>(0);
  const [drawEpoch, setDrawEpoch] = useState(0);

  const newestBet = useMemo(() => {
    let max = 0;
    for (const b of unifiedBets) {
      const ts = typeof b.betPlacedAt === 'number' ? b.betPlacedAt : b.betPlacedAt ? new Date(b.betPlacedAt).getTime() : 0;
      if (ts > max) max = ts;
    }
    return max;
  }, [unifiedBets]);

  useEffect(() => {
    if (!seededRef.current && newestBet > 0) {
      seededRef.current = true;
      roundResetRef.current = newestBet - (BETTING_WINDOW_MS + DRAWING_DURATION_MS);
    }
  }, [newestBet]);

  useEffect(() => {
    const prev = prevDrawnLenRef.current;
    prevDrawnLenRef.current = drawn.length;
    if (prev >= 20 && drawn.length === 0) {
      roundResetRef.current = Date.now();
      setDrawEpoch((e) => e + 1);
    }
  }, [drawn]);

  const currentRoundBets = useMemo(
    () =>
      unifiedBets.filter((b) => {
        const ts = typeof b.betPlacedAt === 'number' ? b.betPlacedAt : b.betPlacedAt ? new Date(b.betPlacedAt).getTime() : 0;
        return ts >= roundResetRef.current;
      }),
    [unifiedBets, drawEpoch],
  );

  const activeBets = currentRoundBets.filter(b => b.status === 'bet_placed' || b.status === 'claiming');
  const settledBets = currentRoundBets.filter(b => b.status === 'won' || b.status === 'lost');

  return (
    <div className='overflow-hidden rounded-xl border border-white/10 bg-[#0b0f19] text-slate-100'>
      <style>{BOARD_CSS}</style>

      {/* Header with Game State and Timer */}
      <div className='flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5'>
        <div className='flex items-center gap-3'>
          <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${phaseInfo.bgColor}`}>
            <span className={`h-2 w-2 rounded-full ${gameState.phase === 'betting_open' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`}></span>
            <span className={`text-xs font-bold uppercase tracking-wider ${phaseInfo.color}`}>{phaseInfo.label}</span>
          </div>
          {gameState.timer > 0 && (
            <div className='flex items-center gap-2'>
              <div className='rounded bg-white/5 px-3 py-1.5 font-mono text-sm font-bold text-white'>{formatTimer(gameState.timer)}</div>
              {gameState.roundNumber && <span className='text-xs text-slate-400'>Round #{gameState.roundNumber}</span>}
            </div>
          )}
          <div className='flex items-center gap-2'>
            <span className={`rounded bg-white/5 px-2 py-0.5 font-mono text-[10px] font-bold ${done ? 'text-slate-300' : 'text-amber-300'}`}>
              {done ? `${drawn.length}/20` : `${drawn.length}/20`}
            </span>
            <span className={`text-xs font-medium ${status === 'live' ? 'text-emerald-400' : 'text-slate-400'}`}>
              {status === 'live' ? '● LIVE' : '● OFFLINE'}
            </span>
          </div>
        </div>

        <div className='flex items-center gap-2 text-xs'>
          <span className='text-slate-400'>{activeBets.length} betting</span>
          <span className='text-slate-400'>•</span>
          <span className='text-slate-400'>{settledBets.length} settled</span>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className='space-y-1.5 border-b border-white/10 px-4 py-2'>
          {alerts.map((a) => (
            <div key={a.id} className='flex items-center justify-between gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-200'>
              <span className='min-w-0'>🎉 {a.text} <span className='font-mono font-normal text-emerald-300/70'>{new Date(a.at).toLocaleTimeString()}</span></span>
              <button onClick={() => setAlerts((prev) => prev.filter((x) => x.id !== a.id))} className='shrink-0 text-emerald-300/60 hover:text-emerald-200'>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Drawn balls */}
      <div className='flex flex-wrap items-center gap-1.5 border-b border-white/10 px-4 py-2.5'>
        {drawn.length === 0 ? (
          <div className='flex items-center gap-2'>
            <span className='text-xs italic text-slate-500'>Waiting for the draw…</span>
            {gameState.phase === 'betting_open' && <span className='text-xs text-emerald-400 animate-pulse'>Betting open</span>}
          </div>
        ) : (
          <>
            {drawn.map((n, i) => (
              <span key={n} className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold text-white shadow-lg transition-all duration-300 ${i === drawn.length - 1 ? 'scale-110 bg-emerald-400 ring-2 ring-emerald-300' : 'bg-emerald-500'}`}>{n}</span>
            ))}
            {drawn.length < 20 && <span className='text-xs text-slate-500 italic ml-2'>{20 - drawn.length} remaining...</span>}
          </>
        )}
      </div>

      <div className='grid grid-cols-1 gap-3 p-3 lg:grid-cols-2'>
        {/* Left: ALL active tickets for the current round — simple like the real
            fungames tolobirr ticket: number balls in a row, digits light up as
            the draw lands (live stream), plus a compact account/wager/status line. */}
        <div className='min-w-0'>
          <div className='mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-400'>
            Live Tickets ({currentRoundBets.length})
            {activeBets.length > 0 && <span className='ml-1.5 font-bold text-emerald-400'>· {activeBets.length} betting</span>}
          </div>
          {currentRoundBets.length === 0 ? (
            <p className='py-4 text-center text-xs italic text-slate-500'>No tickets placed this round.</p>
          ) : (
            <div className='flex flex-col gap-2'>
              {currentRoundBets.map((b) => {
                const isFreeBet = b.betType === 'free_bet';
                const s = statusInfo({ status: b.status, winAmount: b.winAmount });
                const isWinner = b.status === 'won';
                const isFailed = b.status === 'failed';
                // Highlight digits from the LIVE draw stream so they light up in
                // real time during the draw (all 20 land by settlement).
                return (
                  <div
                    key={b.id}
                    title={isFailed && b.failReason ? b.failReason : undefined}
                    className={`rounded-lg border p-2 transition-all ${
                      isWinner
                        ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_12px_rgba(34,197,94,0.3)]'
                        : isFailed
                          ? 'border-red-500/70 bg-red-500/5'
                          : isFreeBet
                            ? 'border-sky-500/40 bg-sky-500/10'
                            : 'border-white/5 bg-white/3'
                    }`}
                  >
                    <div className='flex items-start justify-between gap-2'>
                      <div className='flex flex-wrap items-center gap-1'>
                        {b.spots.map((n, idx) => {
                          const isHit = drawn.includes(n);
                          return (
                            <span
                              key={idx}
                              className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px] font-extrabold transition-all duration-300 ${
                                isHit ? 'scale-110 bg-amber-400 text-black ring-2 ring-amber-300' : isFreeBet ? 'bg-sky-600/40 text-sky-100' : 'bg-black/40 text-slate-200'
                              }`}
                            >{n}</span>
                          );
                        })}
                      </div>
                      {/* Cash/free identifier, top-right: $ = cash, cloud/rain = free */}
                      <span
                        className={`shrink-0 rounded border p-0.5 ${isFreeBet ? 'border-sky-500/40 bg-sky-500/15 text-sky-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}
                        title={isFreeBet ? 'Free ticket' : 'Cash ticket'}
                      >
                        {isFreeBet ? <CloudRain className='h-3.5 w-3.5' /> : <DollarSign className='h-3.5 w-3.5' />}
                      </span>
                    </div>
                    <div className='mt-1.5 flex items-center justify-between gap-2 text-xs'>
                      <span className='truncate text-slate-400'>{b.accountName} · {isFreeBet ? `+${b.wagerAmount} ETB` : `${b.stake} ETB`}</span>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${isFailed ? 'bg-red-500/15 text-red-400' : 'bg-white/5'}`}
                        style={isFailed ? undefined : { color: s.tone }}
                      >
                        {isWinner ? 'WINNER' : s.text}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Keno Board */}
        <div className='min-w-0'>
          <div className='keno-board-panel'>
            <div className='keno-board'>
              {Array.from({ length: 80 }, (_, i) => i + 1).map((n) => {
                const isDrawn = drawn.includes(n);
                const isWinnerNum = currentRoundBets.some(b => b.status === 'won' && b.spots.includes(n));
                const isPick = currentRoundBets.some(b => b.spots.includes(n));
                return (
                  <div key={n} className={isWinnerNum ? 'keno-tile hit' : isDrawn ? 'keno-tile picked' : 'keno-tile'}>
                    {n}
                    {!isDrawn && isPick && <span className='keno-dot suggested' />}
                  </div>
                );
              })}
            </div>
          </div>
          <p className='mt-2 text-[11px] text-slate-500'>
            {observer && <>Watching via {observer}. </>}
            {updatedAt && <>Updated {new Date(updatedAt).toLocaleTimeString()}.</>}
            {notificationPermission() === 'denied' && <> Browser notifications are blocked — allow them in site settings to get win alerts.</>}
          </p>
        </div>
      </div>
    </div>
  );
}