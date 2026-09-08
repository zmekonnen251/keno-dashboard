'use client';

import { Button } from '@/components/ui/button';
import { BOARD_CSS } from './boardStyles';

export type BoardMarker = 'hot' | 'suggested';

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
