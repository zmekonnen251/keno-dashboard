'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AutoplayPlacedBet } from '@/lib/types';
import { paytableWin } from '@/lib/kenoOdds';
import { notificationPermission, playWinSound, pushWinNotification, requestNotificationPermission } from '@/lib/sound';
import { isPushActive, pushSupported, subscribePush, unsubscribePush } from '@/lib/push';
import { useLiveDraw } from '@/lib/useLiveDraw';
import { BOARD_CSS } from './boardStyles';

// "Current game" = bets placed within one round window of the newest bet.
const ROUND_WINDOW_MS = 30000;

interface WinAlert {
  id: string;
  text: string;
  at: number;
}

function statusLabel(p: AutoplayPlacedBet): { text: string; tone: string } {
  if (p.status === 'won') return { text: 'Won', tone: '#4ade80' };
  if (p.status === 'lost') return { text: 'Lost', tone: '#64748b' };
  return { text: 'Waiting', tone: '#facc15' };
}

export function GameView({ bets, picks }: { bets: AutoplayPlacedBet[]; picks?: number[] }) {
  const { status, observer, drawn, updatedAt } = useLiveDraw();
  const [soundOn, setSoundOn] = useState(true);
  const [notifyOn, setNotifyOn] = useState(false);
  const [pushOn, setPushOn] = useState(() => isPushActive());
  const [alerts, setAlerts] = useState<WinAlert[]>([]);
  const celebratedRef = useRef<Set<string>>(new Set());

  const newest = useMemo(() => bets.reduce((m, b) => Math.max(m, b.placedAt ?? 0), 0), [bets]);
  const current = useMemo(
    () => bets.filter((b) => (b.placedAt ?? 0) >= newest - ROUND_WINDOW_MS),
    [bets, newest],
  );

  const winners = useMemo(() => {
    const set = new Set<number>();
    const full: AutoplayPlacedBet[] = [];
    for (const b of current) {
      const spots = b.spots || [];
      if (spots.length > 0 && spots.every((n) => drawn.includes(n))) {
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
      const spots = b.spots || [];
      const est = paytableWin(spots.length, spots.length, b.stake) ?? b.winAmount ?? 0;
      const text = `Full match! [${spots.join(',')}] on #${b.accountId} — est. +${est} ETB`;
      if (soundOn) playWinSound();
      if (!pushOn && notifyOn) pushWinNotification('Keno full match!', text);
      setAlerts((prev) => [{ id: key, text, at: Date.now() }, ...prev].slice(0, 5));
    }
    if (celebratedRef.current.size > 200) {
      celebratedRef.current = new Set([...celebratedRef.current].slice(-100));
    }
  }, [winners, soundOn, notifyOn, pushOn]);

  async function onToggleNotifications() {
    if (pushOn || notifyOn) {
      await unsubscribePush();
      setPushOn(false);
      setNotifyOn(false);
      return;
    }
    if (pushSupported() && (await subscribePush())) {
      setPushOn(true);
      setNotifyOn(true);
      return;
    }
    const perm = await requestNotificationPermission();
    setNotifyOn(perm === 'granted');
  }

  const done = drawn.length >= 20;

  return (
    <div className='overflow-hidden rounded-xl border border-white/10 bg-[#0b0f19] text-slate-100'>
      <style>{BOARD_CSS}</style>

      {/* Header */}
      <div className='flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5'>
        <div className='flex items-center gap-2 text-sm font-extrabold tracking-wider'>
          <span className={status === 'live' ? 'text-emerald-400' : 'text-slate-400'}>●</span>
          GAME
          <span className='rounded bg-white/5 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-300'>
            {done ? `${drawn.length} drawn` : `drawing ${drawn.length}/20`}
          </span>
        </div>
        <div className='flex items-center gap-2 text-xs'>
          <button
            onClick={() => setSoundOn((v) => !v)}
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
              <span>
                🎉 {a.text} <span className='font-mono font-normal text-emerald-300/70'>{new Date(a.at).toLocaleTimeString()}</span>
              </span>
              <button onClick={() => setAlerts((prev) => prev.filter((x) => x.id !== a.id))} className='text-emerald-300/60 hover:text-emerald-200'>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drawn balls */}
      <div className='flex flex-wrap items-center gap-1.5 border-b border-white/10 px-4 py-2.5'>
        {drawn.length === 0 ? (
          <span className='text-xs italic text-slate-500'>Waiting for the draw…</span>
        ) : (
          drawn.map((n) => (
            <span
              key={n}
              className='flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-xs font-extrabold text-white shadow-[0_0_8px_rgba(34,197,94,0.5)]'
            >
              {n}
            </span>
          ))
        )}
      </div>

      {/* Tickets + board */}
      <div className='grid grid-cols-1 gap-3 p-3 md:grid-cols-[290px,1fr]'>
        <div>
          <div className='mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-400'>
            My Tickets {current.length > 0 ? current.length : ''}
          </div>
          <div className='max-h-96 space-y-2 overflow-y-auto pr-1'>
            {current.length === 0 ? (
              <p className='py-6 text-center text-xs italic text-slate-500'>No bets placed in the current game yet.</p>
            ) : (
              current.map((p) => {
                const st = statusLabel(p);
                const isWinner = winners.tickets.some((w) => w.accountId === p.accountId && w.requestId === p.requestId);
                return (
                  <div
                    key={`${p.accountId}-${p.requestId}-${p.placedAt}`}
                    className={`rounded-lg border p-2.5 ${isWinner ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_12px_rgba(34,197,94,0.3)]' : 'border-white/5 bg-white/[0.03]'}`}
                  >
                    <div className='flex flex-wrap gap-1'>
                      {(p.spots || []).map((n) => (
                        <span
                          key={n}
                          className={`flex h-6 w-6 items-center justify-center rounded font-mono text-[11px] font-extrabold ${drawn.includes(n) ? 'bg-emerald-500 text-white' : 'bg-black/40 text-slate-300'}`}
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                    <div className='mt-1.5 flex items-center justify-between text-xs'>
                      <span className='text-slate-400'>
                        #{p.accountId} · Bet {p.stake}
                      </span>
                      <span className='font-bold' style={{ color: st.tone }}>
                        {isWinner ? 'WINNER' : st.text}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div>
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
