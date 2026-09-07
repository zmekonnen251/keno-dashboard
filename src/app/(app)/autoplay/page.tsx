/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/rules-of-hooks */
'use client';

import { useEffect, useRef, useState } from 'react';
import {
  setAutoplayConfig,
  autoplayStatus,
  startAutoplay,
  stopAutoplay,
  refreshTokens,
  testAutoplayRound,
  syncBalances,
} from '@/lib/api';
import type { AutoplayPlacedBet } from '@/lib/types';
import { useApi } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, StatCard, Empty, ErrorBox, Loading } from '@/components/app';
import { formatTime } from '@/lib/format';
import { useSocket } from '@/lib/service-gateway';
import { useGatewayGameState } from '@/lib/gateway-game-state';

function ticketsToText(tickets: number[][] | null | undefined): string {
  return (tickets || []).map((t) => t.join(',')).join('\n');
}

function textToTickets(text: string): number[][] | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const tickets = lines
    .map((line) =>
      line
        .split(/[,;\s]+/)
        .map((n) => parseInt(n, 10))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 80)
    )
    .filter((t) => t.length > 0);
  return tickets.length > 0 ? tickets : null;
}

function stateTone(state: string): 'default' | 'destructive' | 'secondary' | 'outline' {
  if (state === 'won') return 'default';
  if (state === 'lost' || state === 'error' || state === 'failed') return 'destructive';
  if (state === 'betting' || state === 'pending') return 'secondary';
  return 'outline';
}

function betLabel(p: AutoplayPlacedBet): string {
  if (p.status === 'won') return 'won';
  if (p.status === 'lost') return 'lost';
  if (p.status === 'pending' || p.ok) return 'sent';
  return 'not sent';
}

function formatTs(ms?: number | null): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleTimeString();
}

