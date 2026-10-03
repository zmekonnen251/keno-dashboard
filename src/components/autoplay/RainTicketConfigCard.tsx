/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/app';
import { setRainTicketConfig, getRainTicketConfig, getRainTicketPreview } from '@/lib/api';
import { Plus, Trash2, Sparkles, Cpu, GripVertical, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import type { BotTicket, RainAutoplayConfig } from '@/lib/types';

interface RainTicketConfigCardProps {
  config?: (RainAutoplayConfig & { tickets?: BotTicket[] }) | null;
  onSaved?: (msg: string) => void;
  onRefresh?: () => void;
}

export function RainTicketConfigCard({ config, onSaved, onRefresh }: RainTicketConfigCardProps) {
  const [tickets, setTickets] = useState<BotTicket[]>([]);
  const [newSpots, setNewSpots] = useState<number>(2);
  const [newStrategy, setNewStrategy] = useState<'cluster' | 'standard' | 'pattern' | 'manual'>('cluster');
  const [newStake, setNewStake] = useState<number>(2);
  const [newFreeBet, setNewFreeBet] = useState<boolean>(true);
  const [newNumbers, setNewNumbers] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewPicks, setPreviewPicks] = useState<Record<string, number[]>>({});
  // Row id currently being dragged (native HTML5 drag), so the queue can be
  // reordered by dragging the grip handle.
  const [dragId, setDragId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState('manual');

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await getRainTicketConfig();
        if (res.ok && res.config?.tickets?.length) {
          setTickets(res.config.tickets);
        } else if (config?.tickets?.length) {
          setTickets(config.tickets);
        } else {
          // Default tickets: user's usual pre-configured picks + space for ML picks
          const defaults: BotTicket[] = [
            { id: '1', spots: 3, strategy: 'manual', stake: 2, enabled: true, useFreeBet: true, numbers: [1, 2, 3] },
            { id: '2', spots: 3, strategy: 'manual', stake: 2, enabled: true, useFreeBet: true, numbers: [72, 73, 74] },
            { id: '3', spots: 3, strategy: 'manual', stake: 2, enabled: true, useFreeBet: true, numbers: [77, 78, 79] },
            { id: '4', spots: 3, strategy: 'cluster', stake: 2, enabled: true, useFreeBet: true },
          ];
          setTickets(defaults);
        }
        setLoaded(true);
      } catch (e) {
        setLoaded(true);
      }
    };
    loadConfig();
  }, [config?.tickets]);

  const saveTickets = async (updatedTickets: BotTicket[]) => {
    setSaving(true);
    onSaved?.('');
    try {
      const res = await setRainTicketConfig({ tickets: updatedTickets });
      if (res.ok) {
        setTickets(updatedTickets);
        onSaved?.('Ticket configuration saved.');
        onRefresh?.();
      }
    } catch (e) {
      onSaved?.(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const parseNumbers = (input: string): number[] => {
    const nums = input
      .split(/[\s,;\-–—]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 80);
    return Array.from(new Set(nums));
  };

  const handleAddTicket = () => {
    const newId = String(Date.now());
    const numbers = parseNumbers(newNumbers);
    const updated = [
      ...tickets,
      {
        id: newId,
        spots: numbers.length > 0 ? numbers.length : newSpots,
        strategy: numbers.length > 0 ? ('manual' as const) : newStrategy,
        stake: newStake,
        enabled: true,
        useFreeBet: newFreeBet,
        ...(numbers.length > 0 ? { numbers } : {}),
      },
    ];
    setNewNumbers('');
    saveTickets(updated);
  };

  const QUICK_PRESETS: { label: string; numbers: number[] }[] = [
    { label: '1,2,3', numbers: [1, 2, 3] },
    { label: '72,73,74', numbers: [72, 73, 74] },
    { label: '77,78,79', numbers: [77, 78, 79] },
  ];

  const handleAddPreset = (numbers: number[]) => {
    const newId = String(Date.now());
    const updated = [
      ...tickets,
      {
        id: newId,
        spots: numbers.length,
        strategy: 'manual' as const,
        stake: newStake,
        enabled: true,
        useFreeBet: newFreeBet,
        numbers,
      },
    ];
    saveTickets(updated);
  };

  const handleDeleteTicket = (id: string) => {
    const updated = tickets.filter((t) => t.id !== id);
    saveTickets(updated);
  };

  const handleToggleTicket = (id: string) => {
    const updated = tickets.map((t) =>
      t.id === id ? { ...t, enabled: !t.enabled } : t,
    );
    saveTickets(updated);
  };

  const handleUpdateTicketValue = (
    id: string,
    field: 'spots' | 'stake' | 'strategy' | 'useFreeBet' | 'numbers',
    value: any,
  ) => {
    let next = value;
    if (field === 'numbers' && typeof value === 'string') {
      next = parseNumbers(value);
      /* allow clearing: empty string removes fixed numbers */
    }
    const updated = tickets.map((t) => {
      if (t.id === id) {
        const ticket = { ...t, [field]: next };
        // When numbers are set, keep spots in sync and mark strategy as manual
        if (field === 'numbers') {
          if (Array.isArray(next) && next.length > 0) {
            ticket.spots = next.length;
            ticket.strategy = 'manual';
          } else {
            ticket.numbers = undefined;
            if (ticket.strategy === 'manual') ticket.strategy = 'cluster';
          }
        }
        return ticket;
      }
      return t;
    });
    saveTickets(updated);
  };

  // ── Queue ordering ────────────────────────────────────────────────────────
  // The order the tickets sit in here is the order the engine plays them (and,
  // for cash tickets, the order they are dealt across the account pool), so
  // reordering is persisted with the rest of the queue.

  /** Move a ticket from one index to another and persist the new order. */
  const reorderTickets = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || to >= tickets.length) return;
    const copy = [...tickets];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    setSortMode('manual');
    saveTickets(copy);
  };

  /** Drop the row being dragged onto `targetIdx`. */
  const handleDropTicket = (targetIdx: number) => {
    if (!dragId) return;
    const from = tickets.findIndex((t) => t.id === dragId);
    setDragId(null);
    if (from < 0 || from === targetIdx) return;
    reorderTickets(from, targetIdx);
  };

  /** One-shot queue sort; the result is persisted immediately. */
  const sortTickets = (mode: string) => {
    if (mode === 'manual') return;
    const numeric = (n: number | undefined, fallback = 0) => (Number.isFinite(Number(n)) ? Number(n) : fallback);
    const sorted = [...tickets].sort((a, b) => {
      switch (mode) {
        case 'stake-asc':
          return numeric(a.stake) - numeric(b.stake);
        case 'stake-desc':
          return numeric(b.stake) - numeric(a.stake);
        case 'spots-asc':
          return (a.numbers?.length ?? a.spots ?? 0) - (b.numbers?.length ?? b.spots ?? 0);
        case 'spots-desc':
          return (b.numbers?.length ?? b.spots ?? 0) - (a.numbers?.length ?? a.spots ?? 0);
        case 'cash-first':
          return Number(a.useFreeBet) - Number(b.useFreeBet);
        case 'free-first':
          return Number(b.useFreeBet) - Number(a.useFreeBet);
        default:
          return 0;
      }
    });
    saveTickets(sorted);
    onSaved?.(`Sorted ${sorted.length} ticket(s).`);
  };

  const handleGeneratePreview = async () => {
    if (!config) return;
    setGenerating(true);
    try {
      // Call server to generate preview for all tickets
      const res = await getRainTicketPreview(tickets, config.provider, config.tickets_per_round);
      if (res.ok && res.previews) {
        setPreviewPicks(res.previews);
        onSaved?.('Preview generated for all tickets.');
      }
    } catch (e) {
      onSaved?.('Error generating preview: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGenerating(false);
    }
  };

  const activeCount = tickets.filter((t) => t.enabled).length;
  const totalCost = tickets.reduce((sum, t) => (t.enabled ? sum + t.stake : sum), 0);

  return (
    <Card title="Rain Auto-Bet Ticket Queue (like Extension)">
      {!loaded ? (
        <div className="text-center py-8 text-slate-500">Loading ticket queue...</div>
      ) : (
        <>
          {/* Queue Statistics Bar */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-muted dark:bg-black/30 border border-border dark:border-white/5 p-3 rounded-xl text-center">
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-wider mb-1">
                Configured Tickets
              </span>
              <span className="text-base font-extrabold text-foreground dark:text-white font-mono">{tickets.length}</span>
            </div>
            <div className="bg-muted dark:bg-black/30 border border-border dark:border-white/5 p-3 rounded-xl text-center">
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-wider mb-1">
                Active Tickets
              </span>
              <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">{activeCount} Playable</span>
            </div>
            <div className="bg-muted dark:bg-black/30 border border-border dark:border-white/5 p-3 rounded-xl text-center">
              <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-wider mb-1">
                Total Round Cost
              </span>
              <span className="text-base font-extrabold text-blue-600 dark:text-blue-300 font-mono">{totalCost} ETB</span>
            </div>
          </div>

          {/* Form to Add New Ticket */}
          <div className="bg-black/5 border border-border p-3 rounded-xl mb-4 dark:bg-white/5 dark:border-white/10">
            <span className="block text-[10px] text-slate-600 dark:text-slate-300 font-black uppercase tracking-wider mb-3">
              Create & Append Ticket
            </span>

            {/* Quick presets: one-click add of usual picks */}
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider self-center">
                ⚡ Your tickets:
              </span>
              {QUICK_PRESETS.map((p) => (
                <Button
                  key={p.label}
                  onClick={() => handleAddPreset(p.numbers)}
                  size="sm"
                  className="bg-indigo-600/30 hover:bg-indigo-500/40 text-indigo-700 border border-indigo-500/30 text-[10px] font-mono font-bold rounded-lg cursor-pointer dark:text-indigo-200"
                >
                  {p.label}
                </Button>
              ))}
            </div>

            {/* Manual numbers entry */}
            <div className="mb-3">
              <Label className="text-[10px] text-slate-500 dark:text-slate-400">
                Fixed numbers (comma / space / dash separated) — overrides strategy
              </Label>
              <input
                type="text"
                value={newNumbers}
                onChange={(e) => setNewNumbers(e.target.value)}
                placeholder="e.g. 1,2,3 or 72,73,74 or 77,78,79"
                className="w-full bg-input border border-border rounded-lg p-2 text-xs text-foreground font-mono focus:outline-none focus:border-indigo-500 dark:bg-black/40 dark:border-white/10 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-5 gap-2 items-end">
              <div>
                <Label className="text-[10px] text-slate-500 dark:text-slate-400">Spots</Label>
                <select
                  value={newSpots}
                  onChange={(e) => setNewSpots(Number(e.target.value))}
                  className="w-full bg-input border border-border rounded-lg p-2 text-xs text-foreground font-mono focus:outline-none focus:border-blue-500 cursor-pointer dark:bg-black/40 dark:border-white/10 dark:text-white"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                    <option key={s} value={s} className="bg-background dark:bg-slate-900">{s} Spots</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-[10px] text-slate-500 dark:text-slate-400">Strategy</Label>
                <select
                  value={newStrategy}
                  onChange={(e) => setNewStrategy(e.target.value as 'cluster' | 'standard' | 'pattern' | 'manual')}
                  className="w-full bg-input border border-border rounded-lg p-2 text-xs text-foreground font-bold uppercase focus:outline-none focus:border-blue-500 cursor-pointer dark:bg-black/40 dark:border-white/10 dark:text-white"
                >
                  <option value="manual" className="bg-background dark:bg-slate-900">✋ Manual / Fixed</option>
                  <option value="cluster" className="bg-background dark:bg-slate-900">🧠 ML Cluster</option>
                  <option value="standard" className="bg-background dark:bg-slate-900">📊 Standard</option>
                  <option value="pattern" className="bg-background dark:bg-slate-900">🧬 Pattern Trend</option>
                </select>
              </div>
              <div>
                <Label className="text-[10px] text-slate-500 dark:text-slate-400">Stake (ETB)</Label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={newStake}
                    onChange={(e) => setNewStake(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-input border border-border rounded-lg p-2 pr-6 text-xs text-foreground font-mono focus:outline-none focus:border-blue-500 dark:bg-black/40 dark:border-white/10 dark:text-white"
                  />
                  <span className="absolute right-2 top-2 text-[9px] text-slate-500 font-mono font-bold">ETB</span>
                </div>
              </div>
              <div>
                <Label className="text-[10px] text-slate-500 dark:text-slate-400">Bet Type</Label>
                <select
                  value={String(newFreeBet)}
                  onChange={(e) => setNewFreeBet(e.target.value === 'true')}
                  className="w-full bg-input border border-border rounded-lg p-2 text-xs text-foreground font-bold uppercase focus:outline-none focus:border-blue-500 cursor-pointer dark:bg-black/40 dark:border-white/10 dark:text-white"
                >
                  <option value="true" className="bg-background dark:bg-slate-900">🎁 Free Bet</option>
                  <option value="false" className="bg-background dark:bg-slate-900">💰 Cash</option>
                </select>
              </div>
              <div>
                <Button onClick={handleAddTicket} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold p-2 rounded-lg text-xs uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer shadow-md h-10">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Ticket</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Per-ticket stake drives the cash play; cash tickets auto-spread. */}
          <p className="mb-4 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
            💰 <b>Cash tickets</b> each play with their own stake — set a few high and the rest at the 2–3 Birr
            minimum. Every enabled <b>CASH</b> ticket is spread across the eligible accounts each round (no two
            accounts play the same ticket), so the whole queue gets used. The queue order below is the play order
            (and the deal order for cash tickets).
          </p>

          {/* Preview + queue sort controls */}
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <Button
              onClick={handleGeneratePreview}
              disabled={generating || tickets.length === 0}
              variant="outline"
              className="w-full sm:w-auto"
            >
              {generating ? (
                <>
                  <Cpu className="w-4 h-4 mr-2 animate-spin" />
                  Generating Previews…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Preview for All Tickets
                </>
              )}
            </Button>
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <Label className="text-[10px] text-slate-500 dark:text-slate-400">Sort queue</Label>
              <select
                value={sortMode}
                onChange={(e) => {
                  const mode = e.target.value;
                  setSortMode(mode);
                  sortTickets(mode);
                }}
                className="bg-input border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-indigo-500 cursor-pointer dark:bg-black/40 dark:border-white/10 dark:text-white"
              >
                <option value="manual" className="bg-background dark:bg-slate-900">Keep my order</option>
                <option value="stake-asc" className="bg-background dark:bg-slate-900">Stake ↑ (low first)</option>
                <option value="stake-desc" className="bg-background dark:bg-slate-900">Stake ↓ (high first)</option>
                <option value="spots-asc" className="bg-background dark:bg-slate-900">Spots ↑</option>
                <option value="spots-desc" className="bg-background dark:bg-slate-900">Spots ↓</option>
                <option value="cash-first" className="bg-background dark:bg-slate-900">Cash tickets first</option>
                <option value="free-first" className="bg-background dark:bg-slate-900">Free-bet tickets first</option>
              </select>
            </div>
          </div>

          {/* Queue List of Tickets */}
          <div className="space-y-2 max-h-100 overflow-y-auto pr-1">
            {tickets.map((ticket, idx) => {
              const preview = previewPicks[ticket.id] || [];
              return (
                <div
                  key={ticket.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDropTicket(idx);
                  }}
                  className={`bg-muted/40 dark:bg-black/35 border p-3 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all ${
                    dragId === ticket.id ? 'ring-2 ring-indigo-500/60 ' : ''
                  }${
                    ticket.enabled ? 'border-border dark:border-white/10 opacity-100' : 'border-border/60 dark:border-white/5 opacity-50'
                  }`}
                >
                  {/* Order controls: drag the grip, or nudge with the arrows.
                      The queue order is the play/deal order. */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        setDragId(ticket.id);
                      }}
                      onDragEnd={() => setDragId(null)}
                      title="Drag to reorder"
                      className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <GripVertical className="w-4 h-4" />
                    </span>
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => reorderTickets(idx, idx - 1)}
                        disabled={idx === 0}
                        title="Move up"
                        className="text-slate-400 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => reorderTickets(idx, idx + 1)}
                        disabled={idx === tickets.length - 1}
                        title="Move down"
                        className="text-slate-400 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Status Toggle & Info */}
                  <div className="flex items-center gap-2.5 min-w-35">
                    <input
                      type="checkbox"
                      checked={ticket.enabled}
                      onChange={() => handleToggleTicket(ticket.id)}
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-muted border-border cursor-pointer accent-emerald-500 dark:bg-black/40 dark:border-white/10"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-foreground font-mono dark:text-white">Ticket #{idx + 1}</span>
                        <span
                          className={`text-[8px] font-black uppercase px-1 rounded font-mono ${
                            ticket.strategy === 'manual'
                              ? 'bg-indigo-500/10 text-indigo-700 border border-indigo-500/20 dark:text-indigo-300'
                              : ticket.strategy === 'cluster'
                              ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 dark:text-emerald-300'
                              : ticket.strategy === 'pattern'
                              ? 'bg-purple-500/10 text-purple-700 border border-purple-500/20 dark:text-purple-300'
                              : 'bg-blue-500/10 text-blue-700 border border-blue-500/20 dark:text-blue-300'
                          }`}
                        >
                          {ticket.strategy === 'manual'
                            ? '✋ Fixed'
                            : ticket.strategy === 'cluster'
                            ? 'ML Cluster'
                            : ticket.strategy === 'pattern'
                            ? 'Pattern Trend'
                            : 'Heuristic'}
                        </span>
                        {ticket.useFreeBet && (
                          <span className="text-[8px] font-bold text-amber-600 ml-1 px-1 rounded bg-amber-500/10 border border-amber-500/20 dark:text-amber-400">FREE</span>
                        )}
                        {!ticket.useFreeBet && (
                          <span className="text-[8px] font-bold text-blue-600 ml-1 px-1 rounded bg-blue-500/10 border border-blue-500/20 dark:text-blue-400">CASH</span>
                        )}
                      </div>

                      {/* Ticket editing dropdowns in real time */}
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <select
                          value={ticket.spots}
                          onChange={(e) =>
                            handleUpdateTicketValue(
                              ticket.id,
                              'spots',
                              Number(e.target.value),
                            )
                          }
                          className="bg-transparent border border-border dark:border-white/5 rounded text-[10px] font-mono text-slate-500 dark:text-slate-400 focus:outline-none cursor-pointer"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                            <option key={s} value={s} className="bg-popover text-popover-foreground dark:bg-slate-900 dark:text-white">
                              {s} Spots
                            </option>
                          ))}
                        </select>
                        <select
                          value={ticket.strategy}
                          onChange={(e) =>
                            handleUpdateTicketValue(
                              ticket.id,
                              'strategy',
                              e.target.value,
                            )
                          }
                          className="bg-transparent border border-border dark:border-white/5 rounded text-[10px] text-slate-500 dark:text-slate-400 focus:outline-none cursor-pointer"
                        >
                          <option value="manual" className="bg-popover text-popover-foreground dark:bg-slate-900 dark:text-white">✋ Manual</option>
                          <option value="cluster" className="bg-popover text-popover-foreground dark:bg-slate-900 dark:text-white">🧠 ML</option>
                          <option value="standard" className="bg-popover text-popover-foreground dark:bg-slate-900 dark:text-white">📊 Standard</option>
                          <option value="pattern" className="bg-popover text-popover-foreground dark:bg-slate-900 dark:text-white">🧬 Pattern</option>
                        </select>
                        <select
                          value={String(ticket.useFreeBet)}
                          onChange={(e) =>
                            handleUpdateTicketValue(
                              ticket.id,
                              'useFreeBet',
                              e.target.value === 'true',
                            )
                          }
                          className="bg-transparent border border-border dark:border-white/5 rounded text-[10px] text-slate-500 dark:text-slate-400 focus:outline-none cursor-pointer"
                        >
                          <option value="true" className="bg-popover text-popover-foreground dark:bg-slate-900 dark:text-white">🎁 Free Bet</option>
                          <option value="false" className="bg-popover text-popover-foreground dark:bg-slate-900 dark:text-white">💰 Cash</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Distinct Picks Preview! */}
                  <div className="grow flex flex-wrap gap-1 items-center max-w-sm min-w-37.5">
                    {ticket.numbers && ticket.numbers.length > 0 ? (
                      ticket.numbers.map((num, pi) => (
                        <span
                          key={`${ticket.id}-${pi}`}
                          title="Fixed number (edit in numbers field below)"
                          className="flex h-6 w-6 items-center justify-center rounded font-mono text-[10px] font-extrabold bg-indigo-500/15 border border-indigo-500/30 text-indigo-700 dark:text-indigo-200"
                        >
                          {num}
                        </span>
                      ))
                    ) : preview.length > 0 ? (
                      preview.map((num, pi) => (
                        <span
                          key={`${ticket.id}-${pi}`}
                          className="flex h-6 w-6 items-center justify-center rounded font-mono text-[10px] font-extrabold bg-black/5 border border-border text-slate-600 dark:bg-white/5 dark:border-white/5 dark:text-slate-300"
                        >
                          {num}
                        </span>
                      ))
                    ) : ticket.enabled ? (
                      <span className="text-[10px] text-slate-500 italic">
                        Click &quot;Generate Preview&quot; to see picks
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 italic">Inactive</span>
                    )}
                  </div>

                  {/* Fixed numbers quick-edit box */}
                  <div className="flex items-center gap-1.5 grow min-w-40">
                    <input
                      type="text"
                      defaultValue={ticket.numbers?.join(', ') ?? ''}
                      key={`numinput-${ticket.id}-${ticket.numbers?.join(',') ?? 'none'}`}
                      onBlur={(e) => {
                        const parsed = parseNumbers(e.target.value);
                        if (parsed.length > 0) {
                          handleUpdateTicketValue(ticket.id, 'numbers', parsed);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.currentTarget.value.trim() !== '') {
                          const parsed = parseNumbers(e.currentTarget.value);
                          if (parsed.length > 0) {
                            handleUpdateTicketValue(ticket.id, 'numbers', parsed);
                          }
                        }
                      }}
                      placeholder={`Fixed numbers (e.g. 1,2,3)${ticket.numbers ? '' : ' or empty for ML'}`}
                      className="w-full bg-muted border border-border rounded-lg p-1.5 text-[10px] text-foreground font-mono focus:outline-none focus:border-indigo-500 dark:bg-black/40 dark:border-indigo-500/20 dark:text-white"
                    />
                  </div>

                  {/* Stake and Deletion */}
                  <div className="flex items-center gap-2 justify-end">
                    <div className="flex items-center bg-muted border border-border rounded-lg px-2 py-1 max-w-20 dark:bg-black/40 dark:border-white/10">
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        value={ticket.stake}
                        onChange={(e) =>
                          handleUpdateTicketValue(
                            ticket.id,
                            'stake',
                            Math.max(1, Number(e.target.value)),
                          )
                        }
                        className="bg-transparent w-full text-right font-mono font-bold text-xs text-foreground focus:outline-none dark:text-white"
                      />
                      <span className="text-[8px] text-slate-500 font-bold ml-1">ETB</span>
                    </div>

                    <Button
                      onClick={() => handleDeleteTicket(ticket.id)}
                      variant="ghost"
                      size="sm"
                      className="p-2 bg-muted hover:bg-rose-500/20 text-slate-500 hover:text-rose-600 rounded-lg border border-border hover:border-rose-500/20 transition-all cursor-pointer dark:bg-black/40 dark:text-slate-400 dark:hover:text-rose-400 dark:border-white/5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {tickets.length === 0 && (
              <div className="text-center py-6 text-slate-500 text-xs italic">
                No tickets configured in the queue yet. Use the fields above to
                add your first predictive set!
              </div>
            )}
          </div>

          {/* Auto-Bet Settings */}
          <div className="mt-4 p-3 rounded-lg border border-border bg-black/5 space-y-3 dark:border-white/10 dark:bg-white/5">
            <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Auto-Bet Engine Settings
            </span>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tickets Per Round</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={config?.tickets_per_round ?? 4}
                  onChange={(e) => saveTickets(tickets)} // triggers save with updated config
                  className="font-mono"
                />
                <p className="text-[10px] text-slate-500">How many tickets to play each round from the queue</p>
              </div>
              <div className="space-y-1.5">
                <Label>Round Interval (seconds)</Label>
                <Input
                  type="number"
                  min={5}
                  max={3600}
                  value={config?.round_interval ?? 30}
                  onChange={(e) => saveTickets(tickets)}
                  className="font-mono"
                />
                <p className="text-[10px] text-slate-500">Seconds between auto-bet rounds</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="rain-auto-enabled"
                checked={config?.enabled ?? false}
                onChange={(e) => saveTickets(tickets)}
                className="h-4 w-4 accent-emerald-500"
              />
              <Label htmlFor="rain-auto-enabled" className="cursor-pointer text-sm">
                Enable Auto-Bet Engine
              </Label>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}