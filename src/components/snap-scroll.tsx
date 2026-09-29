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

  // The element that actually scrolls. Normally this IS `ref.current` (the
  // shell owns the scrollbar once the app layout pins the scroll region to the
  // viewport height), but we walk up from the shell so the control keeps
  // working if some ancestor — e.g. <main> on small screens — ends up being
  // the real scroller instead.
  const getScroller = useCallback((): HTMLElement | null => {
    const el = ref.current;
    if (!el) return null;
    let node: HTMLElement | null = el;
    while (node) {
      if (node.scrollHeight > node.clientHeight + 1) {
        const cs = getComputedStyle(node);
        if (/(auto|scroll|overlay)/.test(cs.overflowY)) return node;
      }
      node = node.parentElement;
    }
    return document.scrollingElement as HTMLElement | null;
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const sections = () =>
      Array.from(el.querySelectorAll<HTMLElement>('[data-snap-section]'));

    const measure = () => {
      const scroller = getScroller();
      const secs = sections();
      setCount(secs.length);
      if (!scroller || !secs.length) return;
      const scrollerTop = scroller.getBoundingClientRect().top;
      let idx = 0;
      let best = Infinity;
      for (let i = 0; i < secs.length; i++) {
        const gap = Math.abs(secs[i].getBoundingClientRect().top - scrollerTop);
        if (gap < best) {
          best = gap;
          idx = i;
        }
      }
      setActive(idx);
    };

    measure();
    // Scroll events don't bubble, but they do pass through ancestors' capture
    // phase — a capture listener on window catches scrolls from any container,
    // including the shell itself, <main>, or the document.
    window.addEventListener('scroll', measure, { capture: true, passive: true });
    window.addEventListener('resize', measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      window.removeEventListener('scroll', measure, { capture: true } as EventListenerOptions);
      window.removeEventListener('resize', measure);
      ro.disconnect();
    };
  }, [getScroller]);

  const goTo = useCallback(
    (idx: number) => {
      const el = ref.current;
      const scroller = getScroller();
      if (!el || !scroller) return;
      const secs = Array.from(el.querySelectorAll<HTMLElement>('[data-snap-section]'));
      const clamped = Math.max(0, Math.min(idx, secs.length - 1));
      const target = secs[clamped];
      if (!target) return;
      const scrollerTop = scroller.getBoundingClientRect().top;
      // Absolute scroll position that puts the section's top flush with the
      // scroller's top edge — correct whether the scroller is the shell, an
      // ancestor like <main>, or the document.
      const dest = scroller.scrollTop + target.getBoundingClientRect().top - scrollerTop;
      scroller.scrollTo({ top: Math.max(0, dest), behavior: 'smooth' });
      setActive(clamped);
    },
    [getScroller],
  );

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