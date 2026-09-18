'use client';

import { useEffect, useState } from 'react';
import {
  getRainAutoplayStatus,
  rainAutoplayStart,
  rainAutoplayStop,
  getRainAccounts,
  refreshRainAccount,
  checkAllRainStatus,
  getRainFreeBets,
  getRainCashBets,
  playRainFreeBet,
  rainBetPrediction,
  rainTestRound,
} from '@/lib/api';
import { isPushActive, pushSupported, subscribePush, unsubscribePush, rePostSubscription } from '@/lib/push';
import { getNotifyPref, setNotifyPref } from '@/lib/notifyPrefs';
import type {
  RainAccount,
  RainAutoplayConfig,
  RainAutoplayStatus,
  RainFreeBet,
  RainCashBet,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge, Card, Empty, Loading, StatCard, TableCell, TableRow } from '@/components/app';
import { Table, TableBody, TableHead, TableHeader } from '@/components/ui/table';
import { Modal } from '@/components/ui/modal';
import { NumberGrid } from './NumberGrid';
import { RainBetView } from './RainBetView';
import { RainManualBetCard } from './RainManualBetCard';
import { formatTime } from '@/lib/format';
import { CollapsibleCard } from './CollapsibleCard';
import { LastDrawsBoards } from './LastDrawsBoards';
import { RainConfigCard } from './RainConfigCard';

const SPOT_STATUS_LABEL: Record<RainFreeBet['status'], { label: string; cls: string }> = {
  available: { label: 'Available', cls: 'bg-emerald-600 text-white' },
  claiming: { label: 'Claiming', cls: 'bg-amber-500 text-black' },
  bet_placed: { label: 'Bet placed', cls: 'bg-sky-600 text-white' },
  won: { label: 'Won', cls: 'bg-emerald-600 text-white' },
  lost: { label: 'Lost', cls: 'bg-zinc-600 text-white' },
  failed: { label: 'Failed', cls: 'bg-rose-600 text-white' },
  expired: { label: 'Expired', cls: 'bg-muted text-muted-foreground' },
};

