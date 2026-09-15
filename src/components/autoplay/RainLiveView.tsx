'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { RainCashBet } from '@/lib/types';
import { paytableWin } from '@/lib/kenoOdds';
import { notificationPermission, playWinSound, pushWinNotification, requestNotificationPermission } from '@/lib/sound';
import { isPushActive, pushSupported, subscribePush, unsubscribePush, rePostSubscription } from '@/lib/push';
import { getNotifyPref, setNotifyPref, getSoundPref, setSoundPref } from '@/lib/notifyPrefs';
import { useNotifications } from '@/lib/notifications';
import { useLiveDraw } from '@/lib/useLiveDraw';
import { getRainCashBets } from '@/lib/api';
import { BOARD_CSS } from './boardStyles';

// Rain CASH wagers: settlement is authoritative on the server (rainClaimer),
// so we only render the settle verdict — no local matching of pending tickets.
interface WinAlert {
  id: string;
  text: string;
  at: number;
}

function cashStatusLabel(b: RainCashBet): { text: string; tone: string } {
  if (b.status === 'won') return { text: 'Won', tone: '#4ade80' };
  if (b.status === 'failed') return { text: 'Failed', tone: '#f87171' };
  return { text: 'Lost', tone: '#64748b' };
}

export function RainLiveView({ bets, picks, autoRefresh = true }: { bets?: RainCashBet[]; picks?: number[]; autoRefresh?: boolean }) {
  const { status, observer, drawn, updatedAt } = useLiveDraw('shamo');
  const [soundOn, setSoundOn] = useState(() => getSoundPref());
  const [notifyOn, setNotifyOn] = useState(() => getNotifyPref());
  const [pushOn, setPushOn] = useState(() => isPushActive());
  const [alerts, setAlerts] = useState<WinAlert[]>([]);
  const [localBets, setLocalBets] = useState<RainCashBet[] | null>(null);
  const celebratedRef = useRef<Set<string>>(new Set());
  const { notify } = useNotifications();

  const listedBets = useMemo(() => bets ?? localBets ?? [], [bets, localBets]);

  useEffect(() => {
    if (!getNotifyPref() && !isPushActive()) return;
    void (async () => {
      const ok = await rePostSubscription();
      setPushOn(ok);
      setNotifyOn(true);
      setNotifyPref(true);
    })();
  }, []);

  // Poll the server ledger for settled cash bets unless the parent supplies
  // a live list already (config option, keeps one polling loop).
  useEffect(() => {
    if (bets) return; // parent feeds the list
    if (!autoRefresh) return;
    let cancelled = false;
    const tick = () =>
      void (async () => {
        try {
          const res = await getRainCashBets(50);
          if (!cancelled) setLocalBets(res.bets);
        } catch {
          // keep last list
        }
      })();
    void tick();
    const t = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [bets, autoRefresh]);

  // Celebrate only server-settled wins (status 'won').
  const winners = useMemo(() => {
    const set = new Set<number>();
    const full: RainCashBet[] = [];
    for (const b of listedBets) {
      if (b.status !== 'won') continue;
      full.push(b);
      for (const n of b.spots) set.add(n);
    }
    return { tickets: full, numbers: set };
  }, [listedBets]);

  useEffect(() => {
    for (const b of winners.tickets) {
      const key = `${b.accountId}-${b.requestId}`;
      if (celebratedRef.current.has(key)) continue;
      celebratedRef.current.add(key);
      const spots = b.spots || [];
      const est = paytableWin(spots.length, spots.length, b.stake) ?? b.winAmount ?? 0;
      const text = `Cash full match! [${spots.join(',')}] on #${b.accountId} — +${est} ETB`;
      if (soundOn) playWinSound();
      if (!pushOn && notifyOn) pushWinNotification('Keno full match!', text);
      notify({ id: `rainwin-${key}`, kind: 'win', text, phone: b.accountName });
      setAlerts((prev) => [{ id: key, text, at: Date.now() }, ...prev].slice(0, 5));
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

      {alerts.length > 0 && (
        <div className='space-y-1.5 border-b border-white/10 px-4 py-2'>
          {alerts.map((a) => (
            <div key={a.id} className='flex items-center justify-between gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-200'>
              <span className='min-w-0'>
                🎉 {a.text} <span className='font-mono font-normal text-emerald-300/70'>{new Date(a.at).toLocaleTimeString()}</span>
              </span>
              <button onClick={() => setAlerts((prev) => prev.filter((x) => x.id !== a.id))} className='shrink-0 text-emerald-300/60 hover:text-emerald-200'>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

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

      <div className='grid grid-cols-1 gap-3 p-3 lg:grid-cols-2'>
        <div className='min-w-0'>
          <div className='mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-400'>
            Cash tickets {listedBets.length > 0 ? `(${listedBets.length})` : ''}
          </div>
          {listedBets.length === 0 ? (
            <p className='py-4 text-center text-xs italic text-slate-500'>No manual cash bets yet — use the Manual cash bet card.</p>
          ) : (
            <div className='flex flex-wrap gap-2 lg:max-h-120 lg:overflow-y-auto lg:pr-1'>
              {listedBets.map((b) => {
                const st = cashStatusLabel(b);
                const isWinner = b.status === 'won';
                return (
                  <div
                    key={`${b.requestId}-${b.placedAt}`}
                    className={`min-w-44 flex-1 rounded-lg border p-2 ${isWinner ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_12px_rgba(34,197,94,0.3)]' : 'border-white/5 bg-white/3'}`}
                  >
                    <div className='flex flex-wrap gap-1'>
                      {b.spots.map((n) => (
                        <span
                          key={n}
                          className={`flex h-6 w-6 items-center justify-center rounded font-mono text-[11px] font-extrabold ${b.drawnSpots.includes(n) ? 'bg-emerald-500 text-white' : 'bg-black/40 text-slate-300'}`}
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                    <div className='mt-1.5 flex items-center justify-between gap-2 text-xs'>
                      <span className='truncate text-slate-400'>
                        {b.accountName} · Bet {b.stake}
                      </span>
                      <span className='shrink-0 font-bold' style={{ color: st.tone }}>
                        {isWinner ? `WINNER +${b.winAmount ?? ''}` : st.text}
                      </span>
                    </div>
                    {b.status === 'failed' && b.failReason && (
                      <div className='mt-1 truncate text-[11px] text-red-400/90' title={b.failReason}>
                        {b.failReason}
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
            {observer && <>Watching via {observer}. </>}
            {updatedAt && <>Updated {new Date(updatedAt).toLocaleTimeString()}.</>}
            {notificationPermission() === 'denied' && <> Browser notifications are blocked — allow them in site settings to get win alerts.</>}
          </p>
        </div>
      </div>
    </div>
  );
}