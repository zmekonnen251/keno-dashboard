'use client';

import { createColumnHelper } from '@tanstack/react-table';
import { type DataTableFeatures } from './ui/data-table-features';
import { type RainAccount, type RainProvider } from '@/lib/types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { formatTime } from '@/lib/format';
import { Power, PowerOff } from 'lucide-react';

// Column definitions for the rain-claiming accounts list — mirrors the keno
// Accounts page: accessor columns are sortable, display columns (status /
// actions) are not, and the action handlers ride along in `meta`.

const columnHelper = createColumnHelper<DataTableFeatures, RainAccount>();

function ProviderBadge({ provider }: { provider: RainProvider }) {
  return (
    <Badge
      className={
        provider === 'phoenixbet'
          ? 'bg-fuchsia-600 text-white'
          : provider === 'fungames_tolobirr'
            ? 'bg-sky-600 text-white'
            : ''
      }
      variant={provider === 'fungames_shamo' ? 'default' : 'secondary'}
    >
      {provider}
    </Badge>
  );
}

function StatusBadge({ acc }: { acc: RainAccount }) {
  if (acc.connected) {
    return <Badge className="bg-emerald-600 text-white">Connected</Badge>;
  }
  const detail = acc.lastError && acc.lastError !== '' ? acc.lastError : acc.status;
  return (
    <Badge variant="outline" className="text-muted-foreground" title={acc.lastError ?? ''}>
      {acc.is_enabled ? `Disconnected · ${detail}` : 'Disabled'}
    </Badge>
  );
}

export interface RainAccountsMeta {
  onShowClaims: (acc: RainAccount) => void;
  onReconnect: (acc: RainAccount) => void;
  onEdit: (acc: RainAccount) => void;
  onDelete: (acc: RainAccount) => void;
  onToggleAutoplay: (acc: RainAccount) => void;
  onWithdrawNow: (acc: RainAccount) => void;
  onResume: (acc: RainAccount) => void;
  busyId: number | null;
}

export const rainAccountColumns = columnHelper.columns([
  columnHelper.accessor('name', {
    header: 'Name',
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  }),
  columnHelper.accessor('provider', {
    header: 'Provider',
    cell: ({ row }) => (
      <div className="flex flex-col items-start gap-0.5">
        <ProviderBadge provider={row.original.provider} />
        <span className="font-mono text-[10px] text-muted-foreground">{row.original.gateway_host}</span>
      </div>
    ),
  }),
  columnHelper.display({
    id: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <div className="flex flex-col gap-0.5">
        <StatusBadge acc={row.original} />
        {row.original.connected && row.original.connectedAt != null && (
          <span className="text-[10px] text-muted-foreground">
            since {formatTime(new Date(row.original.connectedAt).toISOString())}
          </span>
        )}
        {row.original.claimedThisSession > 0 && (
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
            {row.original.claimedThisSession} this session
          </span>
        )}
      </div>
    ),
  }),
  columnHelper.accessor('ws_token_masked', {
    header: 'Token',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">{row.original.ws_token_masked ?? '—'}</span>
    ),
  }),
  columnHelper.accessor('balance', {
    header: 'Balance (ETB)',
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className={row.original.balanceLive ? 'text-emerald-600 dark:text-emerald-400' : ''}>
          {row.original.balance.toFixed(2)}
        </span>
        {row.original.balanceLive && (
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400">live</span>
        )}
      </div>
    ),
  }),
  columnHelper.accessor('has_access_token', {
    header: 'Access token',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.original.has_access_token ? row.original.access_token_masked : '—'}
      </span>
    ),
  }),
  columnHelper.accessor('has_password', {
    header: 'Shamo pw',
    cell: ({ row }) =>
      row.original.has_password ? (
        <Badge className="bg-emerald-600 text-white">stored</Badge>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  }),
  columnHelper.accessor('rain_count', {
    header: 'Claims',
  }),
  columnHelper.accessor('autoplay_enabled', {
    header: 'Autoplay',
    cell: ({ row }) => (
      <Badge variant={row.original.autoplay_enabled ? 'default' : 'secondary'}>
        {row.original.autoplay_enabled ? 'Enabled' : 'Disabled'}
      </Badge>
    ),
  }),
  columnHelper.accessor('withdraw_enabled', {
    header: 'Withdrawal',
    cell: ({ row }) => {
      const acc = row.original;
      if (!acc.withdraw_enabled) return <Badge variant="secondary">Off</Badge>;
      if (acc.cash_suspended) return <Badge className="bg-amber-500 text-black">Cash paused</Badge>;
      return (
        <div className="flex flex-col items-start gap-0.5">
          <Badge className="bg-emerald-600 text-white">On</Badge>
          {!acc.has_payment_details && (
            <span className="text-[10px] text-rose-600 dark:text-rose-400">no payment</span>
          )}
          {acc.last_withdraw_at && (
            <span className="text-[10px] text-muted-foreground">last {formatTime(acc.last_withdraw_at)}</span>
          )}
        </div>
      );
    },
  }),
  columnHelper.accessor('last_claimed_at', {
    header: 'Last claimed',
    cell: ({ row }) => {
      const acc = row.original;
      return (
        <span className="text-xs text-muted-foreground">
          {acc.last_claimed_at ? formatTime(acc.last_claimed_at) : '—'}
          {acc.lastWager != null && (
            <span className="mt-0.5 block">
              slot {acc.lastSlot} · +{acc.lastWager} ETB
            </span>
          )}
        </span>
      );
    },
  }),
  columnHelper.display({
    id: 'actions',
    header: 'Actions',
    cell: ({ table, row }) => {
      const meta = table.options.meta as RainAccountsMeta;
      const busy = meta.busyId === row.original.id;
      return (
        <div className="flex justify-end gap-2">
          <Button
            variant={row.original.autoplay_enabled ? 'outline' : 'default'}
            size="sm"
            title={row.original.autoplay_enabled
              ? 'Disable autoplay — free bets + wallet not used by the engine'
              : 'Enable autoplay — free bets + wallet usable by the engine'}
            onClick={() => meta.onToggleAutoplay(row.original)}
          >
            {row.original.autoplay_enabled ? <><PowerOff className="size-3.5" /> Disable</> : <><Power className="size-3.5" /> Enable</>}
          </Button>
          {row.original.withdraw_enabled && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy || row.original.cash_suspended}
              title={row.original.cash_suspended
                ? 'Cash is paused after a withdrawal — resume it first'
                : 'Sweep the tiered % of the current balance now'}
              onClick={() => meta.onWithdrawNow(row.original)}
            >
              Withdraw
            </Button>
          )}
          {row.original.cash_suspended && (
            <Button variant="secondary" size="sm" onClick={() => meta.onResume(row.original)}>
              Resume cash
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => meta.onShowClaims(row.original)}>
            Claims
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => meta.onReconnect(row.original)}>
            {busy ? '…' : 'Check status'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => meta.onEdit(row.original)}>
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => meta.onDelete(row.original)}>
            Delete
          </Button>
        </div>
      );
    },
  }),
]);

