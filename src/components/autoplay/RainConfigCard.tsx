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
import { Switch } from '@/components/ui/switch';
import { setRainAutoplayConfig } from '@/lib/api';
import { RainTicketConfigCard } from './RainTicketConfigCard';
import type { RainAutoplayConfig, RainProvider } from '@/lib/types';
import { CollapsibleCard } from './CollapsibleCard';

const PROVIDERS: RainProvider[] = ['fungames_shamo', 'fungames_tolobirr', 'phoenixbet'];

// Boolean settings are switches that persist immediately: leaving them as
// <Select>s meant a toggle only took effect after "Save Configuration", which
// made the cash switch look broken. A partial PATCH is supported by the API.
type BoolField = 'enabled' | 'use_cash_after_free_bets' | 'indicator_auto_pause';

const BOOL_LABELS: Record<BoolField, string> = {
  enabled: 'Rain autoplay',
  use_cash_after_free_bets: 'Cash autoplay',
  indicator_auto_pause: 'Repetition guard',
};

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
  const [savingBool, setSavingBool] = useState<BoolField | null>(null);

  // Seed the editor once from the live config
  useEffect(() => {
    if (cfg && !seeded.current) {
      setConfig(cfg);
      seeded.current = true;
    }
  }, [cfg]);

  async function saveBool(field: BoolField, value: boolean) {
    if (!config) return;
    setConfig({ ...config, [field]: value });
    setSavingBool(field);
    onSaved?.('');
    try {
      const patch = { [field]: value } as Pick<RainAutoplayConfig, BoolField>;
      const res = await setRainAutoplayConfig(patch);
      setConfig(res.config);
      seeded.current = true;
      onSaved?.(`${BOOL_LABELS[field]} ${value ? 'enabled' : 'disabled'}.`);
      onRefresh?.();
    } catch (e) {
      // Put the switch back where the server left it so the UI never claims a
      // setting that was not persisted.
      setConfig((prev) => (prev ? { ...prev, [field]: !value } : prev));
      onSaved?.(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingBool(null);
    }
  }

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
        // Queue-only mode: the frequent 2-digit generator is never used.
        use_two_digit_tickets: false,
        two_digit_stake: 0,
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
            <div className="rounded-lg border p-2.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label htmlFor="rain-auto-enabled">Enabled</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {config.enabled ? 'Runs rounds when the engine is started.' : 'Stopped — no rounds are played.'}
                  </p>
                </div>
                <Switch
                  id="rain-auto-enabled"
                  checked={config.enabled}
                  disabled={savingBool === 'enabled'}
                  onCheckedChange={(v) => void saveBool('enabled', v)}
                />
              </div>
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
            <p className="self-end text-xs text-muted-foreground sm:col-span-2">
              Chosen spots come from the <strong>Ticket Queue</strong> below — each ticket with{' '}
              <code>useFreeBet=true</code> is used for free-bet rounds.
            </p>
            <div className="rounded-lg border p-2.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label htmlFor="rain-auto-use-cash">Cash autoplay</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {config.use_cash_after_free_bets
                      ? 'Enabled — plays account cash when no free bets are left.'
                      : 'Disabled — free bets only; cash is never staked.'}
                  </p>
                </div>
                <Switch
                  id="rain-auto-use-cash"
                  checked={config.use_cash_after_free_bets}
                  disabled={savingBool === 'use_cash_after_free_bets'}
                  onCheckedChange={(v) => void saveBool('use_cash_after_free_bets', v)}
                />
              </div>
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
            <div className="rounded-lg border p-2.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label htmlFor="rain-auto-indicator-pause">Repetition guard</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {config.indicator_auto_pause
                      ? 'Pauses when draws stop showing repetitive structure.'
                      : 'Never pauses for non-repetitive draws.'}
                  </p>
                </div>
                <Switch
                  id="rain-auto-indicator-pause"
                  checked={config.indicator_auto_pause ?? true}
                  disabled={savingBool === 'indicator_auto_pause'}
                  onCheckedChange={(v) => void saveBool('indicator_auto_pause', v)}
                />
              </div>
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
          </div>
          <div className="mt-4 flex justify-end border-t pt-4">
            <Button onClick={onSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Configuration'}
            </Button>
          </div>
          <RainTicketConfigCard
            config={config}
            onSaved={(msg) => { if (msg) onSaved?.(msg); }}
            onRefresh={onRefresh}
          />
        </>
      )}
    </CollapsibleCard>
  );
}