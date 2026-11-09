'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { setAutoplayConfig } from '@/lib/api';
import { formatTime } from '@/lib/format';
import type { AutoplayConfig } from '@/lib/types';
import { ticketsToText, textToTickets } from './utils';
import { CollapsibleCard } from './CollapsibleCard';

// Full-hit probabilities from the keno paytable (2-spot 190/3160, 3-spot
// 1140/82160). Expected stake per full hit is stake/p, independent of N.
const P_FULL_2 = 190 / 3160;
const P_FULL_3 = 1140 / 82160;

function pct(x: number, digits = 2): string {
	return `${(x * 100).toFixed(digits)}%`;
}

function anyHit(p: number, n: number): number {
	return n > 0 ? 1 - Math.pow(1 - p, n) : 0;
}

// Toggle fields that persist immediately (partial PATCH). Leaving them as
// checkboxes inside the form meant a switch only applied after Save, which
// made the engine look unresponsive.
type BoolField = 'enabled' | 'repetitive_auto_bet' | 'use_two_digit_tickets' | 'prediction_ticket_betting';

const BOOL_LABELS: Record<BoolField, string> = {
	enabled: 'Autoplay config',
	repetitive_auto_bet: 'Repetitive auto-bet',
	use_two_digit_tickets: '2-digit ML tickets',
	prediction_ticket_betting: 'Prediction-ticket betting',
};

