'use client';

import { useState } from 'react';
import { getTemporalPrediction, generateTemporalPrediction } from '@/lib/api';
import { useSite } from '@/components/site-provider';
import { useApi } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Card, Empty, ErrorBox, Loading, Picks } from '@/components/app';
import { formatTime } from '@/lib/format';

// Temporal-pattern tickets: the top 2/3/4-spot picks mined from the same
// clock-time window on each of the last 7 days (recent days weighted higher).
// See server/src/analyzers/temporalPatternPredictor.ts.
export function TemporalTicketsCard() {
  const { siteId } = useSite();
  const { data, error, loading, refresh } = useApi(() => getTemporalPrediction(siteId), [siteId]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onGenerate() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await generateTemporalPrediction(siteId, {
        tzOffsetMinutes: new Date().getTimezoneOffset(),
      });
      setMsg(
        `Generated ${res.savedCount} tickets from ${res.windowDrawCount} window draws (${res.timeContext.label}).`
      );
      refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Temporal pattern tickets (±window)"
      actions={
        <Button size="sm" variant="outline" onClick={onGenerate} disabled={busy}>
          {busy ? 'Generating…' : 'Generate'}
        </Button>
      }
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Top 2/3/4-spot tickets mined from the same time-of-day window (±10 min) on each of the last 7
        days, weighted toward the most recent days. Run it just before the next draw.
      </p>
      {msg && <p className="mb-2 text-xs text-muted-foreground">{msg}</p>}
      <p className="mb-3 text-[11px] text-muted-foreground">
        These are the tickets the engines play with the temporal source: the rain autoplay &quot;Temporal pattern
        tickets&quot; spots mode, the general engine&apos;s &quot;temporal&quot; ticket source, and the manual bet cards&apos;
        &quot;Temporal Picks&quot; / temporal prediction bets.
      </p>
      {loading ? (
        <Loading rows={3} />
      ) : error ? (
        <ErrorBox message={error} />
      ) : !data || data.count === 0 ? (
        <Empty label="No temporal tickets yet — click Generate." />
      ) : (
        <div className="space-y-1.5">
          {data.tickets.map((t, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <Picks
                nums={t.numbers}
                tone={t.digits === 2 ? 'violet' : t.digits === 3 ? 'emerald' : 'default'}
              />
              <span className="text-xs text-muted-foreground">
                {t.digits}-spot · {Math.round(t.confidence * 100)}%
              </span>
            </div>
          ))}
          {data.latestAt && (
            <div className="pt-1 text-xs text-muted-foreground">Generated {formatTime(data.latestAt)}</div>
          )}
        </div>
      )}
    </Card>
  );
}
