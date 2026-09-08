import type { AutoplayPlacedBet } from '@/lib/types';

export function ticketsToText(tickets: number[][] | null | undefined): string {
	return (tickets || []).map((t) => t.join(',')).join('\n');
}

export function textToTickets(text: string): number[][] | null {
	const lines = text
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l.length > 0);
	const tickets = lines
		.map((line) =>
			line
				.split(/[,;\s]+/)
				.map((n) => parseInt(n, 10))
				.filter((n) => Number.isFinite(n) && n >= 1 && n <= 80),
		)
		.filter((t) => t.length > 0);
	return tickets.length > 0 ? tickets : null;
}

export function stateTone(state: string): 'default' | 'destructive' | 'secondary' | 'outline' {
	if (state === 'won') return 'default';
	if (state === 'lost' || state === 'error' || state === 'failed') return 'destructive';
	if (state === 'betting' || state === 'pending') return 'secondary';
	return 'outline';
}

export function betLabel(p: AutoplayPlacedBet): string {
	if (p.status === 'won') return 'won';
	if (p.status === 'lost') return 'lost';
	if (p.status === 'pending' || p.ok) return 'sent';
	return 'not sent';
}

export function formatTs(ms?: number | null): string {
	if (!ms) return '—';
	return new Date(ms).toLocaleTimeString();
}

export type TicketStrategy = 'cluster' | 'standard' | 'pattern';
export type TicketDifficulty = 'easy' | 'medium' | 'hard';

export const STRATEGY_OPTIONS: { value: TicketStrategy; label: string }[] = [
	{ value: 'cluster', label: 'Cluster (K-Means grouping)' },
	{ value: 'standard', label: 'Standard (heuristic scoring)' },
	{ value: 'pattern', label: 'Pattern (historical patterns)' },
];

export const DIFFICULTY_OPTIONS: { value: TicketDifficulty; label: string }[] = [
	{ value: 'easy', label: 'Easy' },
	{ value: 'medium', label: 'Medium' },
	{ value: 'hard', label: 'Hard' },
];

const FALLBACK_POOL = [1, 2, 3, 8, 9, 10, 58, 59, 60, 71, 72, 73, 77, 78, 79, 80];

/** Slice a suggestion pool into a ticket of `spots` numbers (mirrors extension slicing). */
export function slicePool(pool: number[], spots: number, offset = 0): number[] {
	const clean = [...new Set(pool.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n >= 1 && n <= 80))];
	const source = clean.length >= spots ? clean : [...clean, ...FALLBACK_POOL.filter((n) => !clean.includes(n))];
	const out: number[] = [];
	for (let j = 0; j < spots; j++) {
		out.push(source[(offset + j) % source.length]);
	}
	return out;
}

/** Build one ticket from a strategy + suggestion pools (static = always offset 0). */
export function buildStrategyTicket(
	strategy: TicketStrategy,
	spots: number,
	pools: { chain: number[]; recurrence: number[]; trend: number[]; suggestions: number[] },
	offset = 0,
): number[] {
	if (strategy === 'pattern') return slicePool([...pools.recurrence, ...pools.trend], spots, offset);
	if (strategy === 'cluster') return slicePool([...pools.chain, ...pools.suggestions], spots, offset);
	return slicePool([...pools.suggestions, ...pools.chain], spots, offset);
}
