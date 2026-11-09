'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, History, Loader2, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getDraws } from '@/lib/api';
import type { BotTicket } from '@/lib/types';
import {
  HISTORY_SCAN_LIMIT,
  TICKET_CATALOG_TABS,
  catalogTabCount,
  computeHistoryHits,
  ticketKey,
  type CatalogTab,
  type CatalogTicket,
  type HistoryResult,
} from '@/lib/ticketCatalog';

type HistoryState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; data: HistoryResult };

interface TicketCatalogModalProps {
  onClose: () => void;
  provider: string;
  existingTickets: BotTicket[];
  defaultStake: number;
  defaultUseFreeBet: boolean;
  onAdd: (numbersList: number[][], opts: { stake: number; useFreeBet: boolean }) => void;
}

export function TicketCatalogModal({
  onClose,
  provider,
  existingTickets,
  defaultStake,
  defaultUseFreeBet,
  onAdd,
}: TicketCatalogModalProps) {
  const [activeTab, setActiveTab] = useState<string>(TICKET_CATALOG_TABS[0].id);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Record<string, number[]>>({});
  const [stake, setStake] = useState(Math.max(1, defaultStake || 2));
  const [useFreeBet, setUseFreeBet] = useState(defaultUseFreeBet);
  const [history, setHistory] = useState<HistoryState>({ status: 'loading' });
  const [historyReload, setHistoryReload] = useState(0);

  const inQueue = useMemo(
    () =>
      new Set(
        existingTickets
          .filter((t) => t.numbers && t.numbers.length > 0)
          .map((t) => ticketKey(t.numbers as number[])),
      ),
    [existingTickets],
  );

  useEffect(() => {
    let alive = true;
    getDraws(provider, HISTORY_SCAN_LIMIT)
      .then((res) => {
        if (!alive) return;
        setHistory({
          status: 'ready',
          data: computeHistoryHits(res.draws.map((d) => d.results)),
        });
      })
      .catch((e) => {
        if (!alive) return;
        setHistory({
          status: 'error',
          error: e instanceof Error ? e.message : String(e),
        });
      });
    return () => {
      alive = false;
    };
  }, [provider, historyReload]);

  const selectedKeys = Object.keys(selected);

  const toggle = (t: CatalogTicket) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[t.key]) delete next[t.key];
      else next[t.key] = t.numbers;
      return next;
    });
  };

  const matchesQuery = (numbers: number[]): boolean => {
    const q = query.trim();
    if (!q) return true;
    const asNumber = Number(q);
    if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= 80) {
      return numbers.includes(asNumber);
    }
    return numbers.join('-').includes(q);
  };

  const renderChip = (numbers: number[], key: string, badge?: string) => {
    const queued = inQueue.has(key);
    const active = !!selected[key];
    return (
      <button
        key={key}
        type='button'
        disabled={queued}
        onClick={() => toggle({ numbers, key })}
        title={queued ? 'Already in the queue' : active ? 'Selected — click to uncheck' : 'Check to add to the queue'}
        className={`flex min-h-8 cursor-pointer items-center justify-between gap-1 rounded-lg border px-2 py-1 text-[11px] transition-colors ${
          queued
            ? 'cursor-default border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : active
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-muted/40 text-foreground hover:border-primary/50 hover:bg-muted'
        }`}
      >
        <span className='font-mono font-bold tracking-tight'>{numbers.join('·')}</span>
        <span className='flex items-center gap-1'>
          {badge ? (
            <span
              className={`rounded px-1 text-[9px] font-bold ${
                active ? 'bg-primary-foreground/15' : 'bg-background/60 text-muted-foreground'
              }`}
            >
              {badge}
            </span>
          ) : null}
          {queued || active ? <Check className='size-3' /> : <Plus className='size-3 opacity-50' />}
        </span>
      </button>
    );
  };

  const renderCatalogTab = (tab: CatalogTab) => (
    <>
      <p className='mb-3 text-xs text-muted-foreground'>{tab.description}</p>
      <div className='space-y-4'>
        {tab.groups.map((g) => {
          const visible = g.tickets.filter((t) => matchesQuery(t.numbers));
          return (
            <section key={g.id}>
              <div className='sticky top-0 z-10 -mx-1 mb-2 flex items-baseline justify-between gap-2 bg-background/95 px-1 py-1 backdrop-blur'>
                <h4 className='text-[11px] font-bold uppercase tracking-wide text-foreground'>{g.label}</h4>
                <span className='truncate text-[10px] text-muted-foreground'>
                  {visible.length} · {g.hint}
                </span>
              </div>
              {visible.length > 0 ? (
                <div className='grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5'>
                  {visible.map((t) => renderChip(t.numbers, t.key))}
                </div>
              ) : (
                <p className='py-3 text-center text-xs italic text-muted-foreground'>No ticket matches “{query}”.</p>
              )}
            </section>
          );
        })}
      </div>
    </>
  );

  return (
    <Modal title='Ticket catalog' onClose={onClose} wide>
      <p className='mb-3 text-xs text-muted-foreground'>
        Check the tickets you want, then add them to the queue in one save. Tickets already in the queue are
        marked ✓.
      </p>

      <div className='relative mb-3'>
        <Search className='pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground' />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Filter by a number (e.g. 64)…'
          className='h-8 pl-8 text-xs'
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className='w-full justify-start overflow-x-auto'>
          {TICKET_CATALOG_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className='flex-none text-xs'>
              {tab.shortLabel}
              <span className='text-[10px] text-muted-foreground'>{catalogTabCount(tab)}</span>
            </TabsTrigger>
          ))}
          <TabsTrigger value='history' className='flex-none text-xs'>
            <History className='size-3' />
            History
          </TabsTrigger>
        </TabsList>

        {TICKET_CATALOG_TABS.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className='pt-3'>
            {renderCatalogTab(tab)}
          </TabsContent>
        ))}

        <TabsContent value='history' className='pt-3'>
          {history.status === 'loading' ? (
            <div className='flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground'>
              <Loader2 className='size-4 animate-spin' />
              Reading recent {provider} draws…
            </div>
          ) : history.status === 'error' ? (
            <div className='space-y-3 py-6 text-center'>
              <p className='text-sm text-rose-600 dark:text-rose-400'>Could not load draw history: {history.error}</p>
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  setHistory({ status: 'loading' });
                  setHistoryReload((n) => n + 1);
                }}
              >
                Retry
              </Button>
            </div>
          ) : history.data.stats.scanned === 0 ? (
            <p className='py-10 text-center text-sm text-muted-foreground'>
              No draws recorded for {provider} yet — run the gateway collector and reopen this tab.
            </p>
          ) : (
            <HistoryTab data={history.data} renderChip={renderChip} />
          )}
        </TabsContent>
      </Tabs>

      <div className='sticky bottom-0 z-20 -mx-4 -mb-4 mt-4 border-t bg-background px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:-mx-6 sm:-mb-6 sm:px-6'>
        <div className='flex flex-wrap items-end gap-3'>
          <div className='w-20'>
            <Label htmlFor='catalog-stake' className='text-[10px] text-muted-foreground'>
              Stake (ETB)
            </Label>
            <Input
              id='catalog-stake'
              type='number'
              min={1}
              max={10000}
              value={stake}
              onChange={(e) => setStake(Math.max(1, Number(e.target.value)))}
              className='h-8 text-xs'
            />
          </div>
          <div className='flex items-center gap-2 pb-1.5'>
            <Switch id='catalog-free-bet' checked={useFreeBet} onCheckedChange={setUseFreeBet} />
            <Label htmlFor='catalog-free-bet' className='text-xs'>
              {useFreeBet ? 'Free bet' : 'Cash'}
            </Label>
          </div>
          <div className='ml-auto flex items-center gap-2'>
            <span className='text-xs text-muted-foreground'>{selectedKeys.length} selected</span>
            <Button
              disabled={selectedKeys.length === 0}
              onClick={() => {
                onAdd(
                  selectedKeys.map((k) => selected[k]),
                  { stake, useFreeBet },
                );
                onClose();
              }}
            >
              Add {selectedKeys.length > 0 ? `${selectedKeys.length} ` : ''}to queue
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function HistoryTab({
  data,
  renderChip,
}: {
  data: HistoryResult;
  renderChip: (numbers: number[], key: string, badge?: string) => React.ReactNode;
}) {
  const { stats } = data;
  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
        <HistoryStat label='Draws scanned' value={String(stats.scanned)} />
        <HistoryStat label='Avg numbers/draw' value={stats.avgDistinct.toFixed(1)} />
        <HistoryStat label='Avg adjacent pairs' value={stats.avgAdjacentPairs.toFixed(1)} />
        <HistoryStat label='Avg vertical pairs' value={stats.avgVerticalPairs.toFixed(1)} />
      </div>
      <p className='text-xs text-muted-foreground'>
        Ranked by how many of the last {stats.scanned} recorded draws contained the ticket. Only tickets with at
        least one hit are shown.
      </p>

      <HistoryGroup
        title={`2-digit tickets · top ${data.twoDigit.length}`}
        tickets={data.twoDigit}
        renderChip={renderChip}
      />
      <HistoryGroup
        title={`3-digit tickets · top ${data.threeDigit.length}`}
        tickets={data.threeDigit}
        renderChip={renderChip}
      />
    </div>
  );
}

function HistoryGroup({
  title,
  tickets,
  renderChip,
}: {
  title: string;
  tickets: HistoryResult['twoDigit'];
  renderChip: (numbers: number[], key: string, badge?: string) => React.ReactNode;
}) {
  return (
    <section>
      <div className='mb-2 flex items-baseline justify-between gap-2'>
        <h4 className='text-[11px] font-bold uppercase tracking-wide text-foreground'>{title}</h4>
        <span className='text-[10px] text-muted-foreground'>× hits</span>
      </div>
      {tickets.length > 0 ? (
        <div className='grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5'>
          {tickets.map((t) => renderChip(t.numbers, t.key, `×${t.hits}`))}
        </div>
      ) : (
        <p className='py-3 text-center text-xs italic text-muted-foreground'>No hits in the scanned draws.</p>
      )}
    </section>
  );
}

function HistoryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-lg border border-border bg-muted/40 p-2 text-center'>
      <span className='block text-[9px] font-bold uppercase tracking-wide text-muted-foreground'>{label}</span>
      <span className='font-mono text-sm font-extrabold text-foreground'>{value}</span>
    </div>
  );
}
