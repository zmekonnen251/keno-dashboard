'use client';

import { getLogs } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Card, Empty, ErrorBox, Loading } from '@/components/app';

const levelColor: Record<string, string> = {
  error: 'text-red-600 dark:text-red-400',
  warn: 'text-amber-600',
  info: 'text-sky-600',
  debug: 'text-muted-foreground',
};

export default function LogsPage() {
  const { data, error, loading, refresh } = useApi(() => getLogs(), []);

  if (loading) return <Loading rows={10} />;
  if (error) return <ErrorBox message={error} />;
  if (!data || !data.logs?.length) return <Empty label="No logs" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Logs</h2>
        <Button variant="outline" onClick={refresh}>Refresh</Button>
      </div>

      <Card title={`Logs (${data.logs.length})`}>
        <div className="max-h-[70vh] space-y-1 overflow-y-auto font-mono text-xs">
          {data.logs.map((l, i) => (
            <div key={i} className="flex gap-2 whitespace-pre-wrap rounded px-1 py-0.5 hover:bg-muted">
              <span className="text-muted-foreground">{l.ts}</span>
              <span className={`w-14 shrink-0 uppercase ${levelColor[l.level] || 'text-muted-foreground'}`}>{l.level}</span>
              <span className="text-foreground">{l.msg}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
