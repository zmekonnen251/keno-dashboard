'use client';

import { StatCard } from '@/components/app';
import type { AutoplayConfig, AutoplayStatus } from '@/lib/types';

function ticketSource(cfg?: AutoplayConfig | null): string {
	if (!cfg) return '—';
	if (cfg.use_two_digit_tickets) return '2-digit ML';
	if (cfg.prediction_ticket_betting) {
		return cfg.prediction_source === 'temporal' ? 'Temporal prediction' : 'ML prediction';
	}
	if (cfg.mode === 'C') return `${cfg.digit_count}-digit suggestions`;
	if (cfg.mode === 'B') return 'Split base tickets';
	return 'Base tickets';
}

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
	// Worst-case spend for one full round: every connected worker places its
	// tickets at the configured stake (2-digit stake wins when that mode is on).
	const stake = cfg?.use_two_digit_tickets && (cfg?.two_digit_stake ?? 0) > 0 ? cfg!.two_digit_stake : cfg?.stake;
	const workers = conn?.connectedWorkers ?? 0;
	const perRound = stake && workers > 0 ? stake * (cfg?.tickets_per_account ?? 1) * workers : null;

	return (
		<div className='grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4'>
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
			<StatCard label='Stake' value={`${cfg?.stake ?? '—'} ETB`} sub='per ticket' />
			<StatCard
				label='Round budget'
				value={perRound != null ? `${perRound.toFixed(2)} ETB` : '—'}
				sub={`${cfg?.tickets_per_account ?? 1} ticket(s)/account`}
				tone={perRound != null ? 'accent' : 'default'}
			/>
			<StatCard label='Ticket source' value={ticketSource(cfg)} sub={cfg?.prediction_source === 'temporal' ? 'temporal window' : undefined} />
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
