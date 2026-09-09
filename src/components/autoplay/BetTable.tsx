'use client';

import { Badge } from '@/components/ui/badge';
import type { AutoplayPlacedBet } from '@/lib/types';
import { CopyPhoneButton } from '@/components/accounts-columns';
import { betLabel, formatTs, stateTone } from './utils';

export function BetTable({ bets }: { bets: AutoplayPlacedBet[] }) {
	return (
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
					{bets.map((p) => (
						<tr key={`${p.accountId}-${p.requestId}-${p.placedAt}`} className='border-b border-border/60'>
							<td className='px-2 py-2 text-muted-foreground'>{formatTs(p.placedAt)}</td>
						<td className='px-2 py-2'>
							<div className='font-medium'>#{p.accountId}</div>
							{p.phone ? (
								<div className='inline-flex items-center gap-1 font-mono text-muted-foreground'>
									+{p.phone}
									<CopyPhoneButton phone={p.phone} />
								</div>
							) : (
								<div className='text-muted-foreground'>—</div>
							)}
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
	);
}
