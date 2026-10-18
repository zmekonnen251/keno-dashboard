'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Empty } from '@/components/app';
import { setRainAutoplayConfig, getRainTicketConfig, setRainTicketConfig } from '@/lib/api';
import { RainTicketConfigCard } from './RainTicketConfigCard';
import type { RainAutoplayConfig, RainProvider, BotTicket } from '@/lib/types';
import { formatTime } from '@/lib/format';
import { CollapsibleCard } from './CollapsibleCard';

const PROVIDERS: RainProvider[] = ['fungames_shamo', 'fungames_tolobirr', 'phoenixbet'];

export function RainConfigCard({
  cfg,
  onSaved,
  onRefresh,
  defaultOpen = true,
}: {
  cfg?: RainAutoplayConfig | null;
  onSaved?: (msg: string) => void;
  onRefresh?: () => void;
  defaultOpen?: boolean;
}) {
  const [config, setConfig] = useState<RainAutoplayConfig | null>(null);
  const [manualDraft, setManualDraft] = useState('');
  const seeded = useRef(false);
  const [saving, setSaving] = useState(false);
  const [ticketConfig, setTicketConfig] = useState<unknown>(null);
  const [ticketSeeded, setTicketSeeded] = useState(false);

  // Seed the editor once from the live config
  useEffect(() => {
    if (cfg && !seeded.current) {
      setConfig(cfg);
      setManualDraft(cfg.manual_spots.join(', '));
      seeded.current = true;
    }
  }, [cfg]);

  useEffect(() => {
    if (!ticketSeeded) {
      getRainTicketConfig().then(res => {
        if (res.ok) {
          setTicketConfig(res.config);
          setTicketSeeded(true);
        }
      }).catch(() => { setTicketSeeded(true); });
    }
  }, [ticketSeeded]);

  function parseManualSpots(text: string): number[] {
    // Parse flat list for backward compatibility (comma/space separated single ticket)
    return text
      .split(/[,;\n\r]+/)
      .flatMap((part) => part.trim().split(/\s+/))
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 80)
      .slice(0, 20);
  }

  function parseManualTickets(text: string): { numbers: number[]; spots: number }[] {
    // Parse multiple tickets: each line = one ticket, numbers separated by comma/space
    return text
      .split(/\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const numbers = line
          .split(/[,;\s]+/)
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isFinite(n) && n >= 1 && n <= 80);
        return { numbers, spots: numbers.length };
      })
      .filter((t) => t.numbers.length > 0);
  }

  async function onSave() {
    if (!config) return;
    setSaving(true);
    onSaved?.('');
    try {
      // Parse manual spots for backward compatibility (flat array)
      const manualSpots = parseManualSpots(manualDraft);

      // If manual mode, also create ticket queue entries from manual draft (one ticket per line)
      if (config.spots_mode === 'manual' && manualDraft.trim()) {
        const manualTickets = parseManualTickets(manualDraft);
        if (manualTickets.length > 0) {
          const existingTicketConfig = await getRainTicketConfig();
          const existingTickets = existingTicketConfig.config?.tickets || [];
          
          // Remove existing free-bet manual tickets (keep cash tickets and other manual tickets)
          const filteredTickets = existingTickets.filter(
            (t) => !(t.useFreeBet === true && t.strategy === 'manual')
          );
          
          // Add new manual free-bet tickets
          const newTickets: BotTicket[] = manualTickets.map((t, i) => ({
            id: `manual-free-${Date.now()}-${i}`,
            spots: t.spots,
            strategy: 'manual',
            stake: config.cash_stake || 2,
            enabled: true,
            useFreeBet: true,
            numbers: t.numbers,
          }));
          
          const updatedTickets = [...filteredTickets, ...newTickets];
          
          await setRainTicketConfig({ tickets: updatedTickets });
        }
      }

      const res = await setRainAutoplayConfig({
        enabled: config.enabled,
        provider: config.provider,
        tickets_per_round: config.tickets_per_round,
        spots_mode: config.spots_mode,
        manual_spots: parseManualSpots(manualDraft), // backward compatibility
        round_interval: config.round_interval,
        use_cash_after_free_bets: config.use_cash_after_free_bets,
        cash_stake: config.cash_stake,
        recurrence_tickets_per_round: config.recurrence_tickets_per_round,
        temporal_tickets_per_round: config.temporal_tickets_per_round ?? 1,
        tickets_per_account: config.tickets_per_account ?? 1,
        use_two_digit_tickets: config.use_two_digit_tickets ?? false,
        two_digit_stake: config.two_digit_stake ?? 0,
        indicator_auto_pause: config.indicator_auto_pause ?? true,
        indicator_guard_rounds: config.indicator_guard_rounds ?? 3,
        indicator_auto_bet: config.indicator_auto_bet ?? true,
      });
      setConfig(res.config);
      seeded.current = true;
      onSaved?.('Rain autoplay configuration saved.');
      onRefresh?.();
    } catch (e) {
      onSaved?.(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <CollapsibleCard title="Rain autoplay configuration" defaultOpen={defaultOpen}>
      {!config ? (
        <Empty label={'Wait — the current configuration is loading…'} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="rain-auto-enabled">Enabled</Label>
              <Select value={String(config.enabled)} onValueChange={(v) => setConfig({ ...config, enabled: v === 'true' })}>
                <SelectTrigger id="rain-auto-enabled"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Enabled — run rounds when started</SelectItem>
                  <SelectItem value="false">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rain-auto-provider">Provider</Label>
              <Select value={config.provider} onValueChange={(v) => setConfig({ ...config, provider: v as RainProvider })}>
                <SelectTrigger id="rain-auto-provider"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rain-auto-tickets">Tickets per round</Label>
              <Input
                id="rain-auto-tickets"
                type="number"
                min={0}
                max={50}
                value={config.tickets_per_round}
                onChange={(e) => setConfig({ ...config, tickets_per_round: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="rain-auto-interval">Round interval (seconds)</Label>
              <Input
                id="rain-auto-interval"
                type="number"
                min={5}
                max={3600}
                value={config.round_interval}
                onChange={(e) => setConfig({ ...config, round_interval: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="rain-auto-spots-mode">Chosen spots source</Label>
              <Select value={config.spots_mode} onValueChange={(v) => setConfig({ ...config, spots_mode: v as RainAutoplayConfig['spots_mode'] })}>
                <SelectTrigger id="rain-auto-spots-mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual spots below</SelectItem>
                  <SelectItem value="frequent">Frequent numbers tickets (15 pre-generated 3-digit from draw history)</SelectItem>
                  <SelectItem value="temporal">Temporal pattern tickets (same clock-time window)</SelectItem>
                  <SelectItem value="mixed">Mixed — queue + recurrence + temporal tickets</SelectItem>
                  <SelectItem value="recurrence">Recurrence tickets (repetitive + carryover)</SelectItem>
                  <SelectItem value="prediction">ML prediction (fungames_shamo)</SelectItem>
                  <SelectItem value="prediction_tickets">ML prediction tickets (per-site plan)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(config.spots_mode === 'mixed' || config.spots_mode === 'temporal') && (
              <div>
                <Label htmlFor="rain-auto-temporal-tickets">Temporal tickets / round{config.spots_mode === 'temporal' ? ' (whole round)' : ' (rest = queue)'}</Label>
                <Input
                  type="number"
                  id="rain-auto-temporal-tickets"
                  min={0}
                  max={50}
                  value={config.temporal_tickets_per_round ?? 1}
                  onChange={(e) => setConfig({ ...config, temporal_tickets_per_round: Number(e.target.value) })}
                />
              </div>
            )}
            {config.spots_mode === 'mixed' && (
              <div>
                <Label htmlFor="rain-auto-recurrence-tickets">Recurrence tickets / round (rest = preconfigured queue)</Label>
                <Input
                  type="number"
                  id="rain-auto-recurrence-tickets"
                  min={0}
                  max={50}
                  value={config.recurrence_tickets_per_round}
                  onChange={(e) => setConfig({ ...config, recurrence_tickets_per_round: Number(e.target.value) })}
                />
              </div>
            )}
            <div>
              <Label htmlFor="rain-auto-manual-spots">Manual tickets (one per line, numbers comma/space separated)</Label>
              <textarea
                id="rain-auto-manual-spots"
                value={manualDraft}
                onChange={(e) => setManualDraft(e.target.value)}
                placeholder="5, 12, 23, 40
7, 18, 33, 55
11, 22, 33, 44, 55"
                disabled={config.spots_mode !== 'manual'}
                rows={5}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Each line = one free-bet ticket. Numbers separated by commas or spaces. 
                Tickets are saved to the ticket queue with useFreeBet=true.
              </p>
            </div>
            <div>
              <Label htmlFor="rain-auto-use-cash">Use cash after free bets</Label>
              <Select value={String(config.use_cash_after_free_bets)} onValueChange={(v) => setConfig({ ...config, use_cash_after_free_bets: v === 'true' })}>
                <SelectTrigger id="rain-auto-use-cash"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Enabled — use account cash when no free bets</SelectItem>
                  <SelectItem value="false">Disabled — free bets only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rain-auto-cash-stake">Cash stake (ETB)</Label>
              <Input
                id="rain-auto-cash-stake"
                type="number"
                min={1}
                max={10000}
                value={config.cash_stake}
                onChange={(e) => setConfig({ ...config, cash_stake: Number(e.target.value) })}
                disabled={!config.use_cash_after_free_bets}
              />
            </div>
            <div>
              <Label htmlFor="rain-auto-tickets-per-account">Cash tickets per account / round</Label>
              <Input
                id="rain-auto-tickets-per-account"
                type="number"
                min={1}
                max={20}
                value={config.tickets_per_account ?? 1}
                onChange={(e) => setConfig({ ...config, tickets_per_account: Number(e.target.value) })}
                disabled={!config.use_cash_after_free_bets}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Each eligible account places this many cash tickets (total = accounts × this). When the next stake
                would leave less than 2 Birr — below the minimum bet — the whole remaining balance is played as one
                all-in ticket.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2.5">
            <input
              id="rain-auto-two-digit"
              type="checkbox"
              checked={config.use_two_digit_tickets ?? false}
              onChange={(e) => setConfig({ ...config, use_two_digit_tickets: e.target.checked })}
              className="h-4 w-4 accent-blue-600"
            />
            <Label htmlFor="rain-auto-two-digit" className="cursor-pointer">
              2-digit ML dynamic tickets — free bets and cash bets play ranked 2-spot pairs
            </Label>
            <span className="w-full text-[11px] text-muted-foreground">
              Pairs predicted from the last 1–3 draws (same digits can redraw next game) plus overdue/time patterns —
              the same pairs the 2-digit ticket card places manually. Overrides the ticket source above; falls back to
              it when no completed draw is on record.
            </span>
            <label htmlFor="rain-auto-two-digit-stake" className="flex items-center gap-2 text-xs text-muted-foreground">
              2-digit cash stake (ETB)
              <Input
                id="rain-auto-two-digit-stake"
                type="number"
                min={0}
                max={10000}
                value={config.two_digit_stake ?? 0}
                onChange={(e) => setConfig({ ...config, two_digit_stake: Number(e.target.value) })}
                disabled={!config.use_two_digit_tickets}
                className="w-28"
              />
              <span>0 = use cash stake</span>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2.5">
            <input
              id="rain-auto-indicator-pause"
              type="checkbox"
              checked={config.indicator_auto_pause ?? true}
              onChange={(e) => setConfig({ ...config, indicator_auto_pause: e.target.checked })}
              className="h-4 w-4 accent-blue-600"
            />
            <Label htmlFor="rain-auto-indicator-pause" className="cursor-pointer">
              Indicator auto-pause — skip rounds when the last draws show no repetitive structure
            </Label>
            <label htmlFor="rain-auto-indicator-guard" className="flex items-center gap-2 text-xs text-muted-foreground">
              Non-repetitive rounds before pausing
              <Input
                id="rain-auto-indicator-guard"
                type="number"
                min={1}
                max={20}
                value={config.indicator_guard_rounds ?? 3}
                onChange={(e) => setConfig({ ...config, indicator_guard_rounds: Math.max(1, Math.min(20, Math.floor(Number(e.target.value) || 3))) })}
                disabled={!(config.indicator_auto_pause ?? true)}
                className="w-20"
              />
            </label>
            <span className="w-full text-[11px] text-muted-foreground">
              Repetitive strategies depend on adjacent-digit structure (chains like 53,54,56). When it disappears
              (the &quot;hard&quot;/non-repetitive mode) for this many consecutive rounds, the engine stops betting for as long
              as it lasts — then resumes automatically once repetitive draws come back.
            </span>
            <input
              id="rain-auto-indicator-bet"
              type="checkbox"
              checked={config.indicator_auto_bet ?? true}
              onChange={(e) => setConfig({ ...config, indicator_auto_bet: e.target.checked })}
              className="h-4 w-4 accent-blue-600"
            />
            <Label htmlFor="rain-auto-indicator-bet" className="cursor-pointer">
              Indicator tickets — pick from decade clusters, sequence triggers and vertical lanes
            </Label>
            <span className="w-full text-[11px] text-muted-foreground">
              Examples: ≥3 numbers in one decade (e.g. 68,69,70 → the 60s carry) boost that decade; a run like
              53,54,56 replicates as 4,5,6 / 14,15,16 / 44,45,46 / 64,65,66; lanes repeating a ones-place digit
              stepped by 10 (9,19,29) prioritise the aligned tickets. High-confidence indicator tickets are paired
              with the highest-wager available free bet.
            </span>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {config.tickets_per_round === 0
                ? '0 tickets/round = all plan tickets'
                : `${config.tickets_per_round} free bet(s)/round`}{' '}
              · {config.tickets_per_account ?? 1} cash ticket(s) per account · Updated {formatTime(config.updated_at)}
            </div>
            <Button onClick={onSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save configuration'}
            </Button>
          </div>

          {/* Ticket Queue Configuration (like Extension) */}
          <RainTicketConfigCard
            config={{ 
              ...config, 
              provider: config.provider,
              tickets: (ticketConfig as { tickets?: NonNullable<Parameters<typeof RainTicketConfigCard>[0]['config']>['tickets'] } | null)?.tickets || [],
              tickets_per_round: config.tickets_per_round,
              round_interval: config.round_interval,
              enabled: config.enabled
            }}
            onSaved={onSaved}
            onRefresh={onRefresh}
          />
        </>
      )}
    </CollapsibleCard>
  );
}