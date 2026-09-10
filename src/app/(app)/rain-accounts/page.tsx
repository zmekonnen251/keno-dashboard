'use client';

import { useState } from 'react';
import {
  getRainAccounts,
  createRainAccount,
  updateRainAccount,
  deleteRainAccount,
  refreshRainAccount,
  getRainClaims,
} from '@/lib/api';
import type {
  RainAccount,
  RainProvider,
  RainClaimRecord,
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

const GATEWAY_HOSTS: Record<RainProvider, string> = {
  fungames: 'gateway.fungames.live',
  phoenixbet: 'gateway.phoenixbet.io',
};

const PROVIDERS: RainProvider[] = ['fungames', 'phoenixbet'];

function ProviderBadge({ provider }: { provider: RainProvider }) {
  return (
    <Badge className={provider === 'phoenixbet' ? 'bg-fuchsia-600 text-white' : ''} variant={provider === 'fungames' ? 'default' : 'secondary'}>
      {provider}
    </Badge>
  );
}

function StatusBadge({ acc }: { acc: RainAccount }) {
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
  initial: RainAccount | null;
  onSave: (input: { name: string; ws_token: string; provider: RainProvider; is_enabled: boolean }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [provider, setProvider] = useState<RainProvider>(initial?.provider ?? 'fungames');
  const [wsToken, setWsToken] = useState('');
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

export default function RainAccountsPage() {
  const { data, error, loading, refresh } = useApi(() => getRainAccounts(), []);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<RainAccount | null>(null);
  const [claims, setClaims] = useState<{ account: RainAccount; rows: RainClaimRecord[] } | null>(null);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  async function onAdd(input: { name: string; ws_token: string; provider: RainProvider; is_enabled: boolean }) {
    await createRainAccount(input);
    setAdding(false);
    refresh();
  }

  async function onEdit(acc: RainAccount, input: { name: string; ws_token: string; provider: RainProvider; is_enabled: boolean }) {
    await updateRainAccount(acc.id, {
      name: input.name,
      ...(input.ws_token ? { ws_token: input.ws_token } : {}),
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

  async function onReconnect(acc: RainAccount) {
    setBusyId(acc.id);
    setMsg('');
    try {
      await refreshRainAccount(acc.id);
      setMsg(`Reconnect sent for "${acc.name}".`);
      refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
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

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Empty label="No rain accounts" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Rain Accounts</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refresh}>Refresh</Button>
          <Button onClick={() => setAdding(true)}>Add account</Button>
        </div>
      </div>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}

      <Card title={`Rain-claiming accounts (${data.count})`}>
        {data.accounts.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Claims</TableHead>
                  <TableHead>Last claimed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.accounts.map((acc) => (
                  <TableRow key={acc.id}>
                    <TableCell className="font-medium">{acc.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-0.5">
                        <ProviderBadge provider={acc.provider} />
                        <span className="font-mono text-[10px] text-muted-foreground">{acc.gateway_host}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <StatusBadge acc={acc} />
                        {acc.connected && acc.connectedAt != null && (
                          <span className="text-[10px] text-muted-foreground">since {formatTime(new Date(acc.connectedAt).toISOString())}</span>
                        )}
                        {acc.claimedThisSession > 0 && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                            {acc.claimedThisSession} this session
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{acc.ws_token_masked ?? '—'}</TableCell>
                    <TableCell>{acc.rain_count}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {acc.last_claimed_at ? formatTime(acc.last_claimed_at) : '—'}
                      {acc.lastWager != null && (
                        <span className="mt-0.5 block">slot {acc.lastSlot} · +{acc.lastWager} ETB</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => onShowClaims(acc)}>Claims</Button>
                        <Button variant="outline" size="sm" disabled={busyId === acc.id} onClick={() => onReconnect(acc)}>
                          {busyId === acc.id ? '…' : 'Reconnect'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditing(acc)}>Edit</Button>
                        <Button variant="destructive" size="sm" onClick={() => onDelete(acc)}>Delete</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
    </div>
  );
}