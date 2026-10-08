/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Fragment, useEffect, useState } from 'react';
import { Activity, Globe, Pause, Pencil, Play, RotateCw, Settings, Users, X, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  forceTelebeatRotate,
} from '@/lib/api';
import { apiFetch } from '@/lib/api-client';
import { TelebeatAccount, TelebeatConfig, TelebeatEngineStatus, TelebeatPerf, TelebeatStats } from '@/lib/types';

export default function TelebeatPage() {
  const [config, setConfig] = useState<TelebeatConfig | null>(null);
  const [status, setStatus] = useState<TelebeatEngineStatus | null>(null);
  const [stats, setStats] = useState<TelebeatStats | null>(null);
  const [perf, setPerf] = useState<TelebeatPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [cookie, setCookie] = useState('');
  const [strategy, setStrategy] = useState<'random' | 'heuristic' | 'neural' | 'gemini'>('random');
  const [workers, setWorkers] = useState('2');
  // Inline edit state for an existing account.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [edit, setEdit] = useState({ name: '', token: '', cookie: '', strategy: 'random' as TelebeatAccount['strategy'], workers: '2' });

  async function load() {
    try {
      setLoading(true);
      const [cfg, st, ss, pr] = await Promise.all([
        apiFetch<{ ok: boolean; config: TelebeatConfig }>('/api/telebeat/config'),
        apiFetch<{ ok: boolean; status: TelebeatEngineStatus }>('/api/telebeat/status'),
        apiFetch<{ ok: boolean; stats: TelebeatStats; performanceReport: TelebeatPerf[] }>('/api/telebeat/stats'),
        apiFetch<{ ok: boolean; report: string }>('/api/telebeat/report').catch(() => ({ ok: false, report: '' })),
      ]);
      setConfig(cfg.config);
      setStatus(st.status);
      setStats(ss.stats);
      setPerf(ss.performanceReport ?? []);
    } catch (e) {
      console.error('telebeat load', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const t = setInterval(load, 10000);
    return () => {
      window.clearTimeout(initialLoad);
      clearInterval(t);
    };
  }, []);

  async function saveConfig(patch: Partial<TelebeatConfig>) {
    if (!config) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ ok: boolean; config: TelebeatConfig }>('/api/telebeat/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      setConfig(res.config);
    } finally {
      setSaving(false);
    }
  }

  async function toggleAccount(a: { id: number }) {
    try {
      await apiFetch(`/api/telebeat/accounts/${a.id}/toggle`, { method: 'POST' });
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  async function startEdit(a: { id: number; name: string; strategy: TelebeatAccount['strategy']; workers: number }) {
    setEditingId(a.id);
    setSavingEdit(true);
    try {
      // The status payload has no credentials — fetch the full row so the
      // token/cookie fields can be prefilled.
      const res = await apiFetch<{ ok: boolean; account: TelebeatAccount }>(`/api/telebeat/accounts/${a.id}`);
      const acc = res.account;
      setEdit({
        name: acc.name,
        token: acc.token ?? '',
        cookie: acc.cookie ?? '',
        strategy: acc.strategy,
        workers: String(acc.workers),
      });
    } catch (e) {
      console.error(e);
      setEditingId(null);
    } finally {
      setSavingEdit(false);
    }
  }

  async function saveEdit() {
    if (editingId === null || !edit.name.trim()) return;
    setSavingEdit(true);
    try {
      await apiFetch(`/api/telebeat/accounts/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: edit.name.trim(),
          token: edit.token.trim() || null,
          cookie: edit.cookie.trim() || null,
          strategy: edit.strategy,
          workers: Number(edit.workers) || 2,
        }),
      });
      setEditingId(null);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setSavingEdit(false);
    }
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function createAccount() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await apiFetch('/api/telebeat/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          token: token.trim() || null,
          cookie: cookie.trim() || null,
          strategy,
          workers: Number(workers) || 2,
          is_running: false,
        }),
      });
      setName('');
      setToken('');
      setCookie('');
      setStrategy('random');
      setWorkers('2');
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function forceRotate() {
    setRotating(true);
    try {
      await forceTelebeatRotate();
      await load();
    } finally {
      setRotating(false);
    }
  }

  if (loading && !config) {
    return <div className="p-6 text-sm text-muted-foreground">Loading TeleBeat…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">TeleBeat</h1>
          <p className="text-sm text-muted-foreground">
            Guess-number automation with per-IP request rotation (using the shared proxy pool)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RotateCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accounts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.accounts ?? 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.running ?? 0} running</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Games / Points</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalGames ?? 0} / {stats?.totalPoints ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Hit rate {stats?.hitRate ?? 0}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engine</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {status?.running ? (
                <Badge variant="default" className="bg-green-600">
                  Running
                </Badge>
              ) : (
                <Badge variant="secondary">Stopped</Badge>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {status?.activeAccounts ?? 0} accounts · {status?.activeWorkers ?? 0} workers
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Egress (current IP)</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="truncate text-lg font-semibold">
              {status?.config ? (status as any)?.current || 'direct' : '—'}
            </div>
            <p className="text-xs text-muted-foreground">
              Rotations {status?.activeWorkers != null ? (status as any)?.totalRotations ?? 0 : 0} · Requests{' '}
              {(status as any)?.totalRequests ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Config */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuration
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={forceRotate} disabled={rotating || saving}>
              <RotateCw className={`mr-2 h-4 w-4 ${rotating ? 'animate-spin' : ''}`} />
              Force rotate
            </Button>
            <Button
              size="sm"
              onClick={() => saveConfig({ enabled: !config?.enabled })}
              disabled={saving}
              variant={config?.enabled ? 'destructive' : 'default'}
            >
              {config?.enabled ? (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Enabled</Label>
              <p className="text-sm text-muted-foreground">Master switch for TeleBeat automation</p>
            </div>
            <Switch
              checked={!!config?.enabled}
              onCheckedChange={(v) => saveConfig({ enabled: v })}
              disabled={saving}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Use proxies</Label>
                  <p className="text-sm text-muted-foreground">Route requests through shared proxy pool</p>
                </div>
                <Switch
                  checked={!!config?.proxy_enabled}
                  onCheckedChange={(v) => saveConfig({ proxy_enabled: v })}
                  disabled={saving}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Require proxy</Label>
                  <p className="text-sm text-muted-foreground">Never fall back to direct connection</p>
                </div>
                <Switch
                  checked={!!config?.require_proxy}
                  onCheckedChange={(v) => saveConfig({ require_proxy: v })}
                  disabled={saving}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>One proxy per worker</Label>
                  <p className="text-sm text-muted-foreground">Dedicated egress IP per worker — never shared</p>
                </div>
                <Switch
                  checked={!!config?.per_worker_proxy}
                  onCheckedChange={(v) => saveConfig({ per_worker_proxy: v })}
                  disabled={saving}
                />
              </div>
              <div className="space-y-2 rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Worker IP rotate interval (minutes)</Label>
                  <p className="text-sm text-muted-foreground">Change each worker&apos;s IP on this interval — 0 disables</p>
                </div>
                <Input
                  type="number"
                  value={config?.worker_rotate_minutes ?? 1}
                  onChange={(e) => saveConfig({ worker_rotate_minutes: Number(e.target.value) || 0 })}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Rotate after requests (per IP)</Label>
                <Input
                  type="number"
                  value={config?.rotate_after_requests ?? 50}
                  onChange={(e) => saveConfig({ rotate_after_requests: Number(e.target.value) || 0 })}
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">0 disables</p>
              </div>
              <div className="space-y-2">
                <Label>Rotate after seconds (per IP)</Label>
                <Input
                  type="number"
                  value={config?.rotate_after_seconds ?? 300}
                  onChange={(e) => saveConfig({ rotate_after_seconds: Number(e.target.value) || 0 })}
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">0 disables</p>
              </div>
              <div className="space-y-2">
                <Label>Min request interval (ms)</Label>
                <Input
                  type="number"
                  value={config?.min_request_interval_ms ?? 400}
                  onChange={(e) => saveConfig({ min_request_interval_ms: Number(e.target.value) || 400 })}
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label>Default workers per account</Label>
                <Input
                  type="number"
                  value={config?.default_workers ?? 2}
                  onChange={(e) => saveConfig({ default_workers: Number(e.target.value) || 2 })}
                  disabled={saving}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Report interval (minutes)</Label>
                <Input
                  type="number"
                  value={config?.report_interval_minutes ?? 10}
                  onChange={(e) => saveConfig({ report_interval_minutes: Number(e.target.value) || 10 })}
                  disabled={saving}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add account */}
      <Card>
        <CardHeader>
          <CardTitle>Add account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Primary_Account" />
            </div>
            <div className="space-y-2">
              <Label>Strategy</Label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as any)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus:outline-none"
              >
                <option value="random">random</option>
                <option value="heuristic">heuristic</option>
                <option value="neural">neural</option>
                <option value="gemini">gemini</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Token</Label>
              <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="GAME.XXX" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Cookie</Label>
              <Input value={cookie} onChange={(e) => setCookie(e.target.value)} placeholder="JSESSIONID=..." />
            </div>
            <div className="space-y-2">
              <Label>Workers</Label>
              <Input type="number" value={workers} onChange={(e) => setWorkers(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={createAccount} disabled={creating || !name.trim()}>
              Add account
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Accounts */}
      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead>Workers</TableHead>
                <TableHead>Games</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last error</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(status?.accounts ?? []).map((a) => (
                <Fragment key={a.id}>
                <TableRow>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>{a.strategy}</TableCell>
                  <TableCell>
                    {a.activeWorkers}/{a.workers}
                  </TableCell>
                  <TableCell>{a.gamesPlayed}</TableCell>
                  <TableCell>{a.pointsEarned}</TableCell>
                  <TableCell>
                    {a.isRunning ? (
                      <Badge className="bg-green-600">Running</Badge>
                    ) : (
                      <Badge variant="secondary">Stopped</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-60 truncate text-xs text-muted-foreground">
                    {a.lastError || '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => startEdit(a)} title="Edit account">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant={a.isRunning ? 'destructive' : 'default'} onClick={() => toggleAccount(a)}>
                        {a.isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {editingId === a.id ? (
                  <TableRow key={`edit-${a.id}`} className="bg-muted/40">
                    <TableCell>
                      <Input
                        value={edit.name}
                        onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))}
                        placeholder="Name"
                        disabled={savingEdit}
                      />
                    </TableCell>
                    <TableCell>
                      <select
                        value={edit.strategy}
                        onChange={(e) => setEdit((s) => ({ ...s, strategy: e.target.value as TelebeatAccount['strategy'] }))}
                        disabled={savingEdit}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm outline-none"
                      >
                        <option value="random">random</option>
                        <option value="heuristic">heuristic</option>
                        <option value="neural">neural</option>
                        <option value="gemini">gemini</option>
                      </select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={edit.workers}
                        onChange={(e) => setEdit((s) => ({ ...s, workers: e.target.value }))}
                        disabled={savingEdit}
                      />
                    </TableCell>
                    <TableCell colSpan={2}>
                      <Input
                        value={edit.token}
                        onChange={(e) => setEdit((s) => ({ ...s, token: e.target.value }))}
                        placeholder="Token (GAME.XXX)"
                        disabled={savingEdit}
                      />
                    </TableCell>
                    <TableCell colSpan={2}>
                      <Input
                        value={edit.cookie}
                        onChange={(e) => setEdit((s) => ({ ...s, cookie: e.target.value }))}
                        placeholder="Cookie (JSESSIONID=...)"
                        disabled={savingEdit}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" onClick={saveEdit} disabled={savingEdit || !edit.name.trim()}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit} disabled={savingEdit}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
                </Fragment>
              ))}
              {(status?.accounts ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                    No accounts
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Strategy performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Strategy</TableHead>
                <TableHead>Games</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>Avg</TableHead>
                <TableHead>Hit rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perf.map((p) => (
                <TableRow key={p.strategy}>
                  <TableCell className="font-medium">{p.strategy}</TableCell>
                  <TableCell>{p.games}</TableCell>
                  <TableCell>{p.points}</TableCell>
                  <TableCell>{p.avg}</TableCell>
                  <TableCell>{p.hitRate}%</TableCell>
                </TableRow>
              ))}
              {perf.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    No history yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
