'use client';

import { useEffect, useState } from 'react';
import { getAccounts, getRainWsTokens } from '@/lib/api';
import { GATEWAY_URL } from '@/hooks/useGatewayWorker';

export type LiveDrawStatus = 'connecting' | 'live' | 'waiting';

// Which account pool feeds the observer socket. The shamo site is the rain
// accounts pool (their ws_tokens are raw gateway tokens, fetched from the
// admin-only ws-tokens endpoint); the tolobirr site is the autoplay accounts.
export type DrawTokenSource = 'tolobirr' | 'shamo';

// The keno site id each token pool feeds (matches the server's live hub keys).
const SITE_BY_SOURCE: Record<DrawTokenSource, string> = {
	tolobirr: 'fungames_tolobirr',
	shamo: 'fungames_shamo',
};

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
	// Epoch ms of the current phase change (the gateway's own status timestamp
	// when it sends one, else our receive time). The round timer counts down
	// from this, so it ticks in real time instead of following a poll interval.
	phaseAt: number | null;
}

// The gateway stamps a phase change with its own clock — epoch seconds on some
// deployments, epoch ms on others. Normalize to ms.
function normalizePhaseAt(raw: unknown): number | null {
	if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return null;
	return raw > 1e11 ? raw : raw * 1000;
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
		type?: unknown;
		round_id?: unknown;
		status?: { type?: unknown; round_id?: unknown; timestamp?: unknown };
	};
	if (payload.type !== 'GAME_STATE') return null;
	const drawn = parseDrawnSpots(data);
	const roundId =
		typeof payload.round_id === 'string' && payload.round_id
			? payload.round_id
			: typeof payload.status?.round_id === 'string' && payload.status.round_id
				? payload.status.round_id
				: null;
	let phase: GatewayGamePhase = 'unknown';
	const st = payload.status?.type;
	if (typeof st === 'string') {
		const up = st.toUpperCase();
		if (up === 'WAITING' || up === 'TRANSITION_TO_WAITING') phase = 'betting_open';
		else if (up === 'DRAWING' || up === 'TRANSITION_TO_DRAWING') phase = 'drawing';
		else if (up === 'ROUND_COMPLETE') phase = 'settled';
	}
	if (drawn === null && roundId === null && phase === 'unknown') return null;
	return { drawn, roundId, phase, phaseAt: normalizePhaseAt(payload.status?.timestamp) };
}

