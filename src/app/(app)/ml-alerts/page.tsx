'use client';

import { useEffect, useRef } from 'react';
import { getMlAlerts } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useNotifications } from '@/lib/notifications';
import { Button } from '@/components/ui/button';
import { Card, Empty, ErrorBox, Loading, PrettyNumbers } from '@/components/app';
import { formatTime } from '@/lib/format';

export default function MlAlertsPage() {
  const alerts = useApi(() => getMlAlerts(100), []);
  const { notify } = useNotifications();
  const seen = useRef<Set<number>>(new Set());

  // Live stream: re-poll every 3 seconds (matches the autoplay page pattern).
  useEffect(() => {
    const t = setInterval(() => alerts.refresh(), 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Punch newly-arrived alerts into the notification bell (unread badge).
  useEffect(() => {
    const list = alerts.data?.alerts || [];
    for (const a of list) {
      if (seen.current.has(a.id)) continue;
      seen.current.add(a.id);
      notify({
        id: `ml-${a.id}`,
        kind: 'info',
        text: `ML alert: repetitive triplet in [${(a.summary?.draw || a.draw).join(', ')}]`,
        at: new Date(a.receivedAt).getTime(),
      });
    }
  }, [alerts.data, notify]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">ML Alerts</h2>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Live · refreshes every 3s
          </span>
          <Button variant="outline" onClick={alerts.refresh}>Refresh</Button>
        </div>
      </div>

      <Card title={`Realtime alerts (${alerts.data?.alerts.length ?? 0})`}>
        {alerts.loading && !alerts.data ? (
          <Loading rows={5} />
        ) : alerts.error ? (
          <ErrorBox message={alerts.error} />
        ) : !alerts.data || alerts.data.alerts.length === 0 ? (
          <Empty label="No ML alerts yet. Repetitive sequential groupings (e.g. 1,2,3) detected by the ML service will stream here." />
        ) : (
          <div className="max-h-[70vh] space-y-2 overflow-y-auto">
            {alerts.data.alerts.map((a) => (
              <div key={a.id} className="flex items-start gap-2.5 rounded px-1 py-1.5 hover:bg-muted">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1">
                    <PrettyNumbers nums={a.draw} />
                  </div>
                  <p className="flex flex-wrap items-center gap-x-2 font-mono text-[10px] text-muted-foreground">
                    <span>triplet: {a.summary?.has_triplet ? 'yes' : 'no'}</span>
                    <span>source: {a.source}</span>
                    <span>received {formatTime(a.receivedAt)}</span>
                    <span>(draw ts {a.timestamp})</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}