'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Save, RefreshCw } from 'lucide-react';
import { getAutoplayConfig, setAutoplayConfig } from '@/lib/api';

interface TicketConfig {
  id: string;
  spots: number;
  enabled: boolean;
  picks?: number[];
}

export function TicketConfig({ siteId }: { siteId: string }) {
  const [tickets, setTickets] = useState<TicketConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Load tickets from server config
  useEffect(() => {
    loadConfig();
  }, [siteId]);

  async function loadConfig() {
    try {
      setLoading(true);
      const config = await getAutoplayConfig(siteId);
      if (config?.base_tickets && Array.isArray(config.base_tickets)) {
        const loadedTickets: TicketConfig[] = config.base_tickets.map((ticket, idx) => ({
          id: String(idx),
          spots: ticket.length,
          enabled: true,
          picks: ticket,
        }));
        setTickets(loadedTickets.length > 0 ? loadedTickets : getDefaultTickets());
      } else {
        setTickets(getDefaultTickets());
      }
    } catch (e) {
      setMessage('Failed to load config: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }

  function getDefaultTickets(): TicketConfig[] {
    return [
      { id: '1', spots: 2, enabled: true, picks: [11, 12] },
      { id: '2', spots: 2, enabled: true, picks: [15, 25] },
      { id: '3', spots: 3, enabled: true, picks: [11, 12, 13] },
      { id: '4', spots: 3, enabled: true, picks: [15, 25, 35] },
    ];
  }

  async function saveConfig() {
    try {
      setLoading(true);
      const enabledTickets = tickets.filter(t => t.enabled);
      const baseTickets = enabledTickets.map(t => t.picks || generateRandomPicks(t.spots));
      
      await setAutoplayConfig(siteId, {
        base_tickets: baseTickets,
      });
      
      setMessage('Configuration saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (e) {
      setMessage('Failed to save config: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }

  function generateRandomPicks(count: number): number[] {
    const picks = new Set<number>();
    while (picks.size < count) {
      picks.add(Math.floor(Math.random() * 80) + 1);
    }
    return Array.from(picks).sort((a, b) => a - b);
  }

  function addTicket() {
    const newId = String(Date.now());
    setTickets([...tickets, {
      id: newId,
      spots: 2,
      enabled: true,
      picks: generateRandomPicks(2),
    }]);
  }

  function deleteTicket(id: string) {
    setTickets(tickets.filter(t => t.id !== id));
  }

  function toggleTicket(id: string) {
    setTickets(tickets.map(t => 
      t.id === id ? { ...t, enabled: !t.enabled } : t
    ));
  }

  function updateTicket(id: string, field: 'spots' | 'enabled', value: number | boolean) {
    setTickets(tickets.map(t => {
      if (t.id === id) {
        return field === 'spots'
          ? { ...t, spots: Number(value), picks: generateRandomPicks(Number(value)) }
          : { ...t, enabled: Boolean(value) };
      }
      return t;
    }));
  }

  function regeneratePicks(id: string) {
    setTickets(tickets.map(t => {
      if (t.id === id) {
        return { ...t, picks: generateRandomPicks(t.spots) };
      }
      return t;
    }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">Ticket Configuration</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={loadConfig} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Reload
          </Button>
          <Button size="sm" onClick={saveConfig} disabled={loading}>
            <Save className="w-4 h-4 mr-1" />
            Save
          </Button>
        </div>
      </div>

      {message && (
        <p className={`text-sm ${message.includes('successfully') ? 'text-emerald-600' : 'text-rose-600'}`}>
          {message}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        These are the base tickets for modes A/B — the stake is set in{' '}
        <span className="font-medium text-foreground">Configuration → Stake per ticket</span>. Disabled
        tickets are dropped on save.
      </p>

      <div className="space-y-2">
        {tickets.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No tickets configured — add one below.
          </p>
        )}
        {tickets.map((ticket, idx) => (
          <div
            key={ticket.id}
            className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${
              ticket.enabled
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : 'border-border bg-black/5 opacity-60 dark:border-white/10 dark:bg-white/5'
            }`}
          >
            <Switch
              checked={ticket.enabled}
              onCheckedChange={() => toggleTicket(ticket.id)}
              aria-label={`Enable ticket ${idx + 1}`}
            />

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold">Ticket #{idx + 1}</span>
                <select
                  value={ticket.spots}
                  onChange={(e) => updateTicket(ticket.id, 'spots', Number(e.target.value))}
                  className="rounded border bg-background px-2 py-1 text-xs"
                >
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => (
                    <option key={s} value={s}>{s} spots</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-1">
                {(ticket.picks || []).map((num) => (
                  <span
                    key={num}
                    className="flex h-6 w-6 items-center justify-center rounded bg-primary/20 text-xs font-bold text-primary"
                  >
                    {num}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => regeneratePicks(ticket.id)}
                title="Regenerate picks"
                aria-label={`Regenerate picks for ticket ${idx + 1}`}
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => deleteTicket(ticket.id)}
                title="Delete ticket"
                aria-label={`Delete ticket ${idx + 1}`}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button size="sm" onClick={addTicket} className="w-full">
        <Plus className="w-4 h-4 mr-1" />
        Add Ticket
      </Button>
    </div>
  );
}