export function RainAccountMobileCard({
  account,
  meta,
}: {
  account: RainAccount;
  meta: RainAccountsMeta;
}) {
  const busy = meta.busyId === account.id;
  return (
    <article className="rounded-lg border bg-card p-4 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{account.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {account.provider} · <StatusBadge acc={account} />
          </p>
        </div>
        <span className={account.balanceLive ? 'font-mono text-emerald-600 dark:text-emerald-400' : 'font-mono'}>
          {account.balance.toFixed(2)} ETB
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Claims</dt>
          <dd>{account.rain_count}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last claimed</dt>
          <dd>{account.last_claimed_at ? formatTime(account.last_claimed_at) : '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">WS token</dt>
          <dd className="font-mono text-[11px]">{account.ws_token_masked ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Session</dt>
          <dd>
            {account.connected ? 'connected' : 'offline'}
            {account.claimedThisSession > 0 ? ` · ${account.claimedThisSession} claims` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Autoplay</dt>
          <dd>
            {account.autoplay_enabled ? (
              <span className="text-emerald-600 dark:text-emerald-400">enabled</span>
            ) : (
              <span className="text-muted-foreground">disabled</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Withdrawal</dt>
          <dd>
            {!account.withdraw_enabled ? (
              <span className="text-muted-foreground">off</span>
            ) : account.cash_suspended ? (
              <span className="text-amber-600 dark:text-amber-400">cash paused</span>
            ) : account.has_payment_details ? (
              <span className="text-emerald-600 dark:text-emerald-400">ready</span>
            ) : (
              <span className="text-rose-600 dark:text-rose-400">no payment</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Shamo pw</dt>
          <dd>
            {account.has_password ? (
              <span className="text-emerald-600 dark:text-emerald-400">stored</span>
            ) : (
              <span className="text-muted-foreground">not set</span>
            )}
          </dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant={account.autoplay_enabled ? 'outline' : 'default'}
          size="sm"
          onClick={() => meta.onToggleAutoplay(account)}
        >
          {account.autoplay_enabled ? <><PowerOff className="size-3.5" /> Disable autoplay</> : <><Power className="size-3.5" /> Enable autoplay</>}
        </Button>
        {account.withdraw_enabled && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy || account.cash_suspended}
            onClick={() => meta.onWithdrawNow(account)}
          >
            Withdraw
          </Button>
        )}
        {account.cash_suspended && (
          <Button variant="secondary" size="sm" onClick={() => meta.onResume(account)}>
            Resume cash
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => meta.onShowClaims(account)}>Claims</Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => meta.onReconnect(account)}>
          {busy ? '…' : 'Check status'}
        </Button>
        <Button variant="outline" size="sm" onClick={() => meta.onEdit(account)}>Edit</Button>
        <Button variant="destructive" size="sm" onClick={() => meta.onDelete(account)}>Delete</Button>
      </div>
    </article>
  );
}