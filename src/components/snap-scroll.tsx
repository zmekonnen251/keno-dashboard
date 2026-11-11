'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, List } from 'lucide-react';

// Vertical snap-scroll shell for the autoplay page. Sections snap so the next
// section lands flush at the top of the viewport while scrolling.
//
// `proximity` (not `mandatory`) is used so a section taller than one screen
// still scrolls freely instead of being pinned to its top edge.
//
// The bottom-right floating control jumps straight to the previous/next
// section, and the counter opens a jump menu listing every section title, so
// you never have to scroll through blank space between sections.
export function SnapScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const [count, setCount] = useState(0);
  const [titles, setTitles] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

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
      const nextTitles = secs.map(
        (s) => s.dataset.snapTitle || s.querySelector('h2,h3')?.textContent?.trim() || 'Section',
      );
      setTitles((prev) =>
        prev.length === nextTitles.length && prev.every((t, i) => t === nextTitles[i]) ? prev : nextTitles,
      );
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
    <div
      ref={ref}
      className="relative h-full min-w-0 snap-y snap-proximity space-y-4 overflow-x-hidden overflow-y-auto pb-16"
    >
      {children}

      {count > 1 && (
        <div className="fixed right-4 bottom-24 z-50 flex flex-col items-center gap-1.5 sm:bottom-6 sm:right-6">
          {menuOpen && (
            <button
              type="button"
              aria-label="Close section menu"
              tabIndex={-1}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 -z-10 cursor-default bg-transparent"
            />
          )}
          <div className="relative">
            {menuOpen && (
              <div className="absolute right-0 bottom-full mb-2 max-h-[60vh] w-60 overflow-y-auto rounded-xl border border-border bg-background/95 p-1.5 shadow-xl backdrop-blur">
                <div className="px-2 pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Jump to section
                </div>
                {titles.map((t, i) => (
                  <button
                    key={`${i}-${t}`}
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      goTo(i);
                    }}
                    className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent ${
                      i === active ? 'bg-accent font-semibold text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    <span className="w-4 shrink-0 text-right font-mono text-[10px] opacity-60">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{t}</span>
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              title="Jump to a section"
              aria-label="Jump to a section"
              aria-expanded={menuOpen}
              className="flex items-center gap-1 rounded-full border border-border bg-background/90 px-2 py-0.5 text-[10px] font-bold text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent hover:text-foreground"
            >
              <List className="h-3 w-3" />
              {active + 1}/{count}
            </button>
          </div>
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
// produced the scrollable white gaps between sections. `title` labels the
// section in the jump menu.
export function SnapSection({
  children,
  fill = false,
  title,
}: {
  children: ReactNode;
  fill?: boolean;
  title?: string;
}) {
  return (
    <section data-snap-section data-snap-title={title} className="min-w-0 snap-start">
      {children}
    </section>
  );
}