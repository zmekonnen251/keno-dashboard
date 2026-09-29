'use client';

import { useEffect, useState } from 'react';
import { getAccounts, getRainWsTokens } from '@/lib/api';
import { GATEWAY_URL } from '@/hooks/useGatewayWorker';

export type LiveDrawStatus = 'connecting' | 'live' | 'waiting';

// Which account pool feeds the observer socket. The shamo site is the rain
// accounts pool (their ws_tokens are raw gateway tokens, fetched from the
// admin-only ws-tokens endpoint); the tolobirr site is the autoplay accounts.
export type DrawTokenSource = 'tolobirr' | 'shamo';

function parseDrawnSpots(data: unknown): number[] | null {
	if (!data || typeof data !== 'object') return null;
	const msg = data as { type?: unknown; payload?: unknown };
	if (msg.type !== 'GAME' || !msg.payload || typeof msg.payload !== 'object') return null;
	const payload = msg.payload as { status?: { drawn_spots?: unknown }; drawn_spots?: unknown };
	const raw = payload.status?.drawn_spots ?? payload.drawn_spots;
	if (!Array.isArray(raw)) return null;
	return raw.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n >= 1 && n <= 80);
}

export type GatewayGamePhase = 'betting_open' | 'drawing' | 'settled' | 'unknown';

interface LiveGameFrame {
	drawn: number[] | null;
	roundId: string | null;
	phase: GatewayGamePhase;
}

// Parse the GAME_STATE frames the observer socket already receives: drawn
// spots, the round id (payload.round_id or status.round_id — the ticket→round
// relation) and the game phase (status.type: WAITING/DRAWING/ROUND_COMPLETE).
// Returns null for frames that carry none of the three (e.g. BALANCE).
function parseGameFrame(data: unknown): LiveGameFrame | null {
	if (!data || typeof data !== 'object') return null;
	const msg = data as { type?: unknown; payload?: unknown };
	if (msg.type !== 'GAME' || !msg.payload || typeof msg.payload !== 'object') return null;
	const payload = msg.payload as {
		round_id?: unknown;
		status?: { round_id?: unknown; type?: unknown; drawn_spots?: unknown };
		drawn_spots?: unknown;
	};
	const raw = payload.status?.drawn_spots ?? payload.drawn_spots;
	let drawn: number[] | null = null;
	if (Array.isArray(raw)) {
		drawn = raw.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n >= 1 && n <= 80);
	}
	const roundId =
		typeof payload.round_id === 'string' && payload.round_id
			? payload.round_id
			: typeof payload.status?.round_id === 'string' && payload.status.round_id
				? payload.status.round_id
				: null;
	let phase: GatewayGamePhase = 'unknown';
	const phaseRaw = payload.status?.type;
	if (typeof phaseRaw === 'string') {
		const up = phaseRaw.toUpperCase();
		if (up === 'WAITING' || up === 'TRANSITION_TO_WAITING') phase = 'betting_open';
		else if (up === 'DRAWING' || up === 'TRANSITION_TO_DRAWING') phase = 'drawing';
		else if (up === 'ROUND_COMPLETE') phase = 'settled';
	}
	if (drawn === null && roundId === null && phase === 'unknown') return null;
	return { drawn, roundId, phase };
}

// One observer WebSocket (any account ws_token — the draw is global, we only
// watch). Rotates to the next token if a socket drops.
export function useLiveDraw(tokenSource: DrawTokenSource = 'tolobirr') {
	const [status, setStatus] = useState<LiveDrawStatus>('connecting');
	const [observer, setObserver] = useState('');
	const [drawn, setDrawn] = useState<number[]>([]);
	const [updatedAt, setUpdatedAt] = useState<number | null>(null);
	// Live game state from the observer socket: current round id + phase.
	const [roundId, setRoundId] = useState<string | null>(null);
	const [phase, setPhase] = useState<GatewayGamePhase>('unknown');

	useEffect(() => {
		let cancelled = false;
		let ws: WebSocket | null = null;
		let retry: ReturnType<typeof setTimeout> | null = null;
		let tokens: { phone: string; ws_token: string }[] = [];
		let idx = 0;

		function connect() {
			if (cancelled) return;
			if (idx >= tokens.length) {
				setStatus('waiting');
				return;
			}
			const t = tokens[idx];
			setObserver(t.phone);
			setStatus('connecting');
			ws = new WebSocket(`${GATEWAY_URL}?token=${encodeURIComponent(t.ws_token)}`);
			ws.onopen = () => {
				if (!cancelled) setStatus('live');
			};
			ws.onmessage = (event) => {
				if (cancelled) return;
				try {
					const frame = parseGameFrame(JSON.parse(event.data));
					if (frame === null) return;
					if (frame.roundId) setRoundId(frame.roundId);
					if (frame.phase !== 'unknown') setPhase(frame.phase);
					if (frame.drawn !== null) {
						setDrawn((prev) => {
							if (frame.drawn!.length > 0) return frame.drawn!;
							// Empty draw frame after a finished draw = new round starting.
							if (prev.length >= 20) return [];
							return prev;
						});
					}
					setUpdatedAt(Date.now());
				} catch {
					// Ignore non-JSON gateway frames.
				}
			};
			const rotate = () => {
				try {
					ws?.close();
				} catch {
					// Ignore close errors during rotation.
				}
				ws = null;
				idx += 1;
				if (!cancelled) retry = setTimeout(connect, 5000);
			};
			ws.onclose = rotate;
			ws.onerror = rotate;
		}

		(async () => {
			try {
				if (tokenSource === 'shamo') {
					const res = await getRainWsTokens();
					if (cancelled) return;
					tokens = res.tokens
						.filter((t) => t.ws_token)
						.map((t) => ({ phone: t.phone || t.name, ws_token: t.ws_token as string }));
				} else {
					const res = await getAccounts('fungames_tolobirr');
					if (cancelled) return;
					tokens = res.accounts
						.filter((a) => a.ws_token)
						.map((a) => ({ phone: a.phone, ws_token: a.ws_token as string }));
				}
				connect();
			} catch {
				if (!cancelled) setStatus('waiting');
			}
		})();

		return () => {
			cancelled = true;
			if (retry) clearTimeout(retry);
			try {
				ws?.close();
			} catch {
				// Ignore close errors on unmount.
			}
		};
	}, [tokenSource]);

	return { status, observer, drawn, updatedAt, roundId, phase };
}
