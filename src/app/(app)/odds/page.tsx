'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, ExternalLink, Play, RotateCw, TrendingDown, Ticket, ShieldCheck, Ban } from 'lucide-react';
import {
  getOddsLive,
  getOddsConfig,
  setOddsConfig,
  oddsPollNow,
  oddsCalibrate,
  getShamoBetStatus,
  getShamoBetOrders,
  getShamoBets,
  setShamoBetConfig,
  cancelShamoBetOrder,
  requeueShamoBetOrder,
  createShamoBetOrder,
  pushTest,
  type OddsLiveResponse,
} from '@/lib/api';
import { useApi } from '@/lib/hooks';
import {
  isPushActive,
  pushSupported,
  subscribePush,
  unsubscribePush,
  rePostSubscription,
} from '@/lib/push';
import { Button } from '@/components/ui/button';
import { Card, Empty, ErrorBox, Loading, StatCard, Badge } from '@/components/app';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatTime } from '@/lib/format';
import type {
  OddsDrop,
  OddsSuggestion,
  OddsWatcherConfig,
  ShamoBetConfig,
  ShamoBetOrder,
  ShamoBetRecord,
  ShamoBetStatus,
} from '@/lib/types';

// Live odd-drop monitor + soccer suggester. Watches the melbet feed for priced
// drops (>= configured %), flags "steam" when the same market drops again, and
// cross-references shamo prices so the user can bet the lagging bookie.
// Polls every 5s; new drops red-flash as they arrive.

const POLL_MS = 5000;
const FLASH_MS = 2600;

