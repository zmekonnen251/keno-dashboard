// clientEngineUtils.ts

import { Account, AutoplayConfig } from "./types";

export interface PlacedBet {
	accountId: number;
	phone: string;
	spots: number[];
	stake: number;
	requestId: string;
	ok: boolean;
	status: 'failed' | 'pending' | 'won' | 'lost';
	winAmount: number | null;
	drawnSpots: number[] | null;
	matched: number | null;
	balanceAfter: number | null;
	placedAt: number;
	settledAt: number | null;
}

export interface AccountGameStatus {
	accountId: number;
	phone: string;
  tokenOk: boolean;
  wsTokenOk: boolean;
	connected: boolean;
	lastStatus: string;
	lastBetAt: number | null;
	lastSpots: number[] | null;
	lastStake: number | null;
	state: 'idle' | 'betting' | 'won' | 'lost' | 'pending' | 'error';
	winAmount: number | null;
	balance: number;
	updatedAt: number;
}

export const MODE_A_BASELINE: number[][] = [
	[1, 2, 3],
	[2, 3, 4],
	[5, 6, 7],
	[6, 7, 8],
	[7, 8, 9],
	[8, 9, 10],
	[11, 12, 13],
	[21, 22, 23],
	[31, 32, 33],
	[41, 42, 43],
	[61, 62, 63],
];

export function randRequestId(): string {
	// Timestamp prefix + randomness: unique across thousands of bets per day
	// (short random IDs collide and corrupt same-id bet records).
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let s = Date.now().toString(36).toUpperCase();
	for (let i = 0; i < 6; i++)
		s += chars[Math.floor(Math.random() * chars.length)];
	return s;
}

export function buildRoundTickets(
	accounts: Account[],
	config: AutoplayConfig,
	predictionPick: number[] | null,
) {
	if (accounts.length === 0) return [];
	const stake = config.stake > 0 ? config.stake : 2;

	return accounts.map((account, i) => {
		let spots = MODE_A_BASELINE[i % MODE_A_BASELINE.length];
		if (predictionPick && predictionPick.length >= 2) {
			spots = predictionPick.slice(0, config.digit_count || 2);
		}
		return { accountId: account.id, spots, stake };
	});
}
