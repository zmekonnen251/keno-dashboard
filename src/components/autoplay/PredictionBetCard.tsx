'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { placePredictionBet } from '@/lib/api';
import { CollapsibleCard } from './CollapsibleCard';

export function PredictionBetCard({
	running,
	onMessage,
	onRefresh,
}: {
	running: boolean;
	onMessage: (msg: string) => void;
	onRefresh: () => void;
}) {
	const [stake, setStake] = useState('2');
	const [placing, setPlacing] = useState(false);

	const stakeNum = parseFloat(stake) || 0;

	async function onPlace() {
		if (stakeNum < 2) {
			onMessage('Stake must be >= 2 ETB.');
			return;
		}
		setPlacing(true);
		try {
			const res = await placePredictionBet(stakeNum);
			if (res.ok) {
				onMessage(
					`Prediction bet placed at ${stakeNum} ETB on account #${res.accountId ?? 'auto'}. ` +
						'The generated ticket appears on the Predictions page; results are marked after the settle.',
				);
				onRefresh();
			} else {
				onMessage(`Prediction bet failed: ${res.failReason || 'unknown error'}`);
			}
		} catch (e) {
			onMessage('Prediction bet failed: ' + (e instanceof Error ? e.message : String(e)));
		} finally {
			setPlacing(false);
		}
	}

	return (
		<CollapsibleCard title='Prediction betting — bet the latest ML prediction ticket' defaultOpen={false}>
			<div className='flex flex-wrap items-end gap-3'>
				<div className='space-y-1.5'>
					<Label>Stake (ETB)</Label>
					<Input type='number' min='2' value={stake} onChange={(e) => setStake(e.target.value)} placeholder='2' className='w-32' />
				</div>
				<Button onClick={onPlace} disabled={placing || !running}>
					{placing ? 'Placing…' : 'Bet prediction'}
				</Button>
			</div>
			<p className='mt-2 text-xs text-muted-foreground'>
				Uses the latest prediction&apos;s preferred ticket — the server picks the best-priced spot after the round opens. Manual
				one-off version of the prediction-ticket betting you can enable per round in Configuration.
			</p>
		</CollapsibleCard>
	);
}