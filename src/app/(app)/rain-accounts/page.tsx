'use client';

import { useEffect, useState } from 'react';
import {
  getRainAccounts,
  createRainAccount,
  updateRainAccount,
  deleteRainAccount,
  refreshRainAccount,
  checkAllRainStatus,
  getRainClaims,
  setRainAccountAutoplayEnabled,
  setRainAutoplayConfig,
  rainAutoplayStart,
  rainAutoplayStop,
  getRainAutoplayStatus,
  getRainFreeBets,
  playRainFreeBet,
  rainBetPrediction,
} from '@/lib/api';
import type {
  RainAccount,
  RainProvider,
  RainClaimRecord,
  RainAutoplayConfig,
  RainFreeBet,
  RainAutoplayStatus,
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
import { DataTable } from '@/components/ui/data-table';
import { rainAccountColumns, RainAccountMobileCard } from '@/components/rain-accounts-columns';

const GATEWAY_HOSTS: Record<RainProvider, string> = {
  fungames_shamo: 'gateway.fungames.live',
  fungames_tolobirr: 'gateway.fungames.live',
  phoenixbet: 'gateway.phoenixbet.io',
};

const PROVIDERS: RainProvider[] = ['fungames_shamo', 'fungames_tolobirr', 'phoenixbet'];

const SPOT_STATUS_LABEL: Record<RainFreeBet['status'], { label: string; cls: string }> = {
  available: { label: 'Available', cls: 'bg-emerald-600 text-white' },
  claiming: { label: 'Claiming', cls: 'bg-amber-500 text-black' },
  bet_placed: { label: 'Bet placed', cls: 'bg-sky-600 text-white' },
  won: { label: 'Won', cls: 'bg-emerald-600 text-white' },
  lost: { label: 'Lost', cls: 'bg-zinc-600 text-white' },
  failed: { label: 'Failed', cls: 'bg-rose-600 text-white' },
  expired: { label: 'Expired', cls: 'bg-muted text-muted-foreground' },
};

function AccountForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: RainAccount | null;
  onSave: (input: { name: string; ws_token: string; provider: RainProvider; is_enabled: boolean; access_token?: string; password?: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [provider, setProvider] = useState<RainProvider>(initial?.provider ?? 'fungames_shamo');
  const [wsToken, setWsToken] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [password, setPassword] = useState('');
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
        // Optional shamo.bet login password. Blank keeps the stored password
        // (mirrors the access_token field); the PATCH route only clears when
        // given an explicit '' — that stays possible via the API alone.
        ...(password ? { password } : {}),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="rain-name">Name</Label>
        <Input id="rain-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rain account 1" />
      </div>
      <div>
        <Label htmlFor="rain-provider">Provider</Label>
        <Select value={provider} onValueChange={(v) => setProvider(v as RainProvider)}>
          <SelectTrigger id="rain-provider">
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
        <Label htmlFor="rain-token">
          ws_token {initial && <span className="font-normal text-muted-foreground">(blank keeps the current token)</span>}
        </Label>
        <Input id="rain-token" value={wsToken} onChange={(e) => setWsToken(e.target.value)} placeholder={initial ? '••••••••' : 'gateway ws token'} />
      </div>
      <div>
        <Label htmlFor="rain-access-token">
          access_token {initial && <span className="font-normal text-muted-foreground">(blank keeps the current token; needed for future cash-out)</span>}
        </Label>
        {initial && (
          <p className="mb-1 text-xs text-muted-foreground">
            Current: {initial.has_access_token ? <code className="font-mono">{initial.access_token_masked}</code> : 'not set'}
          </p>
        )}
        <Input id="rain-access-token" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder={initial ? '••••••••' : 'optional account access token'} />
      </div>
      <div>
        <Label htmlFor="rain-password">
          Shamo login password (optional) {initial && <span className="font-normal text-muted-foreground">(blank keeps the current password)</span>}
        </Label>
        {initial && (
          <p className="mb-1 text-xs text-muted-foreground">
            Current: {initial.has_password ? 'stored' : 'not set'} — used by the mobile “login to shamo website” flow.
          </p>
        )}
        <Input id="rain-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={initial ? '••••••••' : 'optional shamo.bet login password'} />
      </div>
      <div>
        <Label htmlFor="rain-enabled">Enabled</Label>
        <Select value={String(enabled)} onValueChange={(v) => setEnabled(v === 'true')}>
          <SelectTrigger id="rain-enabled">
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

// Clock-driven rain autoplay: a single config row gates the engine on the
// server, which plays eligible rain free-bets each round.
function AutoplayCard() {
  const [config, setConfig] = useState<RainAutoplayConfig | null>(null);
  const [status, setStatus] = useState<RainAutoplayStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [manualDraft, setManualDraft] = useState('');
  const [draftSynced, setDraftSynced] = useState(false);

  // Keep the manual-spots text box as the raw string the user typed, so commas
  // and spaces aren't re-canonicalized (and dropped) on every keystroke. The
  // draft is parsed into an array only when saving.
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

  // The status endpoint also returns the current config, so a single poll loop
  // keeps both alive without seeding state synchronously inside the effect.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await getRainAutoplayStatus();
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
      const res = await setRainAutoplayConfig({
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
      await rainAutoplayStart();
      const res = await getRainAutoplayStatus();
      setStatus(res.status);
      setConfig((c) => (c ? { ...c, ...res.config } : res.config));
      setMsg('Rain autoplay engine started.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  async function stop() {
    setMsg('');
    try {
      await rainAutoplayStop();
      const res = await getRainAutoplayStatus();
      setStatus(res.status);
      setConfig((c) => (c ? { ...c, ...res.config } : res.config));
      setMsg('Rain autoplay engine stopped.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Card
      title="Rain Autoplay"
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
            <Label htmlFor="rain-auto-enabled">Enabled</Label>
            <Select value={String(config.enabled)} onValueChange={(v) => setConfig({ ...config, enabled: v === 'true' })}>
              <SelectTrigger id="rain-auto-enabled"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Enabled — run rounds when started</SelectItem>
                <SelectItem value="false">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="rain-auto-provider">Provider</Label>
            <Select value={config.provider} onValueChange={(v) => setConfig({ ...config, provider: v as RainProvider })}>
              <SelectTrigger id="rain-auto-provider"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="rain-auto-tickets">Tickets per round</Label>
            <Input
              id="rain-auto-tickets"
              type="number"
              min={0}
              max={50}
              value={config.tickets_per_round}
              onChange={(e) => setConfig({ ...config, tickets_per_round: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="rain-auto-interval">Round interval (seconds)</Label>
            <Input
              id="rain-auto-interval"
              type="number"
              min={5}
              max={3600}
              value={config.round_interval}
              onChange={(e) => setConfig({ ...config, round_interval: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="rain-auto-spots-mode">Chosen spots source</Label>
            <Select value={config.spots_mode} onValueChange={(v) => setConfig({ ...config, spots_mode: v as RainAutoplayConfig['spots_mode'] })}>
              <SelectTrigger id="rain-auto-spots-mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual spots below</SelectItem>
                <SelectItem value="prediction">ML prediction (fungames_shamo)</SelectItem>
                <SelectItem value="prediction_tickets">ML prediction tickets (per-site plan)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="rain-auto-manual-spots">Manual spots / ticket (1–80, comma or space separated)</Label>
            <Input
              type="text"
              id="rain-auto-manual-spots"
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

export default function RainAccountsPage() {
  const { data, error, loading, refresh } = useApi(() => getRainAccounts(), []);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<RainAccount | null>(null);
  const [claims, setClaims] = useState<{ account: RainAccount; rows: RainClaimRecord[] } | null>(null);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [freeBets, setFreeBets] = useState<RainFreeBet[] | null>(null);
  const [freeBetsLoading, setFreeBetsLoading] = useState(false);
  const [playHistory, setPlayHistory] = useState<RainFreeBet[] | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bettingPrediction, setBettingPrediction] = useState(false);
  const [checkingAll, setCheckingAll] = useState(false);
  const [msg, setMsg] = useState('');

  // Played-ticket history (chosen_spots present) used by the card + the poll.
  async function loadPlayHistory() {
    try {
      const res = await getRainFreeBets();
      setPlayHistory(res.bets.filter((b) => (b.chosen_spots?.length ?? 0) > 0));
    } catch {
      /* keep the last list */
    }
  }

  // Poll the list while the page is open so worker balances (BALANCE frames)
  // and connect/disconnect state stay live without a page reload. The played-ticket
  // history is refreshed on the same cadence so win/loss verdicts appear live.
  useEffect(() => {
    void loadPlayHistory();
    const timer = setInterval(() => { refresh(); void loadPlayHistory(); }, 10000);
    return () => clearInterval(timer);
  }, [refresh]);

  async function onAdd(input: { name: string; ws_token: string; provider: RainProvider; is_enabled: boolean; access_token?: string; password?: string }) {
    await createRainAccount(input);
    setAdding(false);
    refresh();
  }

  async function onEdit(acc: RainAccount, input: { name: string; ws_token: string; provider: RainProvider; is_enabled: boolean; access_token?: string; password?: string }) {
    await updateRainAccount(acc.id, {
      name: input.name,
      ...(input.ws_token ? { ws_token: input.ws_token } : {}),
      ...(input.access_token ? { access_token: input.access_token } : {}),
      ...(input.password ? { password: input.password } : {}),
      provider: input.provider,
      is_enabled: input.is_enabled,
    });
    setEditing(null);
    refresh();
  }

  async function onDelete(acc: RainAccount) {
    if (!window.confirm(`Delete "${acc.name}"?\nThis also removes its claim history.`)) return;
    await deleteRainAccount(acc.id);
    refresh();
  }

  async function onToggleAutoplay(acc: RainAccount) {
    if (!window.confirm(acc.autoplay_enabled
      ? `Disable autoplay for "${acc.name}"?\nIt will keep claiming rain, but its free bets and wallet will NOT be used by the autoplay engine (free-bet plays and cash-mode bets).`
      : `Enable autoplay for "${acc.name}"?\nIts free bets and wallet will be usable by the autoplay engine again.`)) return;
    await setRainAccountAutoplayEnabled(acc.id, !acc.autoplay_enabled);
    refresh();
  }

  async function onReconnect(acc: RainAccount) {
    setBusyId(acc.id);
    setMsg('');
    try {
      await refreshRainAccount(acc.id);
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
      const res = await checkAllRainStatus();
      refresh();
      void loadPlayHistory();
      await new Promise((r) => setTimeout(r, 1500)); // let sockets come up
      refresh();
      setMsg(res.reconnected > 0
        ? `Reconnected ${res.reconnected} rain account${res.reconnected === 1 ? '' : 's'} — statuses re-checked.`
        : 'No enabled rain accounts to check.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setCheckingAll(false);
    }
  }

  async function onShowClaims(acc: RainAccount) {
    setClaimsLoading(true);
    setClaims({ account: acc, rows: [] });
    try {
      const res = await getRainClaims(acc.id);
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
      const res = await getRainFreeBets();
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
      const res = await rainBetPrediction();
      if (!res.ok || !res.result?.ok) {
        setMsg(res.result?.error || 'Prediction bet failed.');
      } else {
        setMsg('Prediction bet placed on an eligible rain free-bet (wager = the free-bet amount).');
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBettingPrediction(false);
    }
  }

  async function onPlayFreeBet(bet: RainFreeBet) {
    setPlayingId(bet.id);
    setMsg('');
    try {
      const res = await playRainFreeBet(bet.id);
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
  if (!data) return <Empty label="No rain accounts" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Rain Accounts</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void onShowFreeBets()}>Free bets</Button>
          <Button variant="outline" disabled={bettingPrediction} onClick={() => void onBetPrediction()}>
            {bettingPrediction ? '…' : 'Bet prediction'}
          </Button>
          <Button variant="outline" disabled={checkingAll} onClick={() => void onCheckAll()}>
            {checkingAll ? '…' : 'Check all rains'}
          </Button>
          <Button variant="outline" onClick={refresh}>Refresh</Button>
          <Button onClick={() => setAdding(true)}>Add account</Button>
        </div>
      </div>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}

      <AutoplayCard />

      <Card title={`Prediction bets / free-bet plays (${playHistory ? playHistory.length : '…'})`}>
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

      <Card title={`Rain-claiming accounts (${data.count})`}>
        {data.accounts.length ? (
          <DataTable
            columns={rainAccountColumns}
            data={data.accounts}
            meta={{
              onShowClaims,
              onReconnect,
              onEdit: setEditing,
              onDelete,
              onToggleAutoplay,
              busyId,
            }}
            renderMobileRowCard={(acc) => (
              <RainAccountMobileCard
                account={acc}
                meta={{
                  onShowClaims,
                  onReconnect,
                  onEdit: setEditing,
                  onDelete,
                  onToggleAutoplay,
                  busyId,
                }}
              />
            )}
          />
        ) : (
          <Empty label="No rain-claiming accounts. Add one to start auto-claiming free bets." />
        )}
      </Card>

      {adding && (
        <Modal title="Add rain account" onClose={() => setAdding(false)}>
          <AccountForm initial={null} onCancel={() => setAdding(false)} onSave={(input) => void onAdd(input)} />
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <AccountForm initial={editing} onCancel={() => setEditing(null)} onSave={(input) => void onEdit(editing, input)} />
        </Modal>
      )}

      {claims && (
        <Modal title={`Claims — ${claims.account.name}`} onClose={() => setClaims(null)} wide>
          {claimsLoading ? (
            <Loading rows={3} />
          ) : claims.rows.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rain ID</TableHead>
                    <TableHead>Slot</TableHead>
                    <TableHead>Wager</TableHead>
                    <TableHead>Claimed at</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.rows.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.rain_id}</TableCell>
                      <TableCell>{c.slot_index}</TableCell>
                      <TableCell>+{c.wager_amount} ETB</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatTime(c.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Empty label="No claims recorded yet." />
          )}
        </Modal>
      )}

      {freeBets && (
        <Modal title="Rain free bets (ledger)" onClose={() => setFreeBets(null)} wide>
          {freeBetsLoading ? (
            <Loading rows={3} />
          ) : freeBets.length ? (
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
                  {freeBets.map((b) => {
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