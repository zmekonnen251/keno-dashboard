'use client';

import { getPatterns } from '@/lib/api';
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

export default function PatternsPage() {
  const { siteId } = useSite();
  const { data, error, loading, refresh } = useApi(() => getPatterns(siteId), [siteId]);

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data || !data.patterns?.length) return <Empty label="No patterns yet" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Patterns</h2>
        <Button variant="outline" onClick={refresh}>Refresh</Button>
      </div>

      <Card title={`Patterns (${data.count ?? data.patterns.length})`}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pattern</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Hit rate</TableHead>
                <TableHead>Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.patterns.map((p, i) => (
                <TableRow key={p.pattern.description ?? i}>
                  <TableCell><PrettyNumbers nums={p.pattern.numbers} /></TableCell>
                  <TableCell>{p.totalOccurrences}</TableCell>
                  <TableCell>{p.overdueScore != null ? p.overdueScore.toFixed(2) : '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatTime(p.lastSeen)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
