/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CollapsibleCard } from './CollapsibleCard';
import {
  rainManualCashBet,
  getRainAutoplayStatus,
  rainBetPrediction,
  getRainPrediction,
  getRainTicketConfig,
  setRainTicketConfig,
  getRainFreeBets,
  playRainFreeBet,
} from '@/lib/api';
import {
  Play,
  Trash2,
  Sparkles,
  Zap,
  Plus,
  Gift,
  Coins,
  MoreVertical,
  ArrowUp,
  ArrowDown,
  SortAsc,
  Pencil,
  GripVertical,
  X,
} from 'lucide-react';
import type { RainAutoplayConfig, RainAccount, RainAutoplayStatus, BotTicket, RainFreeBet } from '@/lib/types';
import { useSocket } from '@/lib/service-gateway';
import { NumberGrid } from './NumberGrid';

// Pre-configured one-click tickets (mirrors the mobile RainAutoplayConfig defaults).
const PRESET_TICKETS: { label: string; numbers: number[] }[] = [
  { label: '1,2,3', numbers: [1, 2, 3] },
  { label: '72,73,74', numbers: [72, 73, 74] },
  { label: '77,78,79', numbers: [77, 78, 79] },
];

// Cash quick-stake buttons (ETB). All manual-bet stake defaults are 5 ETB;
// the minimum stays 2 ETB.
const CASH_PRESETS = [2, 5, 8, 10, 20];
// Free-bet one-click presets (Birr) — highest-value first.
const FREE_PRESETS = [50, 30, 10, 5, 2];
const DEFAULT_STAKE = 5;

/** A free-bet row is playable while it's available (or failed = retryable),
 *  not settled, and not expired — mirrors the server's listEligibleFreeBets. */
function isPlayableFreeBet(b: RainFreeBet): boolean {
  if (b.status !== 'available' && b.status !== 'failed') return false;
  if ((b.closed_bet_count ?? 0) >= 1) return false;
  if (b.expires_at && new Date(b.expires_at).getTime() <= Date.now()) return false;
  return true;
}

/** Build the two ML ticket groups from the last rain prediction:
 *  "Most Repetitive 2–5 Digit" chips are the top repeated 2-5 digit patterns;
 *  "Recurrence" chips are the individual numbers that recur most often. */
function buildMlGroups(
  lp: { repetitivePatterns?: any[] } | null,
): { key: string; label: string; chips: { id: string; numbers: number[]; stake: number; meta: string }[] }[] {
  if (!lp) return [];
  const patterns = Array.isArray(lp.repetitivePatterns) ? lp.repetitivePatterns : [];
  const groups: { key: string; label: string; chips: { id: string; numbers: number[]; stake: number; meta: string }[] }[] = [];

  const patterned = patterns
    .filter((p: any) => Array.isArray(p?.numbers) && p.numbers.length >= 2 && p.numbers.length <= 5)
    .sort((a: any, b: any) => (b.frequency ?? 0) - (a.frequency ?? 0));
  if (patterned.length > 0) {
    groups.push({
      key: 'repetitive',
      label: 'Most Repetitive 2–5 Digit',
      chips: patterned.slice(0, 4).map((p: any, i: number) => ({
        id: `ml-rep-${i}-${p.numbers.join('-')}`,
        numbers: p.numbers.map(Number),
        stake: DEFAULT_STAKE,
        meta: `×${p.frequency ?? 1}`,
      })),
    });
  }

  const freq = new Map<number, number>();
  for (const p of patterns) {
    if (!Array.isArray(p?.numbers)) continue;
    for (const n of p.numbers) {
      const num = Number(n);
      if (Number.isFinite(num)) freq.set(num, (freq.get(num) ?? 0) + (Number(p.frequency) || 1));
    }
  }
  const recurring = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  if (recurring.length >= 2) {
    const chips: { id: string; numbers: number[]; stake: number; meta: string }[] = [];
    for (let i = 0; i < recurring.length && chips.length < 3; i += 3) {
      chips.push({ id: `ml-rec-${i}`, numbers: recurring.slice(i, i + 3), stake: DEFAULT_STAKE, meta: `#${i + 1}` });
    }
    groups.push({ key: 'recurring', label: 'Recurrence', chips });
  }
  return groups;
}

interface RainManualBetCardProps {
  running: boolean;
  config?: RainAutoplayConfig | null;
  accounts: RainAccount[];
  onMessage: (msg: string) => void;
  onRefresh: () => void;
}

