'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/app';
import { getEligibleAccounts, placeManualBet } from '@/lib/api';
import type { AccountGameStatus, BotTicket, EligibleAccount, RecurrenceSignal } from '@/lib/types';
import { NumberGrid } from './NumberGrid';
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

export function ManualBetCard({
	running,
	recurrence,
	accounts,
	onMessage,
	onRefresh,
}: {
	running: boolean;
	recurrence?: RecurrenceSignal | null;
	accounts: AccountGameStatus[];
	onMessage: (msg: string) => void;
	onRefresh: () => void;
}) {
	const [spotsCount, setSpotsCount] = useState<2 | 3>(3);
	const [selectedSpots, setSelectedSpots] = useState<number[]>([]);
	const [manualStake, setManualStake] = useState('2');
	const [accountMode, setAccountMode] = useState<'auto' | 'manual'>('auto');
	const [selectedAccountId, setSelectedAccountId] = useState('');
	const [eligible, setEligible] = useState<EligibleAccount[]>([]);
	const [placing, setPlacing] = useState(false);

	const [strategy, setStrategy] = useState<TicketStrategy>('cluster');
	const [difficulty, setDifficulty] = useState<TicketDifficulty>('medium');
	const [ticketStake, setTicketStake] = useState('2');
	const [staticTicket, setStaticTicket] = useState(true);
	const [savedTickets, setSavedTickets] = useState<BotTicket[]>([]);
	const [genCount, setGenCount] = useState(0);

	const stakeNum = parseFloat(manualStake) || 2;

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

	const chips = suggestionChips(recurrence ?? null, spotsCount);
	const manualAccounts = accountMode === 'manual' ? (eligible.length > 0 ? eligible : accounts.map((a) => ({ accountId: a.accountId, phone: a.phone, balance: a.balance, connected: a.connected }))) : [];

	return (
		<Card title='Manual play — pick a ticket, set stake, place bet'>
			<div className='space-y-4'>
				<p className='text-sm text-muted-foreground'>
					Click a suggested ticket (repetitive / recurring / chain / trend) or tap the number grid like the real keno
					board. Stake defaults to 2 ETB — with a bigger stake the server picks a wallet that can cover it.
				</p>

				<div>
					<div className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Suggested tickets</div>
					{chips.length === 0 ? (
						<p className='mt-1 text-xs text-muted-foreground'>Waiting for draw history — pick numbers on the grid below.</p>
					) : (
						<div className='mt-2 flex flex-wrap gap-2'>
							{chips.map((c) => (
								<Button key={c.key} variant='outline' size='sm' onClick={() => applySuggested(c.numbers)}>
									{c.label}: [{c.numbers.join(',')}]
								</Button>
							))}
						</div>
					)}
				</div>

				<div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
					<div>
						<NumberGrid selected={selectedSpots} max={spotsCount} onToggle={toggleNumber} onClear={() => setSelectedSpots([])} />
					</div>
					<div className='space-y-3'>
						<div className='grid grid-cols-2 gap-2'>
							<div className='space-y-1.5'>
								<Label>Spots per ticket</Label>
								<select
									value={String(spotsCount)}
									onChange={(e) => {
										const v = e.target.value === '2' ? 2 : 3;
										setSpotsCount(v);
										setSelectedSpots((prev) => prev.slice(0, v));
									}}
									className='w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground'
								>
									<option value='2'>2 numbers</option>
									<option value='3'>3 numbers</option>
								</select>
							</div>
							<div className='space-y-1.5'>
								<Label>Stake (ETB)</Label>
								<Input type='number' min='2' value={manualStake} onChange={(e) => setManualStake(e.target.value)} placeholder='2' />
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
								<Button variant='outline' size='sm' onClick={generateFromStrategy} disabled={!running}>
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

						<Button onClick={onPlaceBet} disabled={placing || !running}>
							{placing ? 'Placing…' : 'Place bet'}
						</Button>
					</div>
				</div>
			</div>
		</Card>
	);
}
