'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/app';
import type { AccountGameStatus } from '@/lib/types';
import { CollapsibleCard } from './CollapsibleCard';
import { stateTone } from './utils';

// Live view: only accounts with a connected socket. Disconnected workers are
// not live bets, so they stay out of this card (see the autoplay pool in the
// config/status overview for the full list).
export function AccountStatusCard({ accounts, running }: { accounts: AccountGameStatus[]; running: boolean }) {
	const connected = useMemo(() => accounts.filter((a) => a.connected), [accounts]);

	return (
		<CollapsibleCard
			title={`Account game status${running ? ' (live)' : ''} · ${connected.length} connected`}
			defaultOpen={true}
		>
			{connected.length === 0 ? (
				<Empty label='No connected sockets. Start autoplay to open gateway connections.' />
			) : (
				<div className='overflow-x-auto'>
					<table className='w-full text-xs'>
						<thead>
							<tr className='border-b border-border text-left text-muted-foreground'>
								<th className='px-2 py-1.5 font-medium'>Account</th>
								<th className='px-2 py-1.5 font-medium'>State</th>
								<th className='px-2 py-1.5 font-medium'>Round phase</th>
								<th className='px-2 py-1.5 font-medium'>Bets sent/ack</th>
								<th className='px-2 py-1.5 font-medium'>Last bet</th>
								<th className='px-2 py-1.5 font-medium'>Win</th>
								<th className='px-2 py-1.5 font-medium'>Balance</th>
								<th className='px-2 py-1.5 font-medium'>Socket</th>
							</tr>
						</thead>
						<tbody>
							{connected.map((a) => (
								<tr key={a.accountId} className='border-b border-border/60'>
								<td className='px-2 py-2'>
									<div className='font-medium'>#{a.accountId}</div>
									<div className='text-muted-foreground'>{a.phone}</div>
								</td>
								<td className='px-2 py-2'>
									<Badge variant={stateTone(a.state)}>{a.state}</Badge>
									{a.deleted && (
										<Badge variant='destructive' className='ml-1'>
											deleted
										</Badge>
									)}
								</td>
								<td className='px-2 py-2'>
									{a.lastPhase ? (
										<>
											<div
												className={
													a.lastPhase === 'WAITING'
														? 'font-semibold text-emerald-500'
														: a.lastPhase === 'DRAWING'
															? 'font-semibold text-amber-500'
															: 'text-muted-foreground'
												}
											>
												{a.lastPhase}
											</div>
											{a.lastRoundId && (
												<div className='font-mono text-muted-foreground'>{(a.lastRoundId ?? '').slice(0, 8)}</div>
											)}
										</>
									) : (
										<span className='text-muted-foreground'>—</span>
									)}
								</td>
								<td className='px-2 py-2'>
									<div className='font-mono'>
										{a.sent ?? 0}/{(a.acked ?? 0)}
									</div>
									{(a.failed ?? 0) > 0 ? (
										<div className='font-semibold text-red-500'>{(a.failed ?? 0)} failed</div>
									) : (
										<div className='text-muted-foreground'>0 failed</div>
									)}
								</td>
								<td className='px-2 py-2'>
										{a.lastSpots ? (
											<>
												<div className='font-mono'>[{a.lastSpots.join(',')}]</div>
												<div className='text-muted-foreground'>{a.lastStake ?? '—'} ETB</div>
											</>
										) : (
											<span className='text-muted-foreground'>—</span>
										)}
									</td>
									<td className='px-2 py-2'>
										{a.winAmount != null ? (
											<span className={a.winAmount > 0 ? 'text-emerald-500' : 'text-muted-foreground'}>
												{a.winAmount > 0 ? '+' : ''}
												{a.winAmount} ETB
											</span>
										) : (
											<span className='text-muted-foreground'>—</span>
										)}
									</td>
								<td className='px-2 py-2'>
									<div className={a.balance < 2 ? 'font-semibold text-red-500' : ''}>
										{typeof a.balance === 'number' ? a.balance.toFixed(2) : a.balance} ETB
									</div>
									<div
										className='text-muted-foreground'
										title={
											a.balanceLive
												? 'Confirmed by a gateway BALANCE frame — this is the real wallet.'
												: 'DB seed — no BALANCE frame seen yet on this stream; the real wallet may differ (e.g. empty).'
										}
									>
										{a.balanceLive ? 'live' : 'cached'}
									</div>
								</td>
									<td className='px-2 py-2'>
										<div className='text-emerald-500'>connected</div>
										<div className='text-muted-foreground'>{a.lastStatus}</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</CollapsibleCard>
	);
}
