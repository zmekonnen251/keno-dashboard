'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Empty } from '@/components/app';
import { setAutoplayConfig } from '@/lib/api';
import { formatTime } from '@/lib/format';
import type { AutoplayConfig } from '@/lib/types';
import { ticketsToText, textToTickets } from './utils';
import { CollapsibleCard } from './CollapsibleCard';

export function ConfigCard({
	cfg,
	onSaved,
	onRefresh,
	siteId,
	defaultOpen = true,
}: {
	cfg?: AutoplayConfig | null;
	onSaved: (msg: string) => void;
	onRefresh: () => void;
	siteId?: string;
	defaultOpen?: boolean;
}) {
	const [loaded, setLoaded] = useState(false);
	const [stake, setStake] = useState('');
	const [batch, setBatch] = useState('');
	const [mode, setMode] = useState<'A' | 'B' | 'C'>('A');
	const [splitRatio, setSplitRatio] = useState<'uniform' | '1/2' | '1/3'>('uniform');
	const [digitCount, setDigitCount] = useState<2 | 3>(3);
	const [ticketsText, setTicketsText] = useState('');
	const [repBet, setRepBet] = useState(true);
	const [manualAccountSelection, setManualAccountSelection] = useState(false);
	const [predTicketBetting, setPredTicketBetting] = useState(false);
	const [predTicketsPerRound, setPredTicketsPerRound] = useState('');
	const [saving, setSaving] = useState(false);

	function onLoadCurrent() {
		setStake(String(cfg?.stake ?? ''));
		setBatch(String(cfg?.batch_size ?? ''));
		setMode(cfg?.mode ?? 'A');
		setSplitRatio(cfg?.split_ratio ?? 'uniform');
		setDigitCount(cfg?.digit_count ?? 3);
		setTicketsText(ticketsToText(cfg?.base_tickets));
		setRepBet(cfg?.repetitive_auto_bet ?? true);
		setManualAccountSelection(cfg?.manual_account_selection ?? false);
		setPredTicketBetting(cfg?.prediction_ticket_betting ?? false);
		setPredTicketsPerRound(String(cfg?.prediction_tickets_per_round ?? 0));
		setLoaded(true);
		onSaved('');
	}

	function onNew() {
		setStake('');
		setBatch('');
		setMode('C');
		setSplitRatio('uniform');
		setDigitCount(3);
		setTicketsText('1,2,3\n8,9,10\n58,59,60\n71,72,73\n77,78,79\n78,79,80');
		setRepBet(true);
		setManualAccountSelection(false);
		setPredTicketBetting(false);
		setPredTicketsPerRound('');
		setLoaded(true);
		onSaved('');
	}

	async function onSave() {
		setSaving(true);
		onSaved('');
		try {
			await setAutoplayConfig(siteId || 'fungames_tolobirr', {
				stake: stake !== '' ? parseFloat(stake) : undefined,
				batch_size: batch !== '' ? parseInt(batch, 10) : undefined,
				mode,
				split_ratio: splitRatio,
				...(mode === 'C' ? { digit_count: digitCount } : {}),
				base_tickets: textToTickets(ticketsText),
				repetitive_auto_bet: repBet,
				manual_account_selection: manualAccountSelection,
				prediction_ticket_betting: predTicketBetting,
				prediction_tickets_per_round: predTicketsPerRound !== '' ? parseInt(predTicketsPerRound, 10) : 0,
			});
			onSaved('Configuration saved.');
			onRefresh();
		} finally {
			setSaving(false);
		}
	}

	return (
		<CollapsibleCard
			title='Configuration'
			defaultOpen={defaultOpen}
			actions={
				<div className='flex gap-2'>
					<Button variant='outline' size='sm' onClick={onNew} disabled={loaded}>
						New
					</Button>
					<Button variant='outline' size='sm' onClick={onLoadCurrent}>
						Load current
					</Button>
				</div>
			}
		>
			{!loaded ? (
				<Empty label={'Click "Load current" to start editing the autoplay configuration.'} />
			) : (
				<>
					<div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
						<div className='space-y-1.5'>
							<Label>Mode</Label>
							<select
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
									? 'Mode C takes tickets from the server suggestion numbers each round. Pick how many digits per ticket below.'
									: 'Mode B with uniform ratio spreads each configured ticket onto its own account.'}
							</p>
						</div>
						{mode === 'C' ? (
							<div className='space-y-1.5'>
								<Label>Digits per ticket (Mode C)</Label>
								<select
									value={String(digitCount)}
									onChange={(e) => setDigitCount(e.target.value === '2' ? 2 : 3)}
									className='w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground'
								>
									<option value='2'>2 — two-digit tickets</option>
									<option value='3'>3 — three-digit tickets</option>
								</select>
								<p className='text-xs text-muted-foreground'>
									Each account bets its own {digitCount}-number ticket sliced from the server suggestion pool.
								</p>
							</div>
						) : (
							<div className='space-y-1.5'>
								<Label>Split ratio (Mode B)</Label>
								<select
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
						<div className='grid grid-cols-2 gap-4'>
							<div className='space-y-1.5'>
								<Label>Stake (Birr)</Label>
								<Input type='number' min='2' value={stake} onChange={(e) => setStake(e.target.value)} placeholder='2' />
							</div>
							<div className='space-y-1.5'>
								<Label>Batch size</Label>
								<Input type='number' min='1' value={batch} onChange={(e) => setBatch(e.target.value)} placeholder='1' />
							</div>
						</div>
					</div>

					<div className='mt-4 flex items-center gap-3 rounded-lg border border-border px-3 py-2.5'>
						<input
							id='repBet'
							type='checkbox'
							checked={repBet}
							onChange={(e) => setRepBet(e.target.checked)}
							className='h-4 w-4 accent-blue-600'
						/>
						<Label htmlFor='repBet' className='cursor-pointer'>
							Auto-bet recent repetitive tickets (recurrence &amp; pattern-trend picks lead the round)
						</Label>
						<span className='ml-auto text-xs text-muted-foreground'>Chains · overdue/time patterns · carryover</span>
					</div>

					<div className='mt-2 flex items-center gap-3 rounded-lg border border-border px-3 py-2.5'>
						<input
							id='manualAccountSelection'
							type='checkbox'
							checked={manualAccountSelection}
							onChange={(e) => setManualAccountSelection(e.target.checked)}
							className='h-4 w-4 accent-blue-600'
						/>
						<Label htmlFor='manualAccountSelection' className='cursor-pointer'>
							Manual account selection
						</Label>
						<span className='ml-auto text-xs text-muted-foreground'>Off = server auto-selects an eligible account</span>
					</div>

					<div className='mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2.5'>
						<input
							id='predTicketBetting'
							type='checkbox'
							checked={predTicketBetting}
							onChange={(e) => setPredTicketBetting(e.target.checked)}
							className='h-4 w-4 accent-blue-600'
						/>
						<Label htmlFor='predTicketBetting' className='cursor-pointer'>
							Prediction-ticket betting — bet one {mode === 'C' ? digitCount : 3}-spot prediction ticket per account each round
						</Label>
						<label htmlFor='predTicketsPerRound' className='ml-auto flex items-center gap-2 text-xs text-muted-foreground'>
							tickets/account
							<Input
								id='predTicketsPerRound'
								type='number'
								min='0'
								value={predTicketsPerRound}
								onChange={(e) => setPredTicketsPerRound(e.target.value)}
								className='w-24'
							/>
						</label>
						<span className='w-full text-[11px] text-muted-foreground'>
							0 = all tickets from the site ticket plan (editable on the Predictions page)
						</span>
					</div>

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

					<div className='mt-4 flex items-center justify-between'>
						<div className='text-xs text-muted-foreground'>
							{cfg?.base_tickets?.length ?? 0} ticket(s) saved · Updated {formatTime(cfg?.updated_at)}
						</div>
						<Button onClick={onSave} disabled={saving}>
							{saving ? 'Saving…' : 'Save configuration'}
						</Button>
					</div>
				</>
			)}
		</CollapsibleCard>
	);
}
