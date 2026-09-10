'use client';

import { useState } from 'react';
import { getPredictions, generatePrediction } from '@/lib/api';
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
import { formatTime, winRate } from '@/lib/format';

export default function PredictionsPage() {
  const { siteId } = useSite();
  const { data, error, loading, refresh } = useApi(() => getPredictions(siteId), [siteId]);
  const [generating, setGenerating] = useState(false);

  async function onGenerate() {
    setGenerating(true);
    try {
      await generatePrediction(siteId);
      refresh();
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Empty label="No predictions" />;

  const { prediction, recent, accuracy } = data;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Predictions</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refresh}>Refresh</Button>
          <Button onClick={onGenerate} disabled={generating}>{generating ? 'Generating…' : 'Generate'}</Button>
        </div>
      </div>

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
              <div className="text-xs text-muted-foreground">Generated {formatTime(prediction.generatedAt)} · conf {Math.round((prediction.confidence ?? 0) * 100)}%</div>
            </div>
          ) : (
            <Empty label="No prediction" />
          )}
        </Card>
        <Card title="Accuracy">
          <StatCard label="Win rate" value={winRate({ total: accuracy?.total, wins: accuracy?.wins })} />
          {accuracy?.total !== undefined && accuracy.total > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {accuracy.wins} wins / {accuracy.total} evaluated predictions
            </p>
          )}
        </Card>
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
                    <TableCell>{r.hit == null ? '—' : (r.hit ? '✓' : '✗')}</TableCell>
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
    </div>
  );
}
