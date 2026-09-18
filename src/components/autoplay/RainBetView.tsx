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
import { BOARD_CSS } from './boardStyles';

const BETTING_WINDOW_MS = 70000;
const DRAWING_DURATION_MS = 10000;

interface GameState {
  phase: 'betting_open' | 'drawing' | 'settled' | 'unknown';
  timer: number;
  roundNumber?: number;
}

function freeBetStatusLabel(b: { status: RainFreeBet['status']; winAmount?: number | null }): { text: string; cls: string } {
  if (b.status === 'won') return { text: 'Won', cls: 'bg-emerald-600 text-white' };
  if (b.status === 'lost') return { text: 'Lost', cls: 'bg-zinc-600 text-white' };
  if (b.status === 'failed') return { text: 'Failed', cls: 'bg-rose-600 text-white' };
  if (b.status === 'bet_placed') return { text: 'Bet placed', cls: 'bg-sky-600 text-white' };
  if (b.status === 'claiming') return { text: 'Claiming', cls: 'bg-amber-500 text-black' };
  if (b.status === 'expired') return { text: 'Expired', cls: 'bg-muted text-muted-foreground' };
  return { text: 'Available', cls: 'bg-emerald-600 text-white' };
}

function cashStatusLabel(b: RainCashBet): { text: string; tone: string } {
  if (b.status === 'won') return { text: 'Won', tone: '#4ade80' };
  if (b.status === 'failed') return { text: 'Failed', tone: '#f87171' };
  return { text: 'Lost', tone: '#64748b' };
}

function betTypeBadge(betType: 'free_bet' | 'cash'): { text: string; cls: string } {
  return betType === 'free_bet'
    ? { text: '🎁 FREE BET', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/40' }
    : { text: '💰 CASH', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/40' };
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
  const celebratedRef = useRef<Set<string>>(new Set());
  const { notify } = useNotifications();
  const [gameState, setGameState] = useState<GameState>({
    phase: 'unknown',
    timer: 0,
  });
  const [lastPhaseChange, setLastPhaseChange] = useState<number>(Date.now);

  // Convert free bets and cash bets to unified format
  const unifiedBets = useMemo((): UnifiedBet[] => {
    const bets: UnifiedBet[] = [];
    
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
  const isDrawing = gameState.phase === 'drawing' || gameState.phase === 'settled';

  // Win celebration for free bets
  useEffect(() => {
    for (const b of unifiedBets) {
      if (b.betType !== 'free_bet') continue;
      if (b.status !== 'won') continue;
      const key = `freebet-${b.accountId}-${b.requestId}`;
      if (celebratedRef.current.has(key)) continue;
      celebratedRef.current.add(key);
      const spots = b.spots || [];
      const est = paytableWin(spots.length, spots.length, 0) ?? b.winAmount ?? 0;
      const text = `🎁 Free Bet Full Match! [${spots.join(',')}] on ${b.accountName} — +${est} ETB`;
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

  const activeBets = unifiedBets.filter(b => b.status === 'bet_placed' || b.status === 'claiming');
  const settledBets = unifiedBets.filter(b => b.status === 'won' || b.status === 'lost');

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
        {/* Left: All Tickets */}
        <div className='min-w-0 lg:max-h-150 overflow-y-auto'>
          <div className='mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-400'>
            All Tickets ({unifiedBets.length})
          </div>
          {unifiedBets.length === 0 ? (
            <p className='py-4 text-center text-xs italic text-slate-500'>No tickets placed yet.</p>
          ) : (
            <div className='space-y-2'>
              {unifiedBets.map((b) => {
                const isFreeBet = b.betType === 'free_bet';
                const s = freeBetStatusLabel({ status: b.status, winAmount: b.winAmount });
                const bt = betTypeBadge(b.betType);
                const isWinner = b.status === 'won';
                const matched = b.matched ?? 0;
                const drawnSpots = b.drawnSpots || [];

                return (
                  <div key={b.id} className={`min-w-44 flex-1 rounded-lg border p-2 ${isWinner ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_12px_rgba(34,197,94,0.3)]' : isFreeBet ? 'border-sky-500/40 bg-sky-500/10' : 'border-white/5 bg-white/3'}`}>
                    <div className='flex flex-wrap gap-1 mb-1'>
                      {b.spots.map((n, idx) => {
                        const isMatched = drawnSpots.includes(n);
                        const isDrawn = drawnSpots.includes(n);
                        return (
                          <span key={idx} className={`flex h-6 w-6 items-center justify-center rounded font-mono text-[11px] font-extrabold ${
                            isMatched ? 'bg-emerald-500 text-white ring-2 ring-emerald-300' :
                            isDrawn ? 'bg-amber-500 text-white' :
                            isFreeBet ? 'bg-sky-500 text-white' : 'bg-black/40 text-slate-300'
                          }`}>{n}</span>
                        );
                      })}
                    </div>
                    <div className='mt-1.5 flex items-center justify-between gap-2 text-xs'>
                      <span className='truncate text-slate-400'>{b.accountName} · {isFreeBet ? `+${b.wagerAmount} ETB` : `Bet ${b.stake}`}</span>
                      <div className='flex items-center gap-1.5'>
                        <span className={`shrink-0 font-bold ${s.cls}`}>{isWinner ? `WINNER +${b.winAmount ?? ''}` : s.text}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${bt.cls}`}>{bt.text}</span>
                      </div>
                    </div>
                    {isDrawing && drawnSpots.length > 0 && (
                      <div className='mt-1 flex flex-wrap gap-1'>
                        <span className='text-[10px] text-slate-500 font-mono'>Drawn:</span>
                        {drawnSpots.map((n, i) => (
                          <span key={i} className={`flex h-5 w-5 items-center justify-center rounded font-mono text-[10px] font-bold ${drawnSpots.includes(n) ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40' : 'bg-white/5 text-slate-400 border border-white/10'}`}>{n}</span>
                        ))}
                      </div>
                    )}
                    {b.failReason && <div className='mt-1 truncate text-[11px] text-red-400/90' title={b.failReason}>{b.failReason}</div>}
                    {b.betPlacedAt && <div className='mt-1 text-[11px] text-slate-500'>Placed {typeof b.betPlacedAt === 'number' ? new Date(b.betPlacedAt).toLocaleTimeString() : new Date(b.betPlacedAt).toLocaleTimeString()}</div>}
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
                const isWinnerNum = unifiedBets.some(b => b.status === 'won' && b.spots.includes(n));
                const isPick = unifiedBets.some(b => b.spots.includes(n));
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