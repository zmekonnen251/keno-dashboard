'use client';

import { useEffect, useState } from 'react';
import {
	autoplayStatus,
	startAutoplay,
	stopAutoplay,
	refreshTokens,
	testAutoplayRound,
	syncBalances,
} from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { ErrorBox, Loading } from '@/components/app';
import { useSocket } from '@/lib/service-gateway';
import { useGatewayGameState } from '@/lib/gateway-game-state';
import { StatOverview } from '@/components/autoplay/StatOverview';
import { SignalPanel } from '@/components/autoplay/SignalPanel';
import { ConfigCard } from '@/components/autoplay/ConfigCard';
import { ManualBetCard } from '@/components/autoplay/ManualBetCard';
import { BetLogCard } from '@/components/autoplay/BetLogCard';
import { ActiveBettingCard } from '@/components/autoplay/ActiveBettingCard';
import { AccountStatusCard } from '@/components/autoplay/AccountStatusCard';

export default function AutoplayPage() {
	const { data: conn, error, loading, refresh } = useApi(() => autoplayStatus(), []);
	const [testing, setTesting] = useState(false);
	const [testMsg, setTestMsg] = useState('');
	const [refreshing, setRefreshing] = useState(false);
	const [syncing, setSyncing] = useState(false);
	const [gameState, setGameState] = useState<'betting_open' | 'drawing' | 'settled' | 'unknown'>('unknown');
	const [signals, setSignals] = useState<'repetitive' | 'recurring' | 'hot' | 'none'>('repetitive');

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
			const sent = res.sent ?? (res.placed || []).filter((p) => p.ok).length;
			const failed = (res.placed || []).filter((p) => !p.ok);
			const reason = failed[0]?.failReason ? ` (${failed[0].failReason})` : '';
			setTestMsg(
				`Sent ${sent}/${(res.placed || []).length} tickets on ${res.workers} worker(s)${reason}. ` +
					'Results (win/loss) appear in the bet log after the draw settles.',
			);
			refresh();
		} catch (e) {
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

	return (
		<div className='space-y-5'>
			<div className='flex flex-wrap items-center justify-between gap-3'>
				<h2 className='text-lg font-bold text-foreground'>Autoplay</h2>
				<div className='flex flex-wrap gap-2'>
					{conn?.running ? (
						<Button variant='destructive' onClick={() => stopAutoplay().then(() => refresh())}>
							Stop
						</Button>
					) : (
						<Button onClick={() => startAutoplay().then(() => refresh())}>Start</Button>
					)}
					<Button variant='outline' onClick={onTestRound} disabled={testing || !conn?.running}>
						{testing ? 'Testing…' : 'Test Round'}
					</Button>
					<Button variant='outline' onClick={onRefreshTokens} disabled={refreshing}>
						{refreshing ? 'Refreshing…' : 'Refresh tokens'}
					</Button>
					<Button variant='outline' onClick={onSyncWallets} disabled={syncing}>
						{syncing ? 'Syncing…' : 'Sync wallets'}
					</Button>
				</div>
			</div>

			<div className='alert alert-info mt-3'>
				<strong>Game State:</strong>{' '}
				{gameState === 'betting_open'
					? 'Betting OPEN — inject tickets now'
					: gameState === 'drawing'
						? 'Drawing in progress — bets scheduled for next round'
						: gameState === 'settled'
							? 'Settled — results announced'
							: 'Unknown'}
			</div>

			{testMsg && <p className='text-sm text-muted-foreground'>{testMsg}</p>}

			<StatOverview conn={conn ?? null} cfg={cfg ?? null} gameState={gameState} signals={signals} />

			<SignalPanel rec={rec ?? null} signals={signals} onSignalsChange={setSignals} />

			<ConfigCard cfg={cfg ?? null} onSaved={setTestMsg} onRefresh={refresh} />

			<ManualBetCard
				running={conn?.running ?? false}
				recurrence={rec ?? null}
				accounts={accounts}
				onMessage={setTestMsg}
				onRefresh={refresh}
			/>

			<ActiveBettingCard accounts={accounts} running={conn?.running ?? false} />

			<BetLogCard bets={bets} />

			<AccountStatusCard accounts={accounts} running={conn?.running ?? false} />
		</div>
	);
}
