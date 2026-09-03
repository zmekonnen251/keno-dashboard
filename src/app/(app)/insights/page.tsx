'use client';

import { getInsights } from '@/lib/api';
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
import { formatTime } from '@/lib/format';

export default function InsightsPage() {
  const { siteId } = useSite();
  const { data, error, loading, refresh } = useApi(() => getInsights(siteId), [siteId]);

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Empty label="No insights" />;

  const { prediction, patterns, repetitive } = data;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Insights</h2>
        <Button variant="outline" onClick={refresh}>Refresh</Button>
      </div>

      <Card title="Current prediction">
        {prediction ? (
          <div className="space-y-2">
            <PrettyNumbers nums={prediction.numbers} />
            <div className="text-xs text-muted-foreground">Generated {formatTime(prediction.generatedAt)}</div>
          </div>
        ) : (
          <Empty label="No prediction" />
        )}
      </Card>

      <Card title="Notable patterns">
        {patterns && patterns.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pattern</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Hit rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patterns.map((p, i) => (
                  <TableRow key={p.pattern.description ?? i}>
                    <TableCell><PrettyNumbers nums={p.pattern.numbers} /></TableCell>
                    <TableCell>{p.totalOccurrences}</TableCell>
                    <TableCell>{p.overdueScore != null ? p.overdueScore.toFixed(2) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Empty label="No patterns" />
        )}
      </Card>

      <Card title="Repetitive analysis">
        {repetitive && Object.keys(repetitive).length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(repetitive).map(([k, v]) => (
                  <TableRow key={k}>
                    <TableCell className="text-xs text-muted-foreground">{k}</TableCell>
                    <TableCell className="text-sm">{Array.isArray(v) ? v.join(', ') : String(v)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Empty label="No repetitive analysis" />
        )}
      </Card>
    </div>
  );
}
