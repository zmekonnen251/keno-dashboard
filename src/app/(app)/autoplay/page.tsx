'use client';

import { useEffect, useState } from 'react';
import {
	autoplayStatus,
	startAutoplay,
	stopAutoplay,
	refreshTokens,
	testAutoplayRound,
	syncBalances,
	getLiveBalances,
} from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { ErrorBox, Loading } from '@/components/app';
import { useSocket } from '@/lib/service-gateway';
import { useGatewayGameState } from '@/lib/gateway-game-state';
import { StatOverview } from '@/components/autoplay/StatOverview';
import { SignalPanel } from '@/components/autoplay/SignalPanel';
import { CollapsibleCard } from '@/components/autoplay/CollapsibleCard';
import { ConfigCard } from '@/components/autoplay/ConfigCard';
import { ManualBetCard } from '@/components/autoplay/ManualBetCard';
import { PredictionBetCard } from '@/components/autoplay/PredictionBetCard';
import { GameView } from '@/components/autoplay/GameView';
import { LastDrawsBoards } from '@/components/autoplay/LastDrawsBoards';
import { MlPredictorCard } from '@/components/autoplay/MlPredictorCard';
import { TwoDigitTicketsCard } from '@/components/autoplay/TwoDigitTicketsCard';
import { ShamoAutoplay } from '@/components/autoplay/ShamoAutoplay';
import { TicketConfig } from '@/components/autoplay/TicketConfig';
import { useSite } from '@/components/site-provider';
import { Modal } from '@/components/ui/modal';
import { SnapScroll, SnapSection } from '@/components/snap-scroll';
import {
	Activity,
	FlaskConical,
	KeyRound,
	Play,
	RefreshCw,
	Settings,
	Square,
	Ticket,
	Wallet,
} from 'lucide-react';
import type { AutoplayPlacedBet } from '@/lib/types';

// Compact icon-only actions on phones so the whole control bar stays on one
// row; the labels return from `sm` up.
const ACTION_BTN = 'h-8 w-8 px-0 sm:w-auto sm:px-2.5';
const ACTION_LABEL = 'hidden sm:inline';

// Site-gated autoplay: the tolobirr (real-money gateway) autoplay is shown for
// the default site, while fungames_shamo is driven by rain free-bets.
export default function AutoplayPage() {
	const { siteId, siteName } = useSite();
	if (siteId === 'fungames_shamo') {
		return <ShamoAutoplay siteName={siteName} />;
	}
	return <TolobirrAutoplay siteName={siteName} />;
}

