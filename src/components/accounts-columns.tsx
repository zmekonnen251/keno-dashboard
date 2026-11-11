'use client';

import { useState } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { type DataTableFeatures } from './ui/data-table-features';
import { type Account } from '@/lib/types';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { formatTime } from '@/lib/format';
import { toLocalPhone } from '@/lib/phone';
import { GATEWAY_URL } from '@/hooks/useGatewayWorker';
import {
	Check,
	CloudRain,
	Copy,
	LoaderCircle,
	MoreVertical,
	Power,
	PowerOff,
	RefreshCw,
	Trash2,
	Wallet,
	Wifi,
	WifiOff,
} from 'lucide-react';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger
} from './ui/tooltip';

type ConnectionStatus = 'idle' | 'checking' | 'valid' | 'invalid';

// Accounts on these providers can join the FunGames rain-claiming list
// (shared by tolobirr + casagames, separate from the shamo rain pool).
const FUNGAMES_RAIN_PROVIDERS = new Set(['fungames_tolobirr', 'casagames']);

export function TestGatewayConnection({ token }: { token?: string | null }) {
	const [status, setStatus] = useState<ConnectionStatus>('idle');
	const [message, setMessage] = useState('');

	function testConnection() {
		if (!token) {
			setStatus('invalid');
			setMessage('No token');
			return;
		}

		setStatus('checking');
		setMessage('');
		const socket = new WebSocket(`${GATEWAY_URL}?token=${encodeURIComponent(token)}`);
		let settled = false;
		const timeout = window.setTimeout(() => {
			if (settled) return;
			settled = true;
			setStatus('invalid');
			setMessage('Timed out');
			socket.close();
		}, 5000);

		socket.onopen = () => {
			if (settled) return;
			settled = true;
			window.clearTimeout(timeout);
			setStatus('valid');
			setMessage('Connected');
			socket.close();
		};
		socket.onmessage = (event) => {
			try {
				const messageData = JSON.parse(event.data);
				if (messageData.type === 'ERROR' || messageData.error) {
					settled = true;
					window.clearTimeout(timeout);
					setStatus('invalid');
					setMessage('Rejected');
					socket.close();
				}
			} catch {
				// Ignore non-JSON gateway frames during the connection test.
			}
		};
		socket.onerror = () => {
			if (settled) return;
			settled = true;
			window.clearTimeout(timeout);
			setStatus('invalid');
			setMessage('Failed');
		};
		socket.onclose = () => window.clearTimeout(timeout);
	}

	return (
		<TooltipProvider>
			<div className='flex items-center gap-2'>
				{status === 'idle' && <Badge variant='outline'>{token ? 'Not checked' : 'No token'}</Badge>}
				{status === 'valid' && <Badge className='bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'>{message}</Badge>}
				{status === 'invalid' && <Badge variant='destructive'>{message}</Badge>}
				{status === 'checking' && <Badge variant='secondary'><LoaderCircle className='animate-spin' /> Checking</Badge>}
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant='outline'
							size='icon-sm'
							aria-label='Test WebSocket connection'
							onClick={testConnection}
							disabled={status === 'checking' || !token}
						>
							{status === 'invalid' || !token ? <WifiOff /> : <Wifi />}
						</Button>
					</TooltipTrigger>
					<TooltipContent>Test WebSocket connection</TooltipContent>
				</Tooltip>
			</div>
		</TooltipProvider>
	);
}

export function CopyPhoneButton({ phone }: { phone: string }) {
	const [copied, setCopied] = useState(false);

	async function onCopy() {
		const local = toLocalPhone(phone);
		try {
			await navigator.clipboard.writeText(local);
		} catch {
			// Fallback for non-secure contexts where the Clipboard API is unavailable.
			const ta = document.createElement('textarea');
			ta.value = local;
			document.body.appendChild(ta);
			ta.select();
			try {
				document.execCommand('copy');
			} catch {
				// Ignore — the primary Clipboard API path already failed.
			}
			document.body.removeChild(ta);
		}
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1500);
	}

	return (
		<Button
			variant='ghost'
			size='icon-xs'
			aria-label='Copy 9-digit phone number'
			title='Copy 9-digit number (without country code)'
			onClick={onCopy}
		>
			{copied ? <Check /> : <Copy />}
		</Button>
	);
}

