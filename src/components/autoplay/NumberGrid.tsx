'use client';

import { Button } from '@/components/ui/button';

export function NumberGrid({
	selected,
	max,
	onToggle,
	onClear,
}: {
	selected: number[];
	max: number;
	onToggle: (n: number) => void;
	onClear: () => void;
}) {
	return (
		<div>
			<div className='mb-2 flex items-center justify-between'>
				<span className='text-xs text-muted-foreground'>
					{selected.length}/{max} selected — tap numbers like the keno board
				</span>
				<Button variant='ghost' size='xs' onClick={onClear}>
					Clear
				</Button>
			</div>
			<div className='grid grid-cols-10 gap-1'>
				{Array.from({ length: 80 }, (_, i) => i + 1).map((n) => {
					const active = selected.includes(n);
					return (
						<button
							key={n}
							type='button'
							onClick={() => onToggle(n)}
							className={
								active
									? 'flex h-8 items-center justify-center rounded-md bg-emerald-600 text-xs font-bold text-white'
									: 'flex h-8 items-center justify-center rounded-md bg-muted text-xs font-semibold text-foreground hover:bg-muted/70'
							}
						>
							{n}
						</button>
					);
				})}
			</div>
		</div>
	);
}
