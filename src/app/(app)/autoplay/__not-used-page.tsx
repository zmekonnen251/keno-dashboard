'use client';

import { useState } from 'react';
import { useWsAutoplayEngine } from '@/hooks/useWsAutoplayEngine';
import {
	setAutoplayConfig as updateAutoplayConfigServerAction,
  refreshTokens as refreshTokensServerAction,
	syncBalances as syncWalletsServerAction,
} from '@/lib/api';

import type { PlacedBet } from '@/lib/clientWsEngineUtils';

// shadcn/ui components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';

import { StatCard, Empty } from '@/components/app';
import { formatTime } from '@/lib/format';

function ticketsToText(tickets: number[][] | null | undefined): string {
	return (tickets || []).map((t) => t.join(',')).join('\n');
}

function textToTickets(text: string): number[][] | null {
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

function stateTone(
	state: string,
): 'default' | 'destructive' | 'secondary' | 'outline' {
	if (state === 'won') return 'default';
	if (state === 'lost' || state === 'error' || state === 'failed')
		return 'destructive';
	if (state === 'betting' || state === 'pending') return 'secondary';
	return 'outline';
}

function betLabel(p: PlacedBet): string {
	if (p.status === 'won') return 'won';
	if (p.status === 'lost') return 'lost';
	if (p.status === 'pending' || p.ok) return 'sent';
	return 'not sent';
}

function formatTs(ms?: number | null): string {
	if (!ms) return '—';
	return new Date(ms).toLocaleTimeString();
}

export default function AutoplayPage() {
	const {
		isRunning,
		startEngine,
		stopEngine,
		config,
		accounts,
		recentBets,
		connectedWorkersCount,
		triggerRound,
		reloadConfig,
	} = useWsAutoplayEngine();

	const [loaded, setLoaded] = useState(false);
	const [stake, setStake] = useState('');
	const [batch, setBatch] = useState('');
	const [mode, setMode] = useState<'A' | 'B' | 'C'>('A');
	const [splitRatio, setSplitRatio] = useState<'uniform' | '1/2' | '1/3'>(
		'uniform',
	);
	const [digitCount, setDigitCount] = useState<2 | 3>(3);
	const [ticketsText, setTicketsText] = useState('');
	const [saving, setSaving] = useState(false);
	const [testing, setTesting] = useState(false);
	const [testMsg, setTestMsg] = useState('');
	const [refreshing, setRefreshing] = useState(false);
	const [syncing, setSyncing] = useState(false);

	function onLoadCurrent() {
		setStake(String(config?.stake ?? ''));
		setBatch(String(config?.batch_size ?? ''));
		setMode(config?.mode ?? 'A');
		setSplitRatio(config?.split_ratio ?? 'uniform');
		setDigitCount(config?.digit_count ?? 3);
		setTicketsText(ticketsToText(config?.base_tickets));
		setLoaded(true);
		setTestMsg('');
	}

	function onNew() {
		setStake('');
		setBatch('');
		setMode('C');
		setSplitRatio('uniform');
		setDigitCount(3);
		setTicketsText('1,2,3\n8,9,10\n58,59,60\n71,72,73\n77,78,79\n78,79,80');
		setLoaded(true);
		setTestMsg('');
	}

	async function onSave() {
		setSaving(true);
		setTestMsg('');
		try {
			await updateAutoplayConfigServerAction({
				stake: stake !== '' ? parseFloat(stake) : undefined,
				batch_size: batch !== '' ? parseInt(batch, 10) : undefined,
				mode,
				split_ratio: splitRatio,
				...(mode === 'C' ? { digit_count: digitCount } : {}),
				base_tickets: textToTickets(ticketsText),
			});
			setTestMsg('Configuration saved.');
			await reloadConfig();
		} catch (e) {
			setTestMsg('Save error: ' + (e instanceof Error ? e.message : String(e)));
		} finally {
			setSaving(false);
		}
	}

	async function onTestRound() {
		setTesting(true);
		setTestMsg('');
		try {
			const placed = await triggerRound();
			const sent = placed.filter((p) => p.ok).length;
			setTestMsg(
				`Dispatched ${sent}/${placed.length} ticket(s) directly from browser socket workers.`,
			);
		} catch (e) {
			setTestMsg(
				'Error running test round: ' +
					(e instanceof Error ? e.message : String(e)),
			);
		} finally {
			setTesting(false);
		}
	}

	async function onRefreshTokens() {
		setRefreshing(true);
		try {
			await refreshTokensServerAction();
			setTestMsg('Tokens refreshed successfully.');
		} catch (e) {
			setTestMsg(
				'Token refresh failed: ' + (e instanceof Error ? e.message : String(e)),
			);
		} finally {
			setRefreshing(false);
		}
	}

	async function onSyncWallets() {
		setSyncing(true);
		try {
			const res = await syncWalletsServerAction();
			setTestMsg(`Wallets synced: ${res.synced ?? 0} updated.`);
		} catch (e) {
			setTestMsg(
				'Wallet sync failed: ' + (e instanceof Error ? e.message : String(e)),
			);
		} finally {
			setSyncing(false);
		}
	}

	return (
		<div className='space-y-6'>
			{/* Header Actions */}
			<div className='flex flex-wrap items-center justify-between gap-3'>
				<h2 className='text-xl font-bold tracking-tight text-foreground'>
					Client Autoplay Engine
				</h2>
				<div className='flex flex-wrap gap-2'>
					{isRunning ? (
						<Button variant='destructive' onClick={stopEngine}>
							Stop
						</Button>
					) : (
						<Button onClick={startEngine}>Start</Button>
					)}
					<Button
						variant='outline'
						onClick={onTestRound}
						disabled={testing || !isRunning}
					>
						{testing ? 'Testing…' : 'Test Round'}
					</Button>
					<Button
						variant='outline'
						onClick={onRefreshTokens}
						disabled={refreshing}
					>
						{refreshing ? 'Refreshing…' : 'Refresh tokens'}
					</Button>
					<Button variant='outline' onClick={onSyncWallets} disabled={syncing}>
						{syncing ? 'Syncing…' : 'Sync wallets'}
					</Button>
				</div>
			</div>

			{testMsg && (
				<p className='text-sm font-medium text-muted-foreground'>{testMsg}</p>
			)}

			{/* Metrics Row */}
			<div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
				<StatCard
					label='Enabled'
					value={config?.enabled ? 'Yes' : 'No'}
					tone={config?.enabled ? 'positive' : 'default'}
				/>
				<StatCard
					label='Running Client-Side'
					value={isRunning ? 'Yes' : 'No'}
					tone={isRunning ? 'positive' : 'default'}
				/>
				<StatCard
					label='Browser Connections'
					value={`${connectedWorkersCount}/${accounts.length}`}
					sub='active sockets / batch'
					tone='accent'
				/>
				<StatCard label='Stake' value={config?.stake ?? '—'} />
			</div>

			{/* Autoplay Configuration Form */}
			<Card>
				<CardHeader className='flex flex-row items-center justify-between space-y-0 pb-4'>
					<div>
						<CardTitle className='text-base font-semibold'>
							Configuration
						</CardTitle>
						<CardDescription className='text-xs'>
							Adjust client betting strategies and active batch parameters.
						</CardDescription>
					</div>
					<div className='flex gap-2'>
						<Button
							variant='outline'
							size='sm'
							onClick={onNew}
							disabled={loaded}
						>
							New
						</Button>
						<Button variant='outline' size='sm' onClick={onLoadCurrent}>
							Load current
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{!loaded ? (
						<Empty
							label={
								'Click "Load current" to start editing the autoplay configuration.'
							}
						/>
					) : (
						<div className='space-y-4'>
							<div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
								{/* Mode Select */}
								<div className='space-y-1.5'>
									<Label>Mode</Label>
									<Select
										value={mode}
										onValueChange={(val: 'A' | 'B' | 'C') => setMode(val)}
									>
										<SelectTrigger>
											<SelectValue placeholder='Select mode' />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='A'>
												A — Guided (same pick, all accounts)
											</SelectItem>
											<SelectItem value='B'>
												B — Split (distinct tickets)
											</SelectItem>
											<SelectItem value='C'>
												C — Suggestions (digits from server picks)
											</SelectItem>
										</SelectContent>
									</Select>
								</div>

								{/* Sub-mode Options */}
								{mode === 'C' ? (
									<div className='space-y-1.5'>
										<Label>Digits per ticket (Mode C)</Label>
										<Select
											value={String(digitCount)}
											onValueChange={(val) =>
												setDigitCount(val === '2' ? 2 : 3)
											}
										>
											<SelectTrigger>
												<SelectValue placeholder='Digits' />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value='2'>2 — two-digit tickets</SelectItem>
												<SelectItem value='3'>
													3 — three-digit tickets
												</SelectItem>
											</SelectContent>
										</Select>
									</div>
								) : (
									<div className='space-y-1.5'>
										<Label>Split ratio (Mode B)</Label>
										<Select
											value={splitRatio}
											onValueChange={(val: 'uniform' | '1/2' | '1/3') =>
												setSplitRatio(val)
											}
										>
											<SelectTrigger>
												<SelectValue placeholder='Split ratio' />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value='uniform'>
													Uniform — one ticket per account
												</SelectItem>
												<SelectItem value='1/2'>
													1/2 — split in two groups
												</SelectItem>
												<SelectItem value='1/3'>
													1/3 — split in three groups
												</SelectItem>
											</SelectContent>
										</Select>
									</div>
								)}

								<div className='grid grid-cols-2 gap-4'>
									<div className='space-y-1.5'>
										<Label>Stake (Birr)</Label>
										<Input
											type='number'
											min='2'
											value={stake}
											onChange={(e) => setStake(e.target.value)}
											placeholder='2'
										/>
									</div>
									<div className='space-y-1.5'>
										<Label>Batch size</Label>
										<Input
											type='number'
											min='1'
											value={batch}
											onChange={(e) => setBatch(e.target.value)}
											placeholder='1'
										/>
									</div>
								</div>
							</div>

							{/* Tickets Textarea & Preview */}
							<div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
								<div className='space-y-1.5'>
									<Label>Base tickets (one per line, comma separated)</Label>
									<Textarea
										value={ticketsText}
										onChange={(e) => setTicketsText(e.target.value)}
										rows={6}
										className='font-mono text-xs'
									/>
								</div>
								<div className='space-y-1.5'>
									<Label>Preview</Label>
									<pre className='h-35.5 overflow-auto rounded-md border border-input bg-muted p-3 font-mono text-xs text-muted-foreground'>
										{ticketsText || '—'}
									</pre>
								</div>
							</div>

							<div className='flex items-center justify-between pt-2'>
								<div className='text-xs text-muted-foreground'>
									{config?.base_tickets?.length ?? 0} ticket(s) saved · Updated{' '}
									{formatTime(config?.updated_at?.toISOString() ?? null)}
								</div>
								<Button onClick={onSave} disabled={saving}>
									{saving ? 'Saving…' : 'Save configuration'}
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Live Bet Log using shadcn Table */}
			<Card>
				<CardHeader className='pb-3'>
					<CardTitle className='text-base font-semibold'>
						Client Bet Log (Live)
					</CardTitle>
					<CardDescription className='text-xs'>
						Real-time socket events processed directly within the browser
						session.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{recentBets.length === 0 ? (
						<Empty label='No bets recorded yet in this session. Start engine or execute a test round.' />
					) : (
						<div className='rounded-md border'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Time</TableHead>
										<TableHead>Account</TableHead>
										<TableHead>Ticket</TableHead>
										<TableHead>Stake</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Hits</TableHead>
										<TableHead>Won</TableHead>
										<TableHead>Balance After</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{recentBets.map((p) => (
										<TableRow
											key={`${p.accountId}-${p.requestId}-${p.placedAt}`}
										>
											<TableCell className='text-xs text-muted-foreground'>
												{formatTs(p.placedAt)}
											</TableCell>
											<TableCell className='text-xs font-medium'>
												#{p.accountId}{' '}
												<span className='text-muted-foreground'>
													({p.phone})
												</span>
											</TableCell>
											<TableCell className='font-mono text-xs'>
												[{(p.spots || []).join(',')}]
											</TableCell>
											<TableCell className='text-xs'>{p.stake} ETB</TableCell>
											<TableCell className='text-xs'>
												<Badge variant={stateTone(p.status)}>
													{betLabel(p)}
												</Badge>
											</TableCell>
											<TableCell className='text-xs'>
												{p.matched ?? '—'}
											</TableCell>
											<TableCell className='text-xs'>
												{p.winAmount != null ? (
													<span
														className={
															p.winAmount > 0
																? 'font-semibold text-emerald-500'
																: 'text-muted-foreground'
														}
													>
														{p.winAmount > 0 ? '+' : ''}
														{p.winAmount} ETB
													</span>
												) : (
													'—'
												)}
											</TableCell>
											<TableCell className='text-xs'>
												{p.balanceAfter != null ? `${p.balanceAfter} ETB` : '—'}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}