export default function OddsPage() {
  const live = useApi<OddsLiveResponse>(() => getOddsLive(), []);
  const cfgApi = useApi<OddsWatcherConfig>(() => getOddsConfig(), []);
  const [polling, setPolling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [flashIds, setFlashIds] = useState<Set<number>>(new Set());
  const [calMsg, setCalMsg] = useState('');
  const [queueMsg, setQueueMsg] = useState('');

  // Manual "Queue bet" from a suggestion card (bypasses edge/cooldown rules —
  // the admin clicked it on purpose; the extension still confirm-firsts it).
  async function onQueueSuggestion(id: number) {
    try {
      const order = await createShamoBetOrder(id);
      setQueueMsg(
        `Queued order #${order.id} — ${order.home} vs ${order.away} · ${order.outcomeLabel ?? order.outcome} @ ${order.quotedOdd}`,
      );
    } catch (e) {
      setQueueMsg(e instanceof Error ? e.message : 'Could not queue order');
    }
    setTimeout(() => setQueueMsg(''), 6000);
  }

  // Push (Chrome) drop alerts — reuses the win-flag subscription.
  const [pushOn, setPushOn] = useState(() => isPushActive());
  useEffect(() => {
    void (async () => {
      const ok = await rePostSubscription();
      if (ok) setPushOn(true);
    })();
  }, []);

  async function onTogglePush() {
    if (pushOn) {
      await unsubscribePush();
      setPushOn(false);
      return;
    }
    if (pushSupported() && (await subscribePush())) setPushOn(true);
  }

  // Live poll loop.
  useEffect(() => {
    const t = setInterval(() => live.refresh(), POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Red-flash drops as they arrive. New ids are staged into state via async
  // timers (no synchronous setState in the effect body); refs are only touched
  // inside the effect/cleanup, never during render.
  const seen = useRef<Set<number>>(new Set());
  useEffect(() => {
    const fresh: number[] = [];
    for (const d of live.data?.drops || []) {
      if (d.id == null || seen.current.has(d.id)) continue;
      seen.current.add(d.id);
      fresh.push(d.id);
    }
    if (fresh.length === 0) return;
    const addT = setTimeout(() => {
      setFlashIds((prev) => new Set([...prev, ...fresh]));
    }, 0);
    const clearT = setTimeout(() => {
      setFlashIds((prev) => {
        const next = new Set(prev);
        for (const id of fresh) next.delete(id);
        return next;
      });
    }, FLASH_MS);
    return () => {
      clearTimeout(addT);
      clearTimeout(clearT);
    };
  }, [live.data]);

  async function onPollNow() {
    setPolling(true);
    try {
      await oddsPollNow();
      await live.refresh();
    } finally {
      setPolling(false);
    }
  }

  async function onSaveConfig() {
    const base = cfgApi.data;
    if (!base) return;
    setSaving(true);
    try {
      const merged = { ...base, ...(overrides ?? {}) };
      await setOddsConfig(merged);
      setOverrides(null);
      await cfgApi.refresh();
      await live.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function onCalibrate() {
    setCalibrating(true);
    setCalMsg('');
    try {
      const r = await oddsCalibrate();
      setCalMsg(`Calibrated ${r.samples} sample(s) → ${Object.keys(r.sides).length} bet_type→side mapping(s): ${JSON.stringify(r.sides)}`);
      await live.refresh();
    } catch (e) {
      setCalMsg(e instanceof Error ? e.message : 'Calibration failed');
    } finally {
      setCalibrating(false);
    }
  }

  // Config draft = server values + local overrides (no state-sync effect; the
  // ConfigTab just edits the overlay until Save posts it).
  const [overrides, setOverrides] = useState<Partial<OddsWatcherConfig> | null>(null);
  const draft: OddsWatcherConfig | null = cfgApi.data
    ? { ...cfgApi.data, ...(overrides ?? {}) }
    : null;
  const patchDraft = (p: Partial<OddsWatcherConfig>) =>
    setOverrides((prev) => ({ ...(prev ?? {}), ...p }));

  const status = live.data?.status;
  const drops = live.data?.drops || [];
  const suggestions = live.data?.suggestions || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground">Odd Drops & Soccer Suggestions</h2>
          <p className="text-xs text-muted-foreground">
            Melbet drops signal a move · Shamo is where the bet lands (lagging price = value)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Live · refreshes every {POLL_MS / 1000}s
          </span>
          <Button variant="outline" onClick={onPollNow} disabled={polling}>
            <RotateCw className={polling ? 'animate-spin' : ''} /> Poll now
          </Button>
          <Button variant={pushOn ? 'default' : 'outline'} onClick={onTogglePush}>
            <Bell /> Push {pushOn ? 'on' : 'off'}
          </Button>
        </div>
      </div>

      {/* ── status strip ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Watcher"
          value={status ? (status.enabled ? 'Enabled' : 'Disabled') : '—'}
          tone={status?.enabled ? 'positive' : 'default'}
          sub={status?.lastPollOk ? `last poll ${formatTime(status.lastPollAt)}` : status?.lastError ? `error: ${status.lastError}` : 'polling…'}
        />
        <StatCard
          label="Feeds"
          value={
            status ? (
              <span className="text-base">
                M{status.melbetEvents} · S{status.shamoEvents}
              </span>
            ) : (
              '—'
            )
          }
          sub={status ? `melbet ${formatTime(status.lastMelbetAt)} · shamo ${formatTime(status.lastShamoAt)}` : '—'}
        />
        <StatCard
          label="Football coverage"
          value={status ? `${status.matchedFootball}/${status.melbetFootball}` : '—'}
          tone={status && status.matchedFootball > 0 ? 'positive' : 'default'}
          sub={
            status
              ? `${status.shamoFootball} football on shamo · ${status.shamoLeagueCount ?? 0} leagues named`
              : '—'
          }
        />
        <StatCard
          label="Drops / Suggestions"
          value={
            <span className="text-base">
              {drops.length} / {suggestions.length}
            </span>
          }
          tone={drops.length > 0 ? 'negative' : 'default'}
          sub="in last window"
        />
      </div>

      {status && !status.configured && (
        <ErrorBox message="Watcher is not configured: set MELBET_URL and SHAMO_URL in the server .env, then restart it." />
      )}
      {status && !status.lastPollOk && status.lastError && (
        <ErrorBox message={`Latest tick error: ${status.lastError}`} />
      )}

      {queueMsg && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {queueMsg}
        </div>
      )}

      <Tabs defaultValue="drops">
        <TabsList>
          <TabsTrigger value="drops">Drops ({drops.length})</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions ({suggestions.length})</TabsTrigger>
          <TabsTrigger value="bets">Bet slips</TabsTrigger>
          <TabsTrigger value="config">Watcher config</TabsTrigger>
        </TabsList>

        <TabsContent value="drops">
          <DropsTab drops={drops} loading={live.loading} error={live.error} flashIds={flashIds} />
        </TabsContent>

        <TabsContent value="suggestions">
          <SuggestionsTab
            suggestions={suggestions}
            loading={live.loading}
            error={live.error}
            onQueue={onQueueSuggestion}
          />
        </TabsContent>

        <TabsContent value="bets">
          <BetsTab />
        </TabsContent>

        <TabsContent value="config">
          <ConfigTab
            draft={draft}
            onDraft={patchDraft}
            onSave={onSaveConfig}
            saving={saving}
            onCalibrate={onCalibrate}
            calibrating={calibrating}
            calMsg={calMsg}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function DropsTab({
  drops,
  loading,
  error,
  flashIds,
}: {
  drops: OddsDrop[];
  loading: boolean;
  error: string;
  flashIds: Set<number>;
}) {
  return (
    <Card title={`Odds drops (${drops.length})`} actions={<TrendingDown className="h-4 w-4 text-red-500" />}>
      {loading && !drops.length ? (
        <Loading rows={5} />
      ) : error && !drops.length ? (
        <ErrorBox message={error} />
      ) : drops.length === 0 ? (
        <Empty label="No drops in the window yet. When a melbet market falls ≥ the configured % it will red-flash here (and push to your browser if enabled)." />
      ) : (
        <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
          {drops.map((d, i) => {
            const flash = d.id != null && flashIds.has(d.id);
            const dropPct = Math.abs(d.pctChange);
            return (
              <div
                key={d.id ?? `${d.externalId}-${i}`}
                className={`rounded-lg border p-3 transition-colors ${
                  flash ? 'border-red-500/60 bg-red-500/10' : 'border-border bg-card'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {d.home} <span className="text-muted-foreground">vs</span> {d.away}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {d.sport} · {d.country ? `${d.country} · ` : ''}
                      {d.league} · {formatTime(d.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.steam && (
                      <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        STEAM
                      </Badge>
                    )}
                    <Badge variant="outline" className="font-mono">
                      {d.marketLabel ?? d.marketKey}
                    </Badge>
                    {d.url && (
                      <Button asChild variant="outline" size="xs">
                        <a href={d.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink /> Shamo
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="font-medium text-foreground">{d.outcomeLabel ?? d.outcome}</span>
                  <span className="font-mono text-muted-foreground">
                    {d.prevOdd.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-mono font-semibold text-red-500">{d.newOdd.toFixed(2)}</span>
                  <span
                    className={`text-xs font-semibold ${flash ? 'text-red-500' : 'text-red-400'}`}
                  >
                    -{dropPct.toFixed(1)}%
                  </span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {d.source} · {d.marketKey}/{d.outcome}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function SuggestionsTab({
  suggestions,
  loading,
  error,
  onQueue,
}: {
  suggestions: OddsSuggestion[];
  loading: boolean;
  error: string;
  onQueue?: (suggestionId: number) => void;
}) {
  return (
    <Card title={`Soccer suggestions (${suggestions.length})`}>
      {loading && !suggestions.length ? (
        <Loading rows={5} />
      ) : error && !suggestions.length ? (
        <ErrorBox message={error} />
      ) : suggestions.length === 0 ? (
        <Empty label="No suggestions right now. A suggestion needs a melbet drop on a match shamo also offers — big-league nights when both bookies share fixtures will light this up. Coverage is shown in the status cards above." />
      ) : (
        <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
          {suggestions.map((s) => {
            const gap =
              s.shamoOdd && s.melbetCurrent > 0 ? ((s.shamoOdd - s.melbetCurrent) / s.melbetCurrent) * 100 : null;
            return (
              <div key={s.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {s.home} <span className="text-muted-foreground">vs</span> {s.away}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {s.country ? `${s.country} · ` : ''}
                      {s.league} · kickoff {formatTime(s.startTs)} · expires{' '}
                      {formatTime(s.expiresAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.steam && (
                      <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        STEAM
                      </Badge>
                    )}
                    <Badge className="bg-violet-500/15 text-violet-600 dark:text-violet-400">
                      score {s.score.toFixed(1)}
                    </Badge>
                    {s.shamoUrl && (
                      <Button asChild variant="outline" size="xs">
                        <a href={s.shamoUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink /> Shamo
                        </a>
                      </Button>
                    )}
                    {s.melbetUrl && (
                      <Button asChild variant="outline" size="xs">
                        <a href={s.melbetUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink /> Melbet
                        </a>
                      </Button>
                    )}
                    {onQueue && s.shamoUrl && (
                      <Button size="xs" onClick={() => onQueue(s.id)}>
                        <Ticket /> Queue bet
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="font-medium">{s.outcomeLabel ?? s.outcome}</span>
                  <span className="font-mono text-muted-foreground">
                    melbet {s.melbetOdd.toFixed(2)} → {s.melbetCurrent.toFixed(2)}
                  </span>
                  {s.shamoOdd ? (
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      shamo {s.shamoOdd.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">no shamo price</span>
                  )}
                  {gap != null && gap > 0 && (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      +{gap.toFixed(1)}% edge vs melbet
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    dropped {Math.abs(s.dropPct).toFixed(1)}%
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{s.reason}</p>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ConfigTab({
  draft,
  onDraft,
  onSave,
  saving,
  onCalibrate,
  calibrating,
  calMsg,
}: {
  draft: OddsWatcherConfig | null;
  onDraft: (p: Partial<OddsWatcherConfig>) => void;
  onSave: () => void;
  saving: boolean;
  onCalibrate: () => void;
  calibrating: boolean;
  calMsg: string;
}) {
  if (!draft) return <Loading rows={4} />;
  const num = (key: keyof OddsWatcherConfig, label: string, step = 1, min = 0) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step={step}
        min={min}
        value={String(draft[key] ?? '')}
        onChange={(e) => onDraft({ [key]: parseFloat(e.target.value) || 0 })}
      />
    </div>
  );
  return (
    <Card title="Watcher config" actions={<Play className="h-4 w-4" />}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {num('pollIntervalMs', 'Poll interval (ms)', 1000, 5000)}
        {num('dropPct', 'Drop threshold (fraction)', 0.01, 0.001)}
        {num('steamWindowMin', 'Steam window (min)', 1)}
        {num('dropWindowMin', 'Drop window (min)', 1)}
        {num('matchToleranceMin', 'Match tolerance (min)', 1)}
        {num('maxSuggestions', 'Max suggestions', 1)}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant={draft.enabled ? 'default' : 'outline'}
          onClick={() => onDraft({ enabled: !draft.enabled })}
        >
          {draft.enabled ? 'Watcher enabled' : 'Watcher disabled'}
        </Button>
        <Button
          variant={draft.pushEnabled ? 'default' : 'outline'}
          onClick={() => onDraft({ pushEnabled: !draft.pushEnabled })}
        >
          <Bell /> Drop push {draft.pushEnabled ? 'enabled' : 'disabled'} (server)
        </Button>
        <Button onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save config'}
        </Button>
        <Button variant="outline" onClick={onCalibrate} disabled={calibrating}>
          <RotateCw className={calibrating ? 'animate-spin' : ''} /> Re-calibrate shamo sides
        </Button>
      </div>
      {calMsg && <p className="mt-3 text-xs text-muted-foreground">{calMsg}</p>}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Shamo&apos;s win_odds only expose numeric bet_types; the side mapping (1/X/2) is
        auto-learned by comparing shamo prices to melbet 1X2 on matched matches.
      </p>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

// Shamo sports bet slips: config + engine status, the order queue (what the
// extension is working through) and the placed/attempted audit log. The
// extension polls /api/odds/bot/* directly with the X-Bot-Token.
const ORDER_TONE: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  claimed: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  placed: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  rejected: 'bg-zinc-500/15 text-zinc-500 dark:text-zinc-400',
  failed: 'bg-red-500/15 text-red-600 dark:text-red-400',
  expired: 'bg-zinc-500/15 text-zinc-500 dark:text-zinc-400',
  cancelled: 'bg-zinc-500/15 text-zinc-500 dark:text-zinc-400',
};

function BetsTab() {
  const statusApi = useApi<ShamoBetStatus>(() => getShamoBetStatus(), []);
  const ordersApi = useApi<ShamoBetOrder[]>(() => getShamoBetOrders(50), []);
  const betsApi = useApi<ShamoBetRecord[]>(() => getShamoBets(50), []);
  const [overrides, setOverrides] = useState<Partial<ShamoBetConfig> | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const t = setInterval(() => {
      statusApi.refresh();
      ordersApi.refresh();
    }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = statusApi.data;
  const cfg = status?.config ?? null;
  const draft: ShamoBetConfig | null = cfg ? { ...cfg, ...(overrides ?? {}) } : null;
  const patchDraft = (p: Partial<ShamoBetConfig>) =>
    setOverrides((prev) => ({ ...(prev ?? {}), ...p }));

  async function onSave() {
    if (!draft) return;
    setSaving(true);
    try {
      await setShamoBetConfig(draft);
      setOverrides(null);
      await statusApi.refresh();
      setMsg('Config saved');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onCancel(id: number) {
    setBusyId(id);
    try {
      await cancelShamoBetOrder(id);
      await Promise.all([ordersApi.refresh(), statusApi.refresh()]);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setBusyId(null);
    }
  }

  async function onRequeue(id: number) {
    setBusyId(id);
    try {
      await requeueShamoBetOrder(id);
      await Promise.all([ordersApi.refresh(), statusApi.refresh()]);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Requeue failed');
    } finally {
      setBusyId(null);
    }
  }

  async function onTestPush() {
    setMsg('Sending test push…');
    const r = await pushTest();
    if (r.ok && r.subscriptions > 0) {
      setMsg(`Test push sent to ${r.subscriptions} browser(s) — check for a Chrome notification.`);
    } else if (r.error) {
      setMsg(r.error);
    } else {
      setMsg('No push subscriptions yet — click “Push on” at the top of this page, allow notifications, then retry.');
    }
  }

  const orders = ordersApi.data ?? [];
  const bets = betsApi.data ?? [];
  const dryRun = status?.engine.dryRun ?? [];

  const num = (key: keyof ShamoBetConfig, label: string, step = 1, min = 0) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step={step}
        min={min}
        value={String(draft?.[key] ?? '')}
        onChange={(e) =>
          patchDraft({ [key]: parseFloat(e.target.value) || 0 } as Partial<ShamoBetConfig>)
        }
      />
    </div>
  );

  return (
    <div className="space-y-4">
      {msg && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {msg}
        </div>
      )}

      <Card title="Bet engine" actions={<ShieldCheck className="h-4 w-4 text-emerald-500" />}>
        {statusApi.loading && !status ? (
          <Loading rows={3} />
        ) : statusApi.error && !status ? (
          <ErrorBox message={statusApi.error} />
        ) : !draft ? null : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard
                label="Engine"
                value={draft.enabled ? 'Enabled' : 'Disabled'}
                tone={draft.enabled ? 'positive' : 'default'}
                sub={status?.engine.running ? 'loop running' : 'loop idle'}
              />
              <StatCard label="Mode" value={draft.mode} sub="confirm asks · auto places · dry-run previews" />
              <StatCard
                label="Today"
                value={`${status?.placedToday ?? 0} bets`}
                sub={`${(status?.stakeUsedToday ?? 0).toFixed(0)} stake used`}
              />
              <StatCard
                label="Queue"
                value={`${status?.pending ?? 0} pending`}
                sub={`${status?.claimed ?? 0} claimed by extension`}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {num('stakePerBet', 'Stake per bet', 1, 1)}
              {num('minEdgePct', 'Min edge (%)', 0.1, 0)}
              {num('maxDayStake', 'Max daily stake', 10, 1)}
              {num('maxBetsPerDay', 'Max bets / day', 1, 1)}
              {num('cooldownMin', 'Cooldown (min)', 1, 0)}
              {num('orderTtlMin', 'Order TTL (min)', 1, 1)}
              {num('maxOddDriftPct', 'Max odd drift (%)', 0.1, 0)}
              <div className="space-y-1">
                <Label className="text-xs">Bot token (extension)</Label>
                <Input
                  type="password"
                  placeholder="shared secret"
                  value={draft.botToken}
                  onChange={(e) => patchDraft({ botToken: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                variant={draft.enabled ? 'default' : 'outline'}
                onClick={() => patchDraft({ enabled: !draft.enabled })}
              >
                {draft.enabled ? 'Engine enabled' : 'Engine disabled'}
              </Button>
              {(['confirm', 'auto', 'dry-run'] as const).map((m) => (
                <Button
                  key={m}
                  variant={draft.mode === m ? 'default' : 'outline'}
                  onClick={() => patchDraft({ mode: m })}
                >
                  {m}
                </Button>
              ))}
              <Button onClick={onSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save config'}
              </Button>
            </div>
            {!status?.botTokenSet && (
              <p className="mt-3 text-xs text-red-500">
                No bot token set — the extension cannot reach /api/odds/bot/* until you set one
                here or via SHAMO_BET_BOT_TOKEN in the server .env.
              </p>
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">
              The engine only queues orders that pass the edge/cooldown/daily-cap rules. Money is
              never auto-spent unless mode is auto AND the extension is running with a logged-in
              shamo.bet tab. dry-run previews what would queue without risking anything.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <Button variant="outline" size="sm" onClick={onTestPush}>
                <Bell className="mr-1.5 h-3.5 w-3.5" />
                Send test push
              </Button>
              <span className="text-[11px] text-muted-foreground">
                Browser push alerts you on odd drops and when bet slips are generated. Enable it with
                the “Push on” button at the top of this page and allow notifications, then verify with
                the test button. The Chrome extension notifies separately on the same events.
              </span>
            </div>
          </>
        )}

        {dryRun.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
              Dry-run: would queue ({dryRun.length})
            </p>
            <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {dryRun.map((d, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-card px-3 py-2 text-xs"
                >
                  <span className="font-medium text-foreground">
                    {d.home} vs {d.away}
                  </span>
                  <span className="text-muted-foreground">{d.outcomeLabel ?? d.outcome}</span>
                  <span className="font-mono">@{d.quotedOdd.toFixed(2)}</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    +{d.edgePct.toFixed(1)}%
                  </span>
                  <span className="ml-auto font-mono text-muted-foreground">
                    stake {d.stake.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card title={`Bet orders (${orders.length})`} actions={<Ticket className="h-4 w-4 text-violet-500" />}>
        {ordersApi.loading && !orders.length ? (
          <Loading rows={4} />
        ) : ordersApi.error && !orders.length ? (
          <ErrorBox message={ordersApi.error} />
        ) : orders.length === 0 ? (
          <Empty label="No bet orders yet. Fresh suggestions that pass the edge/cooldown/cap rules queue automatically; you can also hit 'Queue bet' on any suggestion card." />
        ) : (
          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {orders.map((o) => (
              <div key={o.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">
                      #{o.id} · {o.home} <span className="text-muted-foreground">vs</span> {o.away}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {o.country ? `${o.country} · ` : ''}
                      {o.league} · created {formatTime(o.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={ORDER_TONE[o.status] ?? ''}>{o.status}</Badge>
                    {o.shamoUrl && (
                      <Button asChild variant="outline" size="xs">
                        <a href={o.shamoUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink /> Shamo
                        </a>
                      </Button>
                    )}
                    {o.ticketId && (
                      <Badge variant="outline" className="font-mono">
                        ticket {o.ticketId}
                      </Badge>
                    )}
                    {(o.status === 'pending' || o.status === 'claimed') && (
                      <Button size="xs" variant="outline" disabled={busyId === o.id} onClick={() => onCancel(o.id)}>
                        <Ban /> Cancel
                      </Button>
                    )}
                    {['expired', 'cancelled', 'rejected', 'failed'].includes(o.status) && (
                      <Button size="xs" variant="outline" disabled={busyId === o.id} onClick={() => onRequeue(o.id)}>
                        <RotateCw /> Requeue
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="font-medium">{o.outcomeLabel ?? o.outcome}</span>
                  <span className="font-mono text-muted-foreground">said {o.quotedOdd.toFixed(2)}</span>
                  {o.actualOdd != null && (
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      placed @ {o.actualOdd.toFixed(2)}
                    </span>
                  )}
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    +{o.edgePct.toFixed(1)}%
                  </span>
                  <span className="font-mono text-muted-foreground">stake {o.stake.toFixed(1)}</span>
                  {o.action === 'auto' && <Badge variant="outline">auto</Badge>}
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {o.expiresAt ? `expires ${formatTime(o.expiresAt)}` : ''}
                  </span>
                </div>
                {o.error && <p className="mt-1.5 text-xs text-red-500">{o.error}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={`Placed / attempted (${bets.length})`}>
        {betsApi.loading && !bets.length ? (
          <Loading rows={3} />
        ) : betsApi.error && !bets.length ? (
          <ErrorBox message={betsApi.error} />
        ) : bets.length === 0 ? (
          <Empty label="Nothing reported yet. Once the extension places (or skips/fails) an order, the result lands here." />
        ) : (
          <div className="max-h-[40vh] space-y-1.5 overflow-y-auto pr-1">
            {bets.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                <Badge className={ORDER_TONE[b.state] ?? ''}>{b.state}</Badge>
                <span className="font-mono text-xs">#{b.orderId}</span>
                {b.ticketId && <span className="font-mono text-xs">ticket {b.ticketId}</span>}
                <span className="font-mono text-muted-foreground">stake {b.stake.toFixed(1)}</span>
                {b.quotedOdd != null && (
                  <span className="font-mono text-muted-foreground">said {b.quotedOdd.toFixed(2)}</span>
                )}
                {b.actualOdd != null && (
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    @ {b.actualOdd.toFixed(2)}
                  </span>
                )}
                {b.message && <span className="text-xs text-muted-foreground">{b.message}</span>}
                <span className="ml-auto text-[10px] text-muted-foreground">{formatTime(b.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}