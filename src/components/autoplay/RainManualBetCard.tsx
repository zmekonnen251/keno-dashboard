/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/app';
import { rainManualCashBet, getRainAutoplayStatus, rainBetPrediction, getRainPrediction, getRainTicketConfig } from '@/lib/api';
import { Play, Trash2, Sparkles, Zap } from 'lucide-react';
import type { RainAutoplayConfig, RainAccount, RainAutoplayStatus, BotTicket } from '@/lib/types';
import { useSocket } from '@/lib/service-gateway';
import { NumberGrid } from './NumberGrid';

// Pre-configured one-click tickets (mirrors the mobile RainAutoplayConfig defaults).
const PRESET_TICKETS: { label: string; numbers: number[] }[] = [
  { label: '1,2,3', numbers: [1, 2, 3] },
  { label: '72,73,74', numbers: [72, 73, 74] },
  { label: '77,78,79', numbers: [77, 78, 79] },
];

interface RainManualBetCardProps {
  running: boolean;
  config?: RainAutoplayConfig | null;
  accounts: RainAccount[];
  onMessage: (msg: string) => void;
  onRefresh: () => void;
}

export function RainManualBetCard({ config, accounts, onMessage, onRefresh }: RainManualBetCardProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null); // null = auto (server picks by balance)
  const [picks, setPicks] = useState<number[]>([]);
  const [stake, setStake] = useState<number>(2);
  const [predicting, setPredicting] = useState(false);
  const [betting, setBetting] = useState(false);
  const [lastPrediction, setLastPrediction] = useState<{
    picks: number[];
    strategy: string;
    difficulty: string;
    repetitivePatterns: any[];
    clusters: any[];
  } | null>(null);
  const [status, setStatus] = useState<RainAutoplayStatus | null>(null);
  const [savedTickets, setSavedTickets] = useState<BotTicket[]>([]);

  useSocket('/rain/autoplay/status', (data: any) => {
    if (data?.status) setStatus(data.status);
  });

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const [st, tc] = await Promise.all([
          getRainAutoplayStatus(),
          getRainTicketConfig(),
        ]);
        setStatus(st.status);
        if (tc.ok && tc.config?.tickets) setSavedTickets(tc.config.tickets.filter((t: BotTicket) => t.enabled));
      } catch {}
    };
    fetchStatus();
    const t = setInterval(fetchStatus, 5000);
    return () => clearInterval(t);
  }, []);

  const enabledAccounts = accounts.filter(a => a.is_enabled);

  // Max stake = the balance of the selected account, or (auto) the highest
  // balance among enabled accounts — e.g. if the richest account has 20 ETB
  // the stake input is capped at 20. Min is 2 ETB.
  const stakeMax = Math.max(
    2,
    selectedAccountId !== null
      ? (enabledAccounts.find(a => a.id === selectedAccountId)?.balance ?? 2)
      : Math.max(2, ...enabledAccounts.map(a => a.balance)),
  );

  const clampStake = (v: number) => (Number.isFinite(v) ? Math.min(Math.max(Math.round(v * 100) / 100, 2), stakeMax) : 2);

  const accountLabel = (id: number | null) =>
    id !== null
      ? `account #${id}`
      : `auto-selected account (${stakeMax.toFixed(2)} ETB max balance)`;

  /** One-click bet: play a saved ticket's fixed numbers, or its queue spots, on the selected account. */
  const handlePlaySavedTicket = async (ticket: BotTicket) => {
    const numbers = ticket.numbers && ticket.numbers.length > 0
      ? ticket.numbers
      : picks.length > 0 ? picks : null;
    if (!numbers) {
      onMessage(`Ticket #${ticket.id} has no fixed numbers — generate AI picks first or click it with picks loaded.`);
      return;
    }
    setBetting(true);
    try {
      const res = await rainManualCashBet(selectedAccountId, numbers, ticket.stake || stake);
      if (res.ok && res.result?.ok) {
        onMessage(`One-click bet placed: [${numbers.join(', ')}] stake ${ticket.stake || stake} ETB · ${accountLabel(res.accountId ?? selectedAccountId)}`);
        onRefresh();
      } else {
        onMessage(res.result?.error || 'Failed to place one-click bet');
      }
    } catch (e) {
      onMessage('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBetting(false);
    }
  };

  /** One-click preset ticket: place the fixed numbers immediately on the selected account. */
  const handlePlayPreset = async (numbers: number[]) => {
    setBetting(true);
    try {
      const res = await rainManualCashBet(selectedAccountId, numbers, stake);
      if (res.ok && res.result?.ok) {
        onMessage(`One-click preset bet placed: [${numbers.join(', ')}] · ${stake} ETB · ${accountLabel(res.accountId ?? selectedAccountId)}`);
        onRefresh();
      } else {
        onMessage(res.result?.error || 'Failed to place preset bet');
      }
    } catch (e) {
      onMessage('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBetting(false);
    }
  };

  const handleInjectPicks = async () => {
    if (!config) return;
    setPredicting(true);
    try {
      const res = await rainBetPrediction();
      if (res.ok && res.result?.ok) {
        onMessage('Prediction bet placed!');
        onRefresh();
      } else {
        onMessage(res.result?.error || 'Failed to place prediction bet');
      }
    } catch (e) {
      onMessage('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPredicting(false);
    }
  };

  const handlePlaceBet = async () => {
    if (picks.length === 0) return;
    setBetting(true);
    try {
      const res = await rainManualCashBet(selectedAccountId, picks, stake);
      if (res.ok && res.result?.ok) {
        onMessage(`Bet placed on ${accountLabel(res.accountId ?? selectedAccountId)} with stake ${stake} ETB`);
        setPicks([]);
        onRefresh();
      } else {
        onMessage(res.result?.error || 'Failed to place bet');
      }
    } catch (e) {
      onMessage('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBetting(false);
    }
  };

  const handleGeneratePicks = async () => {
    if (!config) return;
    setPredicting(true);
    try {
      const res = await getRainPrediction(config.provider, 3);
      if (res.ok && res.prediction) {
        const p = res.prediction;
        setPicks(p.picks);
        setLastPrediction({
          picks: p.picks,
          strategy: p.strategy,
          difficulty: p.difficulty.level,
          repetitivePatterns: p.repetitivePatterns,
          clusters: p.clusters,
        });
        onMessage(`Generated ${p.picks.length} picks using ${p.strategy} strategy (${p.difficulty.level})`);
      }
    } catch (e) {
      onMessage('Error generating picks: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPredicting(false);
    }
  };

  const handleClearPicks = () => { setPicks([]); setLastPrediction(null); };

  function toggleNumber(n: number) {
    setPicks((prev) => {
      if (prev.includes(n)) return prev.filter(x => x !== n);
      if (prev.length >= 10) return [...prev.slice(1), n]; // keep newest, drop oldest
      return [...prev, n].sort((a, b) => a - b);
    });
  }

  return (
    <Card title="Manual Cash Bet (Rain Accounts)">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Manual bets work without starting autoplay — pick or generate numbers on the board, set a stake
          (min 2, max your richest account balance), and place the bet.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Account</Label>
            <select
              value={selectedAccountId ?? 'auto'}
              onChange={(e) => setSelectedAccountId(e.target.value === 'auto' ? null : Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            >
              <option value="auto">🤖 Auto — server picks by balance</option>
              {enabledAccounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.provider}) — Bal: {a.balance} ETB
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Stake (ETB) — min 2, max {stakeMax.toFixed(2)}</Label>
            <Input
              type="number"
              min={2}
              max={stakeMax}
              value={stake}
              onChange={(e) => setStake(clampStake(Number(e.target.value)))}
              className="font-mono"
            />
            {selectedAccountId === null && (
              <p className="text-[10px] text-muted-foreground">
                Max = highest enabled account balance ({stakeMax.toFixed(2)} ETB).
              </p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Keno Board — tap up to 10 numbers</span>
            <Button variant="outline" size="sm" onClick={handleClearPicks} disabled={picks.length === 0} className="h-7 px-2 text-xs">
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear ({picks.length})
            </Button>
          </div>
          <NumberGrid
            selected={picks}
            max={10}
            onToggle={toggleNumber}
            onClear={() => setPicks([])}
          />
        </div>

        {savedTickets.length > 0 && (
          <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                One-Click Saved Tickets
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {savedTickets.map((t, idx) => (
                <Button
                  key={t.id}
                  onClick={() => void handlePlaySavedTicket(t)}
                  disabled={betting}
                  size="sm"
                  className="bg-indigo-600/30 hover:bg-indigo-500/50 text-indigo-100 border border-indigo-500/30 text-[11px] font-mono cursor-pointer"
                  title={t.numbers ? `Play ${t.numbers.join(', ')}` : 'Uses currently generated picks'}
                >
                  #{idx + 1}
                  {t.numbers ? ` [${t.numbers.join(',')}]` : ' AI'}
                  <span className="ml-1 text-[9px] opacity-70">{t.stake} ETB</span>
                </Button>
              ))}
            </div>
            {savedTickets.some((t) => !t.numbers) && (
              <p className="mt-2 text-[10px] text-indigo-200/60">
                AI tickets use the picks currently shown on the board — generate first, then click.
              </p>
            )}
          </div>
        )}

        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Play className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              One-Click Pre-Configured Tickets
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESET_TICKETS.map((p) => (
              <Button
                key={p.label}
                onClick={() => void handlePlayPreset(p.numbers)}
                disabled={betting}
                size="sm"
                className="bg-emerald-600/30 hover:bg-emerald-500/50 text-emerald-100 border border-emerald-500/30 text-[11px] font-mono cursor-pointer"
                title={`Play ${p.numbers.join(', ')} · ${stake} ETB`}
              >
                {p.label}
                <span className="ml-1 text-[9px] opacity-70">{stake} ETB</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleGeneratePicks}
            disabled={predicting || !config}
            className="flex-1 min-w-40"
          >
            {predicting ? 'Generating…' : <><Sparkles className="w-4 h-4 mr-1" /> Generate AI Picks</>}
          </Button>
          <Button
            onClick={handlePlaceBet}
            disabled={betting || picks.length === 0}
            variant="default"
            className="flex-1 min-w-40 bg-emerald-600 hover:bg-emerald-500"
            title={selectedAccountId === null ? 'Server auto-selects the account by balance' : undefined}
          >
            {betting ? 'Placing…' : <><Play className="w-4 h-4 mr-1" /> Place Bet</>}
          </Button>
          <Button
            onClick={handleClearPicks}
            disabled={picks.length === 0}
            variant="outline"
            className="min-w-25"
          >
            <Trash2 className="w-4 h-4 mr-1" /> Clear
          </Button>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/3 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Selected Numbers ({picks.length})
            </span>
            {lastPrediction && (
              <span className="text-[10px] text-slate-500">
                Strategy: {lastPrediction.strategy} · Difficulty: {lastPrediction.difficulty}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 min-h-10">
            {picks.length === 0 ? (
              <span className="text-sm text-slate-500 italic w-full">
                Tap the board above or click &quot;Generate AI Picks&quot;
              </span>
            ) : (
              picks.map((num, idx) => (
                <span
                  key={`${num}-${idx}`}
                  className="flex h-8 w-8 items-center justify-center rounded bg-blue-500/20 border border-blue-500/40 text-blue-300 font-mono font-bold text-sm"
                >
                  {num}
                </span>
              ))
            )}
          </div>
        </div>

        {lastPrediction && (
          <details className="group rounded-lg border border-white/10 bg-white/3 p-3">
            <summary className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-400">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Prediction Details</span>
              <span className="ml-auto text-[10px] text-slate-500">Click to expand</span>
            </summary>
            <div className="mt-3 space-y-2 text-[10px] text-slate-300">
              <div><strong>Repetitive Patterns:</strong> {lastPrediction.repetitivePatterns.slice(0, 3).map(p => `[${p.numbers.join(',')}]×${p.frequency}`).join(' · ') || 'None'}</div>
              <div><strong>Top Clusters:</strong> {lastPrediction.clusters.slice(0, 2).map(c => `Cluster ${c.id} (${c.numbers.slice(0, 5).join(',')})`).join(' · ')}</div>
            </div>
          </details>
        )}

        {status && (
          <div className="rounded-lg border border-white/10 bg-white/3 p-3 text-[11px] text-slate-300">
            <div className="flex flex-wrap gap-4 text-xs">
              <span>Free bets played: <strong className="text-emerald-400">{status.freeBetsPlayed}</strong></span>
              <span>Cash bets played: <strong className="text-blue-400">{status.cashBetsPlayed}</strong></span>
              <span>Total: <strong>{status.totalPlayed}</strong></span>
              <span>Pending: <strong className="text-amber-400">{status.pendingAcks}</strong></span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}