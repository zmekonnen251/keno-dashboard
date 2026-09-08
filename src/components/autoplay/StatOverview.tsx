'use client';

import { StatCard } from '@/components/app';
import type { AutoplayConfig, AutoplayStatus } from '@/lib/types';

export function StatOverview({
	conn,
	cfg,
	gameState,
	signals,
}: {
	conn?: AutoplayStatus | null;
	cfg?: AutoplayConfig | null;
	gameState: 'betting_open' | 'drawing' | 'settled' | 'unknown';
	signals: 'repetitive' | 'recurring' | 'hot' | 'none';
}) {
	return (
		<div className='grid grid-cols-2 gap-4 md:grid-cols-3'>
			<StatCard label='Enabled' value={conn?.enabled ? 'Yes' : 'No'} tone={conn?.enabled ? 'positive' : 'default'} />
			<StatCard label='Running' value={conn?.running ? 'Yes' : 'No'} tone={conn?.running ? 'positive' : 'default'} />
			<StatCard
				label='Workers'
				value={`${conn?.connectedWorkers ?? 0}/${conn?.workers ?? 0}`}
				sub='connected / pool'
				tone='accent'
			/>
			<StatCard
				label='Fresh pool'
				value={`${conn?.freshAccounts ?? 0}/${conn?.workers ?? 0}`}
				sub='2-Birr / never-bet accounts prioritized'
				tone={conn?.connectedWorkers ? 'accent' : 'default'}
			/>
			<StatCard label='Stake' value={`${cfg?.stake ?? '—'} ETB`} />
			<StatCard
				label='Repetitive auto-bet'
				value={cfg?.repetitive_auto_bet ? 'On' : 'Off'}
				sub='bet recent repeating numbers / patterns'
				tone={cfg?.repetitive_auto_bet ? 'positive' : 'default'}
			/>
			<StatCard
				label='Game state'
				value={gameState === 'betting_open' ? 'OPEN' : gameState === 'drawing' ? 'DRAWING' : gameState === 'settled' ? 'SETTLED' : 'Unknown'}
				tone={gameState === 'betting_open' ? 'positive' : gameState === 'drawing' ? 'negative' : 'accent'}
			/>
			<StatCard
				label='Signals'
				value={signals === 'repetitive' ? 'Repetitive' : signals === 'recurring' ? 'Recurring' : signals === 'hot' ? 'Hot digits' : 'None'}
				tone={signals === 'repetitive' ? 'positive' : signals === 'recurring' ? 'accent' : 'default'}
			/>
		</div>
	);
}
