'use client';

import { Badge } from '@/components/ui/badge';
import { Card, Empty } from '@/components/app';
import type { AccountGameStatus } from '@/lib/types';
import { stateTone } from './utils';

export function ActiveBettingCard({ accounts, running }: { accounts: AccountGameStatus[]; running: boolean }) {
	const live = accounts.filter((a) => a.state === 'betting');
	return (
		<Card title={`Live game — now betting${running ? ' (live)' : ''}`} actions={<Badge variant='outline'>{live.length} active</Badge>}>
			{live.length === 0 ? (
				<Empty label='No live bets right now. Accounts with status "betting" appear here.' />
			) : (
				<div className='overflow-x-auto'>
					<table className='w-full text-xs'>
						<thead>
							<tr className='border-b border-border text-left text-muted-foreground'>
								<th className='px-2 py-1.5 font-medium'>Account</th>
								<th className='px-2 py-1.5 font-medium'>Ticket</th>
								<th className='px-2 py-1.5 font-medium'>Stake</th>
								<th className='px-2 py-1.5 font-medium'>State</th>
								<th className='px-2 py-1.5 font-medium'>Balance</th>
							</tr>
						</thead>
						<tbody>
							{live.map((a) => (
								<tr key={a.accountId} className='border-b border-border/60'>
									<td className='px-2 py-2'>
										<div className='font-medium'>#{a.accountId}</div>
										<div className='text-muted-foreground'>{a.phone}</div>
									</td>
									<td className='px-2 py-2 font-mono'>{a.lastSpots ? `[${a.lastSpots.join(',')}]` : '—'}</td>
									<td className='px-2 py-2'>{a.lastStake ?? '—'} ETB</td>
									<td className='px-2 py-2'>
										<Badge variant={stateTone(a.state)}>{a.state}</Badge>
									</td>
									<td className='px-2 py-2'>
										{typeof a.balance === 'number' ? a.balance.toFixed(2) : a.balance} ETB
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</Card>
	);
}
