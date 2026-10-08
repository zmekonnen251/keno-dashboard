'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, Empty, Loading, Badge, TableCell, TableRow } from '@/components/app';
import { PaymentMethodSelect } from '@/components/PaymentMethodSelect';
import { Table, TableBody, TableHead, TableHeader } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { formatTime } from '@/lib/format';
import {
  getWithdrawalConfig,
  setWithdrawalConfig,
  getWithdrawalStatus,
  getWithdrawalRequests,
  withdrawalStart,
  withdrawalStop,
  refreshAllRainAccountTokens,
} from '@/lib/api';
import type {
  WithdrawalConfig,
  WithdrawalEngineStatus,
  WithdrawalRequest,
  WithdrawalStatus,
} from '@/lib/types';

const REQUEST_STATUS: Record<WithdrawalStatus, { label: string; cls: string }> = {
  queued: { label: 'Queued', cls: 'bg-sky-600 text-white' },
  running: { label: 'Running', cls: 'bg-amber-500 text-black' },
  succeeded: { label: 'Succeeded', cls: 'bg-emerald-600 text-white' },
  submitted: { label: 'Submitted', cls: 'bg-teal-600 text-white' },
  dry_run: { label: 'Dry run', cls: 'bg-indigo-600 text-white' },
  failed: { label: 'Failed', cls: 'bg-rose-600 text-white' },
  skipped: { label: 'Skipped', cls: 'bg-muted text-muted-foreground' },
};

function money(n: number | null | undefined): string {
  return n == null ? '—' : `${Number(n).toFixed(2)} ETB`;
}

