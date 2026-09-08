'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, Empty } from '@/components/app';
import { getAccounts } from '@/lib/api';
import { GATEWAY_URL } from '@/hooks/useGatewayWorker';
import { BOARD_CSS } from './boardStyles';

// Live draw board: streams the current keno draw straight from the gateway
// over ONE observer WebSocket (any account ws_token — the draw is global, so
// we only watch, never bet here). Drawn digits light up gold like the real
// game; numbers from your manual ticket that get drawn turn green.
function parseDrawnSpots(data: unknown): number[] | null {
	if (!data || typeof data !== 'object') return null;
	const msg = data as { type?: unknown; payload?: unknown };
	if (msg.type !== 'GAME' || !msg.payload || typeof msg.payload !== 'object') return null;
	const payload = msg.payload as { status?: { drawn_spots?: unknown }; drawn_spots?: unknown };
	const raw = payload.status?.drawn_spots ?? payload.drawn_spots;
	if (!Array.isArray(raw)) return null;
	return raw.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n >= 1 && n <= 80);
}

export function LiveDrawBoard({ picks }: { picks?: number[] }) {
	const [status, setStatus] = useState<'connecting' | 'live' | 'waiting'>('connecting');
	const [observer, setObserver] = useState('');
	const [drawn, setDrawn] = useState<number[]>([]);
	const [updatedAt, setUpdatedAt] = useState<number | null>(null);

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
					const numbers = parseDrawnSpots(JSON.parse(event.data));
					if (numbers === null) return;
					setDrawn((prev) => {
						if (numbers.length > 0) return numbers;
						// Empty draw frame after a finished draw = new round starting.
						if (prev.length >= 20) return [];
						return prev;
					});
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
				const res = await getAccounts('fungames');
				if (cancelled) return;
				tokens = res.accounts
					.filter((a) => a.ws_token)
					.map((a) => ({ phone: a.phone, ws_token: a.ws_token as string }));
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
	}, []);

	const done = drawn.length >= 20;
	const hits = (picks ?? []).filter((n) => drawn.includes(n));

	return (
		<Card
			title='Live draw'
			actions={
				<Badge variant='outline'>
					{status === 'live' ? `live · ${drawn.length}/20` : status === 'connecting' ? 'connecting…' : 'waiting for token'}
				</Badge>
			}
		>
			<style>{BOARD_CSS}</style>
			{status === 'waiting' && drawn.length === 0 ? (
				<Empty label='No observer token — import an account with a WS token to watch the live draw.' />
			) : (
				<>
					<div className='keno-board-panel'>
						<div className='keno-board'>
							{Array.from({ length: 80 }, (_, i) => i + 1).map((n) => {
								const isDrawn = drawn.includes(n);
								const isHit = isDrawn && (picks ?? []).includes(n);
								return (
									<div key={n} className={isHit ? 'keno-tile hit' : isDrawn ? 'keno-tile drawn' : 'keno-tile'}>
										{n}
									</div>
								);
							})}
						</div>
					</div>
					<p className='mt-2 text-xs text-muted-foreground'>
						{done ? (
							<>Draw complete — {drawn.length} numbers drawn.</>
						) : (
							<>Drawing… {drawn.length}/20 drawn.</>
						)}{' '}
						{picks && picks.length > 0 && <>Your ticket: {hits.length} hit{hits.length === 1 ? '' : 's'}.</>}{' '}
						{observer && <>Watching via +{observer}.</>}{' '}
						{updatedAt && <>Updated {new Date(updatedAt).toLocaleTimeString()}.</>}
					</p>
				</>
			)}
		</Card>
	);
}