export function RainManualBetCard({ config, accounts, onMessage, onRefresh }: RainManualBetCardProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null); // null = auto (server picks by balance)
  const [picks, setPicks] = useState<number[]>([]);
  const [stake, setStake] = useState<number>(DEFAULT_STAKE);
  const [predicting, setPredicting] = useState(false);
  const [betting, setBetting] = useState(false);
  const [lastPrediction, setLastPrediction] = useState<{
    picks: number[];
    strategy: string;
    difficulty: string;
    repetitivePatterns: any[];
    clusters: any[];
  } | null>(null);
  const [status, setStatus] = useState<RainAutoplayStatus | null>(null);
  // Full ticket queue from the rain autoplay config (enabled + disabled) so
  // "Add ticket" never drops disabled entries. Only enabled ones are playable.
  const [queue, setQueue] = useState<BotTicket[]>([]);
  const [newNumbers, setNewNumbers] = useState('');
  const [newStake, setNewStake] = useState(String(DEFAULT_STAKE));

  // ── UI/UX additions ─────────────────────────────────────────────────────
  const [betMode, setBetMode] = useState<'cash' | 'free'>('cash'); // which fund the place button uses
  const [freeBets, setFreeBets] = useState<RainFreeBet[]>([]);
  const [freeBetAuto, setFreeBetAuto] = useState(true); // Auto-Mode: pick best eligible free bet
  const [selectedFreeBetId, setSelectedFreeBetId] = useState<number | null>(null);
  const [stakeMode, setStakeMode] = useState<'custom' | 'quick'>('custom'); // cash stake: two input modes
  const [newTicketType, setNewTicketType] = useState<'cash' | 'free'>('cash');
  // Context menu + inline edit state for one-click tickets.
  const [ctxMenu, setCtxMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStake, setEditStake] = useState('');
  // HTML5 drag-and-drop reorder — stored as ticket id so state stays in sync.
  const [dragId, setDragId] = useState<string | null>(null);

  const savedTickets = queue.filter((t: BotTicket) => t.enabled);
  const cashTickets = savedTickets.filter((t) => !t.useFreeBet);
  const freeTickets = savedTickets.filter((t) => t.useFreeBet);

  const playableFreeBets = freeBets.filter(isPlayableFreeBet);
  const bestFreeBet = playableFreeBets.length
    ? [...playableFreeBets].sort(
        (a, b) => b.wager_amount - a.wager_amount || (a.granted_at ?? '').localeCompare(b.granted_at ?? ''),
      )[0]
    : null;
  const activeFreeBet =
    freeBetAuto || selectedFreeBetId === null
      ? bestFreeBet
      : playableFreeBets.find((b) => b.id === selectedFreeBetId) ?? null;

  useSocket('/rain/autoplay/status', (data: any) => {
    if (data?.status) setStatus(data.status);
  });

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const [st, tc, fb] = await Promise.all([
          getRainAutoplayStatus(),
          getRainTicketConfig(),
          getRainFreeBets(),
        ]);
        setStatus(st.status);
        if (tc.ok && Array.isArray(tc.config?.tickets)) setQueue(tc.config.tickets);
        if (Array.isArray(fb?.bets)) setFreeBets(fb.bets);
      } catch {}
    };
    fetchStatus();
    const t = setInterval(fetchStatus, 5000);
    return () => clearInterval(t);
  }, []);

  // Only enabled accounts with a playable balance (min stake is 2 ETB,
  // below that the bet can't be placed) — sorted richest first so the least
  // likely-to-cover accounts are at the bottom.
  const enabledAccounts = accounts
    .filter((a) => a.is_enabled && a.balance >= 2)
    .sort((a, b) => b.balance - a.balance);

  // Max stake = the balance of the selected account, or (auto) the highest
  // balance among enabled accounts — e.g. if the richest account has 20 ETB
  // the stake input is capped at 20. Min is 2 ETB.
  const stakeMax = Math.max(
    2,
    selectedAccountId !== null
      ? (enabledAccounts.find(a => a.id === selectedAccountId)?.balance ?? 2)
      : Math.max(2, ...enabledAccounts.map(a => a.balance)),
  );

  const clampStake = (v: number) => (Number.isFinite(v) ? Math.min(Math.max(Math.round(v * 100) / 100, 2), stakeMax) : 2);
  const x2Stake = () => setStake(clampStake(stake * 2));

  const accountLabel = (id: number | null) =>
    id !== null
      ? `account #${id}`
      : `auto-selected account (${stakeMax.toFixed(2)} ETB max balance)`;

  const parseNumbers = (input: string): number[] => {
    const nums = input
      .split(/[\s,;\-–—]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter((n) => Number.isFinite(n) && Number.isInteger(n) && n >= 1 && n <= 80);
    return Array.from(new Set(nums));
  };

  /** Shared one-click bet: validates + clamps, places the cash wager, reports the outcome. */
  const placeOneClick = async (numbersIn: number[], stakeIn: number, label: string) => {
    const numbers = Array.from(new Set(numbersIn))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 80)
      .slice(0, 10);
    if (numbers.length === 0) {
      onMessage(`Can't place ${label}: need 1–10 valid keno numbers (1–80).`);
      return null;
    }
    const st = clampStake(stakeIn);
    setBetting(true);
    try {
      const res = await rainManualCashBet(selectedAccountId, numbers, st);
      if (res.ok && res.result?.ok) {
        onMessage(`✓ One-click bet placed [${numbers.join(', ')}] · ${st} ETB · ${accountLabel(res.accountId ?? selectedAccountId)}`);
        onRefresh();
        return res;
      }
      onMessage(res.result?.error || 'Failed to place one-click bet');
      return null;
    } catch (e) {
      onMessage('One-click bet failed: ' + (e instanceof Error ? e.message : String(e)));
      return null;
    } finally {
      setBetting(false);
    }
  };

  /** One-click saved ticket: fixed numbers, otherwise generate picks on the fly
   *  so a click ALWAYS results in a bet (never a silent no-op). Supports both
   *  cash tickets (rainManualCashBet) and free-bet tickets (playRainFreeBet). */
  const handlePlaySavedTicket = async (ticket: BotTicket) => {
    let numbers = ticket.numbers && ticket.numbers.length > 0 ? ticket.numbers : null;
    if (!numbers) {
      onMessage(`Ticket #${ticket.id} has no fixed numbers — generating picks, then betting…`);
      try {
        const res = await getRainPrediction(config?.provider ?? 'fungames_shamo', ticket.spots || 3);
        if (res.ok && res.prediction?.picks?.length) numbers = res.prediction.picks;
      } catch {}
      if (!numbers || numbers.length === 0) numbers = picks.length > 0 ? picks : null;
      if (!numbers || numbers.length === 0) {
        onMessage(`Ticket #${ticket.id} has no numbers — pick numbers on the board and click again.`);
        return;
      }
    }
    if (ticket.useFreeBet) {
      await handlePlayFreeBet(numbers, ticket.stake ?? stake, `saved free-bet ticket #${ticket.id}`);
    } else {
      await placeOneClick(numbers, ticket.stake ?? stake, `saved ticket #${ticket.id}`);
    }
  };

  /** One-click preset ticket: place the fixed numbers immediately on the selected account. */
  const handlePlayPreset = (numbers: number[]) => {
    void placeOneClick(numbers, stake, `pre-configured [${numbers.join(',')}]`);
  };

  /** Free-bet manual play: Auto-Mode picks the best eligible free bet (highest
   *  wager, oldest first), otherwise the user-selected one. Spots default to
   *  the board picks; when empty the engine uses its configured spots. */
  const handlePlayFreeBet = async (numbersIn: number[] | null, stakeIn?: number, label = 'free bet') => {
    const bet = activeFreeBet;
    if (!bet) {
      onMessage('No playable free bet available — refresh the page or connect an account with a fresh rain bonus.');
      return null;
    }
    setBetting(true);
    try {
      const spots = numbersIn && numbersIn.length > 0 ? numbersIn.slice(0, 10) : picks.length > 0 ? picks : undefined;
      const res = await playRainFreeBet(bet.id, spots);
      if (res.ok && res.result?.ok) {
        onMessage(`✓ ${label} played — wager ${bet.wager_amount} ETB${spots && spots.length ? ` on [${spots.join(', ')}]` : ''}`);
        onRefresh();
        return res;
      }
      onMessage(res.result?.error || `Failed to play ${label}`);
      return null;
    } catch (e) {
      onMessage(`${label} failed: ` + (e instanceof Error ? e.message : String(e)));
      return null;
    } finally {
      setBetting(false);
    }
  };

  const handleInjectPicks = async () => {
    if (!config) return;
    setPredicting(true);
    try {
      const res = await rainBetPrediction();
      if (res.ok && res.result?.ok) {
        onMessage('Prediction bet placed!');
        onRefresh();
      } else {
        onMessage(res.result?.error || 'Failed to place prediction bet');
      }
    } catch (e) {
      onMessage('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPredicting(false);
    }
  };

  const handlePlaceBet = async () => {
    if (picks.length === 0) return;
    if (betMode === 'free') {
      await handlePlayFreeBet(picks, stake, 'manual free bet');
      return;
    }
    setBetting(true);
    try {
      const res = await rainManualCashBet(selectedAccountId, picks, stake);
      if (res.ok && res.result?.ok) {
        onMessage(`Bet placed on ${accountLabel(res.accountId ?? selectedAccountId)} with stake ${stake} ETB`);
        setPicks([]);
        onRefresh();
      } else {
        onMessage(res.result?.error || 'Failed to place bet');
      }
    } catch (e) {
      onMessage('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBetting(false);
    }
  };

  const handleGeneratePicks = async () => {
    if (!config) return;
    setPredicting(true);
    try {
      const res = await getRainPrediction(config.provider, 3);
      if (res.ok && res.prediction) {
        const p = res.prediction;
        setPicks(p.picks);
        setLastPrediction({
          picks: p.picks,
          strategy: p.strategy,
          difficulty: p.difficulty.level,
          repetitivePatterns: p.repetitivePatterns,
          clusters: p.clusters,
        });
        onMessage(`Generated ${p.picks.length} picks using ${p.strategy} strategy (${p.difficulty.level})`);
      }
    } catch (e) {
      onMessage('Error generating picks: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPredicting(false);
    }
  };

  const handleClearPicks = () => { setPicks([]); setLastPrediction(null); };

  function toggleNumber(n: number) {
    setPicks((prev) => {
      if (prev.includes(n)) return prev.filter(x => x !== n);
      if (prev.length >= 10) return [...prev.slice(1), n]; // keep newest, drop oldest
      return [...prev, n].sort((a, b) => a - b);
    });
  }

  /** Build a ticket from the "Add custom ticket" inputs. Empty numbers ⇒ AI ticket. */
  const buildTicket = (): BotTicket => {
    const numbers = parseNumbers(newNumbers);
    return {
      id: `t${Date.now()}`,
      spots: numbers.length || 3,
      strategy: numbers.length ? 'manual' : 'cluster',
      stake: clampStake(Number(newStake) || DEFAULT_STAKE),
      enabled: true,
      useFreeBet: newTicketType === 'free',
      ...(numbers.length ? { numbers } : {}),
    };
  };

  const persistQueue = async (next: BotTicket[]): Promise<boolean> => {
    setQueue(next);
    try {
      const res = await setRainTicketConfig({ tickets: next });
      if (res.ok) return true;
      onMessage('Failed to save ticket queue (server error).');
    } catch (e) {
      onMessage('Failed to save ticket queue: ' + (e instanceof Error ? e.message : String(e)));
    }
    return false;
  };

  /** Persist a new custom ticket to the queue so it appears in the one-click list. */
  const handleAddTicket = async () => {
    const t = buildTicket();
    await persistQueue([...queue, t]);
    onMessage(
      `Ticket added (#${t.id})${t.numbers ? ` [${t.numbers.join(',')}]` : ' (AI — generates picks on click)'} · ${t.stake} ETB · ${t.useFreeBet ? 'Free bet' : 'Cash'}.`,
    );
    setNewNumbers('');
    setNewStake(String(DEFAULT_STAKE));
  };

  /** Persist a new custom ticket AND play it immediately. */
  const handleAddAndPlay = async () => {
    const t = buildTicket();
    const ok = await persistQueue([...queue, t]);
    setNewNumbers('');
    setNewStake(String(DEFAULT_STAKE));
    if (!ok) return;
    if (t.numbers && t.numbers.length > 0) {
      if (t.useFreeBet) await handlePlayFreeBet(t.numbers, t.stake, `new ticket [${t.numbers.join(',')}]`);
      else await placeOneClick(t.numbers, t.stake, `new ticket [${t.numbers.join(',')}]`);
    } else {
      await handlePlaySavedTicket(t);
    }
  };

  // ── Context menu + reorder helpers ──────────────────────────────────────

  /** Rebuild the full queue with one group (cash/free) reordered in place. */
  const reorderGroup = (group: BotTicket[], ordered: BotTicket[]) => {
    const ids = new Set(group.map((g) => g.id));
    const byId = new Map(ordered.map((t) => [t.id, t]));
    const next = queue.map((t) => (ids.has(t.id) ? byId.get(t.id)! : t));
    setQueue(next);
    void persistQueue(next);
  };

  const moveTicket = (group: BotTicket[], from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || to >= group.length) return;
    const copy = [...group];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    reorderGroup(group, copy);
  };

  /** Auto-sort one ticket group: stake amount asc, then digit count asc. */
  const sortGroup = (group: BotTicket[]) => {
    const sorted = [...group].sort((a, b) => {
      const d = (a.stake ?? 0) - (b.stake ?? 0);
      if (d !== 0) return d;
      return (a.numbers?.length ?? a.spots ?? 0) - (b.numbers?.length ?? b.spots ?? 0);
    });
    reorderGroup(group, sorted);
    onMessage(`Sorted ${group.length} ticket(s) — stake ↑, digit count ↑`);
  };

  const dropTicket = (group: BotTicket[], targetIdx: number) => {
    if (!dragId) return;
    const from = group.findIndex((t) => t.id === dragId);
    if (from < 0 || from === targetIdx) return;
    const copy = [...group];
    const [item] = copy.splice(from, 1);
    copy.splice(targetIdx, 0, item);
    reorderGroup(group, copy);
  };

  const updateTicket = (id: string, patch: Partial<BotTicket>) => {
    const next = queue.map((t) => (t.id === id ? { ...t, ...patch } : t));
    setQueue(next);
    void persistQueue(next);
  };

  const removeTicket = (id: string) => {
    setCtxMenu(null);
    const next = queue.filter((t) => t.id !== id);
    setQueue(next);
    void persistQueue(next);
  };

  /** Render one ticket row with drag handle, context menu + inline stake editor. */
  const ticketRow = (t: BotTicket, idx: number, group: BotTicket[], kind: 'cash' | 'free') => {
    const isFree = kind === 'free';
    const editing = editingId === t.id;
    return (
      <div
        key={t.id}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          setDragId(t.id);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          dropTicket(group, idx);
          setDragId(null);
        }}
        onDragEnd={() => setDragId(null)}
        onContextMenu={(e) => {
          e.preventDefault();
          setCtxMenu({ id: t.id, x: e.clientX, y: e.clientY });
        }}
        className={`group/ticket flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${
          dragId === t.id ? 'border-indigo-400 bg-indigo-500/10' : 'border-border bg-muted/40 hover:bg-muted'
        }`}
        title={isFree ? 'Free-bet ticket — right-click for actions; drag to reorder' : 'Cash ticket — right-click for actions; drag to reorder'}
      >
        <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-mono">
          {t.numbers?.length
            ? `#${idx + 1} [${t.numbers.join(',')}]`
            : `#${idx + 1} ${t.spots ?? 3}SP ${String(t.strategy ?? 'ML').toUpperCase()}`}
          <span className="ml-2 text-[10px] text-muted-foreground">
            {t.stake ?? DEFAULT_STAKE} {isFree ? 'Birr 🎁' : 'ETB 💰'}
          </span>
        </span>
        {editing ? (
          <span className="flex items-center gap-1">
            <Input
              type="number"
              min={2}
              value={editStake}
              onChange={(e) => setEditStake(e.target.value)}
              className="h-6 w-16 px-1.5 text-xs font-mono"
              autoFocus
            />
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                const n = parseFloat(editStake);
                updateTicket(t.id, { stake: Number.isFinite(n) && n >= 2 ? n : DEFAULT_STAKE });
                setEditingId(null);
                onMessage(`Ticket #${t.id} stake → ${Number.isFinite(n) && n >= 2 ? n : DEFAULT_STAKE}`);
              }}
            >
              OK
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setEditingId(null)}>
              <X className="h-3 w-3" />
            </Button>
          </span>
        ) : (
          <span className="flex items-center gap-0.5">
            <Button size="xs" variant="ghost" className="h-6 w-6 px-0" onClick={() => moveTicket(group, idx, idx - 1)} disabled={idx === 0} title="Move up">
              <ArrowUp className="h-3 w-3" />
            </Button>
            <Button size="xs" variant="ghost" className="h-6 w-6 px-0" onClick={() => moveTicket(group, idx, idx + 1)} disabled={idx === group.length - 1} title="Move down">
              <ArrowDown className="h-3 w-3" />
            </Button>
            <Button
              size="xs"
              variant="ghost"
              className="h-6 w-6 px-0"
              onClick={() => {
                setEditingId(editingId === t.id ? null : t.id);
                setEditStake(String(t.stake ?? DEFAULT_STAKE));
              }}
              title="Edit stake"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button size="xs" variant="ghost" className="h-6 w-6 px-0 text-rose-400" onClick={() => removeTicket(t.id)} title="Remove ticket">
              <Trash2 className="h-3 w-3" />
            </Button>
          </span>
        )}
      </div>
    );
  };

  /** One collapsible ticket group (Cash or Free Bet) with its own sort button. */
  const ticketGroup = (kind: 'cash' | 'free') => {
    const group = kind === 'cash' ? cashTickets : freeTickets;
    const icon = kind === 'cash' ? <Coins className="h-3.5 w-3.5 text-blue-400" /> : <Gift className="h-3.5 w-3.5 text-amber-400" />;
    const title = kind === 'cash' ? 'Cash One-Click Tickets' : 'Free Bet One-Click Tickets';
    return (
      <details className="rounded-lg border border-border bg-white/3" open>
        <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-300">
          {icon}
          <span>{title}</span>
          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] text-slate-300">{group.length}</span>
          <span className="ml-auto flex items-center gap-1">
            <Button
              size="xs"
              variant="ghost"
              className="h-6 px-1.5 text-[10px] normal-case tracking-normal"
              disabled={group.length < 2}
              onClick={(e) => {
                e.preventDefault();
                sortGroup(group);
              }}
              title="Auto-sort by stake (asc) then digit count"
            >
              <SortAsc className="h-3 w-3 mr-0.5" /> Sort
            </Button>
          </span>
        </summary>
        <div className="space-y-1.5 px-3 pb-3 pt-1">
          {group.length === 0 ? (
            <p className="text-[11px] italic text-muted-foreground">
              No {kind === 'cash' ? 'cash' : 'free-bet'} tickets yet — add one below.
            </p>
          ) : (
            group.map((t, idx) => ticketRow(t, idx, group, kind))
          )}
        </div>
      </details>
    );
  };

  const mlGroups = buildMlGroups(lastPrediction);

  return (
    <CollapsibleCard title="Manual Cash Bet (Rain Accounts)" defaultOpen={true}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Manual bets work without starting autoplay — pick or generate numbers on the board, choose
          Cash (stake in ETB) or a Free Bet (wager = the bonus amount), and place the bet. Saved
          one-click tickets place immediately; AI tickets generate picks first.
        </p>

        {/* Bet fund mode: Cash vs Free Bet */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bet with:</span>
          <Button
            size="sm"
            variant={betMode === 'cash' ? 'default' : 'outline'}
            onClick={() => setBetMode('cash')}
            className={betMode === 'cash' ? 'bg-blue-600 hover:bg-blue-500' : ''}
          >
            <Coins className="h-3.5 w-3.5 mr-1" /> Cash
          </Button>
          <Button
            size="sm"
            variant={betMode === 'free' ? 'default' : 'outline'}
            onClick={() => setBetMode('free')}
            className={betMode === 'free' ? 'bg-amber-600 hover:bg-amber-500' : ''}
          >
            <Gift className="h-3.5 w-3.5 mr-1" /> Free Bet
          </Button>
          {betMode === 'free' && (
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={freeBetAuto}
                onChange={(e) => setFreeBetAuto(e.target.checked)}
                className="accent-amber-500"
              />
              Auto-Mode — auto-pick best free bet
            </label>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* LEFT — keno board */}
          <div className="rounded-lg border border-border p-3 lg:self-start">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Keno Board — tap up to 10 numbers</span>
              <Button variant="outline" size="sm" onClick={handleClearPicks} disabled={picks.length === 0} className="h-7 px-2 text-xs">
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear ({picks.length})
              </Button>
            </div>
            <NumberGrid
              selected={picks}
              max={10}
              onToggle={toggleNumber}
              onClear={() => setPicks([])}
            />
          </div>

          {/* RIGHT — controls, quick tickets & add-ticket */}
          <div className="space-y-3">
            {betMode === 'cash' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Account</Label>
                  <select
                    value={selectedAccountId ?? 'auto'}
                    onChange={(e) => setSelectedAccountId(e.target.value === 'auto' ? null : Number(e.target.value))}
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  >
                    <option value="auto">🤖 Auto — server picks by balance</option>
                    {enabledAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.provider}) — Bal: {a.balance.toFixed(2)} ETB
                      </option>
                    ))}
                  </select>
                  {enabledAccounts.length === 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      No enabled rain account with balance ≥ 2 ETB — the bet cannot be placed.
                    </p>
                  )}
                </div>

                {/* Cash stake: two input modes (custom number vs quick presets) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Stake (ETB) — min 2, max {stakeMax.toFixed(2)}</Label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setStakeMode('custom')}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${stakeMode === 'custom' ? 'bg-blue-600 text-white' : 'bg-white/10 text-slate-300'}`}
                      >
                        Custom
                      </button>
                      <button
                        type="button"
                        onClick={() => setStakeMode('quick')}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${stakeMode === 'quick' ? 'bg-blue-600 text-white' : 'bg-white/10 text-slate-300'}`}
                      >
                        Quick
                      </button>
                      <Button size="xs" variant="outline" className="h-6 px-1.5 text-[10px]" onClick={x2Stake} title="Double the current stake">
                        ×2
                      </Button>
                    </div>
                  </div>

                  {stakeMode === 'custom' ? (
                    <Input
                      type="number"
                      min={2}
                      max={stakeMax}
                      value={stake}
                      onChange={(e) => setStake(clampStake(Number(e.target.value)))}
                      className="font-mono"
                    />
                  ) : (
                    // Quick-stake presets live in a collapsible container.
                    <details className="rounded-lg border border-border bg-white/3">
                      <summary className="cursor-pointer select-none px-2 py-1.5 text-[11px] font-bold text-slate-300">
                        Quick stakes: {CASH_PRESETS.join(' / ')} ETB
                      </summary>
                      <div className="flex flex-wrap gap-1.5 px-2 pb-2 pt-1">
                        {CASH_PRESETS.map((n) => (
                          <Button
                            key={n}
                            size="xs"
                            variant={stake === n ? 'default' : 'outline'}
                            className="h-7 min-w-11 px-2 font-mono"
                            onClick={() => setStake(clampStake(n))}
                          >
                            {n}
                          </Button>
                        ))}
                        <Button size="xs" variant="outline" className="h-7 px-2 font-mono" onClick={x2Stake}>
                          ×2
                        </Button>
                      </div>
                    </details>
                  )}
                  {selectedAccountId === null && (
                    <p className="text-[10px] text-muted-foreground">
                      Max = highest enabled account balance ({stakeMax.toFixed(2)} ETB).
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* Free Bet fund selector */
              <div className="space-y-1.5">
                <Label>Free Bet</Label>
                <select
                  value={freeBetAuto ? 'auto' : (activeFreeBet?.id ?? 'auto')}
                  onChange={(e) => {
                    if (e.target.value === 'auto') {
                      setFreeBetAuto(true);
                      setSelectedFreeBetId(null);
                    } else {
                      setFreeBetAuto(false);
                      setSelectedFreeBetId(Number(e.target.value));
                    }
                  }}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  disabled={playableFreeBets.length === 0}
                >
                  {playableFreeBets.length > 0 && (
                    <option value={bestFreeBet?.id ?? ''}>✨ Auto — best: {bestFreeBet ? `${bestFreeBet.wager_amount} ETB` : '—'}</option>
                  )}
                  {freeBetAuto && (
                    <option value="auto">Auto (highest wager first)</option>
                  )}
                  {playableFreeBets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.account_name ? `#${b.account_id} ${b.account_name} · ` : `#${b.account_id} · `}
                      {b.wager_amount} ETB · {b.status}
                    </option>
                  ))}
                </select>
                {playableFreeBets.length === 0 ? (
                  <p className="text-[10px] text-amber-500/90">
                    No playable free bets right now — new rain bonuses on enabled accounts unlock automatically.
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">
                    {activeFreeBet
                      ? `Playing wager ${activeFreeBet.wager_amount} ETB · ${activeFreeBet.account_name ? activeFreeBet.account_name + ' · ' : ''}${activeFreeBet.given_count ?? 0} bonus(es)`
                      : 'Pick a free bet above.'}
                  </p>
                )}
              </div>
            )}

            {/* ML ticket groups (Most Repetitive 2–5 Digit + Recurrence) */}
            {mlGroups.length > 0 && (
              <div className="space-y-2">
                {mlGroups.map((g) => (
                  <div key={g.key} className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-purple-300">{g.label}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {g.chips.map((c) => (
                        <Button
                          key={c.id}
                          size="sm"
                          variant="outline"
                          className="bg-purple-600/20 hover:bg-purple-500/40 text-purple-100 border border-purple-500/30 text-[11px] font-mono cursor-pointer"
                          title={`Apply [${c.numbers.join(',')}] to the board (${c.stake} ETB) — right-click for more`}
                          onClick={() => {
                            setPicks(c.numbers.slice(0, 10));
                            setStake(clampStake(c.stake));
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setPicks(c.numbers.slice(0, 10));
                            void persistQueue([
                              ...queue,
                              { id: `ml-${Date.now()}`, spots: c.numbers.length, strategy: 'manual', stake: c.stake, enabled: true, useFreeBet: false, numbers: c.numbers },
                            ]);
                            onMessage(`ML ticket [${c.numbers.join(',')}] · ${c.stake} ETB saved to cash tickets`);
                          }}
                        >
                          [{c.numbers.join(',')}]
                          <span className="ml-1 text-[9px] opacity-70">{c.meta}</span>
                        </Button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[10px] text-purple-200/50">
                      Click to load onto the board · right-click to save as a cash one-click ticket ({DEFAULT_STAKE} ETB)
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* One-click saved tickets — grouped into Cash + Free Bet collapsibles */}
            {(cashTickets.length > 0 || freeTickets.length > 0) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-indigo-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">One-Click Saved Tickets</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">right-click = menu · drag = reorder</span>
                </div>
                {ticketGroup('cash')}
                {ticketGroup('free')}
              </div>
            )}

            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Plus className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">Add custom one-click ticket</span>
              </div>
              {/* Ticket type: Cash or Free Bet */}
              <div className="mb-2 flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Type:</span>
                <Button
                  size="xs"
                  variant={newTicketType === 'cash' ? 'default' : 'outline'}
                  className={newTicketType === 'cash' ? 'bg-blue-600' : ''}
                  onClick={() => setNewTicketType('cash')}
                >
                  <Coins className="h-3 w-3 mr-1" /> Cash
                </Button>
                <Button
                  size="xs"
                  variant={newTicketType === 'free' ? 'default' : 'outline'}
                  className={newTicketType === 'free' ? 'bg-amber-600' : ''}
                  onClick={() => setNewTicketType('free')}
                >
                  <Gift className="h-3 w-3 mr-1" /> Free Bet
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Numbers (e.g. 1,2,3) — blank = AI</Label>
                  <Input
                    value={newNumbers}
                    onChange={(e) => setNewNumbers(e.target.value)}
                    placeholder="1,2,3"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label>{newTicketType === 'free' ? 'Stake (Birr)' : 'Stake (ETB)'}</Label>
                  <Input
                    type="number"
                    min={2}
                    max={newTicketType === 'free' ? undefined : stakeMax}
                    value={newStake}
                    onChange={(e) => setNewStake(e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">
                  {newTicketType === 'free' ? 'Free presets:' : 'Quick presets:'}
                </span>
                {(newTicketType === 'free' ? FREE_PRESETS : CASH_PRESETS).map((n) => (
                  <Button
                    key={n}
                    size="xs"
                    variant={Number(newStake) === n ? 'default' : 'outline'}
                    className="h-6 px-2 font-mono text-[10px]"
                    onClick={() => setNewStake(String(n))}
                  >
                    {n}
                  </Button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  onClick={() => void handleAddTicket()}
                  disabled={betting}
                  variant="outline"
                  size="sm"
                  className="border-amber-500/40 text-amber-200"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add ticket
                </Button>
                <Button
                  onClick={() => void handleAddAndPlay()}
                  disabled={betting}
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-500 text-white"
                >
                  <Play className="w-3.5 h-3.5 mr-1" /> Add &amp; play now
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Play className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  One-Click Pre-Configured Tickets
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {PRESET_TICKETS.map((p) => (
                  <Button
                    key={p.label}
                    onClick={() => void handlePlayPreset(p.numbers)}
                    disabled={betting}
                    size="sm"
                    className="bg-emerald-600/30 hover:bg-emerald-500/50 text-emerald-100 border border-emerald-500/30 text-[11px] font-mono cursor-pointer"
                    title={`Play ${p.numbers.join(', ')} · ${stake} ETB`}
                  >
                    {p.label}
                    <span className="ml-1 text-[9px] opacity-70">{stake} ETB</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleGeneratePicks}
                disabled={predicting || !config}
                className="flex-1 min-w-40"
              >
                {predicting ? 'Generating…' : <><Sparkles className="w-4 h-4 mr-1" /> Generate AI Picks</>}
              </Button>
              <Button
                onClick={handlePlaceBet}
                disabled={betting || picks.length === 0}
                variant="default"
                className={`flex-1 min-w-40 ${betMode === 'free' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
                title={
                  betMode === 'free'
                    ? freeBetAuto && bestFreeBet
                      ? `Auto-places the best free bet (${bestFreeBet.wager_amount} ETB)`
                      : 'Places the selected free bet'
                    : selectedAccountId === null
                    ? 'Server auto-selects the account by balance'
                    : undefined
                }
              >
                {betting ? 'Placing…' : betMode === 'free' ? <><Gift className="w-4 h-4 mr-1" /> Play Free Bet</> : <><Play className="w-4 h-4 mr-1" /> Place Bet</>}
              </Button>
              <Button
                onClick={handleClearPicks}
                disabled={picks.length === 0}
                variant="outline"
                className="min-w-25"
              >
                <Trash2 className="w-4 h-4 mr-1" /> Clear
              </Button>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/3 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Selected Numbers ({picks.length})
                </span>
                {lastPrediction && (
                  <span className="text-[10px] text-slate-500">
                    Strategy: {lastPrediction.strategy} · Difficulty: {lastPrediction.difficulty}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-10">
                {picks.length === 0 ? (
                  <span className="text-sm text-slate-500 italic w-full">
                    Tap the board above or click &quot;Generate AI Picks&quot;
                  </span>
                ) : (
                  picks.map((num, idx) => (
                    <span
                      key={`${num}-${idx}`}
                      className="flex h-8 w-8 items-center justify-center rounded bg-blue-500/20 border border-blue-500/40 text-blue-300 font-mono font-bold text-sm"
                    >
                      {num}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {lastPrediction && (
          <details className="group rounded-lg border border-white/10 bg-white/3 p-3">
            <summary className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-400">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Prediction Details</span>
              <span className="ml-auto text-[10px] text-slate-500">Click to expand</span>
            </summary>
            <div className="mt-3 space-y-2 text-[10px] text-slate-300">
              <div><strong>Repetitive Patterns:</strong> {lastPrediction.repetitivePatterns.slice(0, 3).map(p => `[${p.numbers.join(',')}]×${p.frequency}`).join(' · ') || 'None'}</div>
              <div><strong>Top Clusters:</strong> {lastPrediction.clusters.slice(0, 2).map(c => `Cluster ${c.id} (${c.numbers.slice(0, 5).join(',')})`).join(' · ')}</div>
            </div>
          </details>
        )}

        {status && (
          <div className="rounded-lg border border-white/10 bg-white/3 p-3 text-[11px] text-slate-300">
            <div className="flex flex-wrap gap-4 text-xs">
              <span>Free bets played: <strong className="text-emerald-400">{status.freeBetsPlayed}</strong></span>
              <span>Cash bets played: <strong className="text-blue-400">{status.cashBetsPlayed}</strong></span>
              <span>Total: <strong>{status.totalPlayed}</strong></span>
              <span>Pending: <strong className="text-amber-400">{status.pendingAcks}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Floating context menu (right-click on a one-click ticket) */}
      {ctxMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setCtxMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setCtxMenu(null);
          }}
        />
      )}
      {ctxMenu && (
        <div
          className="fixed z-50 min-w-44 rounded-lg border border-border bg-background p-1 text-xs shadow-xl"
          style={{ left: Math.min(ctxMenu.x, window.innerWidth - 190), top: Math.min(ctxMenu.y, window.innerHeight - 140) }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Ticket #{ctxMenu.id}</div>
          <button
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-muted"
            onClick={() => {
              const t = queue.find((x) => x.id === ctxMenu.id);
              if (!t) return setCtxMenu(null);
              setEditingId(t.id);
              setEditStake(String(t.stake ?? DEFAULT_STAKE));
              setCtxMenu(null);
            }}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit stake
          </button>
          <button
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-muted text-rose-400"
            onClick={() => removeTicket(ctxMenu.id)}
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove ticket
          </button>
          <div className="my-1 border-t border-border" />
          <p className="px-2 pb-1 text-[10px] text-muted-foreground">Drag rows (<GripVertical className="inline h-3 w-3" />) to reorder.</p>
        </div>
      )}
    </CollapsibleCard>
  );
}