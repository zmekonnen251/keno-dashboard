'use client';

import { Button } from '@/components/ui/button';

export type BoardMarker = 'hot' | 'suggested';

// Board styles live here (same approach as the extension popup `.ball`
// styles) so the 10-column grid renders even if the Tailwind build is stale.
const BOARD_CSS = `
.keno-board-panel { border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1); background: #141a26; padding: 12px; }
.keno-board { display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: 6px; }
.keno-tile { position: relative; aspect-ratio: 1 / 1; display: flex; align-items: center; justify-content: center; border-radius: 6px; background: #242c3d; color: #f1f5f9; font-size: 14px; font-weight: 800; font-family: inherit; border: 1px solid rgba(255, 255, 255, 0.06); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06); cursor: pointer; padding: 0; margin: 0; min-width: 0; }
.keno-tile:hover { background: #2c3547; }
.keno-tile.picked { background: #22c55e; color: #ffffff; box-shadow: 0 0 10px rgba(34, 197, 94, 0.45); }
.keno-dot { position: absolute; top: 4px; right: 4px; height: 6px; width: 6px; border-radius: 9999px; }
.keno-dot.hot { background: #ef4444; }
.keno-dot.suggested { background: #38bdf8; }
`;

/** Keno board styled like the real game: dark tiles, bold white numbers, green picks. */
export function NumberGrid({
	selected,
	max,
	onToggle,
	onClear,
	markers,
}: {
	selected: number[];
	max: number;
	onToggle: (n: number) => void;
	onClear: () => void;
	markers?: Partial<Record<number, BoardMarker>>;
}) {
	return (
		<div className='keno-board-panel'>
			<style>{BOARD_CSS}</style>
			<div className='mb-2 flex items-center justify-between'>
				<span className='text-xs font-semibold text-slate-300'>
					{selected.length}/{max} selected
				</span>
				<Button variant='ghost' size='xs' onClick={onClear} className='text-slate-300'>
					Clear
				</Button>
			</div>
			<div className='keno-board'>
				{Array.from({ length: 80 }, (_, i) => i + 1).map((n) => {
					const active = selected.includes(n);
					const marker = markers?.[n];
					return (
						<button
							key={n}
							type='button'
							onClick={() => onToggle(n)}
							aria-pressed={active}
							className={active ? 'keno-tile picked' : 'keno-tile'}
						>
							{n}
							{!active && marker && <span className={`keno-dot ${marker}`} />}
						</button>
					);
				})}
			</div>
			<p className='mt-2 text-[11px] text-slate-400'>
				<span className='mr-3 inline-flex items-center gap-1'>
					<span className='inline-block h-1.5 w-1.5 rounded-full bg-sky-400' /> suggested pick
				</span>
				Tap numbers to build your ticket, then Place bet.
			</p>
		</div>
	);
}
