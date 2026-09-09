// Client mirror of the server paytable (server/src/autoplay/wsAutoplayEngine.ts
// KENO_ODDS). Kept here so the dashboard can show estimated wins live.
//   3-spot: 3 hits → x50, 2 hits → x2, 0-1 hits → lost.
//   2-spot: 2 hits → x10, 1 hit → x1 (stake back), 0 hits → lost.
export const KENO_ODDS: Record<number, Record<number, number>> = {
	2: { 1: 1, 2: 10 },
	3: { 2: 2, 3: 50 },
};

// Returns null when the table has no rule for this (spots, matched) shape.
export function paytableWin(spots: number, matched: number, stake: number): number | null {
	const table = KENO_ODDS[spots];
	if (!table) return matched <= 1 ? 0 : null;
	const odd = table[matched];
	return odd != null ? stake * odd : 0;
}
