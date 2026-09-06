'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
	getAutoplayConfigServerAction,
	getActiveAccountsServerAction,
	type AutoplayConfigData,
} from '@/lib/actions/autoplay';
import type { PlacedBet } from '@/lib/clientWsEngineUtils';
import { GATEWAY_URL } from './useGatewayWorker';

export interface AccountWorker {
	id: number;
	phone: string;
	ws_token: string | null;
}

export function useWsAutoplayEngine() {
	const [isRunning, setIsRunning] = useState(false);
	const [config, setConfig] = useState<AutoplayConfigData | null>(null);
	const [accounts, setAccounts] = useState<AccountWorker[]>([]);
	const [recentBets, setRecentBets] = useState<PlacedBet[]>([]);
	const [connectedWorkersCount, setConnectedWorkersCount] = useState(0);

	const activeSockets = useRef<Map<number, WebSocket>>(new Map());

	// Reload DB config from Prisma
	const reloadConfig = useCallback(async () => {
		try {
			const fetchedConfig = await getAutoplayConfigServerAction();
			setConfig(fetchedConfig);
			const fetchedAccounts = await getActiveAccountsServerAction();
			setAccounts(fetchedAccounts);
		} catch (err) {
			console.error('Failed to reload engine configuration:', err);
		}
	}, []);

	// Initial load
	useEffect(() => {
		return () => {
			reloadConfig();
		};
	}, [reloadConfig]);

	// Connect WebSockets for active accounts when engine starts
	useEffect(() => {
		const sockets = activeSockets.current;

		if (!isRunning || accounts.length === 0) {
			sockets.forEach((ws) => ws.close());
			sockets.clear();
			return;
		}

		const targetAccounts = accounts.slice(
			0,
			config?.batch_size ?? accounts.length,
		);

		targetAccounts.forEach((acc) => {
			if (activeSockets.current.has(acc.id) || !acc.ws_token) return;
    const url = `${GATEWAY_URL}?token=${encodeURIComponent(acc.ws_token)}`;
			// Replace WS URL with your game gateway endpoint
			const ws = new WebSocket(
				url
			);

			ws.onopen = () => {
				setConnectedWorkersCount((prev) => prev + 1);
			};

			ws.onclose = () => {
				activeSockets.current.delete(acc.id);
				setConnectedWorkersCount((prev) => Math.max(0, prev - 1));
			};

			ws.onerror = (err) => {
				console.error(`Socket error on account #${acc.id}:`, err);
			};

			ws.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					if (data.type === 'BET_RESULT') {
						const placed: PlacedBet = {
              accountId: acc.id,
              phone: acc.phone,
              requestId: data.requestId || String(Date.now()),
              spots: data.spots || [],
              stake: data.stake || config?.stake || 2,
              status: data.won ? 'won' : 'lost',
              ok: true,
              matched: data.matchedCount,
              winAmount: data.winAmount,
              balanceAfter: data.balance,
              placedAt: Date.now(),
              drawnSpots: null,
              settledAt: null
            };
						setRecentBets((prev) => [placed, ...prev.slice(0, 49)]);
					}
				} catch {
					// Handle non-JSON payload frames if any
				}
			};

			activeSockets.current.set(acc.id, ws);
		});

		return () => {
			sockets.forEach((ws) => ws.close());
			sockets.clear();
		};
	}, [isRunning, accounts, config?.batch_size, config?.stake]);

	// Direct manual test round dispatch across workers
	const triggerRound = useCallback(async (): Promise<PlacedBet[]> => {
		const results: PlacedBet[] = [];
		const baseTickets = config?.base_tickets || [[1, 2, 3]];

		activeSockets.current.forEach((ws, accountId) => {
			const acc = accounts.find((a) => a.id === accountId);
			if (!acc || ws.readyState !== WebSocket.OPEN) return;

			const ticket =
				baseTickets[Math.floor(Math.random() * baseTickets.length)];
			const reqId = `test_${Date.now()}_${accountId}`;

			ws.send(
				JSON.stringify({
					action: 'place_bet',
					requestId: reqId,
					spots: ticket,
					stake: config?.stake ?? 2,
				}),
			);

			results.push({
				accountId: acc.id,
				phone: acc.phone,
				requestId: reqId,
				spots: ticket,
				stake: config?.stake ?? 2,
				status: 'pending',
				ok: true,
				placedAt: Date.now(),
				winAmount: null,
				drawnSpots: null,
				matched: null,
				balanceAfter: null,
				settledAt: null,
			});
		});

		setRecentBets((prev) => [
			...results,
			...prev.slice(0, 50 - results.length),
		]);
		return results;
	}, [config, accounts, setRecentBets]);

	const startEngine = useCallback(() => setIsRunning(true), []);
	const stopEngine = useCallback(() => setIsRunning(false), []);

	return {
		isRunning,
		startEngine,
		stopEngine,
		config,
		accounts,
		recentBets,
		connectedWorkersCount,
		triggerRound,
		reloadConfig,
	};
}
