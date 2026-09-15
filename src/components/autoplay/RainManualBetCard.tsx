'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { rainManualCashBet } from '@/lib/api';
import { CollapsibleCard } from './CollapsibleCard';
import { NumberGrid } from './NumberGrid';
import type { RainAccount } from '@/lib/types';

export function RainManualBetCard({
	accounts,
	onMessage,
	onSettled,
}: {
	accounts: RainAccount[];
	onMessage: (msg: string) => void;
	onSettled?: () => void;
}) {
	const [spotsCount, setSpotsCount] = useState<2 | 3>(3);
	const [selectedSpots, setSelectedSpots] = useState<number[]>([]);
	const [stake, setStake] = useState('2');
	const [accountId, setAccountId] = useState('');
	const [placing, setPlacing] = useState(false);

	const stakeNum = parseFloat(stake) || 0;
	const enabledAccounts = accounts.filter((a) => a.connected);

	function toggleNumber(n: number) {
		setSelectedSpots((prev) => {
			if (prev.includes(n)) return prev.filter((x) => x !== n);
			if (prev.length >= spotsCount) return [...prev.slice(1), n];
			return [...prev, n].sort((a, b) => a - b);
		});
	}

	async function onPlace() {
		if (selectedSpots.length < 2) {
			onMessage('Select at least 2 numbers first.');
			return;
		}
		if (stakeNum < 2) {
			onMessage('Stake must be >= 2 ETB.');
			return;
		}
		const id = parseInt(accountId, 10);
		if (accountId === '' || !Number.isFinite(id)) {
			onMessage('Pick a connected rain account first.');
			return;
		}
		setPlacing(true);
		try {
			const res = await rainManualCashBet(id, selectedSpots, stakeNum);
			if (res.ok && res.result.ok) {
				onMessage(`Cash bet placed on #${id} · [${selectedSpots.join(',')}] · ${stakeNum} ETB. Settlement may take a moment.`);
				onSettled?.();
			} else {
				onMessage(`Bet failed: ${res.result.error || 'unknown error'}`);
			}
		} catch (e) {
			onMessage(e instanceof Error ? e.message : String(e));
		} finally {
			setPlacing(false);
		}
	}

	return (
		<CollapsibleCard title='Manual cash bet — real wager on a rain account wallet' defaultOpen={false}>
			<div className='space-y-4'>
				<p className='text-sm text-muted-foreground'>
					Places a real CASH wager (not a free-bet) through a connected rain account&apos;s gateway socket. Win/loss is
					settled server-side and appears in the live game view.
				</p>

				<div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
					<div>
						<NumberGrid selected={selectedSpots} max={spotsCount} onToggle={toggleNumber} onClear={() => setSelectedSpots([])} />
					</div>
					<div className='space-y-3'>
						<div className='grid grid-cols-2 gap-2'>
							<div className='space-y-1.5'>
								<Label>Spots per ticket</Label>
								<select
									value={String(spotsCount)}
									onChange={(e) => {
										const v = e.target.value === '2' ? 2 : 3;
										setSpotsCount(v);
										setSelectedSpots((prev) => prev.slice(0, v));
									}}
									className='w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground'
								>
									<option value='2'>2 numbers</option>
									<option value='3'>3 numbers</option>
								</select>
							</div>
							<div className='space-y-1.5'>
								<Label>Stake (ETB)</Label>
								<Input type='number' min='2' value={stake} onChange={(e) => setStake(e.target.value)} placeholder='2' />
							</div>
						</div>

						<div className='space-y-1.5'>
							<Label>Account</Label>
							<select
								value={accountId}
								onChange={(e) => setAccountId(e.target.value)}
								className='w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground'
							>
								<option value=''>Select account…</option>
								{enabledAccounts.map((a) => (
									<option key={a.id} value={String(a.id)}>
										{a.name} · {a.balance.toFixed(2)} ETB
									</option>
								))}
								{enabledAccounts.length === 0 && <option value='' disabled>No connected rain accounts</option>}
							</select>
						</div>

						<div className='rounded-lg border border-border p-3 font-mono text-xs'>
							Selected: {selectedSpots.length > 0 ? `[${selectedSpots.join(',')}]` : '—'} · {stakeNum} ETB
						</div>

						<Button
							onClick={() => void onPlace()}
							disabled={placing || selectedSpots.length < 2 || stakeNum < 2 || accountId === ''}
						>
							{placing ? 'Placing…' : 'Place cash bet'}
						</Button>
					</div>
				</div>
			</div>
		</CollapsibleCard>
	);
}