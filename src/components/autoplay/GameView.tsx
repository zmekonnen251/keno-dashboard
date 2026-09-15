'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AutoplayPlacedBet } from '@/lib/types';
import { paytableWin } from '@/lib/kenoOdds';
import { notificationPermission, playWinSound, pushWinNotification, requestNotificationPermission } from '@/lib/sound';
import { isPushActive, pushSupported, subscribePush, unsubscribePush, rePostSubscription } from '@/lib/push';
import { getNotifyPref, setNotifyPref, getSoundPref, setSoundPref } from '@/lib/notifyPrefs';
import { useNotifications } from '@/lib/notifications';
import { useLiveDraw } from '@/lib/useLiveDraw';
import { CopyPhoneButton } from '@/components/accounts-columns';
import { BOARD_CSS } from './boardStyles';

// "Current game" = bets placed within one round window of the newest bet.
const ROUND_WINDOW_MS = 30000;

interface WinAlert {
  id: string;
  text: string;
  at: number;
  phone: string;
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
  const celebratedRef = useRef<Set<string>>(new Set());
  const { notify } = useNotifications();

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
  const current = useMemo(
    () => bets.filter((b) => (b.placedAt ?? 0) >= newest - ROUND_WINDOW_MS),
    [bets, newest],
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
      const spots = b.spots || [];
      const est = paytableWin(spots.length, spots.length, b.stake) ?? b.winAmount ?? 0;
      const text = `Full match! [${spots.join(',')}] on #${b.accountId} — est. +${est} ETB`;
      if (soundOn) playWinSound();
      if (!pushOn && notifyOn) pushWinNotification('Keno full match!', text);
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

      {/* Tickets + board: stacked on mobile, side-by-side on desktop so the
          drawn digits on top stay visible without scrolling past a full-width board */}
      <div className='grid grid-cols-1 gap-3 p-3 lg:grid-cols-2'>
        <div className='min-w-0'>
          <div className='mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-400'>
            My Tickets {current.length > 0 ? `(${current.length})` : ''}
          </div>
          {current.length === 0 ? (
            <p className='py-4 text-center text-xs italic text-slate-500'>No bets placed in the current game yet.</p>
          ) : (
            <div className='flex flex-wrap gap-2 lg:max-h-120 lg:overflow-y-auto lg:pr-1'>
              {current.map((p) => {
                const st = statusLabel(p);
                const isWinner = winners.tickets.some((w) => w.accountId === p.accountId && w.requestId === p.requestId);
                return (
                  <div
                    key={`${p.accountId}-${p.requestId}-${p.placedAt}`}
                    className={`min-w-44 flex-1 rounded-lg border p-2 ${isWinner ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_12px_rgba(34,197,94,0.3)]' : 'border-white/5 bg-white/3'}`}
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
                    <div className='mt-1.5 flex items-center justify-between gap-2 text-xs'>
                      <span className='truncate text-slate-400'>
                        #{p.accountId} · Bet {p.stake}
                      </span>
                      <span className='shrink-0 font-bold' style={{ color: st.tone }}>
                        {isWinner ? 'WINNER' : st.text}
                      </span>
                    </div>
                    {p.status === 'failed' && p.failReason && (
                      <div className='mt-1 truncate text-[11px] text-red-400/90' title={p.failReason}>
                        {p.failReason}
                      </div>
                    )}
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
