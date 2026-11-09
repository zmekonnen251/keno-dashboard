// Static 2- and 3-digit ticket catalog for the rain ticket queue.
//
// The shapes mirror what recurs in the recorded draws (the same definitions
// the server's indicator signals use):
//   * horizontal runs    1-2-3, 2-3-4 … 78-79-80
//   * escape runs        1-3-5 … and n, n+2, n+3 (77-79-80)
//   * vertical lanes     1-11-21 … 60-70-80 (same ones digit, +10 each step)
//   * skip-decade lanes  50-70-80 (n, n+20, n+30)
//   * vertical hugs      1-11-12, 64-74-75 (lane pair plus an adjacent number)
//
// The History tab ranks this same catalog by how often each ticket actually
// appeared in the last N recorded draws, so the list is data-driven rather
// than only theoretical.

export interface CatalogTicket {
  numbers: number[];
  key: string;
}

export interface CatalogGroup {
  id: string;
  label: string;
  hint: string;
  tickets: CatalogTicket[];
}

export interface CatalogTab {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  groups: CatalogGroup[];
}

export interface HistoryStats {
  scanned: number;
  avgDistinct: number;
  avgAdjacentPairs: number;
  avgVerticalPairs: number;
}

export interface HistoryTicket extends CatalogTicket {
  hits: number;
  pct: number;
  tabLabel: string;
  groupLabel: string;
}

export interface HistoryResult {
  stats: HistoryStats;
  twoDigit: HistoryTicket[];
  threeDigit: HistoryTicket[];
}

export const HISTORY_SCAN_LIMIT = 150;
export const HISTORY_TOP_PER_SPOT = 30;

/** Order-independent identity for a ticket's number set. */
export function ticketKey(numbers: number[]): string {
  return [...numbers].sort((a, b) => a - b).join('-');
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let n = from; n <= to; n++) out.push(n);
  return out;
}

function ticket(numbers: number[]): CatalogTicket {
  return { numbers, key: numbers.join('-') };
}

function group(id: string, label: string, hint: string, numbers: number[][]): CatalogGroup {
  return { id, label, hint, tickets: numbers.map(ticket) };
}

// ── horizontal (neighbours / one-gap escapes) ───────────────────────────────

const horizontalPairs = group(
  'h2',
  'Adjacent pairs',
  '1·2 · 2·3 · … · 79·80',
  range(1, 79).map((n) => [n, n + 1]),
);

const horizontalEscapePairs = group(
  'h2-escape',
  'One-gap escapes',
  '1·3 · 2·4 · … · 78·80',
  range(1, 78).map((n) => [n, n + 2]),
);

const horizontalTriples = group(
  'h3',
  'Consecutive triples',
  '1·2·3 · 2·3·4 · … · 78·79·80',
  range(1, 78).map((n) => [n, n + 1, n + 2]),
);

const horizontalEscapeTriples = group(
  'h3-escape',
  'One-gap triples',
  '1·3·5 · 2·4·6 · … · 76·78·80',
  range(1, 76).map((n) => [n, n + 2, n + 4]),
);

// n, n+2, n+3 matches the 77·79·80 shape the user plays.
const horizontalTailGapTriples = group(
  'h3-tail',
  'Tail-gap triples',
  '1·3·4 · 2·4·5 · … · 77·79·80',
  range(1, 77).map((n) => [n, n + 2, n + 3]),
);

// ── vertical (same ones digit, decade steps) ────────────────────────────────

const verticalPairs = group(
  'v2',
  'One-decade lanes',
  '1·11 · 2·12 · … · 70·80',
  range(1, 70).map((n) => [n, n + 10]),
);

const verticalEscapePairs = group(
  'v2-escape',
  'Two-decade lanes',
  '1·21 · 2·22 · … · 60·80',
  range(1, 60).map((n) => [n, n + 20]),
);

const verticalTriples = group(
  'v3',
  'Stacked lanes',
  '1·11·21 · 2·12·22 · … · 60·70·80',
  range(1, 60).map((n) => [n, n + 10, n + 20]),
);

// n, n+20, n+30 matches the 50·70·80 shape the user plays.
const verticalSkipTriples = group(
  'v3-skip',
  'Skip-decade lanes',
  '1·21·31 · 2·22·32 · … · 50·70·80',
  range(1, 50).map((n) => [n, n + 20, n + 30]),
);

// ── mixed / "different" tickets ─────────────────────────────────────────────

// 64·74·75: a vertical pair with the next number hugging it.
const verticalHugUp = group(
  'mixed-up',
  'Lane pair + next',
  '1·11·12 · 64·74·75 · … · 69·79·80',
  range(1, 69).map((n) => [n, n + 10, n + 11]),
);

// 64·73·74: a vertical pair with the previous number hugging it.
const verticalHugDown = group(
  'mixed-down',
  'Lane pair + previous',
  '1·10·11 · 64·73·74 · … · 70·79·80',
  range(1, 70).map((n) => [n, n + 9, n + 10]),
);

