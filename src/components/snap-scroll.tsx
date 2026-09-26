'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

// Vertical snap-scroll shell for the autoplay page. Sections snap so the next
// section lands flush at the top of the viewport while scrolling.
//
// `proximity` (not `mandatory`) is used so a section taller than one screen
// still scrolls freely instead of being pinned to its top edge.
//
// The bottom-right floating control jumps straight to the previous/next
// section, so you never have to scroll through blank space between sections.
export function SnapScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const sections = () =>
      Array.from(el.querySelectorAll<HTMLElement>('[data-snap-section]'));

    const measure = () => {
      const secs = sections();
      setCount(secs.length);
      if (!secs.length) return;
      const tops = secs.map((s) => s.offsetTop - el.offsetTop);
      let idx = 0;
      let best = Infinity;
      for (let i = 0; i < tops.length; i++) {
        const gap = Math.abs(tops[i] - el.scrollTop);
        if (gap < best) {
          best = gap;
          idx = i;
        }
      }
      setActive(idx);
    };

    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      ro.disconnect();
    };
  }, []);

  const goTo = useCallback((idx: number) => {
    const el = ref.current;
    if (!el) return;
    const secs = Array.from(el.querySelectorAll<HTMLElement>('[data-snap-section]'));
    const target = secs[Math.max(0, Math.min(idx, secs.length - 1))];
    if (!target) return;
    el.scrollTo({ top: target.offsetTop - el.offsetTop, behavior: 'smooth' });
  }, []);

  const atTop = active <= 0;
  const atBottom = count > 0 && active >= count - 1;

  return (
    <div ref={ref} className="relative h-full snap-y snap-proximity space-y-4 overflow-y-auto pb-16">
      {children}

      {count > 1 && (
        <div className="fixed right-4 bottom-24 z-50 flex flex-col items-center gap-1.5 sm:bottom-6 sm:right-6">
          <span className="rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-bold text-muted-foreground backdrop-blur">
            {active + 1}/{count}
          </span>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => goTo(active - 1)}
              disabled={atTop}
              title="Previous section"
              aria-label="Previous section"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-lg backdrop-blur transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => goTo(active + 1)}
              disabled={atBottom}
              title="Next section"
              aria-label="Next section"
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-600 text-white shadow-lg transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// One scroll-snap target. Sections keep their natural height so content flows
// without dead/blank space; only each section's top edge snap-aligns to the
// viewport top while scrolling. The `fill` prop is kept for API compatibility
// — it previously forced every section to fill a full viewport, which is what
// produced the scrollable white gaps between sections.
export function SnapSection({ children, fill = false }: { children: ReactNode; fill?: boolean }) {
  return (
    <section data-snap-section className="snap-start">
      {children}
    </section>
  );
}