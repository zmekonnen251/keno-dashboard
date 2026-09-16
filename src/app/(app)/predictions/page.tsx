'use client';

import { useState } from 'react';
import { getPredictions, generatePrediction, generateSequencePrediction, getTicketPlan, setTicketPlan } from '@/lib/api';
import { useSite } from '@/components/site-provider';
import { useApi } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, StatCard, Empty, ErrorBox, Loading, PrettyNumbers, Picks } from '@/components/app';
import { SequenceMatchDisplay } from '@/components/app/SequenceMatchDisplay';
import { formatTime, winRate } from '@/lib/format';
import type { TicketPlan, PredictionTicket, AccuracyStats } from '@/lib/types';

// Chips that highlight which predicted numbers actually landed on a checked
// draw — so a "Won ✓" prediction can be eyeballed against the real result.
function MatchChips({ picks, actual }: { picks: number[]; actual?: number[] | null }) {
  const hits = new Set(actual ?? []);
  return (
    <div className="flex flex-wrap gap-1">
      {picks.map((n) => (
        <span
          key={n}
          className={`inline-flex h-6 w-6 items-center justify-center rounded text-[11px] font-semibold ${
            hits.has(n) ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'
          }`}
        >
          {n}
        </span>
      ))}
    </div>
  );
}

