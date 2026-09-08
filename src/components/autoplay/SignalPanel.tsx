'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/app';
import type { RecurrenceSignal } from '@/lib/types';

export function SignalPanel({
	rec,
	signals,
	onSignalsChange,
}: {
	rec?: RecurrenceSignal | null;
	signals: 'repetitive' | 'recurring' | 'hot' | 'none';
	onSignalsChange: (s: 'repetitive' | 'recurring' | 'hot' | 'none') => void;
}) {
	return (
		<>
			<Card title='Signal panel' actions=''>
				<div className='space-y-3'>
					<p className='text-sm text-muted-foreground'>{rec?.dominantPattern || 'Waiting for draw history…'}</p>
					<div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
						<div>
							<div className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Chain picks</div>
							<div className='mt-1 font-mono text-xs'>
								{rec?.chainNumbers.length ? `[${rec.chainNumbers.slice(0, 8).join(',')}]` : '—'}
							</div>
						</div>
						<div>
							<div className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Recurrence picks</div>
							<div className='mt-1 font-mono text-xs'>
								{rec?.recurrenceNumbers.length ? `[${rec.recurrenceNumbers.slice(0, 8).join(',')}]` : '—'}
							</div>
						</div>
						<div>
							<div className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Carryover trend</div>
							<div className='mt-1 font-mono text-xs'>
								{rec?.trendNumbers.length ? `[${rec.trendNumbers.slice(0, 8).join(',')}]` : '—'}
							</div>
						</div>
					</div>
					<div className='mt-3 flex flex-wrap gap-2'>
						<Button variant={signals === 'repetitive' ? 'default' : 'outline'} size='sm' onClick={() => onSignalsChange('repetitive')}>
							Repetitive tickets
						</Button>
						<Button variant={signals === 'recurring' ? 'default' : 'outline'} size='sm' onClick={() => onSignalsChange('recurring')}>
							Recurring patterns
						</Button>
						<Button variant={signals === 'hot' ? 'default' : 'outline'} size='sm' onClick={() => onSignalsChange('hot')}>
							Hot digits
						</Button>
					</div>
				</div>
			</Card>

			{rec && (
				<Card
					title='Recurrence signal'
					actions={
						<Badge variant='outline'>
							{rec.drawCount > 0 ? `${rec.level} · ${(rec.confidence * 100).toFixed(0)}% conf` : 'no draws yet'}
						</Badge>
					}
				>
					<div className='space-y-3'>
						<p className='text-sm text-muted-foreground'>{rec.dominantPattern || 'Waiting for draw history…'}</p>
						<div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
							<div>
								<div className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Chain picks</div>
								<div className='mt-1 font-mono text-xs'>
									{rec.chainNumbers.length ? `[${rec.chainNumbers.slice(0, 8).join(',')}]` : '—'}
								</div>
							</div>
							<div>
								<div className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Recurrence picks</div>
								<div className='mt-1 font-mono text-xs'>
									{rec.recurrenceNumbers.length ? `[${rec.recurrenceNumbers.slice(0, 8).join(',')}]` : '—'}
								</div>
							</div>
							<div>
								<div className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Carryover trend</div>
								<div className='mt-1 font-mono text-xs'>
									{rec.trendNumbers.length ? `[${rec.trendNumbers.slice(0, 8).join(',')}]` : '—'}
								</div>
							</div>
						</div>
					</div>
				</Card>
			)}
		</>
	);
}
