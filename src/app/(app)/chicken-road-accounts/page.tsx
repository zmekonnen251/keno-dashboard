'use client';

import { useEffect, useState } from 'react';
import {
  getChickenRoadAccounts,
  createChickenRoadAccount,
  updateChickenRoadAccount,
  deleteChickenRoadAccount,
  refreshChickenRoadAccount,
  checkAllChickenRoadStatus,
  getChickenRoadClaims,
  setChickenRoadAutoplayConfig,
  chickenRoadAutoplayStart,
  chickenRoadAutoplayStop,
  getChickenRoadAutoplayStatus,
  playNowChickenRoadRound,
  getChickenRoadFreeBets,
  getChickenRoadRounds,
} from '@/lib/api';
import type {
  ChickenRoadAccount,
  ChickenRoadProvider,
  ChickenRoadClaimRecord,
  ChickenRoadAutoplayConfig,
  ChickenRoadFreeBet,
  ChickenRoadAutoplayStatus,
  ChickenRoadRiskLevel,
  ChickenRoadRiskPreset,
  ChickenRoadRound,
} from '@/lib/types';
import { useApi } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, Empty, ErrorBox, Loading, Badge, TableCell, TableRow } from '@/components/app';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
} from '@/components/ui/table';
import { Modal } from '@/components/ui/modal';
import { formatTime } from '@/lib/format';

const GATEWAY_HOSTS: Record<ChickenRoadProvider, string> = {
  chicken_road: 'gateway.fungames.live',
};

const PROVIDERS: ChickenRoadProvider[] = ['chicken_road'];

const SPOT_STATUS_LABEL: Record<ChickenRoadFreeBet['status'], { label: string; cls: string }> = {
  available: { label: 'Available', cls: 'bg-emerald-600 text-white' },
  claiming: { label: 'Claiming', cls: 'bg-amber-500 text-black' },
  bet_placed: { label: 'Bet placed', cls: 'bg-sky-600 text-white' },
  won: { label: 'Won', cls: 'bg-emerald-600 text-white' },
  lost: { label: 'Lost', cls: 'bg-zinc-600 text-white' },
  failed: { label: 'Failed', cls: 'bg-rose-600 text-white' },
  expired: { label: 'Expired', cls: 'bg-muted text-muted-foreground' },
};

const ROUND_STATUS_LABEL: Record<ChickenRoadRound['status'], string> = {
  placed: 'Placed',
  cashed_out: 'Cashed out',
  died: 'Died',
  reached_end: 'Reached end',
  failed: 'Failed',
};

function ProviderBadge({ provider }: { provider: ChickenRoadProvider }) {
  return (
    <Badge className="bg-purple-600 text-white" variant="secondary">
      {provider}
    </Badge>
  );
}

function StatusBadge({ acc }: { acc: ChickenRoadAccount }) {
  if (acc.connected) {
    return <Badge className="bg-emerald-600 text-white">Connected</Badge>;
  }
  const detail =
    acc.lastError && acc.lastError !== '' ? acc.lastError : acc.status;
  return (
    <Badge variant="outline" className="text-muted-foreground" title={acc.lastError ?? ''}>
      {acc.is_enabled ? `Disconnected · ${detail}` : 'Disabled'}
    </Badge>
  );
}

function AccountForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: ChickenRoadAccount | null;
  onSave: (input: { name: string; ws_token: string; provider: ChickenRoadProvider; is_enabled: boolean; access_token?: string }) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [provider, setProvider] = useState<ChickenRoadProvider>(initial?.provider ?? 'chicken_road');
  const [wsToken, setWsToken] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [enabled, setEnabled] = useState(initial?.is_enabled ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!name.trim()) return setError('Name is required.');
    if (!initial && !wsToken.trim()) return setError('ws_token is required for a new account.');
    setBusy(true);
    setError('');
    try {
      await onSave({
        name: name.trim(),
        ws_token: wsToken.trim(),
        provider,
        is_enabled: enabled,
        ...(accessToken.trim() ? { access_token: accessToken.trim() } : {}),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="cr-name">Name</Label>
        <Input id="cr-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken Road account 1" />
      </div>
      <div>
        <Label htmlFor="cr-provider">Provider</Label>
        <Select value={provider} onValueChange={(v) => setProvider(v as ChickenRoadProvider)}>
          <SelectTrigger id="cr-provider">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((p) => (
              <SelectItem key={p} value={p}>
                {p} — wss://{GATEWAY_HOSTS[p]}/v2/ws
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1 text-xs text-muted-foreground">
          Socket: <code className="font-mono">wss://{GATEWAY_HOSTS[provider]}/v2/ws?token=&lt;ws_token&gt;</code>
        </p>
      </div>
      <div>
        <Label htmlFor="cr-token">
          ws_token {initial && <span className="font-normal text-muted-foreground">(blank keeps the current token)</span>}
        </Label>
        <Input id="cr-token" value={wsToken} onChange={(e) => setWsToken(e.target.value)} placeholder={initial ? '••••••••' : 'gateway ws token'} />
      </div>
      <div>
        <Label htmlFor="cr-access-token">
          access_token {initial && <span className="font-normal text-muted-foreground">(blank keeps the current token; needed for future cash-out)</span>}
        </Label>
        {initial && (
          <p className="mb-1 text-xs text-muted-foreground">
            Current: {initial.has_access_token ? <code className="font-mono">{initial.access_token_masked}</code> : 'not set'}
          </p>
        )}
        <Input id="cr-access-token" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder={initial ? '••••••••' : 'optional account access token'} />
      </div>
      <div>
        <Label htmlFor="cr-enabled">Enabled</Label>
        <Select value={String(enabled)} onValueChange={(v) => setEnabled(v === 'true')}>
          <SelectTrigger id="cr-enabled">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Enabled — keep socket connected & auto-claim</SelectItem>
            <SelectItem value="false">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : initial ? 'Save changes' : 'Add account'}
        </Button>
      </div>
    </div>
  );
}

// An optional numeric field (max_stake / daily_loss_stop): a blank string is "off", which
// the config surface represents as null.
function toNullableNumber(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// Lane-based chicken road autoplay. The risk dial is the cash-out LANE; a named preset is
// only a shortcut for one, and a hand-edited lane is reported as 'custom'. The engine runs
// server-side over the gateway socket, so this card reads/writes config and mirrors status.
function AutoplayCard() {
  const [config, setConfig] = useState<ChickenRoadAutoplayConfig | null>(null);
  const [status, setStatus] = useState<ChickenRoadAutoplayStatus | null>(null);
  const [presets, setPresets] = useState<ChickenRoadRiskPreset[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await getChickenRoadAutoplayStatus();
        if (!alive) return;
        setStatus(res.status);
        setPresets(res.riskLevels ?? []);
        setConfig((c) => (c ? { ...c, ...res.config } : res.config));
      } catch (e) {
        if (!alive) return;
        setMsg(e instanceof Error ? e.message : String(e));
      }
    };
    void tick();
    const timer = setInterval(() => { void tick(); }, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  function patch<K extends keyof ChickenRoadAutoplayConfig>(key: K, value: ChickenRoadAutoplayConfig[K]) {
    setConfig((c) => (c ? { ...c, [key]: value } : c));
  }

  // A preset rewrites the lane; editing the lane demotes the level to custom. Keeping the
  // two in step here means the server never has to reject a contradictory save.
  function chooseRisk(level: ChickenRoadRiskLevel) {
    setConfig((c) => {
      if (!c) return c;
      if (level === 'custom') return { ...c, risk_level: 'custom' };
      const preset = presets.find((p) => p.level === level);
      return { ...c, risk_level: level, base_lane: preset ? preset.base_lane : c.base_lane };
    });
  }

  function editLane(value: number) {
    setConfig((c) => (c ? { ...c, base_lane: value, risk_level: 'custom' } : c));
  }

  async function save() {
    if (!config) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await setChickenRoadAutoplayConfig({
        enabled: config.enabled,
        provider: config.provider,
        difficulty: config.difficulty,
        risk_level: config.risk_level,
        base_lane: config.base_lane,
        rng_variance: config.rng_variance,
        base_wager: config.base_wager,
        stake_mode: config.stake_mode,
        stake_value: config.stake_value,
        max_stake: config.max_stake,
        loss_streak_stop: config.loss_streak_stop,
        daily_loss_stop: config.daily_loss_stop,
        free_bet_only: config.free_bet_only,
        delay_between_rounds_ms: config.delay_between_rounds_ms,
      });
      setConfig(res.config);
      if (res.riskLevels) setPresets(res.riskLevels);
      setMsg('Autoplay config saved.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    setMsg('');
    try {
      await chickenRoadAutoplayStart();
      const res = await getChickenRoadAutoplayStatus();
      setStatus(res.status);
      setConfig((c) => (c ? { ...c, ...res.config } : res.config));
      setMsg('Chicken Road autoplay engine started.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  async function stop() {
    setMsg('');
    try {
      await chickenRoadAutoplayStop();
      const res = await getChickenRoadAutoplayStatus();
      setStatus(res.status);
      setConfig((c) => (c ? { ...c, ...res.config } : res.config));
      setMsg('Chicken Road autoplay engine stopped.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  async function playNow(accountId: number) {
    setMsg('');
    try {
      const res = await playNowChickenRoadRound(accountId);
      setMsg(res.ok ? `Round placed on account #${accountId}.` : res.error || 'Could not place the round.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  const nextMult = status?.nextTargetMultiplier ?? null;
  const implied = status?.impliedWinProbability ?? null;
  const activePreset = presets.find((p) => p.level === config?.risk_level);

  return (
    <Card
      title="Chicken Road Autoplay"
      actions={
        <div className="flex items-center gap-3">
          <span className={`text-xs font-semibold ${status?.running ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
            Engine: {status?.running ? 'RUNNING' : 'IDLE'}
          </span>
          <Button variant="outline" size="sm" onClick={start}>Start</Button>
          <Button variant="outline" size="sm" onClick={stop}>Stop</Button>
        </div>
      }
    >
      {msg && <p className="mb-3 text-xs text-muted-foreground">{msg}</p>}
      {!config ? (
        <Loading rows={2} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="cr-auto-enabled">Enabled</Label>
            <Select value={String(config.enabled)} onValueChange={(v) => patch('enabled', v === 'true')}>
              <SelectTrigger id="cr-auto-enabled"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Enabled — run rounds when started</SelectItem>
                <SelectItem value="false">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="cr-auto-difficulty">Difficulty</Label>
            <Select value={config.difficulty} onValueChange={(v) => patch('difficulty', v as ChickenRoadAutoplayConfig['difficulty'])}>
              <SelectTrigger id="cr-auto-difficulty"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['EASY', 'MEDIUM', 'HARD', 'EXTREME'] as const).map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="cr-auto-risk">Risk level</Label>
            <Select value={config.risk_level} onValueChange={(v) => chooseRisk(v as ChickenRoadRiskLevel)}>
              <SelectTrigger id="cr-auto-risk"><SelectValue /></SelectTrigger>
              <SelectContent>
                {presets.map((p) => (
                  <SelectItem key={p.level} value={p.level}>{p.label} — lane {p.base_lane}</SelectItem>
                ))}
                <SelectItem value="custom">Custom lane</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              {activePreset?.blurb ?? 'Custom: the cash-out lane below is the risk dial.'}
            </p>
          </div>
          <div>
            <Label htmlFor="cr-auto-lane">Cash-out lane</Label>
            <Input
              id="cr-auto-lane"
              type="number"
              min={1}
              value={config.base_lane}
              onChange={(e) => editLane(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="cr-auto-variance">Lane variance (±)</Label>
            <Input
              id="cr-auto-variance"
              type="number"
              min={0}
              max={10}
              value={config.rng_variance}
              onChange={(e) => patch('rng_variance', Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="cr-auto-wager">Base wager (ETB)</Label>
            <Input
              id="cr-auto-wager"
              type="number"
              min={0}
              step="0.5"
              value={config.base_wager}
              onChange={(e) => patch('base_wager', Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="cr-auto-stake-mode">Stake mode</Label>
            <Select value={config.stake_mode} onValueChange={(v) => patch('stake_mode', v as 'fixed' | 'percent')}>
              <SelectTrigger id="cr-auto-stake-mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed amount</SelectItem>
                <SelectItem value="percent">Percent of balance</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="cr-auto-stake-value">{config.stake_mode === 'percent' ? 'Stake (% of balance)' : 'Stake (ETB)'}</Label>
            <Input
              id="cr-auto-stake-value"
              type="number"
              min={0}
              step="0.5"
              value={config.stake_value}
              onChange={(e) => patch('stake_value', Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="cr-auto-max-stake">Max stake (blank = game max)</Label>
            <Input
              id="cr-auto-max-stake"
              type="number"
              min={0}
              step="0.5"
              value={config.max_stake ?? ''}
              onChange={(e) => patch('max_stake', toNullableNumber(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="cr-auto-free-only">Free bets only</Label>
            <Select value={String(config.free_bet_only)} onValueChange={(v) => patch('free_bet_only', v === 'true')}>
              <SelectTrigger id="cr-auto-free-only"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="false">Spend free bets, then cash</SelectItem>
                <SelectItem value="true">Free bets only — never the wallet</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="cr-auto-delay">Pause between rounds (ms)</Label>
            <Input
              id="cr-auto-delay"
              type="number"
              min={0}
              max={60000}
              step={250}
              value={config.delay_between_rounds_ms}
              onChange={(e) => patch('delay_between_rounds_ms', Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="cr-auto-loss-stop">Stop after N losses (0 = off)</Label>
            <Input
              id="cr-auto-loss-stop"
              type="number"
              min={0}
              max={50}
              value={config.loss_streak_stop}
              onChange={(e) => patch('loss_streak_stop', Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="cr-auto-daily-stop">Daily loss stop (ETB, blank = off)</Label>
            <Input
              id="cr-auto-daily-stop"
              type="number"
              min={0}
              step="1"
              value={config.daily_loss_stop ?? ''}
              onChange={(e) => patch('daily_loss_stop', toNullableNumber(e.target.value))}
            />
          </div>
        </div>
      )}
      {status && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
            <span>
              Next target: <b>lane {status.nextTargetLane}</b>
              {nextMult != null && <> at <b>×{nextMult.toFixed(2)}</b></>}
              {implied != null && <> (~{(implied * 100).toFixed(1)}% implied)</>}
            </span>
            <span>Rounds: <b>{status.totalPlayed}</b> (cash {status.cashBetsPlayed} / free {status.freeBetsPlayed})</span>
            <span>W / L / F: <b>{status.wins} / {status.losses} / {status.failed}</b></span>
            <span>
              Net cash:{' '}
              <b className={status.netCash < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                {status.netCash.toFixed(2)} ETB
              </b>
            </span>
            <span>Loss streak: <b>{status.lossStreak}</b>{status.lossStreakStop > 0 ? <> / {status.lossStreakStop}</> : ' (stop off)'}</span>
            <span>Daily loss stop: <b>{status.dailyLossStop != null ? `${status.dailyLossStop} ETB` : 'off'}</b></span>
            {status.stoppedReason && (
              <span className="text-rose-600 dark:text-rose-400 sm:col-span-2 lg:col-span-4">Stopped: {status.stoppedReason}</span>
            )}
            {status.lastError && (
              <span className="text-rose-600 dark:text-rose-400 sm:col-span-2 lg:col-span-4">Last error: {status.lastError}</span>
            )}
          </div>
          {status.accounts.length > 0 && (
            <div className="space-y-2">
              {status.accounts.map((a) => (
                <div key={a.accountId} className="flex items-center justify-between rounded-lg border p-2 text-xs">
                  <div className="flex-1">
                    <b>{a.name}</b>
                    <span className="text-muted-foreground">
                      {' · '}{a.connected ? a.phase : 'offline'}
                      {a.currentLane >= 0 && <> · lane {a.currentLane}{a.multiplier != null ? ` (×${a.multiplier})` : ''}</>}
                      {' · '}target {a.targetLane ?? '—'}
                      {a.balance != null && <> · {a.balance.toFixed(2)} ETB</>}
                      {a.freeBetsAvailable > 0 && <> · {a.freeBetsAvailable} free bet{a.freeBetsAvailable === 1 ? '' : 's'}</>}
                      {' · '}{a.won}W/{a.lost}L
                    </span>
                    {a.lastSkipReason && <span className="text-amber-600 dark:text-amber-400"> · {a.lastSkipReason}</span>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => playNow(a.accountId)}>Play now</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <Button onClick={save} disabled={busy || !config}>{busy ? 'Saving…' : 'Save config'}</Button>
      </div>
    </Card>
  );
}

export default function ChickenRoadAccountsPage() {
  const { data, error, loading, refresh } = useApi(() => getChickenRoadAccounts(), []);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ChickenRoadAccount | null>(null);
  const [claims, setClaims] = useState<{ account: ChickenRoadAccount; rows: ChickenRoadClaimRecord[] } | null>(null);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [freeBets, setFreeBets] = useState<ChickenRoadFreeBet[] | null>(null);
  const [freeBetsLoading, setFreeBetsLoading] = useState(false);
  const [rounds, setRounds] = useState<ChickenRoadRound[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [checkingAll, setCheckingAll] = useState(false);
  const [msg, setMsg] = useState('');

  async function loadRounds() {
    try {
      const res = await getChickenRoadRounds(50);
      setRounds(res.rounds);
    } catch {
      /* keep the last list */
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadRounds();
    }, 0);
    const timer = setInterval(() => { refresh(); void loadRounds(); }, 10000);
    return () => {
      window.clearTimeout(initialLoad);
      clearInterval(timer);
    };
  }, [refresh]);

  async function onAdd(input: { name: string; ws_token: string; provider: ChickenRoadProvider; is_enabled: boolean; access_token?: string }) {
    await createChickenRoadAccount(input);
    setAdding(false);
    refresh();
  }

  async function onEdit(acc: ChickenRoadAccount, input: { name: string; ws_token: string; provider: ChickenRoadProvider; is_enabled: boolean; access_token?: string }) {
    await updateChickenRoadAccount(acc.id, {
      name: input.name,
      ...(input.ws_token ? { ws_token: input.ws_token } : {}),
      ...(input.access_token ? { access_token: input.access_token } : {}),
      provider: input.provider,
      is_enabled: input.is_enabled,
    });
    setEditing(null);
    refresh();
  }

  async function onDelete(acc: ChickenRoadAccount) {
    if (!window.confirm(`Delete "${acc.name}"?\nThis also removes its claim history.`)) return;
    await deleteChickenRoadAccount(acc.id);
    refresh();
  }

  async function onReconnect(acc: ChickenRoadAccount) {
    setBusyId(acc.id);
    setMsg('');
    try {
      await refreshChickenRoadAccount(acc.id);
      setMsg(`Reconnect sent for "${acc.name}".`);
      refresh();
      void loadRounds();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function onCheckAll() {
    setCheckingAll(true);
    setMsg('');
    try {
      const res = await checkAllChickenRoadStatus();
      refresh();
      void loadRounds();
      await new Promise((r) => setTimeout(r, 1500));
      refresh();
      setMsg(res.reconnected > 0
        ? `Reconnected ${res.reconnected} chicken road account${res.reconnected === 1 ? '' : 's'} — statuses re-checked.`
        : 'No enabled chicken road accounts to check.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setCheckingAll(false);
    }
  }

  async function onShowClaims(acc: ChickenRoadAccount) {
    setClaimsLoading(true);
    setClaims({ account: acc, rows: [] });
    try {
      const res = await getChickenRoadClaims(acc.id);
      setClaims({ account: acc, rows: res.claims });
    } catch (e) {
      setClaims({ account: acc, rows: [] });
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setClaimsLoading(false);
    }
  }

  async function onShowFreeBets() {
    setFreeBetsLoading(true);
    setFreeBets(null);
    try {
      const res = await getChickenRoadFreeBets();
      setFreeBets(res.bets);
    } catch (e) {
      setFreeBets([]);
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setFreeBetsLoading(false);
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Empty label="No chicken road accounts" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">Chicken Road Accounts</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCheckAll} disabled={checkingAll}>
            {checkingAll ? 'Checking…' : 'Check all'}
          </Button>
          <Button size="sm" onClick={() => setAdding(true)}>Add account</Button>
        </div>
      </div>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <AutoplayCard />

      <Card title="Accounts">
        {data.accounts.length === 0 ? (
          <Empty label="No chicken road accounts yet" />
        ) : (
          <div className="space-y-3">
            {data.accounts.map((acc) => (
              <div key={acc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{acc.name}</span>
                    <ProviderBadge provider={acc.provider} />
                    <StatusBadge acc={acc} />
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Balance: <b>{acc.balance.toFixed(2)} ETB</b> · Claims: <b>{acc.rain_count}</b>
                    {acc.claimedThisSession > 0 && <> · (+{acc.claimedThisSession} now)</>}
                    {acc.lastRainId && <> · Last rain: {acc.lastRainId} slot {acc.lastSlot} (+{acc.lastWager} ETB)</>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onShowClaims(acc)}>Claims</Button>
                  <Button variant="ghost" size="sm" onClick={() => onReconnect(acc)} disabled={busyId === acc.id}>
                    {busyId === acc.id ? 'Refreshing…' : 'Refresh'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(acc)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(acc)} className="text-red-600">Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Free Bets"
        actions={<Button size="sm" onClick={onShowFreeBets}>Refresh</Button>}
      >
        <p className="mb-2 text-xs text-muted-foreground">
          The server engine spends these automatically before it touches the wallet.
        </p>
        {freeBetsLoading ? (
          <Loading rows={3} />
        ) : !freeBets || freeBets.length === 0 ? (
          <Empty label="No free bets yet" />
        ) : (
          <div className="space-y-2">
            {freeBets.map((bet) => (
              <div key={bet.id} className="flex items-center justify-between rounded-lg border p-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{bet.free_bet_id}</span>
                    <Badge className={SPOT_STATUS_LABEL[bet.status].cls}>{SPOT_STATUS_LABEL[bet.status].label}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Amount: <b>{bet.wager_amount} ETB</b> · Account: <b>{bet.account_name || `#${bet.account_id}`}</b>
                    {bet.expires_at && <> · Expires: {formatTime(bet.expires_at)}</>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Recent Rounds"
        actions={<Button size="sm" onClick={loadRounds}>Refresh</Button>}
      >
        {!rounds ? (
          <Loading rows={3} />
        ) : rounds.length === 0 ? (
          <Empty label="No rounds played yet" />
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Target lane</TableHead>
                <TableHead>Cash-out lane</TableHead>
                <TableHead>Multiplier</TableHead>
                <TableHead>Stake</TableHead>
                <TableHead>Payout</TableHead>
                <TableHead>Profit</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rounds.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatTime(r.settled_at ?? r.placed_at)}</TableCell>
                  <TableCell>{r.wager_type === 'FREE_BET' ? 'Free' : 'Cash'}</TableCell>
                  <TableCell>{r.target_lane ?? '—'}</TableCell>
                  <TableCell>{r.cash_out_lane ?? '—'}</TableCell>
                  <TableCell>{r.multiplier != null ? `×${r.multiplier}` : '—'}</TableCell>
                  <TableCell>{r.stake.toFixed(2)}</TableCell>
                  <TableCell>{r.payout.toFixed(2)}</TableCell>
                  <TableCell className={r.profit < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                    {r.profit >= 0 ? '+' : ''}{r.profit.toFixed(2)}
                  </TableCell>
                  <TableCell>{ROUND_STATUS_LABEL[r.status] ?? r.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}
      </Card>

      {(adding || editing) && (
        <Modal title={editing ? 'Edit account' : 'Add account'} onClose={() => { setAdding(false); setEditing(null); }}>
          <AccountForm
            initial={editing}
            onSave={editing ? (i) => onEdit(editing, i) : onAdd}
            onCancel={() => { setAdding(false); setEditing(null); }}
          />
        </Modal>
      )}

      {claims && (
        <Modal title={`Claims — ${claims.account.name}`} onClose={() => setClaims(null)}>
          <div className="space-y-4">
            <h3 className="text-lg font-bold">Claims — {claims.account.name}</h3>
            {claimsLoading ? (
              <Loading rows={3} />
            ) : claims.rows.length === 0 ? (
              <Empty label="No claims recorded yet" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rain ID</TableHead>
                    <TableHead>Slot</TableHead>
                    <TableHead>Wager</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.rows.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.rain_id}</TableCell>
                      <TableCell>{c.slot_index}</TableCell>
                      <TableCell>{c.wager_amount} ETB</TableCell>
                      <TableCell>{formatTime(c.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <Button variant="outline" onClick={() => setClaims(null)}>Close</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