function TolobirrAutoplay({ siteName }: { siteName?: string }) {
	const { data: conn, error, loading, refresh } = useApi(() => autoplayStatus(), []);
	const [testing, setTesting] = useState(false);
	const [testMsg, setTestMsg] = useState('');
	// Exactly what the last Test round sent, so the outcome is never confused
	// with the live ticket feed.
	const [lastTestRound, setLastTestRound] = useState<AutoplayPlacedBet[] | null>(null);
	const [refreshing, setRefreshing] = useState(false);
	const [syncing, setSyncing] = useState(false);
	const [checking, setChecking] = useState(false);
	const [gameState, setGameState] = useState<'betting_open' | 'drawing' | 'settled' | 'unknown'>('unknown');
	const [signals, setSignals] = useState<'repetitive' | 'recurring' | 'hot' | 'none'>('repetitive');
	const [manualPicks, setManualPicks] = useState<number[]>([]);
	const [showConfig, setShowConfig] = useState(false);
	const [showTicketConfig, setShowTicketConfig] = useState(false);
	const { siteId } = useSite();

	useGatewayGameState(setGameState);

	useSocket('/autoplay/signals', (data: unknown) => {
		if (data === 'repetitive' || data === 'recurring' || data === 'hot' || data === 'none') {
			setSignals(data);
		}
	});

	useEffect(() => {
		const t = setInterval(() => refresh(), 4000);
		return () => clearInterval(t);
	}, [refresh]);

	const cfg = conn?.config;
	const bets = conn?.bets || [];
	const rec = conn?.recurrence;
	const accounts = conn?.accounts || [];

	if (loading && !conn) return <Loading />;
	if (error && !conn) return <ErrorBox message={error} />;

	async function onTestRound() {
		setTesting(true);
		setTestMsg('');
		try {
			const res = await testAutoplayRound();
			const placed = res.placed ?? res.bets ?? [];
			const sent = res.sent ?? placed.filter((p) => p.ok).length;
			const failed = placed.filter((p) => !p.ok);
			const reason = failed[0]?.failReason ? ` (${failed[0].failReason})` : '';
			setLastTestRound(placed);
			setTestMsg(
				`Sent ${sent}/${placed.length} tickets on ${res.workers} worker(s)${reason}. ` +
					'Results (win/loss) appear in the bet log after the draw settles.',
			);
			refresh();
		} catch (e) {
			setLastTestRound([]);
			setTestMsg('Error: ' + (e instanceof Error ? e.message : String(e)));
		} finally {
			setTesting(false);
		}
	}

	async function onRefreshTokens() {
		setRefreshing(true);
		try {
			await refreshTokens();
		} finally {
			setRefreshing(false);
		}
	}

	async function onSyncWallets() {
		setSyncing(true);
		try {
			const res = await syncBalances();
			setTestMsg(
				`Wallets synced: ${res.synced ?? 0} updated, ${res.failed ?? 0} failed` +
					(res.timedOut ? ' (partial — still running in background).' : '.'),
			);
			refresh();
		} catch (e) {
			setTestMsg('Wallet sync failed: ' + (e instanceof Error ? e.message : String(e)));
		} finally {
			setSyncing(false);
		}
	}

	async function onCheckLiveBalances() {
		setChecking(true);
		try {
			const res = await getLiveBalances();
			setTestMsg(`Live balances: ${res.wsHits} from gateway streams, ${res.stored} stored (total ${res.count}).`);
			refresh();
		} catch (e) {
			setTestMsg('Live balance check failed: ' + (e instanceof Error ? e.message : String(e)));
		} finally {
			setChecking(false);
		}
	}

	const stateTone =
		gameState === 'betting_open'
			? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
			: gameState === 'drawing'
				? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
				: gameState === 'settled'
					? 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300'
					: 'border-border bg-muted/40 text-muted-foreground';

	return (
		<SnapScroll>
			{/* Sticky control bar — always reachable while the deck scrolls. On
			    phones it collapses to a single scrollable row of icon buttons. */}
			<div className='sticky top-0 z-30 -mx-3 mb-3 border-b border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur-sm sm:-mx-0 sm:mb-4 sm:rounded-xl sm:border sm:p-3 sm:shadow-md'>
				<div className='flex items-center gap-2 sm:flex-wrap sm:justify-between sm:gap-3'>
					<h2 className='hidden min-w-0 truncate text-lg font-bold text-foreground sm:block'>
						Autoplay — {siteName ?? 'fungames_tolobirr'}
					</h2>
					<div className='flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-none sm:flex-wrap sm:gap-2'>
						{conn?.running ? (
							<Button
								variant='destructive'
								className={ACTION_BTN}
								onClick={() => stopAutoplay().then(() => refresh())}
								title='Stop'
								aria-label='Stop'
							>
								<Square />
								<span className={ACTION_LABEL}>Stop</span>
							</Button>
						) : (
							<Button
								className={ACTION_BTN}
								onClick={() => startAutoplay().then(() => refresh())}
								title='Start'
								aria-label='Start'
							>
								<Play />
								<span className={ACTION_LABEL}>Start</span>
							</Button>
						)}
						<Button
							variant='outline'
							className={ACTION_BTN}
							onClick={() => void onTestRound()}
							disabled={testing || !conn?.running}
							title='Test round'
							aria-label='Test round'
						>
							<FlaskConical />
							<span className={ACTION_LABEL}>{testing ? '…' : 'Test round'}</span>
						</Button>
						<Button variant='outline' className={ACTION_BTN} onClick={() => void onRefreshTokens()} disabled={refreshing} title='Refresh tokens' aria-label='Refresh tokens'>
							<KeyRound />
							<span className={ACTION_LABEL}>{refreshing ? '…' : 'Refresh tokens'}</span>
						</Button>
						<Button variant='outline' className={ACTION_BTN} onClick={() => void onSyncWallets()} disabled={syncing} title='Sync wallets' aria-label='Sync wallets'>
							<Wallet />
							<span className={ACTION_LABEL}>{syncing ? '…' : 'Sync wallets'}</span>
						</Button>
						<Button variant='outline' className={ACTION_BTN} onClick={() => void onCheckLiveBalances()} disabled={checking} title='WS balances' aria-label='WS balances'>
							<Activity />
							<span className={ACTION_LABEL}>{checking ? '…' : 'WS balances'}</span>
						</Button>
						<Button variant='outline' className={ACTION_BTN} onClick={() => setShowTicketConfig(true)} title='Ticket config' aria-label='Ticket config'>
							<Ticket />
							<span className={ACTION_LABEL}>Ticket config</span>
						</Button>
						<Button variant='outline' className={ACTION_BTN} onClick={() => setShowConfig(true)} title='Configure' aria-label='Configure'>
							<Settings />
							<span className={ACTION_LABEL}>Configure</span>
						</Button>
						<Button variant='outline' className={ACTION_BTN} onClick={() => refresh()} title='Refresh' aria-label='Refresh'>
							<RefreshCw />
							<span className={ACTION_LABEL}>Refresh</span>
						</Button>
					</div>
				</div>
			</div>

			<SnapSection fill title='Stats'>
				<div className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${stateTone}`}>
					<span className='font-semibold'>Game state:</span>{' '}
					{gameState === 'betting_open'
						? 'Betting OPEN — inject tickets now'
						: gameState === 'drawing'
							? 'Drawing in progress — bets scheduled for next round'
							: gameState === 'settled'
								? 'Settled — results announced'
								: 'Unknown'}
				</div>

				{testMsg && <p className='mt-2 text-sm text-muted-foreground'>{testMsg}</p>}

				{lastTestRound !== null && (
					<div className='mt-2 rounded-lg border border-sky-500/40 bg-sky-500/5 p-2.5'>
						<div className='mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-sky-700 dark:text-sky-300'>
							Last test round — {lastTestRound.length} ticket{lastTestRound.length === 1 ? '' : 's'}
						</div>
						{lastTestRound.length === 0 ? (
							<p className='text-xs italic text-muted-foreground'>No tickets were sent.</p>
						) : (
							<div className='flex flex-col gap-1.5'>
								{lastTestRound.map((b, i) => (
									<div key={`${b.requestId}-${i}`} className='flex flex-wrap items-center gap-2 text-xs'>
										<span className='font-mono text-[11px] text-muted-foreground'>
											{b.phone || `#${b.accountId}`}
										</span>
										<span className='flex flex-wrap gap-1'>
											{b.spots.map((n) => (
												<span
													key={n}
													className='flex h-5 w-5 items-center justify-center rounded-full bg-sky-600/40 font-mono text-[10px] font-extrabold text-sky-800 dark:text-sky-100'
												>
													{n}
												</span>
											))}
										</span>
										<span className='font-mono text-[10px] text-muted-foreground'>{b.stake} ETB</span>
										{b.ok ? (
											<span className='rounded bg-emerald-600/15 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700 dark:text-emerald-300'>
												Sent
											</span>
										) : (
											<span className='rounded bg-rose-600/15 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-rose-700 dark:text-rose-300'>
												{b.failReason ?? 'Failed'}
											</span>
										)}
										{b.roundId && (
											<span className='rounded bg-black/5 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-600 dark:bg-white/5 dark:text-amber-300'>
												Round {b.roundId}
											</span>
										)}
									</div>
								))}
							</div>
						)}
					</div>
				)}

				<CollapsibleCard title='Stats' defaultOpen={true}>
					<StatOverview conn={conn ?? null} cfg={cfg ?? null} gameState={gameState} signals={signals} />
				</CollapsibleCard>
			</SnapSection>

			<SnapSection fill title='Live game'>
				<CollapsibleCard title='Live game — current draw & recent tickets' defaultOpen={true}>
					<GameView bets={bets} picks={manualPicks} />
				</CollapsibleCard>
			</SnapSection>

			<SnapSection fill title='ML predictor'>
				<MlPredictorCard siteId={siteId} />
			</SnapSection>

			<SnapSection fill title='2-digit tickets'>
				<TwoDigitTicketsCard siteId={siteId} onMessage={setTestMsg} onRefresh={refresh} />
			</SnapSection>

			<SnapSection title='Last draws'>
				<CollapsibleCard title='Last draws' defaultOpen={false}>
					<LastDrawsBoards siteId={siteId} siteName={siteName ?? siteId} />
				</CollapsibleCard>
			</SnapSection>

			<SnapSection title='Signals'>
				<CollapsibleCard title='Signals' defaultOpen={false}>
					<SignalPanel rec={rec ?? null} signals={signals} onSignalsChange={setSignals} />
				</CollapsibleCard>
			</SnapSection>

			<SnapSection fill title='Manual bet'>
				<ManualBetCard
					running={conn?.running ?? false}
					recurrence={rec ?? null}
					accounts={accounts}
					onMessage={setTestMsg}
					onRefresh={refresh}
					onPicksChange={setManualPicks}
				/>
			</SnapSection>

			<SnapSection fill title='Prediction bet'>
				<PredictionBetCard running={conn?.running ?? false} onMessage={setTestMsg} onRefresh={refresh} />
			</SnapSection>

			{showConfig && (
				<Modal title='Autoplay configuration' onClose={() => setShowConfig(false)} wide>
					<ConfigCard
						cfg={cfg ?? null}
						onSaved={setTestMsg}
						onRefresh={refresh}
						siteId={siteId}
						accountCount={accounts.length}
					/>
				</Modal>
			)}

			{showTicketConfig && (
				<Modal title='Ticket Configuration' onClose={() => setShowTicketConfig(false)} wide>
					<TicketConfig siteId={siteId} />
				</Modal>
			)}
		</SnapScroll>
	);
}
