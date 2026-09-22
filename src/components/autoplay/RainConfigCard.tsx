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

const PROVIDERS: RainProvider[] = ['fungames_shamo', 'phoenixbet'];

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
  const [ticketConfig, setTicketConfig] = useState<any>(null);
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
  }, []);

  function parseManualSpots(text: string): number[] {
    return text
      .split(/[,;\n\r]+/)
      .flatMap((part) => part.trim().split(/\s+/))
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 80)
      .slice(0, 20);
  }

  async function onSave() {
    if (!config) return;
    setSaving(true);
    onSaved?.('');
    try {
      const res = await setRainAutoplayConfig({
        enabled: config.enabled,
        provider: config.provider,
        tickets_per_round: config.tickets_per_round,
        spots_mode: config.spots_mode,
        manual_spots: parseManualSpots(manualDraft),
        round_interval: config.round_interval,
        use_cash_after_free_bets: config.use_cash_after_free_bets,
        cash_stake: config.cash_stake,
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
                  <SelectItem value="prediction">ML prediction (fungames_shamo)</SelectItem>
                  <SelectItem value="prediction_tickets">ML prediction tickets (per-site plan)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rain-auto-manual-spots">Manual spots / ticket (1–80, comma or space separated)</Label>
              <Input
                type="text"
                id="rain-auto-manual-spots"
                value={manualDraft}
                onChange={(e) => setManualDraft(e.target.value)}
                placeholder="e.g. 5, 12, 23, 40"
                disabled={config.spots_mode !== 'manual'}
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
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {config.tickets_per_round === 0
                ? '0 tickets/round = all plan tickets'
                : `${config.tickets_per_round} ticket(s)/round`}{' '}
              · Updated {formatTime(config.updated_at)}
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
              tickets: ticketConfig?.tickets || [],
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