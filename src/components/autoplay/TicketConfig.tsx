'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Play, Save, RefreshCw } from 'lucide-react';
import { getAutoplayConfig, setAutoplayConfig } from '@/lib/api';

interface TicketConfig {
  id: string;
  spots: number;
  stake: number;
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
          stake: config.stake || 2,
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
      { id: '1', spots: 2, stake: 2, enabled: true, picks: [11, 12] },
      { id: '2', spots: 2, stake: 2, enabled: true, picks: [15, 25] },
      { id: '3', spots: 3, stake: 2, enabled: true, picks: [11, 12, 13] },
      { id: '4', spots: 3, stake: 2, enabled: true, picks: [15, 25, 35] },
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
      stake: 2,
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

  function updateTicket(id: string, field: keyof TicketConfig, value: any) {
    setTickets(tickets.map(t => {
      if (t.id === id) {
        const updated = { ...t, [field]: value };
        if (field === 'spots') {
          updated.picks = generateRandomPicks(value);
        }
        return updated;
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

      <div className="space-y-2">
        {tickets.map((ticket, idx) => (
          <div
            key={ticket.id}
            className={`flex items-center gap-3 p-3 rounded-lg border ${
              ticket.enabled
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : 'border-border bg-black/5 opacity-50 dark:border-white/10 dark:bg-white/5'
            }`}
          >
            <input
              type="checkbox"
              checked={ticket.enabled}
              onChange={() => toggleTicket(ticket.id)}
              className="w-4 h-4 rounded"
            />
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold">Ticket #{idx + 1}</span>
                <select
                  value={ticket.spots}
                  onChange={(e) => updateTicket(ticket.id, 'spots', Number(e.target.value))}
                  className="text-xs bg-background border rounded px-2 py-1"
                >
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => (
                    <option key={s} value={s}>{s} spots</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={ticket.stake}
                  onChange={(e) => updateTicket(ticket.id, 'stake', Number(e.target.value))}
                  className="w-16 text-xs bg-background border rounded px-2 py-1"
                  min="1"
                />
                <span className="text-xs text-muted-foreground">ETB</span>
              </div>
              
              <div className="flex flex-wrap gap-1">
                {(ticket.picks || []).map((num) => (
                  <span
                    key={num}
                    className="w-6 h-6 flex items-center justify-center rounded bg-primary/20 text-primary text-xs font-bold"
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
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => deleteTicket(ticket.id)}
                title="Delete ticket"
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
