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
import { ShamoAutoplay } from '@/components/autoplay/ShamoAutoplay';
import { useSite } from '@/components/site-provider';
import { Modal } from '@/components/ui/modal';

// Site-gated autoplay: the tolobirr (real-money gateway) autoplay is shown for
// the default site, while fungames_shamo is driven by rain free-bets.
export default function AutoplayPage() {
	const { siteId, siteName } = useSite();
	if (siteId === 'fungames_shamo') {
		return <ShamoAutoplay siteName={siteName} />;
	}
	return <TolobirrAutoplay />;
}

function TolobirrAutoplay() {
	const { data: conn, error, loading, refresh } = useApi(() => autoplayStatus(), []);
	const [testing, setTesting] = useState(false);
	const [testMsg, setTestMsg] = useState('');
	const [refreshing, setRefreshing] = useState(false);
	const [syncing, setSyncing] = useState(false);
	const [checking, setChecking] = useState(false);
	const [gameState, setGameState] = useState<'betting_open' | 'drawing' | 'settled' | 'unknown'>('unknown');
	const [signals, setSignals] = useState<'repetitive' | 'recurring' | 'hot' | 'none'>('repetitive');
	const [manualPicks, setManualPicks] = useState<number[]>([]);
	const [showConfig, setShowConfig] = useState(false);

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
					<Button variant='outline' onClick={onCheckLiveBalances} disabled={checking}>
						{checking ? 'Checking…' : 'WS balances'}
					</Button>
					<Button variant='outline' onClick={() => setShowConfig(true)}>
						Configure
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

			<CollapsibleCard title='Stats' defaultOpen={true}>
				<StatOverview conn={conn ?? null} cfg={cfg ?? null} gameState={gameState} signals={signals} />
			</CollapsibleCard>

			<GameView bets={bets} picks={manualPicks} />

			<LastDrawsBoards siteId="fungames_tolobirr" siteName="fungames_tolobirr" />

			<CollapsibleCard title='Signals' defaultOpen={false}>
				<SignalPanel rec={rec ?? null} signals={signals} onSignalsChange={setSignals} />
			</CollapsibleCard>

			<ConfigCard cfg={cfg ?? null} onSaved={setTestMsg} onRefresh={refresh} />

			<ManualBetCard
				running={conn?.running ?? false}
				recurrence={rec ?? null}
				accounts={accounts}
				onMessage={setTestMsg}
				onRefresh={refresh}
				onPicksChange={setManualPicks}
			/>

			<PredictionBetCard running={conn?.running ?? false} onMessage={setTestMsg} onRefresh={refresh} />

			{showConfig && (
				<Modal title='Autoplay configuration' onClose={() => setShowConfig(false)} wide>
					<ConfigCard cfg={cfg ?? null} onSaved={setTestMsg} onRefresh={refresh} />
				</Modal>
			)}
		</div>
	);
}
