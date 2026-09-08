'use client';

import { useMemo } from 'react';
import { Empty } from '@/components/app';
import type { AutoplayPlacedBet } from '@/lib/types';
import { CollapsibleCard } from './CollapsibleCard';
import { BetTable } from './BetTable';

// "Last round" = bets placed within one round window of the newest bet.
export const ROUND_WINDOW_MS = 30000;

export function LastRoundBetsCard({ bets }: { bets: AutoplayPlacedBet[] }) {
	const newest = useMemo(() => bets.reduce((m, b) => Math.max(m, b.placedAt ?? 0), 0), [bets]);
	const lastRound = useMemo(
		() => bets.filter((b) => (b.placedAt ?? 0) >= newest - ROUND_WINDOW_MS),
		[bets, newest],
	);

	return (
		<CollapsibleCard title={`Last round bets · ${lastRound.length}`} defaultOpen={true}>
			{lastRound.length === 0 ? (
				<Empty label='No bets placed in the last round yet.' />
			) : (
				<BetTable bets={lastRound} />
			)}
		</CollapsibleCard>
	);
}
