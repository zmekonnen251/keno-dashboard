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
  getChickenRoadFreeBets,
  playChickenRoadFreeBet,
  chickenRoadBetPrediction,
} from '@/lib/api';
import type {
  ChickenRoadAccount,
  ChickenRoadProvider,
  ChickenRoadClaimRecord,
  ChickenRoadAutoplayConfig,
  ChickenRoadFreeBet,
  ChickenRoadAutoplayStatus,
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
  onSave: (input: { name: string; ws_token: string; provider: ChickenRoadProvider; is_enabled: boolean; access_token?: string }) => void;
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

// Clock-driven chicken road autoplay: a single config row gates the engine on the
// server, which plays eligible chicken road free-bets each round.
function AutoplayCard() {
  const [config, setConfig] = useState<ChickenRoadAutoplayConfig | null>(null);
  const [status, setStatus] = useState<ChickenRoadAutoplayStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [manualDraft, setManualDraft] = useState('');
  const [draftSynced, setDraftSynced] = useState(false);

  useEffect(() => {
    if (config && !draftSynced) {
      setManualDraft(config.manual_spots.join(', '));
      setDraftSynced(true);
    }
  }, [config, draftSynced]);

  function parseManualSpots(text: string): number[] {
    return text
      .split(/[,;\n\r]+/)
      .flatMap((part) => part.trim().split(/\s+/))
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 80)
      .slice(0, 20);
  }

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await getChickenRoadAutoplayStatus();
        if (!alive) return;
        setStatus(res.status);
        setConfig((c) => (c ? { ...c, ...res.config } : res.config));
      } catch (e) {
        if (!alive) return;
        setMsg(e instanceof Error ? e.message : String(e));
      }
    };
    void tick();
    const timer = setInterval(() => { void tick(); }, 10000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  async function save() {
    if (!config) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await setChickenRoadAutoplayConfig({
        enabled: config.enabled,
        provider: config.provider,
        tickets_per_round: config.tickets_per_round,
        spots_mode: config.spots_mode,
        manual_spots: parseManualSpots(manualDraft),
        round_interval: config.round_interval,
      });
      setConfig(res.config);
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
            <Select value={String(config.enabled)} onValueChange={(v) => setConfig({ ...config, enabled: v === 'true' })}>
              <SelectTrigger id="cr-auto-enabled"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Enabled — run rounds when started</SelectItem>
                <SelectItem value="false">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="cr-auto-provider">Provider</Label>
            <Select value={config.provider} onValueChange={(v) => setConfig({ ...config, provider: v as ChickenRoadProvider })}>
              <SelectTrigger id="cr-auto-provider"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="cr-auto-tickets">Tickets per round</Label>
            <Input
              id="cr-auto-tickets"
              type="number"
              min={0}
              max={50}
              value={config.tickets_per_round}
              onChange={(e) => setConfig({ ...config, tickets_per_round: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="cr-auto-interval">Round interval (seconds)</Label>
            <Input
              id="cr-auto-interval"
              type="number"
              min={5}
              max={3600}
              value={config.round_interval}
              onChange={(e) => setConfig({ ...config, round_interval: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="cr-auto-spots-mode">Chosen spots source</Label>
            <Select value={config.spots_mode} onValueChange={(v) => setConfig({ ...config, spots_mode: v as ChickenRoadAutoplayConfig['spots_mode'] })}>
              <SelectTrigger id="cr-auto-spots-mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual spots below</SelectItem>
                <SelectItem value="prediction">ML prediction (chicken_road)</SelectItem>
                <SelectItem value="prediction_tickets">ML prediction tickets (per-site plan)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="cr-auto-manual-spots">Manual spots / ticket (1–80, comma or space separated)</Label>
            <Input
              type="text"
              id="cr-auto-manual-spots"
              value={manualDraft}
              onChange={(e) => setManualDraft(e.target.value)}
              placeholder="e.g. 5, 12, 23, 40"
              disabled={config.spots_mode !== 'manual'}
            />
          </div>
        </div>
      )}
      {status && (
        <div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
          <span>Rounds played total: <b>{status.totalPlayed}</b></span>
          <span>Last round: <b>{status.lastRoundPlayed}</b> bet{status.lastRoundPlayed === 1 ? '' : 's'}</span>
          <span>Last round at: <b>{status.lastRoundAt ? formatTime(new Date(status.lastRoundAt).toISOString()) : '—'}</b></span>
          <span>Pending acks: <b>{status.pendingAcks}</b></span>
          {status.lastError && <span className="text-rose-600 dark:text-rose-400 sm:col-span-2 lg:col-span-4">Last error: {status.lastError}</span>}
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
  const [playHistory, setPlayHistory] = useState<ChickenRoadFreeBet[] | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bettingPrediction, setBettingPrediction] = useState(false);
  const [checkingAll, setCheckingAll] = useState(false);
  const [msg, setMsg] = useState('');

  async function loadPlayHistory() {
    try {
      const res = await getChickenRoadFreeBets();
      setPlayHistory(res.bets.filter((b) => (b.chosen_spots?.length ?? 0) > 0));
    } catch {
      /* keep the last list */
    }
  }

  useEffect(() => {
    void loadPlayHistory();
    const timer = setInterval(() => { refresh(); void loadPlayHistory(); }, 10000);
    return () => clearInterval(timer);
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
      void loadPlayHistory();
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
      void loadPlayHistory();
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

  async function onBetPrediction() {
    setBettingPrediction(true);
    setMsg('');
    try {
      const res = await chickenRoadBetPrediction();
      if (!res.ok || !res.result?.ok) {
        setMsg(res.result?.error || 'Prediction bet failed.');
      } else {
        setMsg('Prediction bet placed on an eligible chicken road free-bet (wager = the free-bet amount).');
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBettingPrediction(false);
    }
  }

  async function onPlayFreeBet(bet: ChickenRoadFreeBet) {
    setPlayingId(bet.id);
    setMsg('');
    try {
      const res = await playChickenRoadFreeBet(bet.id);
      if (!res.result.ok) {
        setMsg(res.result.error || 'Failed to place bet.');
      } else {
        setMsg(`Bet placed for ${bet.free_bet_id} (row #${bet.id}).`);
      }
      await onShowFreeBets();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setPlayingId(null);
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Empty label="No chicken road accounts" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Chicken Road Accounts</h2>
        <div className="flex items-center gap-2">
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
              <div key={acc.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
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
                <div className="flex items-center gap-1">
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
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onBetPrediction} disabled={bettingPrediction}>
              {bettingPrediction ? 'Betting…' : 'Bet prediction'}
            </Button>
            <Button size="sm" onClick={onShowFreeBets}>Refresh</Button>
          </div>
        }
      >
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
                {bet.status === 'available' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPlayFreeBet(bet)}
                    disabled={playingId === bet.id}
                  >
                    {playingId === bet.id ? 'Playing…' : 'Play'}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {(adding || editing) && (
        <Modal open onClose={() => { setAdding(false); setEditing(null); }}>
          <AccountForm
            initial={editing}
            onSave={editing ? (i) => onEdit(editing, i) : onAdd}
            onCancel={() => { setAdding(false); setEditing(null); }}
          />
        </Modal>
      )}

      {claims && (
        <Modal open onClose={() => setClaims(null)}>
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
