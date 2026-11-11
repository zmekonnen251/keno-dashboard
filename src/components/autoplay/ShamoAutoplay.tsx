'use client';

import { useEffect, useState } from 'react';
import {
  getRainAutoplayStatus,
  rainAutoplayStart,
  rainAutoplayStop,
  getRainAccounts,
  refreshRainAccount,
  checkAllRainStatus,
  setRainAccountAutoplayEnabled,
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
import { Badge, Empty, Loading, StatCard, TableCell, TableRow } from '@/components/app';
import {
  Bell,
  BellOff,
  FlaskConical,
  Play,
  Power,
  PowerOff,
  Radar,
  RefreshCw,
  Settings,
  Sparkles,
  Square,
  Ticket,
} from 'lucide-react';
import { Table, TableBody, TableHead, TableHeader } from '@/components/ui/table';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { NumberGrid } from './NumberGrid';
import { RainBetView } from './RainBetView';
import { RainManualBetCard } from './RainManualBetCard';
import { formatTime } from '@/lib/format';
import { isPlayableFreeBet } from '@/lib/freeBet';
import { CollapsibleCard } from './CollapsibleCard';
import { LastDrawsBoards } from './LastDrawsBoards';
import { MlPredictorCard } from './MlPredictorCard';
import { RainConfigCard } from './RainConfigCard';
import { TwoDigitTicketsCard } from './TwoDigitTicketsCard';
import { SnapScroll, SnapSection } from '@/components/snap-scroll';
import { useSession } from '@/components/session-provider';

const MODAL_PAGE_SIZE = 10;
// Compact icon-only actions on phones so the whole control bar stays on one
// row; the labels return from `sm` up.
const ACTION_BTN = 'h-8 w-8 px-0 sm:w-auto sm:px-2.5';
const ACTION_LABEL = 'hidden sm:inline';

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
  // Viewers see only their assigned accounts (server-scoped) and may toggle
  // autoplay / play their own free bets. Engine start/stop, config, prediction,
  // test rounds and manual cash bets stay admin-only.
  const { isAdmin } = useSession();
  const [status, setStatus] = useState<RainAutoplayStatus | null>(null);
  const [cfg, setCfg] = useState<RainAutoplayConfig | null>(null);
  const [accounts, setAccounts] = useState<RainAccount[]>([]);
  const [playHistory, setPlayHistory] = useState<RainFreeBet[] | null>(null);
  const [freeBets, setFreeBets] = useState<RainFreeBet[] | null>(null);
  const [freeBetsPage, setFreeBetsPage] = useState(0);
  const [cashBets, setCashBets] = useState<RainCashBet[]>([]);
  const [showFreeBets, setShowFreeBets] = useState(false);
  const [freeBetsLoading, setFreeBetsLoading] = useState(false);
  const [bettingPrediction, setBettingPrediction] = useState(false);
  const [testingRound, setTestingRound] = useState(false);
  // Exactly what the last Test round played (account, free bet, numbers, round)
  // — so the result is never confused with the ever-growing play history.
  const [lastTestRound, setLastTestRound] = useState<{ accountId: number; freeBetId: string; spots: number[]; roundId: string | null }[] | null>(null);
  const [checkingAll, setCheckingAll] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [pickBet, setPickBet] = useState<RainFreeBet | null>(null);
  const [pickSpots, setPickSpots] = useState<number[]>([]);
  const [pickSpotsCount, setPickSpotsCount] = useState<number>(3);
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
        setLastTestRound([]);
        setMsg('Test round failed — is the claimer running with eligible free-bets?');
      } else {
        // Show the tickets THIS test round played, not the whole ledger.
        setLastTestRound(
          res.result.bets.map((b) => ({
            accountId: b.accountId,
            freeBetId: b.freeBetId,
            spots: b.spots ?? [],
            roundId: b.roundId ?? null,
          })),
        );
        setMsg(res.result.played > 0
          ? `Test round played ${res.result.played} free-bet${res.result.played === 1 ? '' : 's'}.`
          : 'Test round completed — no eligible free-bets to play.');
      }
      void refreshAccountsAndBets();
    } catch (e) {
      setLastTestRound([]);
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

  // Autoplay opt-out per rain account: disabled accounts keep claiming but
  // their free bets + wallet are skipped by the engine (free-bet + cash mode).
  async function onToggleAutoplay(acc: RainAccount) {
    setBusyId(acc.id);
    setMsg('');
    try {
      await setRainAccountAutoplayEnabled(acc.id, !acc.autoplay_enabled);
      setMsg(acc.autoplay_enabled
        ? `Autoplay disabled for "${acc.name}" — free bets + wallet no longer used by the engine.`
        : `Autoplay enabled for "${acc.name}" — free bets + wallet usable by the engine.`);
      void refreshAccountsAndBets();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  function onPlayFreeBet(bet: RainFreeBet) {
    const existing = (bet.chosen_spots ?? []).filter((n) => Number.isInteger(n) && n >= 1 && n <= 80);
    const count = existing.length >= 2 ? Math.min(existing.length, 10) : 3;
    setPickSpotsCount(count);
    setPickSpots(existing.length ? existing.slice(0, count) : []);
    setPickBet(bet);
    // Close the ledger list so the pick board is the only modal on screen.
    setShowFreeBets(false);
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
    setFreeBetsPage(0);
    setFreeBetsLoading(true);
    setFreeBets(null);
    void getRainFreeBets(1000)
      .then((res) => setFreeBets(res.bets))
      .catch((e) => setMsg(e instanceof Error ? e.message : String(e)))
      .finally(() => setFreeBetsLoading(false));
  }

  const totalBalance = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  const liveBalance = accounts.some((a) => a.balanceLive);
  const connected = accounts.filter((a) => a.connected).length;
  const autoplayOffAccountIds = new Set(
    accounts.filter((a) => a.autoplay_enabled === false).map((a) => a.id),
  );
  const playableFb = (freeBets ?? []).filter(
    (b) =>
      isPlayableFreeBet(b) &&
      // Admins lose an autoplay-disabled account's free bets; the assigned
      // viewer keeps them for manual play.
      (!isAdmin || !autoplayOffAccountIds.has(b.account_id)),
  );
  const availableFb = playableFb.length;
  // This modal is the play surface: only playable rows belong here. The full
  // ledger (won/lost/expired/bet_placed history) lives on the rain-accounts page.
  const ledgerBets = playableFb;

  return (
    <SnapScroll>
      {/* Sticky control bar — always reachable while the deck scrolls. On
          phones it collapses to a single row of icon buttons so it does not
          eat the viewport; labels return on larger screens. */}
      <div className="sticky top-0 z-30 -mx-3 mb-3 border-b border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur-sm sm:-mx-0 sm:mb-4 sm:rounded-xl sm:border sm:p-3 sm:shadow-md">
        <div className="flex items-center gap-2 sm:flex-wrap sm:justify-between sm:gap-3">
          <h2 className="hidden min-w-0 truncate text-lg font-bold text-foreground sm:block">
            Autoplay — {siteName ?? 'fungames_shamo'} (rain free-bets)
          </h2>
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-none sm:flex-wrap sm:gap-2">
            {isAdmin && (status?.running ? (
              <Button variant="destructive" className={ACTION_BTN} onClick={() => void onStop()} title="Stop" aria-label="Stop">
                <Square />
                <span className={ACTION_LABEL}>Stop</span>
              </Button>
            ) : (
              <Button className={ACTION_BTN} onClick={() => void onStart()} title="Start" aria-label="Start">
                <Play />
                <span className={ACTION_LABEL}>Start</span>
              </Button>
            ))}
            {isAdmin && (
              <Button variant="outline" className={ACTION_BTN} disabled={bettingPrediction} onClick={() => void onBetPrediction()} title="Bet prediction" aria-label="Bet prediction">
                <Sparkles />
                <span className={ACTION_LABEL}>{bettingPrediction ? '…' : 'Bet prediction'}</span>
              </Button>
            )}
            {isAdmin && (
              <Button variant="outline" className={ACTION_BTN} disabled={testingRound} onClick={() => void onTestRound()} title="Test round" aria-label="Test round">
                <FlaskConical />
                <span className={ACTION_LABEL}>{testingRound ? '…' : 'Test round'}</span>
              </Button>
            )}
            {isAdmin && (
              <Button variant="outline" className={ACTION_BTN} disabled={checkingAll} onClick={() => void onCheckAll()} title="Check all rains" aria-label="Check all rains">
                <Radar />
                <span className={ACTION_LABEL}>{checkingAll ? '…' : 'Check all rains'}</span>
              </Button>
            )}
            <Button
              variant="outline"
              className={ACTION_BTN}
              onClick={onShowFreeBets}
              title={`Free bets${availableFb > 0 ? ` (${availableFb})` : ''}`}
              aria-label={`Free bets${availableFb > 0 ? ` (${availableFb})` : ''}`}
            >
              <Ticket />
              <span className={ACTION_LABEL}>Free bets{availableFb > 0 ? ` (${availableFb})` : ''}</span>
            </Button>
            <Button variant="outline" className={ACTION_BTN} onClick={() => void refreshAccountsAndBets()} title="Refresh" aria-label="Refresh">
              <RefreshCw />
              <span className={ACTION_LABEL}>Refresh</span>
            </Button>
            {isAdmin && (
              <Button variant="outline" className={ACTION_BTN} onClick={() => setShowConfig(true)} title="Configure" aria-label="Configure">
                <Settings />
                <span className={ACTION_LABEL}>Configure</span>
              </Button>
            )}
            <Button
              variant="outline"
              className={ACTION_BTN}
              onClick={() => void onToggleNotifications()}
              title={pushOn ? 'Push on' : notifyOn ? 'Notifications on' : 'Enable notifications'}
              aria-label={pushOn ? 'Push on' : notifyOn ? 'Notifications on' : 'Enable notifications'}
            >
              {pushOn || notifyOn ? <Bell /> : <BellOff />}
              <span className={ACTION_LABEL}>
                {pushOn ? '✓ Push on' : notifyOn ? '✓ Notifications on' : 'Enable notifications'}
              </span>
            </Button>
          </div>
        </div>
      </div>

      <SnapSection fill title="Stats">
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      {/* Exactly what the last Test round played — its own list, so the result
          never reads as "the same tickets as last time" from the history card. */}
      {lastTestRound !== null && (
        <div className="mb-3 rounded-lg border border-sky-500/40 bg-sky-500/5 p-2.5">
          <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-sky-700 dark:text-sky-300">
            Last test round — {lastTestRound.length} ticket{lastTestRound.length === 1 ? '' : 's'}
          </div>
          {lastTestRound.length === 0 ? (
            <p className="text-xs italic text-muted-foreground">No eligible free-bets were played.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {lastTestRound.map((b, i) => (
                <div key={`${b.freeBetId}-${i}`} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono text-[11px] text-muted-foreground">#{b.accountId}</span>
                  <span className="flex flex-wrap gap-1">
                    {(b.spots ?? []).map((n) => (
                      <span key={n} className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-600/40 font-mono text-[10px] font-extrabold text-sky-800 dark:text-sky-100">
                        {n}
                      </span>
                    ))}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">{b.freeBetId}</span>
                  <span className="rounded bg-black/5 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-600 dark:bg-white/5 dark:text-amber-300">
                    {b.roundId ? `Round ${b.roundId}` : 'Round —'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <CollapsibleCard title="Stats" defaultOpen={true}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Engine"
            value={status?.running ? 'RUNNING' : 'IDLE'}
            tone={status?.running ? 'positive' : 'default'}
            sub={isAdmin ? (cfg?.enabled ? 'Config enabled — rounds on' : 'Config disabled') : status?.running ? 'Rounds are running' : 'Rounds are paused'}
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
      </SnapSection>

      <SnapSection title="Last draws">
      <CollapsibleCard title="Last draws" defaultOpen={false}>
        <LastDrawsBoards siteId="fungames_shamo" siteName="fungames_shamo" />
      </CollapsibleCard>
      </SnapSection>

      {isAdmin && (
        <SnapSection fill title="ML predictor">
          <MlPredictorCard siteId="fungames_shamo" />
        </SnapSection>
      )}

      {isAdmin && (
        <SnapSection fill title="2-digit tickets">
          <TwoDigitTicketsCard
            siteId="fungames_shamo"
            onMessage={setMsg}
            onRefresh={() => void refreshAccountsAndBets()}
          />
        </SnapSection>
      )}

      <SnapSection fill title="Manual cash bet">
        <RainManualBetCard
          running={status?.running ?? false}
          config={cfg}
          accounts={accounts}
          onMessage={setMsg}
          onRefresh={() => void refreshAccountsAndBets()}
        />
      </SnapSection>

      <SnapSection fill title="Live view">
      <CollapsibleCard title="Live view — current draw & recent bets" defaultOpen={true}>
        <RainBetView freeBets={freeBets ?? undefined} cashBets={cashBets} config={cfg} autoRefresh={true} />
      </CollapsibleCard>
      </SnapSection>

      <SnapSection title="Play history">
      <CollapsibleCard title={`Playing with rains — prediction bets / free-bet plays (${playHistory ? playHistory.length : '…'})`} defaultOpen={false}>
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
      </CollapsibleCard>
      </SnapSection>

      <SnapSection title="Rain accounts">
      <CollapsibleCard title={`Rain-claiming accounts & balance (${accounts.length})`} defaultOpen={!isAdmin}>
        {accounts.length === 0 ? (
          <Empty label={isAdmin ? 'No rain accounts yet — add them on the Rain Accounts page.' : 'No rain account is assigned to you yet. Ask an admin to assign one.'} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Autoplay</TableHead>
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
                    <TableCell>
                      <Badge variant={acc.autoplay_enabled ? 'default' : 'secondary'}>
                        {acc.autoplay_enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
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
                      <div className="flex justify-end gap-2">
                        <Button
                          variant={acc.autoplay_enabled ? 'outline' : 'default'}
                          size="sm"
                          disabled={busyId === acc.id}
                          title={acc.autoplay_enabled
                            ? 'Disable autoplay — free bets + wallet not used by the engine'
                            : 'Enable autoplay — free bets + wallet usable by the engine'}
                          onClick={() => void onToggleAutoplay(acc)}
                        >
                          {busyId === acc.id ? '…' : acc.autoplay_enabled ? <><PowerOff className="size-3.5" /> Disable</> : <><Power className="size-3.5" /> Enable</>}
                        </Button>
                        <Button variant="outline" size="sm" disabled={busyId === acc.id} onClick={() => void onRefreshStatus(acc)}>
                          {busyId === acc.id ? '…' : 'Check status'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CollapsibleCard>
      </SnapSection>

      {isAdmin && showConfig && (
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
                  const v = Number(e.target.value);
                  setPickSpotsCount(v);
                  setPickSpots((prev) => prev.slice(0, v));
                }}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              >
                {Array.from({ length: 9 }, (_, i) => i + 2).map((n) => (
                  <option key={n} value={n}>{n} numbers</option>
                ))}
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
            {/* Sticky on phones: the board can be taller than the sheet, so
                the Play button stays pinned above the bottom edge instead of
                scrolling out of reach. */}
            <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-background px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:static sm:m-0 sm:border-0 sm:bg-transparent sm:p-0">
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
        <Modal title="Playable rain free bets" onClose={() => setShowFreeBets(false)} wide>
          <p className="mb-3 text-xs text-muted-foreground">
            Only available / failed free bets are listed here. The full ledger (played, won, lost,
            expired) is on the Rain accounts page.
          </p>
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
                    <TableHead>Spots</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerBets.slice(freeBetsPage * MODAL_PAGE_SIZE, (freeBetsPage + 1) * MODAL_PAGE_SIZE).map((b) => {
                    const s = SPOT_STATUS_LABEL[b.status] ?? { label: b.status, cls: 'bg-muted text-muted-foreground' };
                    const playable = isPlayableFreeBet(b);
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="whitespace-nowrap">
                          <span className="font-medium">{b.account_name ?? `#${b.account_id}`}</span>
                          {!b.account_enabled && <span className="ml-1 text-[10px] text-muted-foreground">(disabled)</span>}
                        </TableCell>
                        <TableCell>+{b.wager_amount} ETB</TableCell>
                        <TableCell>{b.closed_bet_count}</TableCell>
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
              <Pagination
                page={freeBetsPage}
                pageSize={MODAL_PAGE_SIZE}
                total={ledgerBets.length}
                onPage={setFreeBetsPage}
                unit="free bets"
              />
            </div>
          ) : (
            <Empty label="No playable free bets right now. Played, won, lost and expired rows are on the Rain accounts page." />
          )}
        </Modal>
      )}
    </SnapScroll>
  );
}