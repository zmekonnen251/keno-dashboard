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
import { setRainAutoplayConfig, getRainTicketConfig } from '@/lib/api';
import { RainTicketConfigCard } from './RainTicketConfigCard';
import type { RainAutoplayConfig, RainProvider } from '@/lib/types';
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
  const seeded = useRef(false);
  const [saving, setSaving] = useState(false);
  const [ticketConfig, setTicketConfig] = useState<RainAutoplayConfig & { tickets?: any[] } | null>(null);
  const [ticketSeeded, setTicketSeeded] = useState(false);

  // Seed the editor once from the live config
  useEffect(() => {
    if (cfg && !seeded.current) {
      setConfig(cfg);
      seeded.current = true;
    }
  }, [cfg]);

  useEffect(() => {
    if (!ticketSeeded) {
      getRainTicketConfig().then(res => {
        if (res.ok && config) {
          setTicketConfig({ ...config, tickets: res.config.tickets } as any);
          setTicketSeeded(true);
        } else if (res.ok) {
          setTicketConfig({ tickets: res.config.tickets } as any);
          setTicketSeeded(true);
        }
      }).catch(() => { setTicketSeeded(true); });
    }
  }, [ticketSeeded]);

  async function onSave() {
    if (!config) return;
    setSaving(true);
    onSaved?.('');
    try {
      // No manual_spots - only ticket queue
      const res = await setRainAutoplayConfig({
        enabled: config.enabled,
        provider: config.provider,
        tickets_per_round: config.tickets_per_round,
        spots_mode: 'queue',
        manual_spots: [], // not used anymore
        round_interval: config.round_interval,
        use_cash_after_free_bets: config.use_cash_after_free_bets,
        cash_stake: config.cash_stake,
        recurrence_tickets_per_round: config.recurrence_tickets_per_round ?? 1,
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
                  <SelectItem value="queue">Ticket Queue Only (use pre-configured tickets)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Configure tickets in the <strong>Ticket Queue</strong> section below. Each ticket with <code>useFreeBet=true</code> is used for free-bet rounds.
            </p>
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
              />
            </div>
            <div>
              <Label htmlFor="rain-auto-use-2digit">2-digit ML dynamic tickets</Label>
              <Select value={String(config.use_two_digit_tickets ?? false)} onValueChange={(v) => setConfig({ ...config, use_two_digit_tickets: v === 'true' })}>
                <SelectTrigger id="rain-auto-use-2digit"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Enabled — ranked 2-spot pairs from recent draws</SelectItem>
                  <SelectItem value="false">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rain-auto-2digit-stake">2-digit stake (ETB, 0 = use cash stake)</Label>
              <Input
                id="rain-auto-2digit-stake"
                type="number"
                min={0}
                max={10000}
                value={config.two_digit_stake ?? 0}
                onChange={(e) => setConfig({ ...config, two_digit_stake: Number(e.target.value) })}
                disabled={!config.use_two_digit_tickets}
              />
            </div>
            <div>
              <Label htmlFor="rain-auto-indicator-pause">Repetition guard (pause if no repetitive structure)</Label>
              <Select value={String(config.indicator_auto_pause ?? true)} onValueChange={(v) => setConfig({ ...config, indicator_auto_pause: v === 'true' })}>
                <SelectTrigger id="rain-auto-indicator-pause"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Enabled</SelectItem>
                  <SelectItem value="false">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rain-auto-indicator-rounds">Guard rounds</Label>
              <Input
                id="rain-auto-indicator-rounds"
                type="number"
                min={1}
                max={10}
                value={config.indicator_guard_rounds ?? 3}
                onChange={(e) => setConfig({ ...config, indicator_guard_rounds: Number(e.target.value) })}
                disabled={!config.indicator_auto_pause}
              />
            </div>
            <div>
              <Label htmlFor="rain-auto-indicator-bet">Indicator auto-bet</Label>
              <Select value={String(config.indicator_auto_bet ?? true)} onValueChange={(v) => setConfig({ ...config, indicator_auto_bet: v === 'true' })}>
                <SelectTrigger id="rain-auto-indicator-bet"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Enabled</SelectItem>
                  <SelectItem value="false">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-4 border-t">
              <Button onClick={onSave} disabled={saving} className="flex-1">
                {saving ? 'Saving…' : 'Save Configuration'}
              </Button>
            </div>
          </div>
          <RainTicketConfigCard
            config={ticketConfig as any}
            onSaved={(msg) => { if (msg) onSaved?.(msg); }}
            onRefresh={onRefresh}
          />
        </>
      )}
    </CollapsibleCard>
  );
}