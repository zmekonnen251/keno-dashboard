'use client';

import { getDashboard } from '@/lib/api';
import { useSite } from '@/components/site-provider';
import { useApi } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, StatCard, Empty, ErrorBox, PrettyNumbers, Picks } from '@/components/app';
import { formatTime, winRate } from '@/lib/format';
import { useRouter } from 'next/navigation';

export default function OverviewPage() {
  const { siteId } = useSite();
  const router = useRouter();
  const { data, error, loading, refresh } = useApi(() => getDashboard(siteId), [siteId]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Empty label="No data" />;

  const { currentPrediction, liveRound, recentDraws, accuracy, mlStatus, hourlyTrends, currentTimeStats, totalDraws } = data;
  const mlMetric = mlStatus && mlStatus.reachable ? mlStatus.metrics?.[siteId] : undefined;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Overview</h2>
        <Button variant="outline" onClick={refresh}>Refresh</Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total draws" value={totalDraws} tone="accent" />
        <StatCard
          label="Prediction accuracy"
          value={winRate(accuracy)}
          sub={mlMetric ? `ML holdout ≥4/10: ${Math.round(mlMetric.pick10_win_rate_ge4 * 100)}% (${mlMetric.holdout_samples} draws)` : undefined}
          tone={accuracy && accuracy.winRate >= 50 ? 'positive' : 'negative'}
        />
        <StatCard label="Hour" value={data.currentContext.hour} sub={data.currentContext.dayName} />
        <StatCard label="Live round" value={liveRound ? 'Active' : 'None'} tone={liveRound ? 'positive' : 'default'} />
      </div>

      {liveRound && (
        <Card title={`Live round #${liveRound.roundId ?? liveRound.roundNo ?? ''}`}>
          <PrettyNumbers nums={liveRound.results || []} />
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Current prediction" actions={currentPrediction && <Badge className="bg-violet-100 text-violet-700">confident</Badge>}>
          {currentPrediction ? (
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pick numbers</div>
                <PrettyNumbers nums={currentPrediction.numbers || []} />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Predicted ticket</div>
                <Picks nums={currentPrediction.ticket || (currentPrediction.numbers || []).slice(0, 3)} tone="violet" />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Whole draw prediction</div>
                <Picks nums={currentPrediction.fullDraw || (currentPrediction.numbers || []).slice(0, 20)} tone="emerald" />
              </div>
              <div className="text-xs text-muted-foreground">
                Generated {formatTime(currentPrediction.generatedAt)}
              </div>
              <Button variant="outline" onClick={() => router.push(`/predictions`)}>View predictions</Button>
            </div>
          ) : (
            <Empty label="No prediction yet" />
          )}
        </Card>

        <Card title="Hourly trend (hot numbers)">
          {hourlyTrends && hourlyTrends.length ? (
            <div className="space-y-2">
              {hourlyTrends.slice(0, 6).map((t) => (
                <div key={t.hour} className="flex items-center gap-2 text-sm">
                  <span className="w-14 text-muted-foreground">{t.hour}h</span>
                  <div className="flex flex-wrap gap-1">
                    {(t.topNumbers || []).map((n) => (
                      <span key={`${t.hour}-${n}`} className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-xs font-semibold text-emerald-700">
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty label="No trend data" />
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Recent draws">
          {recentDraws && recentDraws.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Round</TableHead>
                    <TableHead>Numbers</TableHead>
                    <TableHead>Sum</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentDraws.slice(0, 12).map((d, i) => (
                    <TableRow key={d.roundId ?? i}>
                      <TableCell className="font-mono text-xs">{d.roundNo ?? '—'}</TableCell>
                      <TableCell><PrettyNumbers nums={d.results} /></TableCell>
                      <TableCell className="font-semibold">{d.results ? d.results.reduce((a, b) => a + b, 0) : '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatTime(d.drawnAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Empty label="No draws" />
          )}
        </Card>

        <Card title="Current time stats">
          {currentTimeStats && Object.keys(currentTimeStats).length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(currentTimeStats).map(([k, v]) => (
                    <TableRow key={k}>
                      <TableCell className="text-xs text-muted-foreground">{k}</TableCell>
                      <TableCell className="text-sm">{Array.isArray(v) ? v.join(', ') : String(v)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Empty label="No stats" />
          )}
        </Card>
      </div>
    </div>
  );
}
