'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/app';

export function CollapsibleCard({
	title,
	actions,
	defaultOpen = false,
	children,
}: {
	title: React.ReactNode;
	actions?: React.ReactNode;
	defaultOpen?: boolean;
	children: React.ReactNode;
}) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<Card
			title={title}
			actions={
				<div className='flex items-center gap-2'>
					{actions}
					<Button variant='ghost' size='sm' onClick={() => setOpen((v) => !v)}>
						{open ? 'Hide' : 'Show'}
					</Button>
				</div>
			}
		>
			{open ? children : <p className='text-xs text-muted-foreground'>Collapsed — click Show to expand.</p>}
		</Card>
	);
}