// Rain withdrawal automation: tiered sweep of cash winnings to the account's
// payment method through shamo's player API, with cash-only suspension until
// the wallet is re-funded. Config + engine control + the recent request ledger.
export function WithdrawalConfigCard() {
  const [config, setConfig] = useState<WithdrawalConfig | null>(null);
  const [status, setStatus] = useState<WithdrawalEngineStatus | null>(null);
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const [c, s, r] = await Promise.all([
          getWithdrawalConfig(),
          getWithdrawalStatus(),
          getWithdrawalRequests(50),
        ]);
        if (!alive) return;
        setConfig((prev) => (prev ? { ...prev, ...c.config } : c.config));
        setStatus(s.status);
        setRequests(r.requests);
      } catch (e) {
        if (alive) setMsg(e instanceof Error ? e.message : String(e));
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
      const res = await setWithdrawalConfig({
        enabled: config.enabled,
        min_balance_to_withdraw: Number(config.min_balance_to_withdraw),
        win_trigger: Number(config.win_trigger),
        withdraw_tiers: config.withdraw_tiers.map((t) => ({
          min_win: Number(t.min_win),
          pct: Number(t.pct),
        })),
        resume_balance: Number(config.resume_balance),
        default_payment_method: config.default_payment_method,
        default_account_number: config.default_account_number,
        default_full_name: config.default_full_name,
        cooldown_seconds: Number(config.cooldown_seconds),
        deposit_cooldown_seconds: Number(config.deposit_cooldown_seconds),
        balance_trigger_enabled: config.balance_trigger_enabled,
        daily_max_withdrawals: Number(config.daily_max_withdrawals),
        dry_run: config.dry_run,
        concurrency: Number(config.concurrency),
      });
      setConfig(res.config);
      setMsg('Withdrawal configuration saved.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    setMsg('');
    try {
      await withdrawalStart();
      setStatus((s) => (s ? { ...s, running: true } : s));
      setMsg('Withdrawal engine started.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  async function stop() {
    setMsg('');
    try {
      await withdrawalStop();
      setStatus((s) => (s ? { ...s, running: false } : s));
      setMsg('Withdrawal engine stopped.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  async function refreshTokens() {
    setMsg('');
    try {
      const res = await refreshAllRainAccountTokens();
      setMsg(`Refreshed ${res.updated} shamo login token${res.updated === 1 ? '' : 's'}.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  function updateTier(index: number, patch: Partial<{ min_win: number; pct: number }>) {
    if (!config) return;
    const tiers = config.withdraw_tiers.map((t, i) => (i === index ? { ...t, ...patch } : t));
    setConfig({ ...config, withdraw_tiers: tiers });
  }

  function addTier() {
    if (!config) return;
    setConfig({ ...config, withdraw_tiers: [...config.withdraw_tiers, { min_win: 0, pct: 50 }] });
  }

  function removeTier(index: number) {
    if (!config) return;
    setConfig({ ...config, withdraw_tiers: config.withdraw_tiers.filter((_, i) => i !== index) });
  }

  return (
    <Card
      title="Rain withdrawal automation"
      actions={
        <div className="flex items-center gap-3">
          <span className={`text-xs font-semibold ${status?.running ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
            Engine: {status?.running ? 'RUNNING' : 'IDLE'}
          </span>
          <Button variant="outline" size="sm" onClick={start}>Start</Button>
          <Button variant="outline" size="sm" onClick={stop}>Stop</Button>
          <Button variant="outline" size="sm" onClick={refreshTokens} title="Re-login every rain account and persist a fresh shamo token">
            Refresh tokens
          </Button>
        </div>
      }
    >
      {msg && <p className="mb-3 text-xs text-muted-foreground">{msg}</p>}
      {!config ? (
        <Loading rows={3} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="wd-enabled">Enabled</Label>
              <select
                id="wd-enabled"
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={String(config.enabled)}
                onChange={(e) => setConfig({ ...config, enabled: e.target.value === 'true' })}
              >
                <option value="true">Enabled — sweep winnings and pause cash</option>
                <option value="false">Disabled</option>
              </select>
            </div>
            <div>
              <Label htmlFor="wd-trigger">Win trigger (ETB)</Label>
              <Input
                id="wd-trigger"
                type="number"
                min={1}
                value={config.win_trigger}
                onChange={(e) => setConfig({ ...config, win_trigger: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="wd-floor">Min balance to withdraw (ETB)</Label>
              <Input
                id="wd-floor"
                type="number"
                min={200}
                value={config.min_balance_to_withdraw}
                onChange={(e) => setConfig({ ...config, min_balance_to_withdraw: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="wd-resume">Resume cash when balance ≥ (ETB)</Label>
              <Input
                id="wd-resume"
                type="number"
                min={0}
                value={config.resume_balance}
                onChange={(e) => setConfig({ ...config, resume_balance: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="wd-cooldown">Cooldown (seconds)</Label>
              <Input
                id="wd-cooldown"
                type="number"
                min={0}
                value={config.cooldown_seconds}
                onChange={(e) => setConfig({ ...config, cooldown_seconds: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="wd-deposit-cooldown" className="flex items-center gap-1">
                Deposit cooldown (seconds)
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    After a deposit lands, leave the account alone this long. The tier percentage applies
                    to the whole balance and shamo credits deposits into that same balance — without this
                    the sweep pays freshly deposited money straight back out. 0 disables the guard.
                  </TooltipContent>
                </Tooltip>
              </Label>
              <Input
                id="wd-deposit-cooldown"
                type="number"
                min={0}
                max={604800}
                value={config.deposit_cooldown_seconds}
                onChange={(e) => setConfig({ ...config, deposit_cooldown_seconds: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="wd-daily">Daily max withdrawals (0 = unlimited)</Label>
              <Input
                id="wd-daily"
                type="number"
                min={0}
                value={config.daily_max_withdrawals}
                onChange={(e) => setConfig({ ...config, daily_max_withdrawals: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="wd-concurrency">Concurrency</Label>
              <Input
                id="wd-concurrency"
                type="number"
                min={1}
                max={5}
                value={config.concurrency}
                onChange={(e) => setConfig({ ...config, concurrency: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.dry_run}
                  onChange={(e) => setConfig({ ...config, dry_run: e.target.checked })}
                  className="h-4 w-4 accent-blue-600"
                />
                Dry run (validate only, never submit)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <input
                      type="checkbox"
                      checked={config.balance_trigger_enabled}
                      onChange={(e) => setConfig({ ...config, balance_trigger_enabled: e.target.checked })}
                      className="h-4 w-4 accent-blue-600"
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    Off: only a confirmed win or &quot;Withdraw now&quot; moves money out, so a top-up is
                    never swept. On: the periodic backstop may also withdraw once the total balance clears
                    the win trigger — which, after a deposit, is that deposit.
                  </TooltipContent>
                </Tooltip>
                Allow withdrawal on total balance (no win)
              </label>
            </div>
          </div>

          {/* Tiered percentages, evaluated top-down on the event (win) size. */}
          <div className="mt-4 rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Tiers</p>
                <p className="text-[11px] text-muted-foreground">
                  First tier whose min win is covered wins; the percentage applies to the whole available balance.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={addTier}>Add tier</Button>
            </div>
            <div className="space-y-2">
              {config.withdraw_tiers.map((t, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2">
                  <div>
                    <Label className="text-xs">Min win (ETB)</Label>
                    <Input
                      type="number"
                      min={1}
                      className="w-32"
                      value={t.min_win}
                      onChange={(e) => updateTier(i, { min_win: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Withdraw %</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      className="w-28"
                      value={t.pct}
                      onChange={(e) => updateTier(i, { pct: Number(e.target.value) })}
                    />
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => removeTier(i)}>
                    Remove
                  </Button>
                </div>
              ))}
              {config.withdraw_tiers.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No tiers — saving falls back to the defaults (1000→90%, 500→87%, 400→85%).
                </p>
              )}
            </div>
          </div>

          {/* Global payment defaults, used when an account has no own details. */}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="wd-pay-method">Default payment method</Label>
              <div className="mt-1">
                <PaymentMethodSelect
                  id="wd-pay-method"
                  value={config.default_payment_method}
                  onChange={(v) => setConfig({ ...config, default_payment_method: v })}
                  emptyLabel="— no default —"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="wd-pay-number">Default account number</Label>
              <Input
                id="wd-pay-number"
                value={config.default_account_number ?? ''}
                onChange={(e) => setConfig({ ...config, default_account_number: e.target.value || null })}
                placeholder="e.g. 0911223344"
              />
            </div>
            <div>
              <Label htmlFor="wd-pay-name">Default full name</Label>
              <Input
                id="wd-pay-name"
                value={config.default_full_name ?? ''}
                onChange={(e) => setConfig({ ...config, default_full_name: e.target.value || null })}
                placeholder="Account holder name"
              />
            </div>
          </div>

          {status && (
            <div className="mt-4 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3 lg:grid-cols-6">
              <span>Attempted: <b>{status.attempted}</b></span>
              <span>Succeeded: <b>{status.succeeded}</b></span>
              <span>Failed: <b>{status.failed}</b></span>
              <span>Skipped: <b>{status.skipped}</b></span>
              <span>Active: <b>{status.active}</b> / queued <b>{status.queued}</b></span>
              <span>Last tick: <b>{status.lastTickAt ? formatTime(new Date(status.lastTickAt).toISOString()) : '—'}</b></span>
              {status.lastError && (
                <span className="text-rose-600 dark:text-rose-400 sm:col-span-3 lg:col-span-6">
                  Last error: {status.lastError}
                </span>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              shamo.bet minimum withdrawal is <b>200 ETB</b>; a computed amount below that is skipped. The
              account&apos;s own payment details (set on the account) override these defaults.
            </p>
            <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save configuration'}</Button>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-sm font-semibold">Recent withdrawal requests</p>
            {requests.length === 0 ? (
              <Empty label="No withdrawal requests yet." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((r) => {
                      const s = REQUEST_STATUS[r.status] ?? { label: r.status, cls: 'bg-muted text-muted-foreground' };
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {formatTime(r.created_at)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {r.account_name ?? `#${r.account_id}`}
                          </TableCell>
                          <TableCell className="text-xs">
                            {r.trigger}
                            {r.trigger_amount > 0 && <span className="text-muted-foreground"> · {money(r.trigger_amount)}</span>}
                          </TableCell>
                          <TableCell className="font-medium">{money(r.amount)}</TableCell>
                          <TableCell>{r.tier_pct != null ? `${r.tier_pct}%` : '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {money(r.balance_before)} → {money(r.balance_after)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.payment_method ?? '—'}
                            {r.payment_account_number ? ` · ${r.payment_account_number}` : ''}
                          </TableCell>
                          <TableCell>
                            <Badge className={s.cls} title={r.error ?? undefined}>{s.label}</Badge>
                            {r.error && <span className="mt-0.5 block text-[10px] text-rose-600 dark:text-rose-400">{r.error}</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
