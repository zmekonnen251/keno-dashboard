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
	provider,
}: {
	running: boolean;
	onMessage: (msg: string) => void;
	onRefresh: () => void;
	/** Factory provider whose engine places the bet (fungames_tolobirr | casagames). */
	provider?: string;
}) {
	const [stake, setStake] = useState('2');
	const [source, setSource] = useState<'prediction' | 'temporal'>('prediction');
	const [placing, setPlacing] = useState(false);

	const stakeNum = parseFloat(stake) || 0;

	async function onPlace() {
		if (stakeNum < 2) {
			onMessage('Stake must be >= 2 ETB.');
			return;
		}
		setPlacing(true);
		try {
			const res = await placePredictionBet(stakeNum, undefined, source, provider);
			if (res.ok) {
				onMessage(
					`${source === 'temporal' ? 'Temporal-pattern' : 'Prediction'} bet placed at ${stakeNum} ETB on account #${res.accountId ?? 'auto'}. ` +
						(source === 'temporal'
							? 'The ticket comes from the draws in this same ±10-min clock window over the last 7 days.'
							: 'The generated ticket appears on the Predictions page; results are marked after the settle.'),
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
		<CollapsibleCard title='Prediction betting — bet the latest prediction ticket' defaultOpen={false}>
			<div className='flex flex-wrap items-end gap-3'>
				<div className='space-y-1.5'>
					<Label>Stake (ETB)</Label>
					<Input type='number' min='2' value={stake} onChange={(e) => setStake(e.target.value)} placeholder='2' className='w-32' />
				</div>
				<div className='space-y-1.5'>
					<Label>Ticket source</Label>
					<select
						value={source}
						onChange={(e) => setSource(e.target.value === 'temporal' ? 'temporal' : 'prediction')}
						className='w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground'
					>
						<option value='prediction'>ML prediction (latest forecast)</option>
						<option value='temporal'>Temporal pattern (same clock-time window)</option>
					</select>
				</div>
				<Button onClick={onPlace} disabled={placing || !running}>
					{placing ? 'Placing…' : 'Bet prediction'}
				</Button>
			</div>
			<p className='mt-2 text-xs text-muted-foreground'>
				{source === 'temporal'
					? 'Places the top ticket from the temporal-pattern rankings (draws in this ±10-min window on each of the last 7 days).'
					: 'Uses the latest prediction&apos;s preferred ticket — the server picks the best-priced spot after the round opens. Manual one-off version of the per-round prediction-ticket betting in Configuration.'}
			</p>
		</CollapsibleCard>
	);
}