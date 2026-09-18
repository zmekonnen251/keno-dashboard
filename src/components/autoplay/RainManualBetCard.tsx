/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/app';
import { rainManualCashBet, getRainAutoplayStatus, rainBetPrediction, getRainPrediction } from '@/lib/api';
import { Play, Trash2, Sparkles } from 'lucide-react';
import type { RainAutoplayConfig, RainAccount, RainAutoplayStatus } from '@/lib/types';
import { useSocket } from '@/lib/service-gateway';

interface RainManualBetCardProps {
  running: boolean;
  config?: RainAutoplayConfig | null;
  accounts: RainAccount[];
  onMessage: (msg: string) => void;
  onRefresh: () => void;
}

export function RainManualBetCard({ running, config, accounts, onMessage, onRefresh }: RainManualBetCardProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [picks, setPicks] = useState<number[]>([]);
  const [stake, setStake] = useState<number>(2);
  const [spotsMode, setSpotsMode] = useState<'auto' | 'manual'>('auto');
  const [manualSpotsInput, setManualSpotsInput] = useState('');
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

  useSocket('/rain/autoplay/status', (data: any) => {
    if (data?.status) setStatus(data.status);
  });

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await getRainAutoplayStatus();
        setStatus(res.status);
      } catch {}
    };
    fetchStatus();
    const t = setInterval(fetchStatus, 5000);
    return () => clearInterval(t);
  }, []);

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
    if (!running || selectedAccountId === null || picks.length === 0) return;
    setBetting(true);
    try {
      const res = await rainManualCashBet(selectedAccountId, picks, stake);
      if (res.ok && res.result?.ok) {
        onMessage(`Bet placed on account #${selectedAccountId} with stake ${stake} ETB`);
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

  const handleManualSpotsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setManualSpotsInput(val);
    const spots = val.split(/[,;\s]+/).map(Number).filter(n => Number.isFinite(n) && n >= 1 && n <= 80);
    if (spotsMode === 'manual') setPicks(spots);
  };

  const enabledAccounts = accounts.filter(a => a.is_enabled);

  return (
    <Card title="Manual Cash Bet (Rain Accounts)">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Account</Label>
            <select
              value={selectedAccountId ?? ''}
              onChange={(e) => setSelectedAccountId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              disabled={!running}
            >
              <option value="">Select account...</option>
              {enabledAccounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.provider}) — Bal: {a.balance} ETB
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Stake (ETB)</Label>
            <Input
              type="number"
              min={1}
              max={10000}
              value={stake}
              onChange={(e) => setStake(Number(e.target.value))}
              disabled={!running}
              className="font-mono"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-border p-3">
          <Label htmlFor="spots-mode" className="text-sm font-medium">Spots Source</Label>
          <select
            id="spots-mode"
            value={spotsMode}
            onChange={(e) => setSpotsMode(e.target.value as 'auto' | 'manual')}
            className="w-40 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          >
            <option value="auto">🤖 Auto (AI)</option>
            <option value="manual">✏️ Manual</option>
          </select>
          {spotsMode === 'manual' && (
            <Input
              type="text"
              value={manualSpotsInput}
              onChange={handleManualSpotsChange}
              placeholder="e.g. 5, 12, 23, 40"
              className="flex-1 font-mono text-sm"
            />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleGeneratePicks}
            disabled={!running || predicting || spotsMode === 'manual'}
            className="flex-1 min-w-40"
          >
            {predicting ? 'Generating…' : <><Sparkles className="w-4 h-4 mr-1" /> Generate AI Picks</>}
          </Button>
          <Button
            onClick={handlePlaceBet}
            disabled={!running || betting || selectedAccountId === null || picks.length === 0}
            variant="default"
            className="flex-1 min-w-40 bg-emerald-600 hover:bg-emerald-500"
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
                {spotsMode === 'manual' ? 'Enter numbers above or switch to Auto' : 'Click "Generate AI Picks" to get predictions'}
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