'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CloudRain,
  Play,
  RefreshCw,
  Repeat,
  ShieldCheck,
  Sparkles,
  Square,
  TrendingDown,
  Users,
  Wallet,
  Waypoints,
  Zap,
} from 'lucide-react';
import {
  autoplayStatus,
  checkAllRainStatus,
  getAccounts,
  getDraws,
  getOddsLive,
  getRainAccounts,
  getRainAutoplayStatus,
  getRainFreeBets,
  getRainPaymentChanges,
  getShamoBetStatus,
  getWithdrawalStatus,
  oddsPollNow,
  rainAutoplayStart,
  rainAutoplayStop,
  startAutoplay,
  stopAutoplay,
  syncBalances,
} from '@/lib/api';
import type {
  Account,
  AutoplayStatus,
  Draw,
  DrawsResponse,
  OddsLiveResponse,
  RainAccount,
  RainAutoplayStatus,
  RainFreeBet,
  ShamoBetStatus,
  WithdrawalEngineStatus,
} from '@/lib/types';
import { useSession } from '@/components/session-provider';
import { useSite } from '@/components/site-provider';
import { Card, PrettyNumbers, StatCard } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTime } from '@/lib/format';
import { isPlayableFreeBet } from '@/lib/freeBet';

// The home page is cross-site: it summarizes every surface this dashboard
// operates (factory autoplay, shamo rain, sports betting) and routes into them.
const SITES = [
  { id: 'fungames_tolobirr', name: 'ToloBirr', surface: 'Autoplay' },
  { id: 'casagames', name: 'CasaGames', surface: 'Autoplay' },
  { id: 'fungames_shamo', name: 'Shamo', surface: 'Rain' },
] as const;

// Each block is fetched and rendered on its own. A slow or hanging endpoint
// must never hold the whole page in a skeleton, so every request is timeboxed
// and the sections fill in as they arrive.
const REQUEST_TIMEOUT_MS = 12_000;

interface SiteStats {
  total: number;
  latest: Draw | null;
}

interface RainGroupData {
  status: RainAutoplayStatus | null;
  accounts: RainAccount[];
  freeBets: RainFreeBet[];
}

const EMPTY_RAIN: RainGroupData = { status: null, accounts: [], freeBets: [] };

interface HomeData {
  siteStats: Record<string, SiteStats | null>;
  tolobirrEngine: AutoplayStatus | null;
  casagamesEngine: AutoplayStatus | null;
  shamoRain: RainGroupData;
  funRain: RainGroupData;
  tolobirrAccounts: Account[];
  casagamesAccounts: Account[];
  odds: OddsLiveResponse | null;
  shamoBet: ShamoBetStatus | null;
  withdrawal: WithdrawalEngineStatus | null;
  pendingPayments: number | null;
}

async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