export function AccountMobileCard({ account, onDelete, onRefreshWsToken, onToggleEnabled, onCheckBalance, onAddToRain }: { account: Account; onDelete: (id: number) => void; onRefreshWsToken: (id: number) => void; onToggleEnabled: (id: number, enabled: boolean) => void; onCheckBalance: (id: number, phone: string) => void; onAddToRain: (id: number) => void }) {
	return (
		<TooltipProvider>
			<article className='rounded-lg border bg-card p-4 text-sm shadow-sm'>
				<div className='flex items-start justify-between gap-3'>
					<div className='min-w-0'>
						<p className='flex items-center gap-1 truncate font-mono text-sm font-medium'>
							+{account.phone}
							<CopyPhoneButton phone={account.phone} />
						</p>
						<p className='mt-1 text-xs capitalize text-muted-foreground'>{account.provider}</p>
					</div>
					<DropdownMenu>
						<Tooltip>
							<TooltipTrigger asChild>
								<DropdownMenuTrigger asChild>
									<Button variant='ghost' size='icon-sm' aria-label='Open account actions'>
										<MoreVertical />
									</Button>
								</DropdownMenuTrigger>
							</TooltipTrigger>
							<TooltipContent>Account actions</TooltipContent>
						</Tooltip>
						<DropdownMenuContent align='end'>
							<DropdownMenuItem onClick={() => onToggleEnabled(account.id, !account.is_enabled)}>
								{account.is_enabled ? <PowerOff /> : <Power />} {account.is_enabled ? 'Disable autoplay' : 'Enable autoplay'}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => onRefreshWsToken(account.id)}>
								<RefreshCw /> Refresh WS token
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => onCheckBalance(account.id, account.phone)}>
								<Wallet /> Check balance
							</DropdownMenuItem>
							{FUNGAMES_RAIN_PROVIDERS.has(account.provider) && (
								account.rain_account_id ? (
									<DropdownMenuItem disabled>
										<CloudRain /> In rain claiming
									</DropdownMenuItem>
								) : (
									<DropdownMenuItem
										onClick={() => onAddToRain(account.id)}
										disabled={!account.ws_token}
									>
										<CloudRain /> Add to rain claiming
									</DropdownMenuItem>
								)
							)}
							<DropdownMenuSeparator />
							<DropdownMenuItem variant='destructive' onClick={() => onDelete(account.id)}>
								<Trash2 /> Delete account
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
				<dl className='mt-4 grid grid-cols-2 gap-x-4 gap-y-3'>
					<div>
						<dt className='text-xs text-muted-foreground'>Balance</dt>
						<dd className={account.balance < 2 ? 'font-semibold text-red-500' : 'font-medium'}>{account.balance.toFixed(2)} ETB</dd>
					</div>
					<div>
						<dt className='text-xs text-muted-foreground'>Autoplay</dt>
						<dd className='mt-1'>
							<Badge variant={account.is_enabled ? 'default' : 'secondary'}>
								{account.is_enabled ? 'Enabled' : 'Disabled'}
							</Badge>
						</dd>
					</div>
					<div>
						<dt className='text-xs text-muted-foreground'>WebSocket</dt>
						<dd className='mt-1'><TestGatewayConnection token={account.ws_token} /></dd>
					</div>
					<div>
						<dt className='text-xs text-muted-foreground'>Last bet</dt>
						<dd className='text-xs'>{formatTime(account.last_bet_at)}</dd>
					</div>
				</dl>
			</article>
		</TooltipProvider>
	);
}

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.


