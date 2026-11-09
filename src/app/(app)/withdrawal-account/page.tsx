'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getPaymentMethods,
  getRainAccounts,
  getRainPaymentChanges,
  getWithdrawalRequests,
  requestRainPaymentChange,
  setRainAccountWithdrawEnabled,
} from '@/lib/api';
import type {
  PaymentMethod,
  RainAccount,
  RainPaymentChangeRequest,
  WithdrawalRequest,
} from '@/lib/types';
import { Badge, Empty, Loading, TableCell, TableRow } from '@/components/app';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Pagination } from '@/components/ui/pagination';
import { Table, TableBody, TableHead, TableHeader } from '@/components/ui/table';
import { PaymentMethodSelect } from '@/components/PaymentMethodSelect';
import { formatTime } from '@/lib/format';

const HISTORY_PAGE_SIZE = 10;

const CHANGE_STATUS: Record<RainPaymentChangeRequest['status'], { label: string; cls: string }> = {
  pending: { label: 'Pending approval', cls: 'bg-amber-500 text-black' },
  approved: { label: 'Approved', cls: 'bg-emerald-600 text-white' },
  rejected: { label: 'Rejected', cls: 'bg-rose-600 text-white' },
};

const WITHDRAW_STATUS: Record<string, { label: string; cls: string }> = {
  queued: { label: 'Queued', cls: 'bg-sky-600 text-white' },
  running: { label: 'Running', cls: 'bg-sky-600 text-white' },
  succeeded: { label: 'Succeeded', cls: 'bg-emerald-600 text-white' },
  submitted: { label: 'Submitted', cls: 'bg-emerald-700 text-white' },
  dry_run: { label: 'Dry run', cls: 'bg-muted text-muted-foreground' },
  failed: { label: 'Failed', cls: 'bg-rose-600 text-white' },
  skipped: { label: 'Skipped', cls: 'bg-muted text-muted-foreground' },
};

function methodLabel(key: string | null, methods: PaymentMethod[]): string {
  if (!key) return 'Global default';
  const found = methods.find((m) => m.key === key || String(m.id) === key);
  return found?.label ?? key;
}