export function ConfigCard({
	cfg,
	onSaved,
	onRefresh,
	siteId,
	accountCount,
	defaultOpen = true,
}: {
	cfg?: AutoplayConfig | null;
	onSaved: (msg: string) => void;
	onRefresh: () => void;
	siteId?: string;
	/** Eligible account count — used only for the per-round spend estimate. */
	accountCount?: number;
	defaultOpen?: boolean;
}) {
	const [loaded, setLoaded] = useState(false);
	const [enabled, setEnabled] = useState(false);
	const [stake, setStake] = useState('');
	const [batch, setBatch] = useState('');
	const [ticketsPerAccount, setTicketsPerAccount] = useState('1');
	const [mode, setMode] = useState<'A' | 'B' | 'C'>('A');
	const [splitRatio, setSplitRatio] = useState<'uniform' | '1/2' | '1/3'>('uniform');
	const [digitCount, setDigitCount] = useState<2 | 3>(3);
	const [ticketsText, setTicketsText] = useState('');
	const [repBet, setRepBet] = useState(true);
	const [predTicketBetting, setPredTicketBetting] = useState(false);
	const [predTicketsPerRound, setPredTicketsPerRound] = useState('');
	const [useTwoDigitTickets, setUseTwoDigitTickets] = useState(false);
	const [twoDigitStake, setTwoDigitStake] = useState('');
	const [predSource, setPredSource] = useState<'combined' | 'temporal'>('combined');
	const [saving, setSaving] = useState(false);
	const [savingBool, setSavingBool] = useState<BoolField | null>(null);
	const [feedback, setFeedback] = useState('');
	const seeded = useRef(false);

	function applyConfig(c: AutoplayConfig) {
		setEnabled(c.enabled === true);
		setStake(String(c.stake ?? ''));
		setBatch(String(c.batch_size ?? ''));
		setTicketsPerAccount(String(c.tickets_per_account ?? 1));
		setMode(c.mode ?? 'A');
		setSplitRatio(c.split_ratio ?? 'uniform');
		setDigitCount(c.digit_count ?? 3);
		setTicketsText(ticketsToText(c.base_tickets));
		setRepBet(c.repetitive_auto_bet ?? true);
		setPredTicketBetting(c.prediction_ticket_betting ?? false);
		setPredTicketsPerRound(String(c.prediction_tickets_per_round ?? 0));
		setUseTwoDigitTickets(c.use_two_digit_tickets ?? false);
		setTwoDigitStake(c.two_digit_stake ? String(c.two_digit_stake) : '');
		setPredSource((c.prediction_source ?? 'combined') === 'temporal' ? 'temporal' : 'combined');
		setLoaded(true);
	}

	// Auto-load the live config once it arrives so the editor is immediately
	// usable (it used to require a "Load current" click first).
	useEffect(() => {
		if (cfg && !seeded.current) {
			applyConfig(cfg);
			seeded.current = true;
		}
	}, [cfg]);

	function onLoadCurrent() {
		if (!cfg) return;
		applyConfig(cfg);
		seeded.current = true;
		setFeedback('');
		onSaved('');
	}

	function onDefaults() {
		setEnabled(false);
		setStake('2');
		setBatch('1');
		setTicketsPerAccount('1');
		setMode('C');
		setSplitRatio('uniform');
		setDigitCount(3);
		setTicketsText('1,2,3\n8,9,10\n58,59,60\n71,72,73\n77,78,79\n78,79,80');
		setRepBet(true);
		setPredTicketBetting(false);
		setPredTicketsPerRound('0');
		setUseTwoDigitTickets(false);
		setTwoDigitStake('');
		setPredSource('combined');
		seeded.current = true;
		setFeedback('Defaults loaded — review, then Save configuration.');
		onSaved('');
	}

	async function saveBool(field: BoolField, value: boolean) {
		setSavingBool(field);
		setFeedback('');
		onSaved('');
		try {
			const res = await setAutoplayConfig(siteId || 'fungames_tolobirr', { [field]: value } as Partial<AutoplayConfig>);
			// Reflect the server's answer for exactly this field; other fields may
			// hold unsaved drafts and must not be clobbered.
			const saved = (res as unknown as Record<string, unknown>)[field] === true;
			if (field === 'enabled') setEnabled(saved);
			if (field === 'repetitive_auto_bet') setRepBet(saved);
			if (field === 'use_two_digit_tickets') setUseTwoDigitTickets(saved);
			if (field === 'prediction_ticket_betting') setPredTicketBetting(saved);
			setFeedback(`${BOOL_LABELS[field]} ${saved ? 'enabled' : 'disabled'}.`);
			onSaved(`${BOOL_LABELS[field]} ${saved ? 'enabled' : 'disabled'}.`);
			onRefresh();
		} catch (e) {
			setFeedback(e instanceof Error ? e.message : String(e));
		} finally {
			setSavingBool(null);
		}
	}

	async function onSave() {
		setSaving(true);
		setFeedback('');
		onSaved('');
		try {
			await setAutoplayConfig(siteId || 'fungames_tolobirr', {
				enabled,
				stake: stake !== '' ? parseFloat(stake) : undefined,
				batch_size: batch !== '' ? parseInt(batch, 10) : undefined,
				tickets_per_account: ticketsPerAccount !== '' ? parseInt(ticketsPerAccount, 10) : 1,
				mode,
				split_ratio: splitRatio,
				...(mode === 'C' ? { digit_count: digitCount } : {}),
				base_tickets: textToTickets(ticketsText),
				repetitive_auto_bet: repBet,
				prediction_ticket_betting: predTicketBetting,
				prediction_tickets_per_round: predTicketsPerRound !== '' ? parseInt(predTicketsPerRound, 10) : 0,
				use_two_digit_tickets: useTwoDigitTickets,
				two_digit_stake: twoDigitStake !== '' ? parseFloat(twoDigitStake) : 0,
				prediction_source: predSource,
			});
			setFeedback('Configuration saved.');
			onSaved('Configuration saved.');
			onRefresh();
		} catch (e) {
			setFeedback(e instanceof Error ? e.message : String(e));
		} finally {
			setSaving(false);
		}
	}

	const stakeNum = Math.max(2, parseFloat(stake) || 2);
	const ticketsNum = Math.max(1, parseInt(ticketsPerAccount, 10) || 1);
	const accounts = Math.max(1, accountCount ?? 0);
	const perTicketStake = useTwoDigitTickets && parseFloat(twoDigitStake) > 0 ? parseFloat(twoDigitStake) : stakeNum;
	const perRoundSpend = accounts * ticketsNum * perTicketStake;

	return (
		<CollapsibleCard
			title='Configuration'
			defaultOpen={defaultOpen}
			actions={
				<div className='flex gap-2'>
					<Button variant='outline' size='sm' onClick={onLoadCurrent} disabled={!cfg}>
						Reload current
					</Button>
					<Button variant='outline' size='sm' onClick={onDefaults}>
						Defaults
					</Button>
				</div>
			}
		>
			{!loaded ? (
				<p className='text-sm text-muted-foreground'>Waiting for the current configuration…</p>
			) : (
				<>
					{/* Engine + headline numbers */}
					<div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
						<div className='rounded-lg border p-2.5'>
							<div className='flex items-start justify-between gap-3'>
								<div>
									<Label htmlFor='tolo-enabled'>Enabled</Label>
									<p className='mt-0.5 text-xs text-muted-foreground'>
										{enabled ? 'Config gate open — Start runs rounds.' : 'Closed — rounds are not placed.'}
									</p>
								</div>
								<Switch
									id='tolo-enabled'
									checked={enabled}
									disabled={savingBool === 'enabled'}
									onCheckedChange={(v) => void saveBool('enabled', v)}
								/>
							</div>
						</div>
						<div className='space-y-1.5'>
							<Label htmlFor='tolo-stake'>Stake per ticket (ETB)</Label>
							<Input
								id='tolo-stake'
								type='number'
								min='2'
								value={stake}
								onChange={(e) => setStake(e.target.value)}
								placeholder='2'
							/>
						</div>
						<div className='space-y-1.5'>
							<Label htmlFor='tolo-batch'>Batch size</Label>
							<Input
								id='tolo-batch'
								type='number'
								min='1'
								value={batch}
								onChange={(e) => setBatch(e.target.value)}
								placeholder='1'
							/>
						</div>
					</div>

					{/* Betting mode */}
					<div className='mt-4 rounded-lg border p-3'>
						<div className='mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
							Betting mode
						</div>
						<div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
							<div className='space-y-1.5'>
								<Label htmlFor='tolo-mode'>Mode</Label>
								<select
									id='tolo-mode'
									value={mode}
									onChange={(e) => setMode(e.target.value as 'A' | 'B' | 'C')}
									className='w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground'
								>
									<option value='A'>A — Guided (same pick, all accounts)</option>
									<option value='B'>B — Split (distinct tickets)</option>
									<option value='C'>C — Suggestions (digits from server picks)</option>
								</select>
								<p className='text-xs text-muted-foreground'>
									{mode === 'C'
										? 'Mode C takes tickets from the server suggestion numbers each round.'
										: mode === 'B'
											? 'Mode B splits the configured tickets across accounts; the ratio below controls the grouping.'
											: 'Mode A plays the configured ticket(s) on every eligible account.'}
								</p>
							</div>
							{mode === 'C' ? (
								<div className='space-y-1.5'>
									<Label htmlFor='tolo-digits'>Digits per ticket</Label>
									<select
										id='tolo-digits'
										value={String(digitCount)}
										onChange={(e) => setDigitCount(e.target.value === '2' ? 2 : 3)}
										className='w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground'
									>
										<option value='2'>2 — two-digit tickets</option>
										<option value='3'>3 — three-digit tickets</option>
									</select>
									<p className='text-xs text-muted-foreground'>
										Each account bets its own {digitCount}-number ticket sliced from the suggestion pool.
									</p>
								</div>
							) : (
								<div className='space-y-1.5'>
									<Label htmlFor='tolo-split'>Split ratio</Label>
									<select
										id='tolo-split'
										value={splitRatio}
										onChange={(e) => setSplitRatio(e.target.value as 'uniform' | '1/2' | '1/3')}
										className='w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground'
									>
										<option value='uniform'>Uniform — one ticket per account</option>
										<option value='1/2'>1/2 — split in two groups</option>
										<option value='1/3'>1/3 — split in three groups</option>
									</select>
								</div>
							)}
							<div className='space-y-1.5'>
								<Label htmlFor='tolo-tickets-per-account'>Tickets per account / round</Label>
								<Input
									id='tolo-tickets-per-account'
									type='number'
									min='1'
									max='20'
									value={ticketsPerAccount}
									onChange={(e) => setTicketsPerAccount(e.target.value)}
								/>
								<p className='text-xs text-muted-foreground'>
									Total = accounts × this. A wallet that cannot cover the next stake plays its dust
									remainder all-in instead of leaving it stranded below 2 ETB.
								</p>
							</div>
						</div>
					</div>

					{/* Ticket sources */}
					<div className='mt-4 grid gap-3 sm:grid-cols-2'>
						<div className='rounded-lg border p-2.5'>
							<div className='flex items-start justify-between gap-3'>
								<div>
									<Label htmlFor='tolo-rep'>Auto-bet repetitive tickets</Label>
									<p className='mt-0.5 text-xs text-muted-foreground'>
										Recurrence &amp; pattern-trend picks lead the round (chains · overdue/time patterns · carryover).
									</p>
								</div>
								<Switch
									id='tolo-rep'
									checked={repBet}
									disabled={savingBool === 'repetitive_auto_bet'}
									onCheckedChange={(v) => void saveBool('repetitive_auto_bet', v)}
								/>
							</div>
						</div>
						<div className='rounded-lg border p-2.5'>
							<div className='flex items-start justify-between gap-3'>
								<div>
									<Label htmlFor='tolo-pred-bet'>Prediction-ticket betting</Label>
									<p className='mt-0.5 text-xs text-muted-foreground'>
										Bet one {mode === 'C' ? digitCount : 3}-spot prediction ticket per account each round.
										{parseInt(predTicketsPerRound, 10) === 0
											? ' 0 per account = all tickets from the site ticket plan.'
											: ''}
									</p>
								</div>
								<Switch
									id='tolo-pred-bet'
									checked={predTicketBetting}
									disabled={savingBool === 'prediction_ticket_betting'}
									onCheckedChange={(v) => void saveBool('prediction_ticket_betting', v)}
								/>
							</div>
							{predTicketBetting && (
								<div className='mt-2 flex items-center gap-2'>
									<Label htmlFor='tolo-pred-count' className='text-xs text-muted-foreground'>
										tickets / account
									</Label>
									<Input
										id='tolo-pred-count'
										type='number'
										min='0'
										value={predTicketsPerRound}
										onChange={(e) => setPredTicketsPerRound(e.target.value)}
										className='w-24'
									/>
								</div>
							)}
						</div>
						<div className='rounded-lg border p-2.5 sm:col-span-2'>
							<div className='flex items-start justify-between gap-3'>
								<div>
									<Label htmlFor='tolo-two-digit'>2-digit ML dynamic tickets</Label>
									<p className='mt-0.5 text-xs text-muted-foreground'>
										Every ticket is a ranked 2-spot pair from the last draws. Overrides the mode number
										source while pairs are available; falls back to mode tickets on a cold history.
									</p>
								</div>
								<Switch
									id='tolo-two-digit'
									checked={useTwoDigitTickets}
									disabled={savingBool === 'use_two_digit_tickets'}
									onCheckedChange={(v) => void saveBool('use_two_digit_tickets', v)}
								/>
							</div>
							{useTwoDigitTickets && (
								<div className='mt-2 flex flex-wrap items-center gap-2'>
									<Label htmlFor='tolo-two-digit-stake' className='text-xs text-muted-foreground'>
										2-digit stake (ETB)
									</Label>
									<Input
										id='tolo-two-digit-stake'
										type='number'
										min='0'
										value={twoDigitStake}
										onChange={(e) => setTwoDigitStake(e.target.value)}
										placeholder={stake || '2'}
										className='w-28'
									/>
									<span className='text-xs text-muted-foreground'>0 / blank = use the general stake</span>
								</div>
							)}
						</div>
						<div className='space-y-1.5 sm:col-span-2'>
							<Label htmlFor='tolo-pred-source'>Generated-betting ticket source</Label>
							<select
								id='tolo-pred-source'
								value={predSource}
								onChange={(e) => setPredSource(e.target.value === 'temporal' ? 'temporal' : 'combined')}
								className='w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground'
							>
								<option value='combined'>Combined ML prediction (latest forecast)</option>
								<option value='temporal'>Temporal pattern tickets (same clock-time window, last 7 days)</option>
							</select>
							<p className='text-xs text-muted-foreground'>
								{predSource === 'temporal'
									? 'Tickets are mined from the draws ±10 min of the target time on each of the last 7 days.'
									: 'The engine bets the standard generated prediction tickets.'}
							</p>
						</div>
					</div>

					{/* Per-round economics */}
					<div className='mt-4 rounded-lg border border-border bg-muted/40 p-3'>
						<div className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
							Per-round economics
						</div>
						<p className='mt-1 text-xs text-muted-foreground'>
							With <b>{ticketsNum}</b> ticket(s)/account at <b>{perTicketStake} ETB</b>
							{accountCount != null ? (
								<>
									{' '}
									across <b>{accountCount}</b> account(s): <b>{perRoundSpend.toFixed(2)} ETB</b> per round
								</>
							) : null}
							. A 2-digit full hit is <b>{pct(anyHit(P_FULL_2, ticketsNum))}</b>/account (
							{pct(P_FULL_2)}/ticket, ~{(perTicketStake / P_FULL_2).toFixed(0)} ETB expected stake per full
							hit); a 3-digit full hit is <b>{pct(anyHit(P_FULL_3, ticketsNum))}</b> ({pct(P_FULL_3)}/ticket, ~
							{(perTicketStake / P_FULL_3).toFixed(0)} ETB). Expected return is fixed by the paytable — N
							only changes variance and how often a win shows up.
						</p>
					</div>

					{/* Base tickets */}
					<div className='mt-4 grid grid-cols-1 gap-4 md:grid-cols-2'>
						<div className='space-y-1.5'>
							<Label>Base tickets (one per line, comma separated)</Label>
							<textarea
								value={ticketsText}
								onChange={(e) => setTicketsText(e.target.value)}
								rows={8}
								placeholder={'1,2,3\n8,9,10\n58,59,60\n71,72,73\n77,78,79\n78,79,80'}
								className='w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground'
							/>
						</div>
						<div className='space-y-1.5'>
							<Label>Preview</Label>
							<pre className='max-h-40 overflow-auto rounded-lg border border-border bg-muted p-3 font-mono text-xs text-foreground'>
								{ticketsText || '—'}
							</pre>
						</div>
					</div>

					{/* Footer */}
					<div className='mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4'>
						<div className='text-xs text-muted-foreground'>
							{feedback ? <span className='font-medium text-foreground'>{feedback}</span> : null}
							{feedback ? ' · ' : ''}
							{cfg?.base_tickets?.length ?? 0} ticket(s) saved · Updated {formatTime(cfg?.updated_at)}
						</div>
						<Button onClick={() => void onSave()} disabled={saving}>
							{saving ? 'Saving…' : 'Save configuration'}
						</Button>
					</div>
				</>
			)}
		</CollapsibleCard>
	);
}
