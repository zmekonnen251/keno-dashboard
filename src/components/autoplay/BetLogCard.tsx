'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/app';
import type { AccountGameStatus, AutoplayPlacedBet } from '@/lib/types';
import { CollapsibleCard } from './CollapsibleCard';
import { betLabel, formatTs, stateTone } from './utils';

const BIG_WIN_ETB = 100;
// "Last round" = bets placed within one round window of the newest bet.
const ROUND_WINDOW_MS = 30000;

export function BetLogCard({ bets, accounts }: { bets: AutoplayPlacedBet[]; accounts: AccountGameStatus[] }) {
	const [showAll, setShowAll] = useState(false);

	const connected = useMemo(
		() => new Set(accounts.filter((a) => a.connected).map((a) => a.accountId)),
		[accounts],
	);
	const newest = useMemo(() => bets.reduce((m, b) => Math.max(m, b.placedAt ?? 0), 0), [bets]);
	const visible = showAll
		? bets
		: bets.filter(
				(b) =>
					(b.winAmount ?? 0) >= BIG_WIN_ETB || connected.has(b.accountId) || (b.placedAt ?? 0) >= newest - ROUND_WINDOW_MS,
			);

	return (
		<CollapsibleCard
			title={`Bet log (live) · showing ${visible.length} of ${bets.length}`}
			defaultOpen={false}
			actions={
				<Button variant='ghost' size='sm' onClick={() => setShowAll((v) => !v)}>
					{showAll ? 'Filtered' : 'Show all'}
				</Button>
			}
		>
			{bets.length === 0 ? (
				<Empty label='No bets recorded yet. Start autoplay or run a test round.' />
			) : visible.length === 0 ? (
				<Empty label='Nothing matches the filter (connected accounts · last round · wins ≥ 100 ETB).' />
			) : (
				<div className='overflow-x-auto'>
					<table className='w-full text-xs'>
						<thead>
							<tr className='border-b border-border text-left text-muted-foreground'>
								<th className='px-2 py-1.5 font-medium'>Time</th>
								<th className='px-2 py-1.5 font-medium'>Account</th>
								<th className='px-2 py-1.5 font-medium'>Ticket</th>
								<th className='px-2 py-1.5 font-medium'>Stake</th>
								<th className='px-2 py-1.5 font-medium'>Status</th>
								<th className='px-2 py-1.5 font-medium'>Hits</th>
								<th className='px-2 py-1.5 font-medium'>Won</th>
								<th className='px-2 py-1.5 font-medium'>Drawn</th>
								<th className='px-2 py-1.5 font-medium'>Balance after</th>
							</tr>
						</thead>
						<tbody>
							{visible.map((p) => (
								<tr key={`${p.accountId}-${p.requestId}-${p.placedAt}`} className='border-b border-border/60'>
									<td className='px-2 py-2 text-muted-foreground'>{formatTs(p.placedAt)}</td>
									<td className='px-2 py-2'>
										<div className='font-medium'>#{p.accountId}</div>
										<div className='text-muted-foreground'>{p.phone}</div>
									</td>
									<td className='px-2 py-2 font-mono'>[{(p.spots || []).join(',')}]</td>
									<td className='px-2 py-2'>{p.stake} ETB</td>
									<td className='px-2 py-2'>
										<Badge variant={stateTone(p.status || (p.ok ? 'pending' : 'failed'))}>{betLabel(p)}</Badge>
										{p.failReason && (
											<div className='mt-0.5 max-w-48 truncate text-muted-foreground' title={p.failReason}>
												{p.failReason}
											</div>
										)}
									</td>
									<td className='px-2 py-2'>{p.matched != null ? p.matched : '—'}</td>
									<td className='px-2 py-2'>
										{p.winAmount != null ? (
											<span className={p.winAmount > 0 ? 'font-semibold text-emerald-500' : 'text-muted-foreground'}>
												{p.winAmount > 0 ? '+' : ''}
												{p.winAmount} ETB
											</span>
										) : (
											<span className='text-muted-foreground'>—</span>
										)}
									</td>
									<td className='px-2 py-2 font-mono text-muted-foreground'>
										{p.drawnSpots && p.drawnSpots.length > 0
											? `[${p.drawnSpots.slice(0, 8).join(',')}${p.drawnSpots.length > 8 ? '…' : ''}]`
											: '—'}
									</td>
									<td className='px-2 py-2'>{p.balanceAfter != null ? `${p.balanceAfter} ETB` : '—'}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</CollapsibleCard>
	);
}