export function ShamoAutoplay({ siteName }: { siteName?: string }) {
  const [status, setStatus] = useState<RainAutoplayStatus | null>(null);
  const [cfg, setCfg] = useState<RainAutoplayConfig | null>(null);
  const [accounts, setAccounts] = useState<RainAccount[]>([]);
  const [playHistory, setPlayHistory] = useState<RainFreeBet[] | null>(null);
  const [freeBets, setFreeBets] = useState<RainFreeBet[] | null>(null);
  const [cashBets, setCashBets] = useState<RainCashBet[]>([]);
  const [showFreeBets, setShowFreeBets] = useState(false);
  const [freeBetsLoading, setFreeBetsLoading] = useState(false);
  const [bettingPrediction, setBettingPrediction] = useState(false);
  const [testingRound, setTestingRound] = useState(false);
  const [checkingAll, setCheckingAll] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [pickBet, setPickBet] = useState<RainFreeBet | null>(null);
  const [pickSpots, setPickSpots] = useState<number[]>([]);
  const [pickSpotsCount, setPickSpotsCount] = useState<2 | 3>(3);
  const [msg, setMsg] = useState('');
  const [notifyOn, setNotifyOn] = useState(() => getNotifyPref());
  const [pushOn, setPushOn] = useState(() => isPushActive());

  // Restore an existing push subscription after reload so rain claims keep
  // arriving as Chrome notifications without re-enabling every visit.
  useEffect(() => {
    if (!getNotifyPref() && !isPushActive()) return;
    void (async () => {
      const ok = await rePostSubscription();
      setPushOn(ok);
      setNotifyOn(true);
      setNotifyPref(true);
    })();
  }, []);

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
      setMsg('Push notifications enabled — you will be notified when a rain is claimed or a free-bet is won.');
      void refreshAccountsAndBets();
    }
  }

  useEffect(() => {
    const t = setInterval(() => void refreshStatus(), 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => void refreshAccountsAndBets(), 10000);
    return () => clearInterval(t);
  }, []);

  async function refreshStatus() {
    try {
      const res = await getRainAutoplayStatus();
      setStatus(res.status);
      setCfg((c) => (c ? { ...c, ...res.config } : res.config));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  async function refreshAccountsAndBets() {
    try {
      const [accRes, betRes] = await Promise.all([getRainAccounts(), getRainFreeBets()]);
      setAccounts(accRes.accounts);
      setPlayHistory(betRes.bets.filter((b) => (b.chosen_spots?.length ?? 0) > 0));
      setFreeBets(betRes.bets);
      void getRainCashBets(100)
        .then((res) => setCashBets(res.bets))
        .catch(() => {});
    } catch {
      /* keep the last lists */
    }
  }

  async function onTestRound() {
    setTestingRound(true);
    setMsg('');
    try {
      const res = await rainTestRound();
      if (!res.ok) {
        setMsg('Test round failed — is the claimer running with eligible free-bets?');
      } else {
        setMsg(res.result.played > 0
          ? `Test round played ${res.result.played} free-bet${res.result.played === 1 ? '' : 's'}.`
          : 'Test round completed — no eligible free-bets to play.');
      }
      void refreshAccountsAndBets();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setTestingRound(false);
    }
  }

  async function onStart() {
    setMsg('');
    try {
      await rainAutoplayStart();
      await refreshStatus();
      setMsg('Rain autoplay engine started.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  async function onStop() {
    setMsg('');
    try {
      await rainAutoplayStop();
      await refreshStatus();
      setMsg('Rain autoplay engine stopped.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  async function onBetPrediction() {
    setBettingPrediction(true);
    setMsg('');
    try {
      const res = await rainBetPrediction();
      if (!res.ok || !res.result?.ok) {
        setMsg(res.result?.error || 'Prediction bet failed.');
      } else {
        setMsg('Prediction bet placed on an eligible rain free-bet (wager = the free-bet amount).');
        void refreshAccountsAndBets();
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBettingPrediction(false);
    }
  }

  async function onCheckAll() {
    setCheckingAll(true);
    setMsg('');
    try {
      const res = await checkAllRainStatus();
      await refreshAccountsAndBets();
      await new Promise((r) => setTimeout(r, 1500)); // let sockets come up
      await refreshAccountsAndBets();
      setMsg(res.reconnected > 0
        ? `Reconnected ${res.reconnected} rain account${res.reconnected === 1 ? '' : 's'} — statuses re-checked.`
        : 'No enabled rain accounts to check.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setCheckingAll(false);
    }
  }

  async function onRefreshStatus(acc: RainAccount) {
    setBusyId(acc.id);
    setMsg('');
    try {
      await refreshRainAccount(acc.id);
      setMsg(`Status check sent for "${acc.name}".`);
      void refreshAccountsAndBets();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  function onPlayFreeBet(bet: RainFreeBet) {
    const existing = (bet.chosen_spots ?? []).filter((n) => Number.isInteger(n) && n >= 1 && n <= 80);
    const count: 2 | 3 = existing.length === 2 ? 2 : 3;
    setPickSpotsCount(count);
    setPickSpots(existing.length ? existing.slice(0, count) : []);
    setPickBet(bet);
    setMsg('');
  }

  async function onPlayWithSpots() {
    if (!pickBet || pickSpots.length < 2) {
      setMsg('Pick at least 2 numbers before playing the free bet.');
      return;
    }
    setPlayingId(pickBet.id);
    setMsg('');
    try {
      const res = await playRainFreeBet(pickBet.id, pickSpots);
      if (!res.result.ok) {
        setMsg(res.result.error || 'Failed to place bet.');
      } else {
        setMsg(`Bet placed for ${pickBet.free_bet_id} (row #${pickBet.id}) · [${pickSpots.join(', ')}].`);
      }
      void refreshAccountsAndBets();
      setPickBet(null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setPlayingId(null);
    }
  }

  function onShowFreeBets() {
    setShowFreeBets(true);
    setFreeBetsLoading(true);
    setFreeBets(null);
    void getRainFreeBets()
      .then((res) => setFreeBets(res.bets))
      .catch((e) => setMsg(e instanceof Error ? e.message : String(e)))
      .finally(() => setFreeBetsLoading(false));
  }

  const totalBalance = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  const liveBalance = accounts.some((a) => a.balanceLive);
  const connected = accounts.filter((a) => a.connected).length;
  const availableFb = (freeBets ?? []).filter((b) => b.status === 'available' || b.status === 'failed').length;
  const ledgerBets = freeBets ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">Autoplay — {siteName ?? 'fungames_shamo'} (rain free-bets)</h2>
        <div className="flex flex-wrap gap-2">
          {status?.running ? (
            <Button variant="destructive" onClick={() => void onStop()}>Stop</Button>
          ) : (
            <Button onClick={() => void onStart()}>Start</Button>
          )}
          <Button variant="outline" disabled={bettingPrediction} onClick={() => void onBetPrediction()}>
            {bettingPrediction ? '…' : 'Bet prediction'}
          </Button>
          <Button variant="outline" disabled={testingRound} onClick={() => void onTestRound()}>
            {testingRound ? '…' : 'Test round'}
          </Button>
          <Button variant="outline" disabled={checkingAll} onClick={() => void onCheckAll()}>
            {checkingAll ? '…' : 'Check all rains'}
          </Button>
          <Button variant="outline" onClick={onShowFreeBets}>
            Free bets{availableFb > 0 ? ` (${availableFb})` : ''}
          </Button>
          <Button variant="outline" onClick={() => void refreshAccountsAndBets()}>Refresh</Button>
          <Button variant="outline" onClick={() => setShowConfig(true)}>Configure</Button>
          <Button variant="outline" onClick={() => void onToggleNotifications()}>
            {pushOn ? '✓ Push on' : notifyOn ? '✓ Notifications on' : 'Enable notifications'}
          </Button>
        </div>
      </div>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <CollapsibleCard title="Stats" defaultOpen={true}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Engine"
            value={status?.running ? 'RUNNING' : 'IDLE'}
            tone={status?.running ? 'positive' : 'default'}
            sub={cfg?.enabled ? 'Config enabled — rounds on' : 'Config disabled'}
          />
          <StatCard label="Rounds played (total)" value={status?.totalPlayed ?? '—'} />
          <StatCard
            label="Last round"
            value={status?.lastRoundPlayed ?? '—'}
            sub={status?.lastRoundAt ? formatTime(new Date(status.lastRoundAt).toISOString()) : 'never'}
          />
          <StatCard label="Pending acks" value={status?.pendingAcks ?? '—'} sub={`interval ${((status?.intervalMs ?? 60000) / 1000).toFixed(0)}s`} />
          <StatCard
            label="Rain accounts"
            value={`${connected}/${accounts.length}`}
            sub={`${accounts.length} total · wallets`}
          />
          <StatCard
            label="Balance (rain wallets)"
            value={`${totalBalance.toFixed(2)} ETB`}
            tone={liveBalance ? 'accent' : 'default'}
            sub={liveBalance ? 'live balances' : 'last stored'}
          />
          <StatCard
            label="Free-bet plays"
            value={playHistory?.length ?? '…'}
            sub={`playable ${availableFb} now`}
          />
          <StatCard
            label="Last error"
            value={status?.lastError ? '!' : '—'}
            tone={status?.lastError ? 'negative' : 'default'}
            sub={status?.lastError ? String(status.lastError).slice(0, 60) : 'none'}
          />
        </div>
        {status?.lastError && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{status.lastError}</p>}
      </CollapsibleCard>

      <LastDrawsBoards siteId="fungames_shamo" siteName="fungames_shamo" />

      <RainManualBetCard
        running={status?.running ?? false}
        config={cfg}
        accounts={accounts}
        onMessage={setMsg}
        onRefresh={() => void refreshAccountsAndBets()}
      />

      <RainBetView freeBets={freeBets ?? undefined} cashBets={cashBets} config={cfg} autoRefresh={true} />

      <Card title={`Playing with rains — prediction bets / free-bet plays (${playHistory ? playHistory.length : '…'})`}>
        {playHistory === null ? (
          <Loading rows={2} />
        ) : playHistory.length === 0 ? (
          <Empty label="No tickets placed yet — click 'Bet prediction', use a free bet's Play button, or start prediction-ticket autoplay. Placed tickets and their status appear here." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Ticket spots</TableHead>
                  <TableHead>Wager</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Placed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {playHistory.map((b) => {
                  const s = SPOT_STATUS_LABEL[b.status] ?? { label: b.status, cls: 'bg-muted text-muted-foreground' };
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="whitespace-nowrap">{b.account_name ?? `#${b.account_id}`}</TableCell>
                      <TableCell className="font-mono text-xs">{b.chosen_spots?.join(', ') ?? '—'}</TableCell>
                      <TableCell>+{b.wager_amount} ETB</TableCell>
                      <TableCell>
                        <Badge className={s.cls} title={b.error ?? undefined}>{s.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {b.status === 'won' ? (
                          <span className="text-emerald-600 dark:text-emerald-400">+{b.won_amount} ETB</span>
                        ) : b.status === 'lost' || b.status === 'failed' || b.status === 'expired' ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">pending</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {b.bet_placed_at ? formatTime(b.bet_placed_at) : formatTime(b.updated_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Card title={`Rain-claiming accounts & balance (${accounts.length})`}>
        {accounts.length === 0 ? (
          <Empty label="No rain accounts yet — add them on the Rain Accounts page." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Claims</TableHead>
                  <TableHead>Last claimed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((acc) => (
                  <TableRow key={acc.id}>
                    <TableCell className="font-medium">{acc.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        {acc.connected ? (
                          <Badge className="bg-emerald-600 text-white">Connected</Badge>
                        ) : (
                          <Badge variant="outline" title={acc.lastError ?? ''}>
                            {acc.is_enabled ? `Disconnected · ${acc.lastError || acc.status}` : 'Disabled'}
                          </Badge>
                        )}
                        {acc.balanceLive && <span className="text-[10px] text-emerald-600 dark:text-emerald-400">live balance</span>}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <span className={acc.balanceLive ? 'text-emerald-600 dark:text-emerald-400' : ''}>{acc.balance.toFixed(2)} ETB</span>
                    </TableCell>
                    <TableCell>{acc.rain_count}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {acc.last_claimed_at ? formatTime(acc.last_claimed_at) : '—'}
                      {acc.lastWager != null && (
                        <span className="mt-0.5 block">slot {acc.lastSlot} · +{acc.lastWager} ETB</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" disabled={busyId === acc.id} onClick={() => void onRefreshStatus(acc)}>
                        {busyId === acc.id ? '…' : 'Check status'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <RainConfigCard cfg={cfg} onSaved={setMsg} onRefresh={() => void refreshStatus()} />

      {showConfig && (
        <Modal title="Rain autoplay configuration" onClose={() => setShowConfig(false)} wide>
          <RainConfigCard cfg={cfg} onSaved={setMsg} onRefresh={() => void refreshStatus()} />
        </Modal>
      )}

      {pickBet && (
        <Modal
          title={`Play free bet — ${pickBet.free_bet_id}`}
          onClose={() => {
            if (playingId === pickBet.id) return;
            setPickBet(null);
          }}
          wide
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pick the ticket numbers for this free-bet wager (wager{' '}
              <span className="font-semibold text-foreground">+{pickBet.wager_amount} ETB</span> on{' '}
              <span className="font-mono">{pickBet.account_name ?? `#${pickBet.account_id}`}</span>). Existing picks are
              pre-selected — adjust them or keep as-is.
            </p>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Spots</label>
              <select
                value={String(pickSpotsCount)}
                onChange={(e) => {
                  const v = e.target.value === '2' ? 2 : 3;
                  setPickSpotsCount(v);
                  setPickSpots((prev) => prev.slice(0, v));
                }}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              >
                <option value="2">2 numbers</option>
                <option value="3">3 numbers</option>
              </select>
            </div>
            <NumberGrid
              selected={pickSpots}
              max={pickSpotsCount}
              onToggle={(n) =>
                setPickSpots((prev) => {
                  if (prev.includes(n)) return prev.filter((x) => x !== n);
                  if (prev.length >= pickSpotsCount) return [...prev.slice(1), n];
                  return [...prev, n].sort((a, b) => a - b);
                })
              }
              onClear={() => setPickSpots([])}
            />
            <div className="flex items-center justify-between">
              <span className="rounded-lg border border-border px-3 py-2 font-mono text-xs">
                Selected: {pickSpots.length > 0 ? `[${pickSpots.join(',')}]` : '—'}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPickBet(null)} disabled={playingId === pickBet.id}>
                  Cancel
                </Button>
                <Button onClick={() => void onPlayWithSpots()} disabled={playingId === pickBet.id || pickSpots.length < 2}>
                  {playingId === pickBet.id ? 'Playing…' : 'Play free bet'}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {showFreeBets && (
        <Modal title="Rain free bets (ledger)" onClose={() => setShowFreeBets(false)} wide>
          {freeBetsLoading || freeBets === null ? (
            <Loading rows={3} />
          ) : ledgerBets.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Wager</TableHead>
                    <TableHead>Closed</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Spots</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerBets.map((b) => {
                    const s = SPOT_STATUS_LABEL[b.status] ?? { label: b.status, cls: 'bg-muted text-muted-foreground' };
                    const playable = b.status === 'available' || b.status === 'failed';
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="whitespace-nowrap">
                          <span className="font-medium">{b.account_name ?? `#${b.account_id}`}</span>
                          {!b.account_enabled && <span className="ml-1 text-[10px] text-muted-foreground">(disabled)</span>}
                        </TableCell>
                        <TableCell>+{b.wager_amount} ETB</TableCell>
                        <TableCell>{b.closed_bet_count}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{b.expires_at ? formatTime(b.expires_at) : '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{b.chosen_spots?.length ? b.chosen_spots.join(', ') : '—'}</TableCell>
                        <TableCell>
                          <Badge className={s.cls} title={b.error ?? undefined}>{s.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!playable || playingId === b.id}
                            onClick={() => void onPlayFreeBet(b)}
                          >
                            {playingId === b.id ? '…' : 'Play'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Empty label="No free bets in the ledger yet. They appear as rain accounts receive FREE_BET frames." />
          )}
        </Modal>
      )}
    </div>
  );
}