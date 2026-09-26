'use client';

import type { ReactNode } from 'react';

// Vertical snap-scroll shell for the autoplay page. Sections snap so the next
// section lands flush at the top of the viewport while scrolling.
//
// `proximity` (not `mandatory`) is used so a section taller than one screen
// still scrolls freely instead of being pinned to its top edge.
export function SnapScroll({ children }: { children: ReactNode }) {
	return (
		<div className="h-full snap-y snap-proximity space-y-5 overflow-y-auto">
			{children}
		</div>
	);
}

// One scroll-snap target. With `fill`, the section stretches to a full
// viewport so it reads as its own screen (like a paged deck). Without `fill`
// the section keeps its natural height and only its top edge snap-aligns to
// the viewport top.
export function SnapSection({ children, fill = false }: { children: ReactNode; fill?: boolean }) {
	return (
		<section className={fill ? 'flex min-h-full snap-start flex-col' : 'snap-start'}>
			{children}
		</section>
	);
}