// Use `accessor` for data columns and `display` for columns without one.
const columnHelper = createColumnHelper<DataTableFeatures, Account>();

export const columns = columnHelper.columns([
	columnHelper.accessor('phone', {
		header: 'Phone',
		cell: ({ row }) => (
			<span className='inline-flex items-center gap-1 font-mono'>
				{row.original.phone}
				<CopyPhoneButton phone={row.original.phone} />
			</span>
		),
	}),
	columnHelper.accessor('provider', {
		header: 'Provider',
	}),
	columnHelper.accessor('balance', {
		header: 'Balance (ETB)',
		cell: ({ row }) => (
			<span className={row.original.balance < 2 ? 'font-semibold text-red-500' : ''}>
				{row.original.balance.toFixed(2)}
			</span>
		),
	}),
	columnHelper.accessor('last_bet_at', {
		header: 'Last bet',
		cell: ({ row }) => <span className='text-xs text-muted-foreground'>{formatTime(row.original.last_bet_at)}</span>,
	}),
	columnHelper.accessor('token', {
		header: 'Has Access Token',
		cell: (info) => (info.getValue() ? 'Yes' : 'No'),
  }),
  columnHelper.accessor('ws_token', {
    header: 'Has WS Token',
    cell: (info) => (info.getValue() ? 'Yes' : 'No'),
  }),
  columnHelper.accessor('is_enabled', {
    header: 'Autoplay',
    cell: (info) => (
      <Badge variant={info.getValue() ? 'default' : 'secondary'}>
        {info.getValue() ? 'Enabled' : 'Disabled'}
      </Badge>
    ),
  }),
  
	columnHelper.display({
		id: 'connection',
		header: 'Connection',
		cell: ({ row }) => <TestGatewayConnection token={row.original.ws_token} />,
	}),
	columnHelper.display({
		id: 'actions',
		header: 'Actions',
    cell: ({ table, row }) => (
      <div className='flex gap-2'>
				<Button
          variant={row.original.is_enabled ? 'outline' : 'default'}
          size='sm'
          onClick={() =>
            (table.options.meta as { onToggleEnabled: (id: number, enabled: boolean) => void }).onToggleEnabled(
              row.original.id,
              !row.original.is_enabled,
            )
          }
        >
          {row.original.is_enabled ? <><PowerOff className='size-3.5' /> Disable</> : <><Power className='size-3.5' /> Enable</>}
        </Button>
				<Button
					variant='destructive'
					size='sm'
					onClick={() =>
						(table.options.meta as { onDelete:  (id: number) => void }).onDelete(
							row.original.id,
						)
					}
				>
					Delete
        </Button>
        <Button
          variant='secondary'
          size='sm'
          onClick={ () =>
             (table.options.meta as { onRefreshWsToken: (id: number) => void }).onRefreshWsToken(
              row.original.id
            )
          }
        >
          Refresh Token
        </Button>
        <Button
          variant='outline'
          size='sm'
          onClick={ () =>
             (table.options.meta as { onCheckBalance: (id: number, phone: string) => void }).onCheckBalance(
              row.original.id,
              row.original.phone
            )
          }
        >
          <Wallet className='size-3.5' /> Check
        </Button>
        {FUNGAMES_RAIN_PROVIDERS.has(row.original.provider) && (
          row.original.rain_account_id ? (
            <Badge variant='outline' className='self-center'>
              <CloudRain /> In rain
            </Badge>
          ) : (
            <Button
              variant='outline'
              size='sm'
              disabled={!row.original.ws_token}
              title={row.original.ws_token ? 'Add to the FunGames rain-claiming list' : 'Refresh the WS token first'}
              onClick={() =>
                (table.options.meta as { onAddToRain: (id: number) => void }).onAddToRain(row.original.id)
              }
            >
              <CloudRain className='size-3.5' /> Add to rain
            </Button>
          )
        )}
      </div>
		),
	}),
]);