// One generated ticket with its full-match result (won = every number landed).
function TicketBadges({ tickets }: { tickets?: PredictionTicket[] }) {
  if (!tickets?.length) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tickets.map((t, i) => (
        <span
          key={i}
          title={t.won == null ? 'pending result' : t.won ? 'full match — won' : 'no full match'}
          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium ${
            t.won == null
              ? 'border-border text-muted-foreground'
              : t.won
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-border text-muted-foreground'
          }`}
        >
          {t.numbers.join(',')}
          {t.won == null ? null : t.won ? ' ✓' : ' ✗'}
        </span>
      ))}
    </div>
  );
}

const CORE_SITES = ['fungames_tolobirr', 'fungames_shamo'] as const;

// Digit-count -> ticket count editor for the per-site generation plan.
function TicketPlanEditor({ siteId, plan }: { siteId: string; plan: TicketPlan }) {
  const [draft, setDraft] = useState<TicketPlan>({ ...plan });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await setTicketPlan(siteId, Object.fromEntries(
        Object.entries(draft).map(([k, v]) => [Number(k), Math.max(0, Number(v) || 0)]),
      ));
      setDraft({ ...res.ticketPlan });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const digitCounts = [...new Set([2, 3, 4, ...Object.keys(draft).map(Number)])]
    .filter((d) => d >= 1 && d <= 6)
    .sort((a, b) => a - b);

  return (
    <Card title="Ticket plan (per prediction)">
      <p className="mb-2 text-xs text-muted-foreground">
        How many betting tickets of each digit-count to generate. Tickets are placed on a full match
        (every number on the draw); accuracy is tracked per type.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {digitCounts.map((digits) => (
          <label key={digits} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {digits}-digit
            <input
              type="number"
              min={0}
              max={10}
              value={draft[digits] ?? 0}
              onChange={(e) => setDraft((d) => ({ ...d, [digits]: Math.max(0, Number(e.target.value) || 0) }))}
              className="w-14 rounded border border-input bg-background px-1.5 py-1 text-center text-sm text-foreground"
            />
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save plan'}
        </Button>
        {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
      </div>
    </Card>
  );
}

function AccuracyCard({ accuracy }: { accuracy: AccuracyStats | null }) {
  const digits = Object.keys(accuracy?.tickets ?? {}).map(Number).sort((a, b) => a - b);
  return (
    <Card title="Accuracy">
      <StatCard label="Win rate (≥4/10 picks)" value={winRate({ total: accuracy?.total, wins: accuracy?.wins })} />
      {accuracy?.total !== undefined && accuracy.total > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          {accuracy.wins} wins / {accuracy.total} evaluated predictions
        </p>
      )}
      {digits.length > 0 && (
        <div className="mt-2 border-t border-border pt-2">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Full-match ticket accuracy
          </div>
          <div className="space-y-1 text-xs">
            {digits.map((d) => {
              const s = accuracy!.tickets![String(d)];
              return (
                <div key={d} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{d}-digit tickets</span>
                  <span className={s.wins > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
                    {s.wins}/{s.total} won · {Math.round(s.winRate * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

// Per-site summary comparing the prediction against the recorded draw: the
// context draw it was generated from, the ticket/whole-draw picks, and the last
// evaluation against an actual result.
function SitePredictionCard({ siteId }: { siteId: string }) {
  const { data, error, loading } = useApi(() => getPredictions(siteId), [siteId]);
  if (loading) return <Card title={siteId}><Loading rows={4} /></Card>;
  if (error) return <Card title={siteId}><ErrorBox message={error} /></Card>;
  if (!data) return <Card title={siteId}><Empty label="No predictions" /></Card>;

  const { prediction, recent, accuracy, currentDraw, currentDrawAt } = data;
  const evaluated = recent?.find((r) => r.hit != null && r.evaluatedDraw);

  return (
    <Card title={siteId}>
      <div className="space-y-4">
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Latest completed draw (context)</div>
          {currentDraw ? (
            <>
              <PrettyNumbers nums={currentDraw} />
              {currentDrawAt && (
                <div className="mt-1 text-xs text-muted-foreground">{formatTime(currentDrawAt)}</div>
              )}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">No completed draw recorded yet.</span>
          )}
        </div>
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Predicted ticket</div>
          {prediction ? (
            <Picks nums={prediction.ticket || prediction.numbers.slice(0, 3)} tone="violet" />
          ) : (
            <span className="text-xs text-muted-foreground">No prediction.</span>
          )}
        </div>
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Whole draw prediction</div>
          {prediction ? (
            <Picks nums={prediction.fullDraw || prediction.numbers.slice(0, 20)} tone="emerald" />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Last evaluated against the actual draw</div>
          {evaluated ? (
            <div className="space-y-1.5">
              <MatchChips picks={evaluated.numbers} actual={evaluated.evaluatedDraw} />
              {evaluated.ticket?.length ? (
                <MatchChips picks={evaluated.ticket} actual={evaluated.evaluatedDraw} />
              ) : null}
              {evaluated.tickets?.length ? (
                <TicketBadges tickets={evaluated.tickets} />
              ) : null}
              <p className="text-xs text-muted-foreground">
                {evaluated.hit ? 'Won' : 'Lost'} ·{' '}
                {evaluated.numbers.filter((n) => evaluated.evaluatedDraw?.includes(n)).length}/{evaluated.numbers.length} of the 10 picks were on the draw · ticket{' '}
                {evaluated.ticket?.length
                  ? `${evaluated.ticket.filter((n) => evaluated.evaluatedDraw?.includes(n)).length}/${evaluated.ticket.length}`
                  : '—'}
                {' · '}
                {formatTime(evaluated.createdAt)}
              </p>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Nothing checked against a real draw yet.</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          Accuracy: {winRate(accuracy)} ({accuracy?.wins ?? 0}/{accuracy?.total ?? 0} evaluated)
        </div>
      </div>
    </Card>
  );
}

export default function PredictionsPage() {
  const { siteId } = useSite();
  const { data, error, loading, refresh } = useApi(() => getPredictions(siteId), [siteId]);
  const [generating, setGenerating] = useState(false);
  const [useSequenceMatch, setUseSequenceMatch] = useState(false);
  const [lookbackN, setLookbackN] = useState(3);

  async function onGenerate() {
    setGenerating(true);
    try {
      await generatePrediction(siteId, { useSequenceMatch, lookback_n: lookbackN });
      refresh();
    } finally {
      setGenerating(false);
    }
  }

  async function onGenerateSequence() {
    setGenerating(true);
    try {
      await generateSequencePrediction(siteId, { lookback_n: lookbackN });
      refresh();
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Empty label="No predictions" />;

  const { prediction, recent, accuracy, currentDraw, currentDrawAt } = data;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Predictions</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refresh}>Refresh</Button>
          <Button onClick={onGenerate} disabled={generating}>{generating ? 'Generating…' : 'Generate'}</Button>
          <Button variant="outline" onClick={onGenerateSequence} disabled={generating}>
            {generating ? 'Sequence…' : 'Sequence Match'}
          </Button>
        </div>
      </div>

      {/* Sequence Matching Controls */}
      <Card title="Sequence Matching Settings">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={useSequenceMatch}
                onChange={(e) => setUseSequenceMatch(e.target.checked)}
                className="rounded border-input"
              />
              Enable sequence matching
            </label>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Lookback window:</label>
            <select
              value={lookbackN}
              onChange={(e) => setLookbackN(Number(e.target.value))}
              className="rounded border border-input bg-background px-2 py-1 text-sm"
            >
              <option value={2}>2 draws</option>
              <option value={3}>3 draws</option>
              <option value={5}>5 draws</option>
            </select>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card title="Current prediction">
          {prediction ? (
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pick numbers</div>
                <PrettyNumbers nums={prediction.numbers} />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Predicted ticket</div>
                <Picks nums={prediction.ticket || prediction.numbers.slice(0, 3)} tone="violet" />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Whole draw prediction</div>
                <Picks nums={prediction.fullDraw || prediction.numbers.slice(0, 20)} tone="emerald" />
              </div>
              {prediction.tickets?.length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Generated betting tickets</div>
                  <TicketBadges tickets={prediction.tickets} />
                </div>
              )}
              <div className="text-xs text-muted-foreground">Generated {formatTime(prediction.generatedAt)} · conf {Math.round((prediction.confidence ?? 0) * 100)}%</div>
              {prediction.useSequenceMatch && (
                <div className="text-xs text-violet-600 dark:text-violet-400 font-medium">
                  Using sequence matching analysis
                </div>
              )}
              {currentDraw && (
                <div className="rounded border border-border p-2">
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Latest completed draw (context)</div>
                  <PrettyNumbers nums={currentDraw} />
                  {currentDrawAt && (
                    <div className="mt-1 text-xs text-muted-foreground">{formatTime(currentDrawAt)}</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <Empty label="No prediction" />
          )}
        </Card>
        <AccuracyCard accuracy={accuracy} />
        <TicketPlanEditor siteId={siteId} plan={data.ticketPlan ?? { 2: 3, 3: 3, 4: 1 }} />
        <Card title="ML model accuracy">
          {(() => {
            const ms = data.mlStatus;
            const m = ms && siteId ? ms.metrics?.[siteId] : undefined;
            if (!ms || !ms.reachable) {
              return (
                <p className="text-xs text-muted-foreground">
                  ML microservice not reachable — predictions currently use the heuristic engine.
                </p>
              );
            }
            if (!m) {
              return (
                <p className="text-xs text-muted-foreground">
                  Model trained ({ms.trainedRows ?? 0} draws) — holdout metrics appear after the next retrain.
                </p>
              );
            }
            return (
              <div className="space-y-1.5">
                <StatCard label="Holdout win rate (≥4/10 picks)" value={`${Math.round(m.pick10_win_rate_ge4 * 100)}%`} />
                <div className="space-y-0.5 text-xs text-muted-foreground">
                  <p>≥3: {Math.round(m.pick10_win_rate_ge3 * 100)}% · ≥2: {Math.round(m.pick10_win_rate_ge2 * 100)}% · ≥1: {Math.round(m.pick10_win_rate_ge1 * 100)}%</p>
                  <p>{m.holdout_samples} held-out draws · avg {m.mean_pick10_hits.toFixed(2)}/10 picks · ticket avg {m.mean_ticket3_hits.toFixed(2)}/3</p>
                  {ms.lastTrainAt?.[siteId] && (
                    <p>Last retrain: {formatTime(ms.lastTrainAt[siteId])}</p>
                  )}
                </div>
              </div>
            );
          })()}
        </Card>
        <SequenceMatchDisplay sequenceMatch={prediction?.sequenceMatch || null} />
      </div>

      {recent && recent.length ? (
        <Card title="Recent predictions">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Picks</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Whole draw</TableHead>
                  <TableHead>Generated tickets</TableHead>
                  <TableHead>Hit</TableHead>
                  <TableHead>Generated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><PrettyNumbers nums={r.numbers} /></TableCell>
                    <TableCell><Picks nums={r.ticket || r.numbers.slice(0, 3)} tone="violet" /></TableCell>
                    <TableCell><Picks nums={r.fullDraw || r.numbers.slice(0, 20)} tone="emerald" /></TableCell>
                    <TableCell><TicketBadges tickets={r.tickets} /></TableCell>
                    <TableCell>{r.hit == null ? '—' : (
                      <span className={r.hit ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
                        {r.hit ? '✓' : '✗'}
                        {r.evaluatedDraw ? ` ${r.numbers.filter((n) => r.evaluatedDraw?.includes(n)).length}/${r.numbers.length}` : ''}
                        {r.evaluatedDraw && r.ticket?.length ? ` · ticket ${r.ticket.filter((n) => r.evaluatedDraw?.includes(n)).length}/${r.ticket.length}` : ''}
                      </span>
                    )}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatTime(r.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        <Empty label="No recent predictions" />
      )}

      <div className="space-y-3">
        <h3 className="text-base font-bold text-foreground">Both sites — prediction vs actual draw</h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {CORE_SITES.map((sid) => (
            <SitePredictionCard key={sid} siteId={sid} />
          ))}
        </div>
      </div>
    </div>
  );
}
