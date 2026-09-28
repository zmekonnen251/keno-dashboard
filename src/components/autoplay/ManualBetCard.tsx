'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getEligibleAccounts, placeManualBet } from '@/lib/api';
import { CollapsibleCard } from './CollapsibleCard';
import type { AccountGameStatus, BotTicket, EligibleAccount, RecurrenceSignal } from '@/lib/types';
import { NumberGrid, type BoardMarker } from './NumberGrid';
import {
	DIFFICULTY_OPTIONS,
	STRATEGY_OPTIONS,
	buildStrategyTicket,
	slicePool,
	type TicketDifficulty,
	type TicketStrategy,
} from './utils';

function suggestionChips(
	rec: RecurrenceSignal | null | undefined,
	spots: number,
): { key: string; label: string; numbers: number[] }[] {
	if (!rec) return [];
	const out: { key: string; label: string; numbers: number[] }[] = [];
	if (rec.suggestions.length >= 2) out.push({ key: 'repetitive', label: 'Repetitive', numbers: slicePool(rec.suggestions, spots) });
	if (rec.recurrenceNumbers.length >= 2)
		out.push({ key: 'recurring', label: 'Recurring', numbers: slicePool(rec.recurrenceNumbers, spots) });
	if (rec.chainNumbers.length >= 2) out.push({ key: 'chain', label: 'Chain', numbers: slicePool(rec.chainNumbers, spots) });
	if (rec.trendNumbers.length >= 2) out.push({ key: 'trend', label: 'Trend', numbers: slicePool(rec.trendNumbers, spots) });
	return out;
}

// The two ML ticket groups: "Most Repetitive 2–5 Digit" (most repeated
// numbers) and "Recurrence" (numbers that keep showing in recent draws).
// Each chip is a ready one-click ticket with a stake default of 5 ETB.
function mlTicketGroups(rec: RecurrenceSignal | null | undefined, spots: number): { key: string; label: string; chips: { id: string; numbers: number[]; stake: number; hint: string }[] }[] {
	if (!rec) return [];
	const groups: { key: string; label: string; chips: { id: string; numbers: number[]; stake: number; hint: string }[] }[] = [];
	const repetitive = rec.suggestions.length >= 2 ? slicePool(rec.suggestions, Math.min(spots, 5)) : [];
	const top3 = rec.suggestions.length >= 3 ? slicePool(rec.suggestions, 3) : [];
	const recurrence = rec.recurrenceNumbers.length >= 2 ? slicePool(rec.recurrenceNumbers, Math.min(spots, 5)) : [];
	if (repetitive.length >= 2)
		groups.push({
			key: 'ml-repetitive',
			label: 'Most Repetitive 2–5 Digit',
			chips: [
				{ id: `mlrep-${Date.now()}`, numbers: repetitive, stake: 5, hint: 'top repeated numbers' },
				...(top3.length >= 2 ? [{ id: `mlrep2-${Date.now()}`, numbers: top3, stake: 5, hint: 'top 3' }] : []),
			],
		});
	if (recurrence.length >= 2)
		groups.push({
			key: 'ml-recurrence',
			label: 'Recurrence',
			chips: [{ id: `mlrec-${Date.now()}`, numbers: recurrence, stake: 5, hint: 'recurring numbers' }],
		});
	return groups;
}