// 64·65·75: a horizontal pair plus the number one decade above the second.
const corner = group(
  'mixed-corner',
  'Corner shapes',
  '1·2·12 · 64·65·75 · … · 69·70·80',
  range(1, 69).map((n) => [n, n + 1, n + 11]),
);

export const TICKET_CATALOG_TABS: CatalogTab[] = [
  {
    id: 'horizontal-2',
    label: 'Horizontal 2',
    shortLabel: 'H·2',
    description: 'Two adjacent numbers, or an adjacent pair with one number skipped.',
    groups: [horizontalPairs, horizontalEscapePairs],
  },
  {
    id: 'horizontal-3',
    label: 'Horizontal 3',
    shortLabel: 'H·3',
    description: 'Three numbers in a row, including one-gap runs and the 77·79·80 tail-gap shape.',
    groups: [horizontalTriples, horizontalEscapeTriples, horizontalTailGapTriples],
  },
  {
    id: 'vertical-2',
    label: 'Vertical 2',
    shortLabel: 'V·2',
    description: 'Same ones digit one or two decades apart.',
    groups: [verticalPairs, verticalEscapePairs],
  },
  {
    id: 'vertical-3',
    label: 'Vertical 3',
    shortLabel: 'V·3',
    description: 'Three numbers on one lane, including the 50·70·80 skip-decade shape.',
    groups: [verticalTriples, verticalSkipTriples],
  },
  {
    id: 'mixed',
    label: 'Lane + hug',
    shortLabel: 'Mixed',
    description: 'The "different" tickets: a lane pair hugging an adjacent number (1·11·12, 64·74·75).',
    groups: [verticalHugUp, verticalHugDown, corner],
  },
];

interface IndexedTicket extends CatalogTicket {
  spots: number;
  tabId: string;
  tabLabel: string;
  groupLabel: string;
}

// One copy per number-set, with the first tab/group that owns it.
const INDEX = new Map<string, IndexedTicket>();
for (const tab of TICKET_CATALOG_TABS) {
  for (const g of tab.groups) {
    for (const t of g.tickets) {
      if (INDEX.has(t.key)) continue;
      INDEX.set(t.key, {
        ...t,
        spots: t.numbers.length,
        tabId: tab.id,
        tabLabel: tab.label,
        groupLabel: g.label,
      });
    }
  }
}

export const ALL_CATALOG_TICKETS: IndexedTicket[] = [...INDEX.values()];

/** Ticket counts per tab, for the tab trigger badges. */
export function catalogTabCount(tab: CatalogTab): number {
  return tab.groups.reduce((sum, g) => sum + g.tickets.length, 0);
}

/** Rank catalog tickets by how often they appeared in the supplied draws. */
export function computeHistoryHits(
  rawDraws: number[][],
  limitPerSpot = HISTORY_TOP_PER_SPOT,
  scanLimit = HISTORY_SCAN_LIMIT,
): HistoryResult {
  const sets: Set<number>[] = [];
  let distinct = 0;
  let adjacentPairs = 0;
  let verticalPairs = 0;

  for (const draw of rawDraws.slice(0, scanLimit)) {
    const set = new Set(
      (draw || []).filter((n) => Number.isInteger(n) && n >= 1 && n <= 80),
    );
    if (set.size === 0) continue;
    sets.push(set);
    distinct += set.size;
    for (const n of set) {
      if (set.has(n + 1)) adjacentPairs++;
      if (set.has(n + 10)) verticalPairs++;
    }
  }

  const counts = new Map<string, number>();
  for (const set of sets) {
    for (const t of ALL_CATALOG_TICKETS) {
      if (t.numbers.every((n) => set.has(n))) {
        counts.set(t.key, (counts.get(t.key) ?? 0) + 1);
      }
    }
  }

  const scanned = sets.length;
  const toHistory = (spots: number): HistoryTicket[] =>
    [...counts.entries()]
      .filter(([key, hits]) => hits > 0 && INDEX.get(key)!.spots === spots)
      .map(([key, hits]) => {
        const meta = INDEX.get(key)!;
        return {
          numbers: meta.numbers,
          key: meta.key,
          hits,
          pct: scanned > 0 ? Math.round((hits / scanned) * 100) : 0,
          tabLabel: meta.tabLabel,
          groupLabel: meta.groupLabel,
        };
      })
      .sort((a, b) => b.hits - a.hits || a.key.localeCompare(b.key))
      .slice(0, Math.max(1, limitPerSpot));

  return {
    stats: {
      scanned,
      avgDistinct: scanned > 0 ? distinct / scanned : 0,
      avgAdjacentPairs: scanned > 0 ? adjacentPairs / scanned : 0,
      avgVerticalPairs: scanned > 0 ? verticalPairs / scanned : 0,
    },
    twoDigit: toHistory(2),
    threeDigit: toHistory(3),
  };
}
