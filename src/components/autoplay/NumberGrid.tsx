'use client';

import { Button } from '@/components/ui/button';

export type BoardMarker = 'hot' | 'suggested';

const MARKER_DOT: Record<BoardMarker, string> = {
	hot: 'bg-red-500',
	suggested: 'bg-sky-400',
};

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
		<div className='rounded-xl border border-white/10 bg-[#141a26] p-3'>
			<div className='mb-2 flex items-center justify-between'>
				<span className='text-xs font-semibold text-slate-300'>
					{selected.length}/{max} selected
				</span>
				<Button variant='ghost' size='xs' onClick={onClear} className='text-slate-300'>
					Clear
				</Button>
			</div>
			<div className='grid grid-cols-10 gap-1.5'>
				{Array.from({ length: 80 }, (_, i) => i + 1).map((n) => {
					const active = selected.includes(n);
					const marker = markers?.[n];
					return (
						<button
							key={n}
							type='button'
							onClick={() => onToggle(n)}
							aria-pressed={active}
							className={
								active
									? 'relative flex aspect-square items-center justify-center rounded-md bg-[#22c55e] text-sm font-extrabold text-white shadow-[0_0_10px_rgba(34,197,94,0.45)]'
									: 'relative flex aspect-square items-center justify-center rounded-md bg-[#242c3d] text-sm font-extrabold text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-[#2c3547]'
							}
						>
							{n}
							{!active && marker && (
								<span className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${MARKER_DOT[marker]}`} />
							)}
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