export function ManualBetCard({
	recurrence,
	accounts,
	onMessage,
	onRefresh,
	onPicksChange,
}: {
	running: boolean;
	recurrence?: RecurrenceSignal | null;
	accounts: AccountGameStatus[];
	onMessage: (msg: string) => void;
	onRefresh: () => void;
	onPicksChange?: (spots: number[]) => void;
}) {
	const [spotsCount, setSpotsCount] = useState<number>(3);
	const [selectedSpots, setSelectedSpots] = useState<number[]>([]);
	const [manualStake, setManualStake] = useState('5');
	const [stakeMode, setStakeMode] = useState<'custom' | 'quick'>('custom');
	const [accountMode, setAccountMode] = useState<'auto' | 'manual'>('auto');
	const [selectedAccountId, setSelectedAccountId] = useState('');
	const [eligible, setEligible] = useState<EligibleAccount[]>([]);
	const [placing, setPlacing] = useState(false);

	const [strategy, setStrategy] = useState<TicketStrategy>('cluster');
	const [difficulty, setDifficulty] = useState<TicketDifficulty>('medium');
	const [ticketStake, setTicketStake] = useState('5');
	const [staticTicket, setStaticTicket] = useState(true);
	const [savedTickets, setSavedTickets] = useState<BotTicket[]>([]);
	const [genCount, setGenCount] = useState(0);

	// AI one-click tickets: dedicated stake + auto-refresh of the signal picks.
	const [aiStake, setAiStake] = useState('5');
	const [placingKey, setPlacingKey] = useState<string | null>(null);
	const [autoRefresh, setAutoRefresh] = useState(true);

	const stakeNum = parseFloat(manualStake) || 2;
	const aiStakeNum = parseFloat(aiStake) || 2;

	// Keep the latest onRefresh without re-arming the interval on every parent
	// re-render (the parent re-creates the handler on each status poll).
	const onRefreshRef = useRef(onRefresh);
	useEffect(() => {
		onRefreshRef.current = onRefresh;
	}, [onRefresh]);

	// Auto-refresh the AI ticket picks every 30s (in addition to the parent's
	// status poll) so Repetitive / Recurring / Chain / Trend chips track fresh
	// signals without a manual refresh of the page.
	useEffect(() => {
		if (!autoRefresh) return;
		const t = setInterval(() => onRefreshRef.current(), 30000);
		return () => clearInterval(t);
	}, [autoRefresh]);

	useEffect(() => {
		onPicksChange?.(selectedSpots);
	}, [selectedSpots, onPicksChange]);

	useEffect(() => {
		if (accountMode !== 'manual') return;
		let cancelled = false;
		getEligibleAccounts(stakeNum)
			.then((res) => {
				if (!cancelled) setEligible(res.accounts || []);
			})
			.catch(() => {
				if (!cancelled) setEligible([]);
			});
		return () => {
			cancelled = true;
		};
	}, [accountMode, stakeNum]);

	function toggleNumber(n: number) {
		setSelectedSpots((prev) => {
			if (prev.includes(n)) return prev.filter((x) => x !== n);
			if (prev.length >= spotsCount) return [...prev.slice(1), n];
			return [...prev, n].sort((a, b) => a - b);
		});
	}

	function applySuggested(numbers: number[]) {
		setSelectedSpots(numbers.slice(0, spotsCount).sort((a, b) => a - b));
	}

	function generateFromStrategy() {
		const pools = {
			chain: recurrence?.chainNumbers ?? [],
			recurrence: recurrence?.recurrenceNumbers ?? [],
			trend: recurrence?.trendNumbers ?? [],
			suggestions: recurrence?.suggestions ?? [],
		};
		const offset = staticTicket ? 0 : genCount * spotsCount;
		const picks = buildStrategyTicket(strategy, spotsCount, pools, offset);
		setGenCount((c) => c + 1);
		setSelectedSpots(picks);
	}

	function saveCurrentTicket() {
		if (selectedSpots.length < 2) {
			onMessage('Pick at least 2 numbers before saving the ticket.');
			return;
		}
		const ticket: BotTicket = {
			id: `t${Date.now()}`,
			spots: selectedSpots.length,
			strategy,
			stake: parseFloat(ticketStake) || 2,
			enabled: true,
			staticTicket,
			numbers: [...selectedSpots],
		};
		setSavedTickets((prev) => [ticket, ...prev].slice(0, 20));
		onMessage(`Ticket saved (${staticTicket ? 'static' : 'dynamic'} ${strategy} · ${ticket.stake} ETB).`);
	}

	async function onPlaceBet() {
		if (selectedSpots.length < 2) {
			onMessage('Select at least 2 numbers first — tap a suggested ticket or the grid.');
			return;
		}
		if (stakeNum < 2) {
			onMessage('Stake must be >= 2 ETB.');
			return;
		}
		const accountId = accountMode === 'manual' && selectedAccountId !== '' ? parseInt(selectedAccountId, 10) : undefined;
		if (accountMode === 'manual' && (accountId == null || !Number.isFinite(accountId))) {
			onMessage('Pick an account first, or switch to Auto so the server selects one.');
			return;
		}
		setPlacing(true);
		try {
			const res = await placeManualBet(selectedSpots, stakeNum, accountId);
			if (res.ok) {
				onMessage(`Bet placed! Ticket [${selectedSpots.join(',')}] · ${stakeNum} ETB · account #${res.accountId ?? 'auto'}.`);
				onRefresh();
			} else {
				onMessage(`Bet failed: ${res.failReason || 'unknown error'}`);
			}
		} finally {
			setPlacing(false);
		}
	}

	/** One-click AI ticket: place a Repetitive/Recurring/Chain/Trend chip
	 *  immediately at the configured AI ticket stake. */
	async function placeAiChip(numbers: number[], label: string, chipId: string) {
		if (numbers.length < 2) {
			onMessage('AI ticket needs at least 2 numbers.');
			return;
		}
		if (aiStakeNum < 2) {
			onMessage('AI ticket stake must be >= 2 ETB.');
			return;
		}
		const accountId = accountMode === 'manual' && selectedAccountId !== '' ? parseInt(selectedAccountId, 10) : undefined;
		if (accountMode === 'manual' && (accountId == null || !Number.isFinite(accountId))) {
			onMessage('Pick an account first, or switch to Auto so the server selects one.');
			return;
		}
		setPlacingKey(chipId);
		try {
			const res = await placeManualBet(numbers, aiStakeNum, accountId);
			if (res.ok) {
				onMessage(`AI ${label} ticket [${numbers.join(',')}] placed · ${aiStakeNum} ETB · account #${res.accountId ?? 'auto'}.`);
				onRefresh();
			} else {
				onMessage(`AI ${label} ticket failed: ${res.failReason || 'unknown error'}`);
			}
		} finally {
			setPlacingKey(null);
		}
	}

	const chips = suggestionChips(recurrence ?? null, spotsCount);
	const mlGroups = mlTicketGroups(recurrence ?? null, spotsCount);
	const markers: Partial<Record<number, BoardMarker>> = {};
	for (const c of chips) {
		for (const n of c.numbers) {
			if (!selectedSpots.includes(n)) markers[n] = 'suggested';
		}
	}
	const manualAccounts = accountMode === 'manual' ? (eligible.length > 0 ? eligible : accounts.map((a) => ({ accountId: a.accountId, phone: a.phone, balance: a.balance, connected: a.connected }))) : [];

	// Stake cap: min 2, max = the selected account's balance (manual mode) or
	// the richest enabled wallet (auto mode, server picks which one).
	const maxBalance = accounts.length > 0 ? Math.max(...accounts.map((a) => a.balance ?? 0)) : 2;
	const stakeMax = Math.max(
		2,
		accountMode === 'manual'
			? manualAccounts.find((a) => String(a.accountId) === selectedAccountId)?.balance ?? maxBalance
			: maxBalance,
	);

	function clampStakeInput(v: string): string {
		const n = parseFloat(v);
		if (!Number.isFinite(n)) return '';
		return String(Math.min(Math.max(n, 2), stakeMax));
	}

	function x2Stake() {
		setManualStake(clampStakeInput(String(stakeNum * 2)));
	}

	return (
		<CollapsibleCard title='Manual play — pick a ticket, set stake, place bet' defaultOpen={false}>
			<div className='space-y-4'>
				<p className='text-sm text-muted-foreground'>
					Click a suggested ticket (repetitive / recurring / chain / trend) or tap the number grid like the real keno
					board. Each suggested ticket also has a one-click <span className='font-bold text-emerald-600 dark:text-emerald-400'>Bet</span> button
					that places it instantly at the AI stake below (min 2 ETB). With a bigger stake the server picks a wallet that
					can cover it.
				</p>

				<div className='flex flex-wrap items-center gap-2'>
					<div className='flex items-center gap-2'>
						<Label>AI stake (ETB)</Label>
						<Input
							type='number'
							min='2'
							max={stakeMax}
							value={aiStake}
							onChange={(e) => {
								const n = parseFloat(e.target.value);
								if (!Number.isFinite(n) && e.target.value !== '') return;
								setAiStake(String(Math.min(Math.max(n || 2, 2), stakeMax)));
							}}
							placeholder='5'
							className='w-24'
						/>
					</div>
					<button
						type='button'
						onClick={() => setAutoRefresh((v) => !v)}
						title='Auto-refresh the AI ticket picks every 30s'
						className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
							autoRefresh
								? 'border-emerald-600 bg-emerald-600 text-white'
								: 'border-border bg-muted/40 text-foreground hover:bg-muted/70'
						}`}
					>
						{autoRefresh ? '✓' : '○'} Auto-refresh picks (30s)
					</button>
				</div>

				<div>
					<div className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Suggested tickets</div>
					{chips.length === 0 ? (
						<p className='mt-1 text-xs text-muted-foreground'>Waiting for draw history — pick numbers on the grid below.</p>
					) : (
						<div className='mt-2 flex flex-wrap gap-2'>
							{chips.map((c) => (
								<div key={c.key} className='flex items-center gap-2'>
									<Button variant='outline' size='sm' onClick={() => applySuggested(c.numbers)}>
										{c.label}: [{c.numbers.join(',')}]
									</Button>
									<Button
										size='sm'
										variant='default'
										className='bg-emerald-600 font-mono text-[11px] hover:bg-emerald-500'
										disabled={placingKey !== null}
										title={`Place [${c.numbers.join(',')}] instantly at ${aiStakeNum} ETB`}
										onClick={() => void placeAiChip(c.numbers, c.label, `chip-${c.key}`)}
									>
										{placingKey === `chip-${c.key}` ? 'Placing…' : `Bet ${aiStakeNum} ETB`}
									</Button>
								</div>
							))}
						</div>
					)}
				</div>

				{mlGroups.length > 0 && (
					<div className='space-y-2 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3'>
						<div className='text-xs font-medium uppercase tracking-wide text-purple-300'>ML tickets — one-click groups</div>
						{mlGroups.map((g) => (
							<div key={g.key}>
								<div className='flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-purple-300'>
									{g.label}
									<span className='rounded-full bg-purple-500/20 px-1.5 py-0.5 text-[9px] text-purple-200'>{g.chips.length}</span>
								</div>
								<div className='mt-1.5 flex flex-wrap gap-2'>
									{g.chips.map((c) => (
										<div key={c.id} className='flex items-center gap-2'>
											<Button
												size='sm'
												variant='outline'
												className='border-purple-500/30 bg-purple-600/20 font-mono text-[11px] text-purple-100 hover:bg-purple-500/40'
												title={`Apply [${c.numbers.join(',')}] to the board · right-click for options`}
												onClick={() => applySuggested(c.numbers)}
												onContextMenu={(e) => {
													e.preventDefault();
													setSelectedSpots(c.numbers.slice(0, spotsCount).sort((a, b) => a - b));
													setTicketStake(String(c.stake));
													onMessage(`Applied ML ticket [${c.numbers.join(',')}] · ${c.stake} ETB — setting the ticket stake to ${c.stake} ETB.`);
												}}
											>
												[{c.numbers.join(',')}] <span className='ml-1 text-[9px] opacity-70'>{c.hint} · {c.stake} ETB</span>
											</Button>
											<Button
												size='sm'
												variant='default'
												className='bg-emerald-600 font-mono text-[11px] hover:bg-emerald-500'
												disabled={placingKey !== null}
												title={`Place [${c.numbers.join(',')}] instantly at ${aiStakeNum} ETB`}
												onClick={() => void placeAiChip(c.numbers, g.label, `ml-${g.key}-${c.id}`)}
											>
												{placingKey === `ml-${g.key}-${c.id}` ? 'Placing…' : `Bet ${aiStakeNum} ETB`}
											</Button>
										</div>
									))}
								</div>
							</div>
						))}
						<p className='text-[10px] text-purple-200/50'>Click a chip to load it onto the board — right-click applies it and sets the ticket stake. The green Bet button places it instantly at the AI stake.</p>
					</div>
				)}

				<div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
					<div>
						<NumberGrid selected={selectedSpots} max={spotsCount} onToggle={toggleNumber} onClear={() => setSelectedSpots([])} markers={markers} />
					</div>
					<div className='space-y-3'>
						<div className='grid grid-cols-2 gap-2'>
							<div className='space-y-1.5'>
								<Label>Spots per ticket</Label>
								<select
									value={String(spotsCount)}
									onChange={(e) => {
										const v = Number(e.target.value);
										setSpotsCount(v);
										setSelectedSpots((prev) => prev.slice(0, v));
									}}
									className='w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground'
								>
									{Array.from({ length: 9 }, (_, i) => i + 2).map((n) => (
										<option key={n} value={n}>{n} numbers</option>
									))}
								</select>
							</div>
							<div className='space-y-1.5'>
								<Label>Stake (ETB)</Label>
								<div className='flex items-center gap-1'>
									<button
										type='button'
										onClick={() => setStakeMode('custom')}
										className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${stakeMode === 'custom' ? 'bg-blue-600 text-white' : 'bg-black/5 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}
									>
										Custom
									</button>
									<button
										type='button'
										onClick={() => setStakeMode('quick')}
										className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${stakeMode === 'quick' ? 'bg-blue-600 text-white' : 'bg-black/5 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}
									>
										Quick
									</button>
									<Button size='xs' variant='outline' className='ml-auto h-6 px-1.5 text-[10px]' onClick={x2Stake} title='Double the current stake'>
										×2
									</Button>
								</div>
								{stakeMode === 'custom' ? (
									<Input type='number' min='2' max={stakeMax} value={manualStake} onChange={(e) => setManualStake(clampStakeInput(e.target.value))} placeholder='5' />
								) : (
									<details className='rounded-lg border border-border bg-black/5 dark:bg-white/5'>
										<summary className='cursor-pointer select-none px-2 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300'>
											Quick stakes: 2 / 5 / 8 / 10 / 20 ETB
										</summary>
										<div className='flex flex-wrap gap-1.5 px-2 pb-2 pt-1'>
											{[2, 5, 8, 10, 20].map((n) => (
												<Button
													key={n}
													size='xs'
													variant={stakeNum === n ? 'default' : 'outline'}
													className='h-7 min-w-11 px-2 font-mono'
													onClick={() => setManualStake(clampStakeInput(String(n)))}
												>
													{n}
												</Button>
											))}
											<Button size='xs' variant='outline' className='h-7 px-2 font-mono' onClick={x2Stake}>
												×2
											</Button>
										</div>
									</details>
								)}
								<p className='text-[10px] text-muted-foreground'>Min 2 · Max {stakeMax} ETB (richest wallet)</p>
							</div>
						</div>

						<div className='space-y-1.5'>
							<Label>Account</Label>
							<select
								value={accountMode}
								onChange={(e) => setAccountMode(e.target.value as 'auto' | 'manual')}
								className='w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground'
							>
								<option value='auto'>Auto — server selects an eligible account</option>
								<option value='manual'>Manual — I select the account</option>
							</select>
						</div>

						{accountMode === 'manual' && (
							<div className='space-y-1.5'>
								<Label>Account (balance ≥ stake preferred)</Label>
								<select
									value={selectedAccountId}
									onChange={(e) => setSelectedAccountId(e.target.value)}
									className='w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground'
								>
									<option value=''>Select account…</option>
									{manualAccounts.map((a) => (
										<option key={a.accountId} value={String(a.accountId)}>
											#{a.accountId} · {a.phone} · {a.balance} ETB{a.connected ? '' : ' (offline)'}
										</option>
									))}
								</select>
							</div>
						)}

						<div className='rounded-lg border border-border p-3'>
							<div className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Strategy ticket builder</div>
							<div className='mt-2 grid grid-cols-2 gap-2'>
								<div className='space-y-1.5'>
									<Label>Strategy</Label>
									<select
										value={strategy}
										onChange={(e) => setStrategy(e.target.value as TicketStrategy)}
										className='w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground'
									>
										{STRATEGY_OPTIONS.map((o) => (
											<option key={o.value} value={o.value}>
												{o.label}
											</option>
										))}
									</select>
								</div>
								<div className='space-y-1.5'>
									<Label>Difficulty</Label>
									<select
										value={difficulty}
										onChange={(e) => setDifficulty(e.target.value as TicketDifficulty)}
										className='w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground'
									>
										{DIFFICULTY_OPTIONS.map((o) => (
											<option key={o.value} value={o.value}>
												{o.label}
											</option>
										))}
									</select>
								</div>
							</div>
							<div className='mt-2 grid grid-cols-2 gap-2'>
								<div className='space-y-1.5'>
									<Label>Ticket stake (ETB)</Label>
									<Input type='number' min='2' value={ticketStake} onChange={(e) => setTicketStake(e.target.value)} placeholder='2' />
								</div>
								<div className='space-y-1.5'>
									<Label>Ticket type</Label>
									<select
										value={staticTicket ? 'static' : 'dynamic'}
										onChange={(e) => setStaticTicket(e.target.value === 'static')}
										className='w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground'
									>
										<option value='static'>Static — same numbers every time</option>
										<option value='dynamic'>Dynamic — rotates with strategy</option>
									</select>
								</div>
							</div>
							<div className='mt-2 flex flex-wrap gap-2'>
								<Button variant='outline' size='sm' onClick={generateFromStrategy}>
									Generate from strategy
								</Button>
								<Button variant='outline' size='sm' onClick={saveCurrentTicket}>
									Save current as ticket
								</Button>
							</div>
							{savedTickets.length > 0 && (
								<div className='mt-2 space-y-1'>
									{savedTickets.map((t) => (
										<div key={t.id} className='flex items-center justify-between gap-2 rounded-md bg-muted px-2 py-1.5 text-xs'>
											<span className='font-mono'>
												[{(t.numbers ?? []).join(',')}] · {t.strategy} · {t.staticTicket ? 'static' : 'dynamic'} · {t.stake} ETB
											</span>
											<span className='flex gap-1'>
												<Button
													variant='ghost'
													size='xs'
													onClick={() => {
														if (t.numbers) {
															setSelectedSpots(t.numbers.slice(0, spotsCount));
															setTicketStake(String(t.stake));
														}
													}}
												>
													Use
												</Button>
												<Button variant='ghost' size='xs' onClick={() => setSavedTickets((prev) => prev.filter((x) => x.id !== t.id))}>
													Delete
												</Button>
											</span>
										</div>
									))}
								</div>
							)}
						</div>

						<div className='rounded-lg border border-border p-3 font-mono text-xs'>
							Selected: {selectedSpots.length > 0 ? `[${selectedSpots.join(',')}]` : '—'} · {stakeNum} ETB
						</div>

					<Button onClick={onPlaceBet} disabled={placing}>
						{placing ? 'Placing…' : 'Place bet'}
					</Button>
				</div>
			</div>
		</div>
		</CollapsibleCard>
	);
}
