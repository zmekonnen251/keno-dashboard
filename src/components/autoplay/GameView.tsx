'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AutoplayPlacedBet } from '@/lib/types';
import { paytableWin } from '@/lib/kenoOdds';
import { notificationPermission, playWinSound, playDrawSound, playBettingOpenSound, pushWinNotification, requestNotificationPermission } from '@/lib/sound';
import { isPushActive, pushSupported, subscribePush, unsubscribePush, rePostSubscription } from '@/lib/push';
import { getNotifyPref, setNotifyPref, getSoundPref, setSoundPref } from '@/lib/notifyPrefs';
import { useNotifications } from '@/lib/notifications';
import { useLiveDraw } from '@/lib/useLiveDraw';
import { CopyPhoneButton } from '@/components/accounts-columns';
import { DollarSign } from 'lucide-react';
import { BOARD_CSS } from './boardStyles';

// "Current game" = bets placed since the websocket observed the current draw
// begin. The window is keyed to the live draw rather than a fixed 30s wall
// clock, so tickets of an in-progress draw stay visible (with their status)
// until the next game actually starts on the stream.
const ROUND_WINDOW_MS = 30000;
const ROUND_DURATION_MS = 30000; // 30 seconds per round
const BETTING_WINDOW_MS = 20000; // 20 seconds for betting
const DRAWING_DURATION_MS = 10000; // 10 seconds for drawing

interface WinAlert {
  id: string;
  text: string;
  at: number;
  phone: string;
}

interface GameState {
  phase: 'betting_open' | 'drawing' | 'settled' | 'unknown';
  timer: number;
  roundNumber?: number;
}

function statusLabel(p: AutoplayPlacedBet): { text: string; tone: string } {
  if (p.status === 'won') return { text: 'Won', tone: '#4ade80' };
  if (p.status === 'lost') return { text: 'Lost', tone: '#64748b' };
  if (p.status === 'failed' || p.ok === false) return { text: 'Failed', tone: '#f87171' };
  // Sent to the socket but not yet acknowledged by the game server — never
  // shown as a win/loss until the gateway settles it.
  return { text: 'Sent', tone: '#facc15' };
}

