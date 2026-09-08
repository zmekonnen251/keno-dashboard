'use client';

import { useMemo } from 'react';
import { Empty } from '@/components/app';
import type { AutoplayPlacedBet } from '@/lib/types';
import { CollapsibleCard } from './CollapsibleCard';
import { BetTable } from './BetTable';

export const BIG_WIN_ETB = 100;

export function BigWinsCard({ bets }: { bets: AutoplayPlacedBet[] }) {
	const bigWins = useMemo(() => bets.filter((b) => (b.winAmount ?? 0) >= BIG_WIN_ETB), [bets]);

	return (
		<CollapsibleCard title={`Big wins (≥ ${BIG_WIN_ETB} ETB) · ${bigWins.length}`} defaultOpen={false}>
			{bigWins.length === 0 ? (
				<Empty label={`No wins ≥ ${BIG_WIN_ETB} ETB yet.`} />
			) : (
				<BetTable bets={bigWins} />
			)}
		</CollapsibleCard>
	);
}