export default function AutoplayPage() {
  const { data: conn, error, loading, refresh } = useApi(() => autoplayStatus(), []);
  const [loaded, setLoaded] = useState(false);
  const [stake, setStake] = useState('');
  const [batch, setBatch] = useState('');
  const [mode, setMode] = useState<'A' | 'B' | 'C'>('A');
  const [splitRatio, setSplitRatio] = useState<'uniform' | '1/2' | '1/3'>('uniform');
  const [digitCount, setDigitCount] = useState<2 | 3>(3);
  const [ticketsText, setTicketsText] = useState('');
  const [repBet, setRepBet] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [gameState, setGameState] = useState<'betting_open' | 'drawing' | 'settled' | 'unknown'>('unknown');
  const [signals, setSignals] = useState<'repetitive' | 'recurring' | 'hot' | 'none'>('repetitive');

  const signalsUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    useGatewayGameState(setGameState);
    useSocket('/autoplay/signals', setSignals);

    return () => {
      signalsUnsubRef.current?.();
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => refresh(), 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const cfg = conn?.config;

  if (loading && !conn) return <Loading />;
  if (error && !conn) return <ErrorBox message={error} />;

  function onLoadCurrent() {
    setStake(String(cfg?.stake ?? ''));
    setBatch(String(cfg?.batch_size ?? ''));
    setMode(cfg?.mode ?? 'A');
    setSplitRatio(cfg?.split_ratio ?? 'uniform');
    setDigitCount(cfg?.digit_count ?? 3);
    setTicketsText(ticketsToText(cfg?.base_tickets));
    setRepBet(cfg?.repetitive_auto_bet ?? true);
    setGameState(cfg?.game_state ?? 'unknown');
    setSignals(cfg?.signals ?? 'repetitive');
    setLoaded(true);
    setTestMsg('');
  }

  function onNew() {
    setStake('');
    setBatch('');
    setMode('C');
    setSplitRatio('uniform');
    setDigitCount(3);
    setTicketsText('1,2,3\n8,9,10\n58,59,60\n71,72,73\n77,78,79\n78,79,80');
    setRepBet(true);
    setGameState('unknown');
    setSignals('repetitive');
    setLoaded(true);
    setTestMsg('');
  }

  async function onSave() {
    setSaving(true);
    setTestMsg('');
    try {
      await setAutoplayConfig({
        stake: stake !== '' ? parseFloat(stake) : undefined,
        batch_size: batch !== '' ? parseInt(batch, 10) : undefined,
        mode,
        split_ratio: splitRatio,
        ...(mode === 'C' ? { digit_count: digitCount } : {}),
        base_tickets: textToTickets(ticketsText),
        repetitive_auto_bet: repBet,
        game_state: gameState,
        signals,
      });
      setTestMsg('Configuration saved.');
      refresh();
    } finally {
      setSaving(false);
    }
  }

  async function onTestRound() {
    setTesting(true);
    setTestMsg('');
    try {
      const res = await testAutoplayRound();
      const sent = res.sent ?? (res.placed || []).filter((p) => p.ok).length;
      const failed = (res.placed || []).filter((p) => !p.ok);
      const reason = failed[0]?.failReason ? ` (${failed[0].failReason})` : '';
      setTestMsg(
        `Sent ${sent}/${(res.placed || []).length} tickets on ${res.workers} worker(s)${reason}. ` +
          'Results (win/loss) appear in the bet log after the draw settles.'
      );
      refresh();
    } catch (e) {
      setTestMsg('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setTesting(false);
    }
  }

  async function onRefreshTokens() {
    setRefreshing(true);
    try {
      await refreshTokens();
    } finally {
      setRefreshing(false);
    }
  }

  async function onSyncWallets() {
    setSyncing(true);
    try {
      const res = await syncBalances();
      setTestMsg(
        `Wallets synced: ${res.synced ?? 0} updated, ${res.failed ?? 0} failed` +
          (res.timedOut ? ' (partial — still running in background).' : '.')
      );
      refresh();
    } catch (e) {
      setTestMsg('Wallet sync failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSyncing(false);
    }
  }

  const bets = conn?.bets || [];
  const rec = conn?.recurrence;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">Autoplay</h2>
        <div className="flex flex-wrap gap-2">
          {conn?.running ? (
            <Button variant="destructive" onClick={() => stopAutoplay().then(() => refresh())}>Stop</Button>
          ) : (
            <Button onClick={() => startAutoplay().then(() => refresh())}>Start</Button>
          )}
          <Button variant="outline" onClick={onTestRound} disabled={testing || !conn?.running}>
            {testing ? 'Testing…' : 'Test Round'}
          </Button>
          <Button variant="outline" onClick={onRefreshTokens} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh tokens'}
          </Button>
          <Button variant="outline" onClick={onSyncWallets} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync wallets'}
          </Button>
        </div>
      </div>

      <div className="alert alert-info mt-3">
        <strong>Game State:</strong> {gameState === 'betting_open' ? 'Betting OPEN — inject tickets now' : gameState === 'drawing' ? 'Drawing in progress — bets scheduled for next round' : gameState === 'settled' ? 'Settled — results announced' : 'Unknown'}
      </div>

      {testMsg && <p className="text-sm text-muted-foreground">{testMsg}</p>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="Enabled" value={conn?.enabled ? 'Yes' : 'No'} tone={conn?.enabled ? 'positive' : 'default'} />
        <StatCard label="Running" value={conn?.running ? 'Yes' : 'No'} tone={conn?.running ? 'positive' : 'default'} />
        <StatCard
          label="Workers"
          value={`${conn?.connectedWorkers ?? 0}/${conn?.workers ?? 0}`}
          sub="connected / pool"
          tone="accent"
        />
        <StatCard
          label="Fresh pool"
          value={`${conn?.freshAccounts ?? 0}/${conn?.workers ?? 0}`}
          sub="2-Birr / never-bet accounts prioritized"
          tone={conn?.connectedWorkers ? 'accent' : 'default'}
        />
        <StatCard label="Stake" value={`${cfg?.stake ?? '—'} ETB`} />
        <StatCard
          label="Repetitive auto-bet"
          value={cfg?.repetitive_auto_bet ? 'On' : 'Off'}
          sub="bet recent repeating numbers / patterns"
          tone={cfg?.repetitive_auto_bet ? 'positive' : 'default'}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="Enabled" value={conn?.enabled ? 'Yes' : 'No'} tone={conn?.enabled ? 'positive' : 'default'} />
        <StatCard label="Running" value={conn?.running ? 'Yes' : 'No'} tone={conn?.running ? 'positive' : 'default'} />
        <StatCard
          label="Workers"
          value={`${conn?.connectedWorkers ?? 0}/${conn?.workers ?? 0}`}
          sub="connected / pool"
          tone="accent"
        />
        <StatCard
          label="Fresh pool"
          value={`${conn?.freshAccounts ?? 0}/${conn?.workers ?? 0}`}
          sub="2-Birr / never-bet accounts prioritized"
          tone={conn?.connectedWorkers ? 'accent' : 'default'}
        />
        <StatCard label="Stake" value={`${cfg?.stake ?? '—'} ETB`} />
        <StatCard
          label="Repetitive auto-bet"
          value={cfg?.repetitive_auto_bet ? 'On' : 'Off'}
          sub="bet recent repeating numbers / patterns"
          tone={cfg?.repetitive_auto_bet ? 'positive' : 'default'}
        />
        <StatCard label="Game state" value={gameState === 'betting_open' ? 'OPEN' : gameState === 'drawing' ? 'DRAWING' : gameState === 'settled' ? 'SETTLED' : 'Unknown'} tone={gameState === 'betting_open' ? 'positive' : gameState === 'drawing' ? 'negative' : 'accent'} />
        <StatCard
          label="Signals"
          value={signals === 'repetitive' ? 'Repetitive' : signals === 'recurring' ? 'Recurring' : signals === 'hot' ? 'Hot digits' : 'None'}
          tone={signals === 'repetitive' ? 'positive' : signals === 'recurring' ? 'accent' : 'default'}
        />
      </div>

      <Card title="Signal panel" actions="">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{rec?.dominantPattern || 'Waiting for draw history…'}</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Chain picks</div>
              <div className="mt-1 font-mono text-xs">{rec?.chainNumbers.length ? `[${rec.chainNumbers.slice(0, 8).join(',')}]` : '—'}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recurrence picks</div>
              <div className="mt-1 font-mono text-xs">{rec?.recurrenceNumbers.length ? `[${rec.recurrenceNumbers.slice(0, 8).join(',')}]` : '—'}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Carryover trend</div>
              <div className="mt-1 font-mono text-xs">{rec?.trendNumbers.length ? `[${rec.trendNumbers.slice(0, 8).join(',')}]` : '—'}</div>
            </div>
          </div>
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => setSignals('repetitive')}>
              Repetitive tickets
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSignals('recurring')}>
              Recurring patterns
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSignals('hot')}>
              Hot digits
            </Button>
          </div>
        </div>
      </Card>

      {rec && (
        <Card
          title="Recurrence signal"
          actions={
            <Badge variant="outline">
              {rec.drawCount > 0 ? `${rec.level} · ${(rec.confidence * 100).toFixed(0)}% conf` : 'no draws yet'}
            </Badge>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{rec.dominantPattern || 'Waiting for draw history…'}</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Chain picks</div>
                <div className="mt-1 font-mono text-xs">{rec.chainNumbers.length ? `[${rec.chainNumbers.slice(0, 8).join(',')}]` : '—'}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recurrence picks</div>
                <div className="mt-1 font-mono text-xs">{rec.recurrenceNumbers.length ? `[${rec.recurrenceNumbers.slice(0, 8).join(',')}]` : '—'}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Carryover trend</div>
                <div className="mt-1 font-mono text-xs">{rec.trendNumbers.length ? `[${rec.trendNumbers.slice(0, 8).join(',')}]` : '—'}</div>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card
        title="Configuration"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onNew} disabled={loaded}>
              New
            </Button>
            <Button variant="outline" size="sm" onClick={onLoadCurrent}>
              Load current
            </Button>
          </div>
        }
      >
        {!loaded ? (
          <Empty label={'Click "Load current" to start editing the autoplay configuration.'} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Mode</Label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as 'A' | 'B' | 'C')}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                >
                  <option value="A">A — Guided (same pick, all accounts)</option>
                  <option value="B">B — Split (distinct tickets)</option>
                  <option value="C">C — Suggestions (digits from server picks)</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  {mode === 'C'
                    ? 'Mode C takes tickets from the server suggestion numbers each round. Pick how many digits per ticket below.'
                    : 'Mode B with uniform ratio spreads each configured ticket onto its own account.'}
                </p>
              </div>
              {mode === 'C' ? (
                <div className="space-y-1.5">
                  <Label>Digits per ticket (Mode C)</Label>
                  <select
                    value={String(digitCount)}
                    onChange={(e) => setDigitCount(e.target.value === '2' ? 2 : 3)}
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  >
                    <option value="2">2 — two-digit tickets</option>
                    <option value="3">3 — three-digit tickets</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Each account bets its own {digitCount}-number ticket sliced from the server suggestion pool.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Split ratio (Mode B)</Label>
                  <select
                    value={splitRatio}
                    onChange={(e) => setSplitRatio(e.target.value as 'uniform' | '1/2' | '1/3')}
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  >
                    <option value="uniform">Uniform — one ticket per account</option>
                    <option value="1/2">1/2 — split in two groups</option>
                    <option value="1/3">1/3 — split in three groups</option>
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Stake (Birr)</Label>
                  <Input type="number" min="2" value={stake} onChange={(e) => setStake(e.target.value)} placeholder="2" />
                </div>
                <div className="space-y-1.5">
                  <Label>Batch size</Label>
                  <Input type="number" min="1" value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="1" />
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
              <input
                id="repBet"
                type="checkbox"
                checked={repBet}
                onChange={(e) => setRepBet(e.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
              <Label htmlFor="repBet" className="cursor-pointer">
                Auto-bet recent repetitive tickets (recurrence &amp; pattern-trend picks lead the round)
              </Label>
              <span className="ml-auto text-xs text-muted-foreground">
                Chains · overdue/time patterns · carryover
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Base tickets (one per line, comma separated)</Label>
                <textarea
                  value={ticketsText}
                  onChange={(e) => setTicketsText(e.target.value)}
                  rows={8}
                  placeholder={'1,2,3\n8,9,10\n58,59,60\n71,72,73\n77,78,79\n78,79,80'}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Preview</Label>
                <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-muted p-3 font-mono text-xs text-foreground">
                  {ticketsText || '—'}
                </pre>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {cfg?.base_tickets?.length ?? 0} ticket(s) saved · Updated {formatTime(cfg?.updated_at)}
              </div>
              <Button onClick={onSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save configuration'}
              </Button>
            </div>
          </>
        )}
      </Card>

      <Card title="Bet log (live)">
        {bets.length === 0 ? (
          <Empty label="No bets recorded yet. Start autoplay or run a test round." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-2 py-1.5 font-medium">Time</th>
                  <th className="px-2 py-1.5 font-medium">Account</th>
                  <th className="px-2 py-1.5 font-medium">Ticket</th>
                  <th className="px-2 py-1.5 font-medium">Stake</th>
                  <th className="px-2 py-1.5 font-medium">Status</th>
                  <th className="px-2 py-1.5 font-medium">Hits</th>
                  <th className="px-2 py-1.5 font-medium">Won</th>
                  <th className="px-2 py-1.5 font-medium">Drawn</th>
                  <th className="px-2 py-1.5 font-medium">Balance after</th>
                </tr>
              </thead>
              <tbody>
                {bets.map((p) => (
                  <tr key={`${p.accountId}-${p.requestId}-${p.placedAt}`} className="border-b border-border/60">
                    <td className="px-2 py-2 text-muted-foreground">{formatTs(p.placedAt)}</td>
                    <td className="px-2 py-2">
                      <div className="font-medium">#{p.accountId}</div>
                      <div className="text-muted-foreground">{p.phone}</div>
                    </td>
                    <td className="px-2 py-2 font-mono">[{(p.spots || []).join(',')}]</td>
                    <td className="px-2 py-2">{p.stake} ETB</td>
                    <td className="px-2 py-2">
                      <Badge variant={stateTone(p.status || (p.ok ? 'pending' : 'failed'))}>
                        {betLabel(p)}
                      </Badge>
                      {p.failReason && (
                        <div className="mt-0.5 max-w-48 truncate text-muted-foreground" title={p.failReason}>
                          {p.failReason}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2">{p.matched != null ? p.matched : '—'}</td>
                    <td className="px-2 py-2">
                      {p.winAmount != null ? (
                        <span className={p.winAmount > 0 ? 'font-semibold text-emerald-500' : 'text-muted-foreground'}>
                          {p.winAmount > 0 ? '+' : ''}{p.winAmount} ETB
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 font-mono text-muted-foreground">
                      {p.drawnSpots && p.drawnSpots.length > 0 ? `[${p.drawnSpots.slice(0, 8).join(',')}${p.drawnSpots.length > 8 ? '…' : ''}]` : '—'}
                    </td>
                    <td className="px-2 py-2">{p.balanceAfter != null ? `${p.balanceAfter} ETB` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={`Account game status${conn?.running ? ' (live)' : ''}`}>
        {!conn?.accounts || conn.accounts.length === 0 ? (
          <Empty label="No active workers. Start autoplay to open gateway connections." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-2 py-1.5 font-medium">Account</th>
                  <th className="px-2 py-1.5 font-medium">State</th>
                  <th className="px-2 py-1.5 font-medium">Last bet</th>
                  <th className="px-2 py-1.5 font-medium">Win</th>
                  <th className="px-2 py-1.5 font-medium">Balance</th>
                  <th className="px-2 py-1.5 font-medium">Socket</th>
                </tr>
              </thead>
              <tbody>
                {conn.accounts.map((a) => (
                  <tr key={a.accountId} className="border-b border-border/60">
                    <td className="px-2 py-2">
                      <div className="font-medium">#{a.accountId}</div>
                      <div className="text-muted-foreground">{a.phone}</div>
                    </td>
                    <td className="px-2 py-2">
                      <Badge variant={stateTone(a.state)}>{a.state}</Badge>
                      {a.deleted && <Badge variant="destructive" className="ml-1">deleted</Badge>}
                    </td>
                    <td className="px-2 py-2">
                      {a.lastSpots ? (
                        <>
                          <div className="font-mono">[{a.lastSpots.join(',')}]</div>
                          <div className="text-muted-foreground">{a.lastStake ?? '—'} ETB</div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {a.winAmount != null ? (
                        <span className={a.winAmount > 0 ? 'text-emerald-500' : 'text-muted-foreground'}>
                          {a.winAmount > 0 ? '+' : ''}{a.winAmount} ETB
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className={a.balance < 2 ? 'font-semibold text-red-500' : ''}>
                        {typeof a.balance === 'number' ? a.balance.toFixed(2) : a.balance} ETB
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className={a.connected ? 'text-emerald-500' : 'text-muted-foreground'}>
                        {a.connected ? 'connected' : 'offline'}
                      </div>
                      <div className="text-muted-foreground">{a.lastStatus}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
