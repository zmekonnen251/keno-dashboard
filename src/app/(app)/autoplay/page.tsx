'use client';

import { useEffect, useState } from 'react';
import {
  getAutoplayConfig,
  setAutoplayConfig,
  autoplayStatus,
  startAutoplay,
  stopAutoplay,
  refreshTokens,
  testAutoplayRound,
  checkBalances,
} from '@/lib/api';
import type { AutoplayPlacedBet, CheckBalanceItem } from '@/lib/types';
import { useApi } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, StatCard, Empty, ErrorBox, Loading } from '@/components/app';
import { formatTime } from '@/lib/format';

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
  if (state === 'lost' || state === 'error') return 'destructive';
  if (state === 'betting' || state === 'pending') return 'secondary';
  return 'outline';
}

export default function AutoplayPage() {
  const config = useApi(() => getAutoplayConfig(), []);
  const status = useApi(() => autoplayStatus(), []);
  const [loaded, setLoaded] = useState(false);
  const [stake, setStake] = useState('');
  const [batch, setBatch] = useState('');
  const [mode, setMode] = useState<'A' | 'B' | 'C'>('A');
  const [splitRatio, setSplitRatio] = useState<'uniform' | '1/2' | '1/3'>('uniform');
  const [digitCount, setDigitCount] = useState<2 | 3>(3);
  const [ticketsText, setTicketsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState('');
  const [lastPlaced, setLastPlaced] = useState<AutoplayPlacedBet[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingAll, setCheckingAll] = useState(false);
  const [checkingIds, setCheckingIds] = useState<Set<number>>(new Set());
  const [balances, setBalances] = useState<Record<number, CheckBalanceItem>>({});
  const [refreshingStatus, setRefreshingStatus] = useState(false);

  // Poll per-account live game status every 5s so the table stays current.
  useEffect(() => {
    if (status.data?.running) {
      const t = setInterval(() => status.refresh(), 5000);
      return () => clearInterval(t);
    }
  }, [status.data?.running, status]);

  const cfg = config.data;

  if (config.loading || status.loading) return <Loading />;
  const err = config.error || status.error;
  if (err) return <ErrorBox message={err} />;

  function onLoadCurrent() {
    setStake(String(cfg?.stake ?? ''));
    setBatch(String(cfg?.batch_size ?? ''));
    setMode(cfg?.mode ?? 'A');
    setSplitRatio(cfg?.split_ratio ?? 'uniform');
    setDigitCount(cfg?.digit_count ?? 3);
    setTicketsText(ticketsToText(cfg?.base_tickets));
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
    setLoaded(true);
    setTestMsg('');
    setLastPlaced(null);
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
      });
      setTestMsg('Configuration saved.');
      config.refresh();
      status.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function onTestRound() {
    setTesting(true);
    setTestMsg('');
    try {
      const res = await testAutoplayRound();
      setLastPlaced(res.placed || []);
      const ok = (res.placed || []).filter((p) => p.ok).length;
      setTestMsg(
        `Round ran across ${res.workers} worker(s). ${ok}/${(res.placed || []).length} bets placed.`
      );
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

  async function onCheckBalances(id?: number) {
    if (typeof id === 'number') {
      setCheckingIds((prev) => new Set(prev).add(id));
    } else {
      setCheckingAll(true);
    }
    try {
      const res = await checkBalances(id);
      setBalances((prev) => {
        const next = { ...prev };
        (res.results || []).forEach((r) => (next[r.accountId] = r));
        return next;
      });
      status.refresh();
    } catch (e) {
      setTestMsg('Balance check failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      if (typeof id === 'number') setCheckingIds((prev) => new Set([...prev].filter((x) => x !== id)));
      else setCheckingAll(false);
    }
  }

  async function onRefreshStatus() {
    setRefreshingStatus(true);
    try {
      await status.refresh();
    } finally {
      setRefreshingStatus(false);
    }
  }

  const conn = status.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">Autoplay</h2>
        <div className="flex flex-wrap gap-2">
          {conn?.running ? (
            <Button variant="destructive" onClick={() => stopAutoplay().then(() => status.refresh())}>Stop</Button>
          ) : (
            <Button onClick={() => startAutoplay().then(() => status.refresh())}>Start</Button>
          )}
          <Button variant="outline" onClick={onTestRound} disabled={testing || !conn?.running}>
            {testing ? 'Testing…' : 'Test Round'}
          </Button>
          <Button variant="outline" onClick={onRefreshTokens} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh tokens'}
          </Button>
          <Button variant="outline" onClick={() => onCheckBalances()} disabled={checkingAll}>
            {checkingAll ? 'Checking…' : 'Check balances'}
          </Button>
        </div>
      </div>

      {testMsg && <p className="text-sm text-muted-foreground">{testMsg}</p>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Enabled" value={cfg?.enabled ? 'Yes' : 'No'} tone={cfg?.enabled ? 'positive' : 'default'} />
        <StatCard label="Running" value={conn?.running ? 'Yes' : 'No'} tone={conn?.running ? 'positive' : 'default'} />
        <StatCard label="Workers" value={conn?.workers ?? 0} tone="accent" />
        <StatCard label="Stake" value={cfg?.stake ?? '—'} />
      </div>

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

      {lastPlaced && lastPlaced.length > 0 && (
        <Card title="Last test round">
          <div className="space-y-1">
            {lastPlaced.map((p) => (
              <div key={p.accountId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${p.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                    {p.ok ? '✓' : '✗'}
                  </span>
                  <span className="font-medium">#{p.accountId}</span>
                  <span className="text-muted-foreground">{p.phone}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono">[{p.spots.join(',')}]</span>
                  <span className="text-muted-foreground">{p.stake} ETB</span>
                  <span className="text-muted-foreground">{p.requestId}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card
        title={`Account game status${status.data?.running ? ' (live)' : ''}`}
        actions={
          <Button variant="outline" size="sm" onClick={onRefreshStatus} disabled={refreshingStatus}>
            {refreshingStatus ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      >
        {!conn?.accounts || conn.accounts.length === 0 ? (
          <Empty label="No active accounts. Run a test round or start autoplay." />
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
                  <th className="px-2 py-1.5 font-medium">Status</th>
                  <th className="px-2 py-1.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {conn.accounts.map((a) => {
                  const bal = balances[a.accountId]?.balance;
                  return (
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
                          <span className={a.winAmount > 0 ? 'text-emerald-600' : 'text-muted-foreground'}>
                            {a.winAmount > 0 ? '+' : ''}{a.winAmount} ETB
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <div className={a.balance < 2 ? 'text-red-600 font-semibold' : ''}>{a.balance?.toFixed?.(2) ?? a.balance} ETB</div>
                        {bal && (
                          <div className="text-muted-foreground">
                            live: {bal.balance != null ? `${bal.balance} ETB` : '—'}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <div className={a.connected ? 'text-emerald-600' : 'text-muted-foreground'}>
                          {a.connected ? 'connected' : 'offline'}
                        </div>
                        <div className="text-muted-foreground">{a.lastStatus}</div>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={checkingIds.has(a.accountId)}
                          onClick={() => onCheckBalances(a.accountId)}
                        >
                          {checkingIds.has(a.accountId) ? 'Checking…' : 'Check balance'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!cfg && <Empty label="No autoplay config" />}
    </div>
  );
}