export function GameView({ bets, picks }: { bets: AutoplayPlacedBet[]; picks?: number[] }) {
  const { status, observer, drawn, updatedAt } = useLiveDraw();
  const [soundOn, setSoundOn] = useState(() => getSoundPref());
  const [notifyOn, setNotifyOn] = useState(() => getNotifyPref());
  const [pushOn, setPushOn] = useState(() => isPushActive());
  const [alerts, setAlerts] = useState<WinAlert[]>([]);
  
  const getStoredCelebrated = (): Set<string> => {
    try {
      const stored = localStorage.getItem('tolobirrCelebrated');
      if (stored) return new Set(JSON.parse(stored));
    } catch {}
    return new Set();
  };
  const celebratedRef = useRef<Set<string>>(getStoredCelebrated());
  const saveCelebrated = () => {
    try { localStorage.setItem('tolobirrCelebrated', JSON.stringify([...celebratedRef.current])); } catch {}
  };
  
  const { notify } = useNotifications();
  const [gameState, setGameState] = useState<GameState>({
    phase: 'unknown',
    timer: 0,
  });
  const [lastPhaseChange, setLastPhaseChange] = useState<number>(Date.now());

  // Enhanced game state detection with timer
  useEffect(() => {
    const updateGameState = () => {
      const now = Date.now();
      const timeSinceUpdate = updatedAt ? now - new Date(updatedAt).getTime() : Infinity;

      let newPhase: GameState['phase'] = 'unknown';
      let timer = 0;

      if (status === 'live' && drawn.length === 0) {
        // Live but no numbers drawn yet - betting phase
        newPhase = 'betting_open';
        timer = Math.max(0, BETTING_WINDOW_MS - timeSinceUpdate);
      } else if (status === 'live' && drawn.length > 0 && drawn.length < 20) {
        // Drawing in progress
        newPhase = 'drawing';
        timer = Math.max(0, DRAWING_DURATION_MS - (drawn.length * (DRAWING_DURATION_MS / 20)));
      } else if (drawn.length >= 20) {
        // Draw complete
        newPhase = 'settled';
        timer = Math.max(0, ROUND_DURATION_MS - (timeSinceUpdate % ROUND_DURATION_MS));
      } else {
        newPhase = 'unknown';
        timer = 0;
      }

      // Detect phase changes and play sounds
      if (newPhase !== gameState.phase && soundOn) {
        if (newPhase === 'betting_open' && gameState.phase !== 'betting_open') {
          playBettingOpenSound();
        } else if (newPhase === 'drawing' && gameState.phase !== 'drawing') {
          playDrawSound();
        }
        setLastPhaseChange(now);
      }

      setGameState({ phase: newPhase, timer, roundNumber: Math.floor(now / ROUND_DURATION_MS) });
    };

    updateGameState();
    const interval = setInterval(updateGameState, 1000);
    return () => clearInterval(interval);
  }, [status, drawn, updatedAt, gameState.phase, soundOn]);

  // Format timer as MM:SS
  const formatTimer = (ms: number) => {
    const seconds = Math.ceil(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get phase color and label
  const getPhaseInfo = (phase: GameState['phase']) => {
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

  // On mount: silently re-post the existing browser push subscription to the
  // server (idempotent) so server-delivered Chrome notifications keep working
  // after a page reload. If the user had notifications enabled previously,
  // this makes them work again immediately.
  useEffect(() => {
    if (!getNotifyPref() && !isPushActive()) return;
    void (async () => {
      const ok = await rePostSubscription();
      setPushOn(ok);
      setNotifyOn(true);
      setNotifyPref(true);
    })();
  }, []);

  const newest = useMemo(() => bets.reduce((m, b) => Math.max(m, b.placedAt ?? 0), 0), [bets]);

  // Round bucket keyed to the websocket draw state: bets stay "current" while
  // the live draw is running (any phase — drawing / settled / between games)
  // and are only dropped once the stream shows a brand-new draw beginning
  // (drawn reset from a completed 20 back to 0). This stops live tickets from
  // disappearing mid-draw just because a wall-clock window elapsed.
  const roundResetRef = useRef<number>(Date.now());
  const seededRef = useRef(false);
  const prevDrawnLenRef = useRef<number>(0);
  const [drawEpoch, setDrawEpoch] = useState(0);

  // Seed the bucket from the newest known bet once tickets are first loaded
  // (before any ws transition has been observed).
  useEffect(() => {
    if (!seededRef.current && newest > 0) {
      seededRef.current = true;
      roundResetRef.current = newest - ROUND_WINDOW_MS;
    }
  }, [newest]);

  // A fresh draw frame arriving after a completed draw (20 -> 0) means the next
  // game has started: close the previous round's bucket.
  useEffect(() => {
    const prev = prevDrawnLenRef.current;
    prevDrawnLenRef.current = drawn.length;
    if (prev >= 20 && drawn.length === 0) {
      roundResetRef.current = Date.now();
      setDrawEpoch((e) => e + 1);
    }
  }, [drawn]);

  const current = useMemo(
    () => bets.filter((b) => (b.placedAt ?? 0) >= roundResetRef.current),
    [bets, drawn, drawEpoch],
  );

  // Celebrate ONLY gateway-settled wins. Pending ("Sent") tickets are frames
  // written to a socket — the game server may never have accepted them — so
  // matching them against the live draw locally invents phantom wins for
  // bets that never landed (and phantom push notifications with them).
  const winners = useMemo(() => {
    const set = new Set<number>();
    const full: AutoplayPlacedBet[] = [];
    for (const b of current) {
      if (b.status !== 'won') continue;
      const spots = b.spots || [];
      const ref = b.drawnSpots && b.drawnSpots.length > 0 ? b.drawnSpots : drawn;
      if (spots.length > 0 && spots.every((n) => ref.includes(n))) {
        full.push(b);
        for (const n of spots) set.add(n);
      }
    }
    return { tickets: full, numbers: set };
  }, [current, drawn]);

  // Full-match fanfare: sound + notification + in-app banner, once per bet.
  // When push is subscribed the server delivers the Chrome notification (so
  // it arrives even with the tab closed) and the page skips its local one to
  // avoid doubles; otherwise the page falls back to a local notification.
  useEffect(() => {
    for (const b of winners.tickets) {
      const key = `${b.accountId}-${b.requestId}`;
      if (celebratedRef.current.has(key)) continue;
      celebratedRef.current.add(key);
      saveCelebrated();
      const spots = b.spots || [];
      // Use the server's settled winAmount when present; otherwise compute the
      // payout from the ACTUAL matched count (not a forced full match).
      const matched =
        b.matched ??
        (b.drawnSpots && b.drawnSpots.length > 0
          ? spots.filter((n) => (b.drawnSpots as number[]).includes(n)).length
          : spots.length);
      const est = b.winAmount ?? paytableWin(spots.length, Math.max(1, matched), b.stake) ?? 0;
      const full = spots.length > 0 && matched >= spots.length;
      const text = full
        ? `Full match! [${spots.join(',')}] on #${b.accountId} — +${est} ETB`
        : `${matched}/${spots.length} hit on #${b.accountId} — +${est} ETB`;
      if (soundOn) playWinSound();
      if (!pushOn && notifyOn)
        pushWinNotification(full ? 'Keno full match!' : `Keno win — ${matched}/${spots.length}!`, text);
      notify({ id: `win-${key}`, kind: 'win', text, phone: b.phone || undefined });
      setAlerts((prev) => [{ id: key, text, at: Date.now(), phone: b.phone || '' }, ...prev].slice(0, 5));
    }
    if (celebratedRef.current.size > 200) {
      celebratedRef.current = new Set([...celebratedRef.current].slice(-100));
    }
  }, [winners, soundOn, notifyOn, pushOn, notify]);

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

  const done = drawn.length >= 20;

  return (
    <div className='overflow-hidden rounded-xl border border-white/10 bg-[#0b0f19] text-slate-100'>
      <style>{BOARD_CSS}</style>

      {/* Enhanced Header with Game State and Timer */}
      <div className='flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5'>
        <div className='flex items-center gap-3'>
          {/* Game Status Indicator */}
          <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${phaseInfo.bgColor}`}>
            <span className={`h-2 w-2 rounded-full ${status === 'live' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`}></span>
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

          {/* Draw Progress */}
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
          <button
            onClick={onToggleSound}
            className={`rounded-md border px-2 py-1 font-bold ${soundOn ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/5 text-slate-400'}`}
            title='Toggle win sound'
          >
            {soundOn ? '🔔 Sound on' : '🔕 Sound off'}
          </button>
          {notifyOn ? (
            <button
              onClick={onToggleNotifications}
              className='rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 font-bold text-emerald-300'
              title={pushOn ? 'Push active — click to turn notifications off' : 'Notifications on — click to turn off'}
            >
              ✓ {pushOn ? 'Push on' : 'Notifications on'}
            </button>
          ) : (
            <button
              onClick={onToggleNotifications}
              className='rounded-md border border-white/10 bg-white/5 px-2 py-1 font-bold text-slate-300'
              title='Enable Chrome push notifications for full matches'
            >
              Enable notifications
            </button>
          )}
        </div>
      </div>

      {/* Win alerts */}
      {alerts.length > 0 && (
        <div className='space-y-1.5 border-b border-white/10 px-4 py-2'>
          {alerts.map((a) => (
            <div key={a.id} className='flex items-center justify-between gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-200'>
              <span className='min-w-0'>
                🎉 {a.text}{' '}
                {a.phone && (
                  <span className='inline-flex items-center gap-0.5 font-mono font-normal text-emerald-300'>
                    +{a.phone}
                    <CopyPhoneButton phone={a.phone} />
                  </span>
                )}{' '}
                <span className='font-mono font-normal text-emerald-300/70'>{new Date(a.at).toLocaleTimeString()}</span>
              </span>
              <button onClick={() => setAlerts((prev) => prev.filter((x) => x.id !== a.id))} className='shrink-0 text-emerald-300/60 hover:text-emerald-200'>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drawn balls with enhanced visual feedback */}
      <div className='flex flex-wrap items-center gap-1.5 border-b border-white/10 px-4 py-2.5'>
        {drawn.length === 0 ? (
          <div className='flex items-center gap-2'>
            <span className='text-xs italic text-slate-500'>Waiting for the draw…</span>
            {gameState.phase === 'betting_open' && (
              <span className='text-xs text-emerald-400 animate-pulse'>Betting open</span>
            )}
          </div>
        ) : (
          <>
            {drawn.map((n, i) => (
              <span
                key={n}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold text-white shadow-lg transition-all duration-300 ${
                  i === drawn.length - 1 ? 'scale-110 bg-emerald-400 ring-2 ring-emerald-300' : 'bg-emerald-500'
                }`}
              >
                {n}
              </span>
            ))}
            {drawn.length < 20 && (
              <span className='text-xs text-slate-500 italic ml-2'>
                {20 - drawn.length} remaining...
              </span>
            )}
          </>
        )}
      </div>

      {/* Tickets + board: stacked on mobile, side-by-side on desktop so the
          drawn digits on top stay visible without scrolling past a full-width board */}
      <div className='grid grid-cols-1 gap-3 p-3 lg:grid-cols-2'>
        <div className='min-w-0'>
          <div className='mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-400'>
            My Tickets {current.length > 0 ? `(${current.length})` : ''}
          </div>
          {current.length === 0 ? (
            <p className='py-4 text-center text-xs italic text-slate-500'>
              {gameState.phase === 'betting_open' ? 'Betting open — place your tickets now!' : 'No bets placed in the current game yet.'}
            </p>
          ) : (
            <div className='flex flex-wrap gap-2 lg:max-h-120 lg:overflow-y-auto lg:pr-1'>
              {current.map((p) => {
                const st = statusLabel(p);
                const isWinner = winners.tickets.some((w) => w.accountId === p.accountId && w.requestId === p.requestId);
                const isFailed = p.status === 'failed' || p.ok === false;
                return (
                  <div
                    key={`${p.accountId}-${p.requestId}-${p.placedAt}`}
                    title={isFailed && p.failReason ? p.failReason : undefined}
                    className={`min-w-44 flex-1 rounded-lg border p-2 transition-all ${
                      isWinner
                        ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_12px_rgba(34,197,94,0.3)]'
                        : isFailed
                          ? 'border-red-500/70 bg-red-500/5'
                          : 'border-white/5 bg-white/3'
                    }`}
                  >
                    <div className='flex items-start justify-between gap-2'>
                      <div className='flex flex-wrap gap-1'>
                        {(p.spots || []).map((n) => (
                          <span
                            key={n}
                            className={`flex h-6 w-6 items-center justify-center rounded font-mono text-[11px] font-extrabold transition-all ${drawn.includes(n) ? 'bg-emerald-500 text-white scale-110' : 'bg-black/40 text-slate-300'}`}
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                      {/* Cash/free identifier: $ = cash ticket, top-right corner */}
                      <span
                        className='shrink-0 rounded border border-emerald-500/30 bg-emerald-500/10 p-0.5 text-emerald-300'
                        title='Cash ticket'
                      >
                        <DollarSign className='h-3 w-3' />
                      </span>
                    </div>
                    <div className='mt-1.5 flex items-center justify-between gap-2 text-xs'>
                      <span className='truncate text-slate-400'>
                        #{p.accountId} · {p.stake} ETB
                      </span>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${isFailed ? 'bg-red-500/15 text-red-400' : 'bg-white/5'}`}
                        style={isFailed ? undefined : { color: st.tone }}
                      >
                        {isWinner ? 'WINNER' : st.text}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className='min-w-0'>
          <div className='keno-board-panel'>
            <div className='keno-board'>
              {Array.from({ length: 80 }, (_, i) => i + 1).map((n) => {
                const isDrawn = drawn.includes(n);
                const isWinnerNum = winners.numbers.has(n);
                const isPick = (picks ?? []).includes(n);
                return (
                  <div
                    key={n}
                    className={isWinnerNum ? 'keno-tile hit' : isDrawn ? 'keno-tile picked' : 'keno-tile'}
                  >
                    {n}
                    {!isDrawn && isPick && <span className='keno-dot suggested' />}
                  </div>
                );
              })}
            </div>
          </div>
          <p className='mt-2 text-[11px] text-slate-500'>
            {observer && <>Watching via +{observer}. </>}
            {updatedAt && <>Updated {new Date(updatedAt).toLocaleTimeString()}.</>}
            {notificationPermission() === 'denied' && <> Browser notifications are blocked — allow them in site settings to get win alerts.</>}
          </p>
        </div>
      </div>
    </div>
  );
}