function timed<T>(promise: Promise<T>, ms = REQUEST_TIMEOUT_MS): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    void safe(promise).then((value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

function timeFromMs(ms?: number | null): string {
  return ms ? formatTime(new Date(ms).toISOString()) : '—';
}

function playableFreeBets(group: RainGroupData): number {
  const disabled = new Set(
    group.accounts.filter((a) => a.autoplay_enabled === false).map((a) => a.id),
  );
  return group.freeBets.filter((b) => isPlayableFreeBet(b) && !disabled.has(b.account_id)).length;
}

function balanceOf(accounts: { balance?: number }[]): number {
  return accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
}

function EngineCard({
  label,
  value,
  sub,
  tone,
  running,
  ready,
  busy,
  onToggle,
  toggleTitle,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: 'default' | 'positive' | 'negative' | 'accent';
  running: boolean;
  ready: boolean;
  busy: boolean;
  onToggle: () => void;
  toggleTitle: string;
}) {
  const toneClass = {
    default: 'text-foreground',
    positive: 'text-emerald-600 dark:text-emerald-400',
    negative: 'text-red-600 dark:text-red-400',
    accent: 'text-blue-600 dark:text-blue-400',
  }[tone];
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</div>
          {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
        </div>
        <Button
          size="sm"
          variant={running ? 'destructive' : 'default'}
          disabled={busy || !ready}
          onClick={onToggle}
          title={toggleTitle}
          aria-label={toggleTitle}
        >
          {busy ? '…' : running ? <Square /> : <Play />}
          <span className="hidden sm:inline">{running ? 'Stop' : 'Start'}</span>
        </Button>
      </div>
    </Card>
  );
}

function QuickLink({
  href,
  title,
  desc,
  icon: Icon,
  onClick,
}: {
  href: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="group flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-sm font-semibold text-foreground">
          {title}
          <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
        </span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
    </Link>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

export default function OverviewPage() {
  const { isAdmin, loading: sessionLoading } = useSession();
  const { setSiteId } = useSite();
  const router = useRouter();
  const [data, setData] = useState<Partial<HomeData>>({});
  const [msg, setMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    const patch = (p: Partial<HomeData>) => setData((d) => ({ ...d, ...p }));

    const loadSites = async () => {
      const [tolobirr, casagames, shamo] = await Promise.all([
        timed(getDraws('fungames_tolobirr', 1)),
        timed(getDraws('casagames', 1)),
        timed(getDraws('fungames_shamo', 1)),
      ]);
      const toStats = (res: DrawsResponse | null): SiteStats | null =>
        res ? { total: res.total, latest: res.draws[0] ?? null } : null;
      patch({
        siteStats: {
          fungames_tolobirr: toStats(tolobirr),
          casagames: toStats(casagames),
          fungames_shamo: toStats(shamo),
        },
      });
    };

    const loadEngines = async () => {
      const [tolobirr, casagames] = await Promise.all([
        timed(autoplayStatus('fungames_tolobirr')),
        timed(autoplayStatus('casagames')),
      ]);
      patch({ tolobirrEngine: tolobirr, casagamesEngine: casagames });
    };

    const loadRain = async () => {
      const [status, shamoAccounts, shamoBets, funAccounts, funBets] = await Promise.all([
        timed(getRainAutoplayStatus('shamo')),
        timed(getRainAccounts('shamo')),
        timed(getRainFreeBets(500, 'shamo')),
        timed(getRainAccounts('fungames')),
        timed(getRainFreeBets(500, 'fungames')),
      ]);
      patch({
        shamoRain: {
          status: status?.status ?? null,
          accounts: shamoAccounts?.accounts ?? [],
          freeBets: shamoBets?.bets ?? [],
        },
        funRain: {
          status: null,
          accounts: funAccounts?.accounts ?? [],
          freeBets: funBets?.bets ?? [],
        },
      });
    };

    const loadAccounts = async () => {
      const [tolobirr, casagames] = await Promise.all([
        timed(getAccounts('fungames_tolobirr')),
        timed(getAccounts('casagames')),
      ]);
      patch({
        tolobirrAccounts: tolobirr?.accounts ?? [],
        casagamesAccounts: casagames?.accounts ?? [],
      });
    };

    const loadBetting = async () => {
      const [odds, shamoBet, withdrawal, payments] = await Promise.all([
        timed(getOddsLive()),
        timed(getShamoBetStatus()),
        timed(getWithdrawalStatus()),
        timed(getRainPaymentChanges('pending')),
      ]);
      patch({
        odds,
        shamoBet,
        withdrawal: withdrawal?.status ?? null,
        pendingPayments: payments?.count ?? null,
      });
    };

    await Promise.allSettled([loadSites(), loadEngines(), loadRain(), loadAccounts(), loadBetting()]);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (sessionLoading || !isAdmin) return;
    const run = () => void load();
    const kick = setTimeout(run, 0);
    const timer = setInterval(run, 60_000);
    return () => {
      clearTimeout(kick);
      clearInterval(timer);
    };
  }, [load, sessionLoading, isAdmin]);

  function openSite(site: string, href: string) {
    setSiteId(site);
    router.push(href);
  }

  async function onToggleFactory(provider: 'fungames_tolobirr' | 'casagames', running: boolean) {
    setBusy(provider);
    setMsg('');
    try {
      if (running) await stopAutoplay(provider);
      else await startAutoplay(provider);
      setMsg(`${provider} autoplay ${running ? 'stopped' : 'started'}.`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onToggleShamoRain(running: boolean) {
    setBusy('shamo-rain');
    setMsg('');
    try {
      if (running) await rainAutoplayStop('shamo');
      else await rainAutoplayStart('shamo');
      setMsg(`Shamo rain autoplay ${running ? 'stopped' : 'started'}.`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onSyncBalances() {
    setBusy('sync');
    setMsg('');
    try {
      const res = await syncBalances();
      setMsg(
        `Balance sync: ${res.synced ?? res.count} synced` +
          (res.failed ? `, ${res.failed} failed` : '') +
          (res.deleted ? `, ${res.deleted} deleted` : '') +
          '.',
      );
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onCheckRain() {
    setBusy('rain-check');
    setMsg('');
    try {
      const res = await checkAllRainStatus('shamo');
      setMsg(`Reconnected ${res.reconnected} shamo rain account${res.reconnected === 1 ? '' : 's'}.`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onPollOdds() {
    setBusy('odds');
    setMsg('');
    try {
      await oddsPollNow();
      setMsg('Odds poll requested.');
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (sessionLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-5">
        <h2 className="text-lg font-bold text-foreground">Home</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <QuickLink href="/autoplay" title="Rain Autoplay" desc="Follow the rain and play your free bets." icon={CloudRain} />
          <QuickLink href="/withdrawal-account" title="Withdrawal Account" desc="Payment details and withdrawal requests." icon={Wallet} />
        </div>
      </div>
    );
  }

  const { tolobirrEngine, casagamesEngine, odds, shamoBet, withdrawal } = data;
  const shamoRain = data.shamoRain ?? EMPTY_RAIN;
  const funRain = data.funRain ?? EMPTY_RAIN;
  const tolobirrAccounts = data.tolobirrAccounts ?? [];
  const casagamesAccounts = data.casagamesAccounts ?? [];

  const rainAccounts = [...shamoRain.accounts, ...funRain.accounts];
  const enabledRainAccounts = rainAccounts.filter((a) => a.autoplay_enabled !== false);
  const rainBalance = balanceOf(enabledRainAccounts);
  const disabledRainCount = rainAccounts.length - enabledRainAccounts.length;
  const freeBets = playableFreeBets(shamoRain) + playableFreeBets(funRain);

  const oddsStatus = odds?.status;
  const betStatus = shamoBet;
  const withdrawalStatus = withdrawal;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Home</h2>
          <p className="text-sm text-muted-foreground">
            Cross-site operations: engines, wallets, draws and sports betting.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={refreshing} onClick={() => void load()}>
            <RefreshCw className={refreshing ? 'animate-spin' : ''} /> Refresh
          </Button>
          <Button size="sm" onClick={() => openSite('fungames_tolobirr', '/autoplay')}>
            <Repeat /> Open autoplay
          </Button>
        </div>
      </div>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void onSyncBalances()}>
          {busy === 'sync' ? '…' : 'Sync balances'}
        </Button>
        <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void onCheckRain()}>
          {busy === 'rain-check' ? '…' : 'Check rain status'}
        </Button>
        <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void onPollOdds()}>
          {busy === 'odds' ? '…' : 'Poll odds now'}
        </Button>
      </div>

      <Section title="Engines">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <EngineCard
            label="ToloBirr autoplay"
            value={tolobirrEngine ? (tolobirrEngine.running ? 'RUNNING' : 'IDLE') : '—'}
            sub={
              tolobirrEngine
                ? `${tolobirrEngine.connectedWorkers ?? 0}/${tolobirrEngine.workers ?? 0} sockets · ${tolobirrEngine.freshAccounts ?? 0} fresh tokens`
                : 'loading…'
            }
            tone={tolobirrEngine?.running ? 'positive' : 'default'}
            running={tolobirrEngine?.running ?? false}
            ready={!!tolobirrEngine}
            busy={busy === 'fungames_tolobirr'}
            onToggle={() => void onToggleFactory('fungames_tolobirr', tolobirrEngine?.running ?? false)}
            toggleTitle={tolobirrEngine?.running ? 'Stop ToloBirr autoplay' : 'Start ToloBirr autoplay'}
          />
          <EngineCard
            label="CasaGames autoplay"
            value={casagamesEngine ? (casagamesEngine.running ? 'RUNNING' : 'IDLE') : '—'}
            sub={
              casagamesEngine
                ? `${casagamesEngine.connectedWorkers ?? 0}/${casagamesEngine.workers ?? 0} sockets · ${casagamesEngine.freshAccounts ?? 0} fresh tokens`
                : 'loading…'
            }
            tone={casagamesEngine?.running ? 'positive' : 'default'}
            running={casagamesEngine?.running ?? false}
            ready={!!casagamesEngine}
            busy={busy === 'casagames'}
            onToggle={() => void onToggleFactory('casagames', casagamesEngine?.running ?? false)}
            toggleTitle={casagamesEngine?.running ? 'Stop CasaGames autoplay' : 'Start CasaGames autoplay'}
          />
          <EngineCard
            label="Shamo rain autoplay"
            value={shamoRain.status ? (shamoRain.status.running ? 'RUNNING' : 'IDLE') : '—'}
            sub={
              shamoRain.status
                ? `${shamoRain.status.totalPlayed} rounds played · last ${timeFromMs(shamoRain.status.lastRoundAt)}`
                : 'loading…'
            }
            tone={shamoRain.status?.running ? 'positive' : 'default'}
            running={shamoRain.status?.running ?? false}
            ready={!!shamoRain.status}
            busy={busy === 'shamo-rain'}
            onToggle={() => void onToggleShamoRain(shamoRain.status?.running ?? false)}
            toggleTitle={shamoRain.status?.running ? 'Stop Shamo rain autoplay' : 'Start Shamo rain autoplay'}
          />
          <StatCard
            label="Shamo bet engine"
            value={betStatus ? (betStatus.engine.running ? 'RUNNING' : betStatus.config.enabled ? 'ARMED' : 'IDLE') : '—'}
            tone={betStatus?.engine.running ? 'positive' : 'default'}
            sub={
              betStatus
                ? `mode ${betStatus.config.mode} · ${betStatus.placedToday} placed today · ${betStatus.stakeUsedToday} ETB staked`
                : 'loading…'
            }
          />
        </div>
      </Section>

      <Section title="Wallets & pools">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Rain wallets"
            value={`${rainBalance.toFixed(2)} ETB`}
            tone="accent"
            sub={
              rainAccounts.length === 0
                ? 'no rain accounts yet'
                : disabledRainCount
                  ? `${enabledRainAccounts.length} enabled · ${disabledRainCount} disabled`
                  : `${enabledRainAccounts.length} accounts · ${shamoRain.accounts.length} shamo · ${funRain.accounts.length} fungames`
            }
          />
          <StatCard
            label="Playable free bets"
            value={freeBets}
            sub={`${playableFreeBets(shamoRain)} shamo · ${playableFreeBets(funRain)} fungames`}
          />
          <StatCard
            label="ToloBirr accounts"
            value={tolobirrAccounts.length}
            sub={`${balanceOf(tolobirrAccounts).toFixed(2)} ETB across the pool`}
          />
          <StatCard
            label="CasaGames accounts"
            value={casagamesAccounts.length}
            sub={`${balanceOf(casagamesAccounts).toFixed(2)} ETB across the pool`}
          />
          <StatCard
            label="Withdrawals"
            value={`${withdrawalStatus?.active ?? 0} active · ${withdrawalStatus?.queued ?? 0} queued`}
            tone={withdrawalStatus?.lastError ? 'negative' : 'default'}
            sub={
              withdrawalStatus
                ? `${withdrawalStatus.succeeded} succeeded · ${withdrawalStatus.failed} failed` +
                  (data.pendingPayments ? ` · ${data.pendingPayments} payment change${data.pendingPayments === 1 ? '' : 's'} pending` : '')
                : 'loading…'
            }
          />
          <StatCard
            label="Shamo bet queue"
            value={betStatus?.pending ?? '—'}
            sub={
              betStatus
                ? `${betStatus.claimed} claimed · ${betStatus.placedToday} placed today`
                : 'loading…'
            }
          />
        </div>
      </Section>

      <Section title="Sports betting">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Odd-drop watcher"
            value={oddsStatus ? (oddsStatus.running ? 'RUNNING' : oddsStatus.enabled ? 'ARMED' : 'IDLE') : '—'}
            tone={oddsStatus?.lastError ? 'negative' : oddsStatus?.running ? 'positive' : 'default'}
            sub={oddsStatus ? `last poll ${formatTime(oddsStatus.lastPollAt)}` : 'loading…'}
          />
          <StatCard
            label="Drops (60 min)"
            value={odds?.drops.length ?? '—'}
            sub={`${odds?.suggestions.length ?? 0} active suggestion${(odds?.suggestions.length ?? 0) === 1 ? '' : 's'}`}
          />
          <StatCard
            label="Bookie coverage"
            value={oddsStatus ? `${oddsStatus.matchedFootball}/${oddsStatus.melbetFootball}` : '—'}
            sub={oddsStatus ? `${oddsStatus.melbetEvents} melbet · ${oddsStatus.shamoEvents} shamo events` : 'loading…'}
          />
          <StatCard
            label="Shamo session"
            value={betStatus ? (betStatus.botTokenSet ? 'READY' : 'MISSING') : '—'}
            tone={betStatus ? (betStatus.botTokenSet ? 'positive' : 'negative') : 'default'}
            sub={betStatus?.engine.lastTickAt ? `last tick ${formatTime(betStatus.engine.lastTickAt)}` : 'no tick yet'}
          />
        </div>
        {oddsStatus?.lastError && (
          <p className="text-xs text-red-600 dark:text-red-400">Odds watcher: {oddsStatus.lastError}</p>
        )}
      </Section>

      <Section title="Keno sites">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {SITES.map((site) => {
            const stats = data.siteStats?.[site.id] ?? null;
            const latest = stats?.latest;
            return (
              <Card key={site.id} title={site.name}>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-xl font-bold text-foreground">{stats?.total ?? '—'}</div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">draws</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground">
                        {latest ? formatTime(latest.drawnAt) : '—'}
                      </div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">last draw</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-foreground">{latest?.roundNo ?? '—'}</div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">round</div>
                    </div>
                  </div>
                  {latest?.results?.length ? (
                    <PrettyNumbers nums={latest.results} />
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {stats ? 'No draws recorded yet.' : 'Loading draws…'}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openSite(site.id, '/stats')}>
                      <BarChart3 /> Stats
                    </Button>
                    <Button size="sm" onClick={() => openSite(site.id, '/autoplay')}>
                      {site.surface === 'Rain' ? <CloudRain /> : <Repeat />} {site.surface}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </Section>

      <Section title="Quick links">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink
            href="/autoplay"
            title="Shamo rain autoplay"
            desc="Claim rain and play free bets."
            icon={CloudRain}
            onClick={() => setSiteId('fungames_shamo')}
          />
          <QuickLink
            href="/autoplay"
            title="ToloBirr autoplay"
            desc="Factory WS autoplay engine."
            icon={Repeat}
            onClick={() => setSiteId('fungames_tolobirr')}
          />
          <QuickLink
            href="/autoplay"
            title="CasaGames autoplay"
            desc="Independent WS autoplay engine."
            icon={Repeat}
            onClick={() => setSiteId('casagames')}
          />
          <QuickLink href="/rain-accounts" title="Rain accounts" desc="Accounts, free bets, withdrawals." icon={Users} />
          <QuickLink href="/accounts" title="Accounts pool" desc="Create and inspect factory accounts." icon={Users} />
          <QuickLink href="/predictions" title="Predictions" desc="ML / temporal tickets per site." icon={Sparkles} />
          <QuickLink href="/odds" title="Odd drops & Shamo Bet" desc="Drops, suggestions, bet queue." icon={TrendingDown} />
          <QuickLink href="/withdrawal-account" title="Withdrawal account" desc="Payment details and requests." icon={Wallet} />
          <QuickLink href="/stats" title="Stats" desc="Draw statistics per site." icon={BarChart3} />
          <QuickLink href="/patterns" title="Patterns" desc="Pattern analysis per site." icon={Waypoints} />
          <QuickLink href="/telebeat" title="TeleBeat" desc="Account rotation and telemetry." icon={Zap} />
          <QuickLink href="/proxies" title="Proxies" desc="Proxy pool health." icon={ShieldCheck} />
        </div>
      </Section>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Activity className="h-3.5 w-3.5" /> Auto-refreshes every 60 seconds.
      </p>
    </div>
  );
}