// Live draw state. Primary source is OUR server's live re-stream: the server
// already listens on the provider gateway sockets (collector + claimer workers)
// and re-broadcasts the normalized live frame as Server-Sent Events through the
// dashboard's /api proxy, so every logged-in user gets real-time round id /
// phase / drawn spots without a provider token. Falls back to a direct provider
// observer socket when the server stream is unavailable (admins only — viewers
// have no token).
export function useLiveDraw(tokenSource: DrawTokenSource = 'tolobirr') {
	const [status, setStatus] = useState<LiveDrawStatus>('connecting');
	const [observer, setObserver] = useState('');
	const [drawn, setDrawn] = useState<number[]>([]);
	const [updatedAt, setUpdatedAt] = useState<number | null>(null);
	// Live game state from the stream: current round id + phase.
	const [roundId, setRoundId] = useState<string | null>(null);
	const [phase, setPhase] = useState<GatewayGamePhase>('unknown');
	// When the current phase started — drives the real-time round countdown.
	const [phaseAt, setPhaseAt] = useState<number | null>(null);
	const [streaming, setStreaming] = useState<'server' | 'gateway' | null>(null);

	useEffect(() => {
		let cancelled = false;
		let ws: WebSocket | null = null; // provider gateway socket (fallback)
		let serverEs: EventSource | null = null; // our server re-stream (primary)
		let retry: ReturnType<typeof setTimeout> | null = null;
		let serverRetry: ReturnType<typeof setTimeout> | null = null;
		let tokens: { phone: string; ws_token: string }[] = [];
		let idx = 0;
		// Last phase we saw, so we can tell a real phase change (re-anchor the
		// countdown) from a frame that merely repeats the same phase.
		let lastPhase: GatewayGamePhase = 'unknown';
		// Frames received from the server re-stream. While this is 0 we keep the
		// provider observer running so the board still works without the server.
		let serverFrames = 0;

		const applyFrame = (frame: LiveGameFrame) => {
			if (frame.roundId) setRoundId(frame.roundId);
			if (frame.phase !== 'unknown') {
				if (frame.phase !== lastPhase) {
					lastPhase = frame.phase;
					// New phase: restart the countdown from the gateway's own
					// phase timestamp (or our receive time when it sends none).
					setPhaseAt(frame.phaseAt ?? Date.now());
				}
				setPhase(frame.phase);
			}
			if (frame.drawn !== null) {
				setDrawn((prev) => {
					if (frame.drawn!.length > 0) return frame.drawn!;
					// Empty draw frame after a finished draw = new round starting.
					if (prev.length >= 20) return [];
					return prev;
				});
			}
			setUpdatedAt(Date.now());
		};

		function connectServer() {
			if (cancelled) return;
			// The server re-stream is exposed as SSE through the dashboard's own
			// API proxy: the dashboard origin cannot open the keno-server's /ws
			// socket, and the proxy path carries the session cookie for every
			// logged-in user (viewers included), not just admins.
			const url = `/api/live?site=${encodeURIComponent(SITE_BY_SOURCE[tokenSource])}`;
			setObserver('keno server');
			try {
				serverEs = new EventSource(url);
			} catch {
				serverEs = null;
				return;
			}
			serverEs.onopen = () => {
				if (!cancelled) setStatus('live');
			};
			serverEs.onmessage = (event) => {
				if (cancelled) return;
				try {
					const msg = JSON.parse(event.data);
					if (msg?.type !== 'live' || !msg.data) return;
					serverFrames += 1;
					setStreaming('server');
					const d = msg.data as {
						roundId?: string | null;
						phase?: GatewayGamePhase;
						drawn?: number[] | null;
						phaseAt?: number | null;
					};
					// The server sends the frame already normalized; a null
					// `drawn` means "no draw info in this frame", not an empty board.
					applyFrame({
						roundId: d.roundId ?? null,
						phase: d.phase ?? 'unknown',
						drawn: d.drawn ?? null,
						phaseAt: normalizePhaseAt(d.phaseAt),
					});
					// The server stream works — drop the provider observer.
					if (serverFrames === 1) {
						try {
							ws?.close();
						} catch {
							// Ignore close errors while switching sources.
						}
						ws = null;
					}
				} catch {
					// Ignore non-JSON server frames.
				}
			};
			// EventSource retries on its own while CONNECTING. Only rebuild the
			// connection when the browser gave up (CLOSED), e.g. a 401 or an
			// upstream that stopped streaming.
			serverEs.onerror = () => {
				if (cancelled) return;
				if (serverFrames === 0) return; // gateway observer carries the board
				setStreaming(null);
				setStatus('waiting');
				if (serverEs && serverEs.readyState === EventSource.CLOSED) {
					serverEs.close();
					serverEs = null;
					serverRetry = setTimeout(connectServer, 5000);
				}
			};
		}

		function connect() {
			if (cancelled || serverFrames > 0) return;
			if (idx >= tokens.length) return;
			const t = tokens[idx];
			setObserver(t.phone);
			if (serverFrames === 0) setStatus('connecting');
			ws = new WebSocket(`${GATEWAY_URL}?token=${encodeURIComponent(t.ws_token)}`);
			ws.onopen = () => {
				if (!cancelled) {
					setStatus('live');
					if (serverFrames === 0) setStreaming('gateway');
				}
			};
			ws.onmessage = (event) => {
				if (cancelled) return;
				try {
					const frame = parseGameFrame(JSON.parse(event.data));
					if (frame === null) return;
					applyFrame(frame);
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
			// The server re-stream needs no credentials, so open it first. The
			// token fetch below is admin-only for the shamo pool; when it fails
			// (viewers) the server stream must still carry the board instead of
			// aborting the whole connection.
			connectServer();
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
			} catch {
				// No provider token available — the server re-stream is enough.
			}
			// Only needed if the server stream stays silent; closed on the
			// first server frame.
			if (!cancelled) connect();
		})();

		return () => {
			cancelled = true;
			if (retry) clearTimeout(retry);
			if (serverRetry) clearTimeout(serverRetry);
			try {
				ws?.close();
			} catch {
				// Ignore close errors on unmount.
			}
			try {
				serverEs?.close();
			} catch {
				// Ignore close errors on unmount.
			}
		};
	}, [tokenSource]);

	return { status, observer, drawn, updatedAt, roundId, phase, phaseAt, streaming };
}
