'use client';

import { getStats } from '@/lib/api';
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
import { Card, Empty, ErrorBox, Loading, PrettyNumbers } from '@/components/app';

export default function StatsPage() {
  const { siteId } = useSite();
  const { data, error, loading, refresh } = useApi(() => getStats(siteId), [siteId]);

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Empty label="No stats" />;

  const trends = data.trends || [];
  const stats = data.stats;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Stats</h2>
        <Button variant="outline" onClick={refresh}>Refresh</Button>
      </div>

      {trends.length ? (
        <Card title="Hourly trends">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hour</TableHead>
                  <TableHead>Draws</TableHead>
                  <TableHead>Hot numbers</TableHead>
                  <TableHead>Avg repetitive</TableHead>
                  <TableHead>Avg cluster</TableHead>
                  <TableHead>Avg sequential</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trends.map((t) => (
                  <TableRow key={t.hour}>
                    <TableCell>{t.hour}h</TableCell>
                    <TableCell>{t.drawCount ?? '—'}</TableCell>
                    <TableCell className="text-xs"><PrettyNumbers nums={t.topNumbers || []} /></TableCell>
                    <TableCell>{t.avgRepetitive != null ? t.avgRepetitive.toFixed(2) : '—'}</TableCell>
                    <TableCell>{t.avgCluster != null ? t.avgCluster.toFixed(2) : '—'}</TableCell>
                    <TableCell>{t.avgSequential != null ? t.avgSequential.toFixed(2) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        <Empty label="No trend data" />
      )}

      {stats && (
        <Card title={`Stats for hour ${stats.hourOfDay}${stats.dayOfWeek >= 0 ? `, ${stats.dayName}` : ''}`}>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Draws</div>
            <div className="text-sm">{stats.drawCount}</div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hot numbers</div>
            <div className="text-sm"><PrettyNumbers nums={stats.hotNumbers} /></div>
          </div>
          <div className="overflow-x-auto pt-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.numberFrequencies.slice(0, 40).map((nf) => (
                  <TableRow key={nf.number}>
                    <TableCell>{nf.number}</TableCell>
                    <TableCell>{nf.frequency.toFixed(4)}</TableCell>
                    <TableCell>{nf.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