export default function WithdrawalAccountPage() {
  const [accounts, setAccounts] = useState<RainAccount[] | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [changes, setChanges] = useState<RainPaymentChangeRequest[]>([]);
  const [history, setHistory] = useState<WithdrawalRequest[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [method, setMethod] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const account = useMemo(
    () => accounts?.find((a) => a.id === accountId) ?? accounts?.[0] ?? null,
    [accounts, accountId],
  );
  const pendingChange = changes.find((c) => c.status === 'pending') ?? null;

  useEffect(() => {
    getPaymentMethods()
      .then((res) => setMethods(res.methods ?? []))
      .catch(() => {});
    getRainAccounts()
      .then((res) => {
        setAccounts(res.accounts);
        setAccountId((cur) => cur ?? res.accounts[0]?.id ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  // Reset the proposal form whenever the selected account's current payee
  // changes (account switch or after an approval).
  useEffect(() => {
    setMethod(account?.payment_method ?? '');
    setAccountNumber(account?.payment_account_number ?? '');
    setFullName(account?.payment_full_name ?? '');
    setMsg('');
  }, [account?.id, account?.payment_method, account?.payment_account_number, account?.payment_full_name]);

  useEffect(() => {
    if (!account) {
      setChanges([]);
      return;
    }
    getRainPaymentChanges()
      .then((res) => setChanges(res.requests.filter((r) => r.account_id === account.id)))
      .catch(() => {});
  }, [account?.id]);

  useEffect(() => {
    if (!account) {
      setHistory([]);
      setHistoryTotal(0);
      return;
    }
    let alive = true;
    setHistoryLoading(true);
    getWithdrawalRequests(HISTORY_PAGE_SIZE, account.id, historyPage * HISTORY_PAGE_SIZE)
      .then((res) => {
        if (!alive) return;
        setHistory(res.requests);
        setHistoryTotal(res.total ?? res.count);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setHistoryLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [account?.id, historyPage]);

  async function onToggleWithdraw(enabled: boolean) {
    if (!account) return;
    setBusy(true);
    setError('');
    try {
      await setRainAccountWithdrawEnabled(account.id, enabled);
      setAccounts((list) =>
        list ? list.map((a) => (a.id === account.id ? { ...a, withdraw_enabled: enabled } : a)) : list,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitChange() {
    if (!account) return;
    setMsg('');
    setError('');
    if (!method.trim()) {
      setError('Choose a payment method.');
      return;
    }
    if (!accountNumber.trim()) {
      setError('Enter the account number that should receive withdrawals.');
      return;
    }
    setBusy(true);
    try {
      await requestRainPaymentChange(account.id, {
        payment_method: method.trim(),
        payment_account_number: accountNumber.trim(),
        payment_full_name: fullName.trim() || null,
      });
      const res = await getRainPaymentChanges();
      setChanges(res.requests.filter((r) => r.account_id === account.id));
      setMsg('Payment change submitted — an admin must approve it before withdrawals use it.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!accounts) {
    return (
      <div className="space-y-4">
        {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Loading />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Withdrawal account</h1>
        <Empty label="No rain account is assigned to you yet. Ask an admin to assign one." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Withdrawal account</h1>
          <p className="text-sm text-muted-foreground">
            Configure where your assigned rain account pays winnings, and review its withdrawal history.
          </p>
        </div>
        {accounts.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Account
            <select
              value={account?.id ?? ''}
              onChange={(e) => {
                setAccountId(Number(e.target.value));
                setHistoryPage(0);
              }}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {msg && <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">{msg}</p>}

      {account && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{account.name}</CardTitle>
                <CardDescription>
                  Balance {account.balance.toFixed(2)} ETB{account.balanceLive ? ' (live)' : ''} · {account.provider}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div>
                    <div className="text-sm font-semibold">Withdrawal automation</div>
                    <p className="text-xs text-muted-foreground">
                      When on, winnings above the admin&apos;s trigger are swept to this payee.
                    </p>
                  </div>
                  <Switch
                    checked={account.withdraw_enabled}
                    disabled={busy}
                    onCheckedChange={(v) => void onToggleWithdraw(v)}
                    aria-label="Withdrawal automation"
                  />
                </div>
                {account.cash_suspended && (
                  <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                    Cash betting is paused until the wallet is re-funded.
                  </p>
                )}
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between gap-3 border-b border-border/60 pb-1.5">
                    <span className="text-muted-foreground">Payment method</span>
                    <span className="font-medium">{methodLabel(account.payment_method, methods)}</span>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-border/60 pb-1.5">
                    <span className="text-muted-foreground">Account number</span>
                    <span className="font-mono">{account.payment_account_number || '—'}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Full name</span>
                    <span>{account.payment_full_name || '—'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Request a payee change</CardTitle>
                <CardDescription>
                  Changes take effect only after an admin approves them. Withdrawals keep using the
                  current payee until then.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingChange ? (
                  <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                    <Badge className={CHANGE_STATUS.pending.cls}>Pending approval</Badge>
                    <p className="text-xs text-muted-foreground">
                      Requested {formatTime(pendingChange.requested_at)} — {methodLabel(pendingChange.payment_method, methods)} ·{' '}
                      <span className="font-mono">{pendingChange.payment_account_number}</span>
                      {pendingChange.payment_full_name ? ` · ${pendingChange.payment_full_name}` : ''}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="pay-method">Payment method</Label>
                      <PaymentMethodSelect id="pay-method" value={method} onChange={setMethod} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pay-number">Account number</Label>
                      <Input
                        id="pay-number"
                        inputMode="numeric"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        placeholder="e.g. 0911223344"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pay-name">Full name</Label>
                      <Input
                        id="pay-name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Account holder name"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={() => void onSubmitChange()} disabled={busy}>
                        {busy ? 'Submitting…' : 'Submit for approval'}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {changes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Payee change requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Requested</TableHead>
                        <TableHead>Payee</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reviewed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {changes.map((c) => {
                        const s = CHANGE_STATUS[c.status];
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {formatTime(c.requested_at)}
                            </TableCell>
                            <TableCell className="text-xs">
                              {methodLabel(c.payment_method, methods)} · <span className="font-mono">{c.payment_account_number}</span>
                              {c.payment_full_name ? ` · ${c.payment_full_name}` : ''}
                            </TableCell>
                            <TableCell>
                              <Badge className={s.cls} title={c.review_note ?? undefined}>{s.label}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {c.reviewed_at ? `${formatTime(c.reviewed_at)}${c.reviewed_by_username ? ` · ${c.reviewed_by_username}` : ''}` : '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Withdrawal history</CardTitle>
              <CardDescription>Automatic and manual withdrawals for this account, newest first.</CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading && history.length === 0 ? (
                <Loading rows={3} />
              ) : history.length === 0 ? (
                <Empty label="No withdrawals recorded yet." />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>When</TableHead>
                          <TableHead>Trigger</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Payee</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.map((w) => {
                          const s = WITHDRAW_STATUS[w.status] ?? { label: w.status, cls: 'bg-muted text-muted-foreground' };
                          return (
                            <TableRow key={w.id}>
                              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                {formatTime(w.created_at)}
                              </TableCell>
                              <TableCell className="text-xs">
                                {w.trigger.replace(/_/g, ' ')}
                                {w.trigger_amount ? ` · ${w.trigger_amount.toFixed(2)}` : ''}
                              </TableCell>
                              <TableCell className="font-mono text-xs">{w.amount.toFixed(2)} ETB</TableCell>
                              <TableCell className="text-xs">
                                {methodLabel(w.payment_method, methods)}
                                {w.payment_account_number ? ` · ${w.payment_account_number}` : ''}
                              </TableCell>
                              <TableCell>
                                <Badge className={s.cls} title={w.error ?? undefined}>{s.label}</Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <Pagination
                    page={historyPage}
                    pageSize={HISTORY_PAGE_SIZE}
                    total={historyTotal}
                    onPage={setHistoryPage}
                    unit="withdrawals"
                  />
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
