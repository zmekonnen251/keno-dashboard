'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

import { Account } from '@/lib/types';
import { type PlacedBet, randRequestId } from '@/lib/clientWsEngineUtils';

export const GATEWAY_URL =
	process.env.NEXT_PUBLIC_FUNGAMES_GATEWAY_BASE_URL ||
	'wss://gateway.fungames.live/v2/ws';

export function useGatewayWorker(
	account: Account,
	onBetSettled?: (betResult: PlacedBet) => void,
) {
	const [isConnected, setIsConnected] = useState(false);
	const [balance, setBalance] = useState<number>(account.balance ?? 2);
	const wsRef = useRef<WebSocket | null>(null);
	const pendingBets = useRef<Map<string, { spots: number[]; stake: number }>>(
		new Map(),
	);

	// Connection Management
	useEffect(() => {
		if (!account.ws_token) return;

		const url = `${GATEWAY_URL}?token=${encodeURIComponent(account.ws_token)}`;
		const ws = new WebSocket(url);
		wsRef.current = ws;

		ws.onopen = () => setIsConnected(true);
		ws.onclose = () => setIsConnected(false);
		ws.onerror = () => setIsConnected(false);

		ws.onmessage = (event) => {
			try {
				const msg = JSON.parse(event.data);
				if (msg.type === 'GAME' && msg.payload) {
					const payload = msg.payload;
					const tickets = payload.tickets || payload.status?.tickets || [];

					tickets.forEach((t: {
						request_id?: string;
						requestId?: string;
						payout?: number | string;
						win?: number | string;
						matched_spots?: number[];
					}) => {
						const reqId = t.request_id || t.requestId;
						if (reqId && pendingBets.current.has(reqId)) {
							const pending = pendingBets.current.get(reqId)!;
							const winAmount = Number(t.payout ?? t.win ?? 0);
							const updatedBal = balance + winAmount;

							setBalance(updatedBal);
							pendingBets.current.delete(reqId);

							if (onBetSettled) {
								onBetSettled({
									accountId: account.id,
									phone: account.phone,
									spots: pending.spots,
									stake: pending.stake,
									requestId: reqId,
									ok: true,
									status: winAmount > 0 ? 'won' : 'lost',
									winAmount,
									drawnSpots: payload.status?.drawn_spots || [],
									matched: t.matched_spots?.length || 0,
									balanceAfter: updatedBal,
									placedAt: Date.now(),
									settledAt: Date.now(),
								});
							}
						}
					});
				}
			} catch (err) {
				console.error('Failed to parse WS frame', err);
			}
		};

		return () => {
			ws.close();
			wsRef.current = null;
		};
  }, [
      account.ws_token,
      account.id,
      balance,
      onBetSettled,
      account.phone
  ]);

	// Execute Bet Execution
	const placeBet = useCallback(
		(spots: number[], stake: number): PlacedBet => {
			const requestId = randRequestId();
			const canSend =
				wsRef.current && wsRef.current.readyState === WebSocket.OPEN;

			if (canSend) {
				const msg = {
					type: 'GAME',
					payload: {
						type: 'PLACE_BET',
						wager: { type: 'CASH', amount: stake },
						chosen_spots: spots,
						request_id: requestId,
					},
				};

				pendingBets.current.set(requestId, { spots, stake });
				wsRef.current!.send(JSON.stringify(msg));
				setBalance((prev) => Math.max(0, prev - stake));
			}

			return {
				accountId: account.id,
				phone: account.phone,
				spots,
				stake,
				requestId,
				ok: Boolean(canSend),
				status: canSend ? 'pending' : 'failed',
				winAmount: null,
				drawnSpots: null,
				matched: null,
				balanceAfter: canSend ? balance - stake : balance,
				placedAt: Date.now(),
				settledAt: null,
			};
		},
		[account.id, account.phone, balance],
	);

	return { isConnected, balance, placeBet };
}
