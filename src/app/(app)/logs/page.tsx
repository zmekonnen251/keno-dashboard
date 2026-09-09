'use client';

import { autoplayStatus, getLogs } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useNotifications } from '@/lib/notifications';
import { Button } from '@/components/ui/button';
import { Card, Empty, ErrorBox, Loading } from '@/components/app';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BetTable } from '@/components/autoplay/BetTable';
import { AccountStatusCard } from '@/components/autoplay/AccountStatusCard';
import { CopyPhoneButton } from '@/components/accounts-columns';

const levelColor: Record<string, string> = {
  error: 'text-red-600 dark:text-red-400',
  warn: 'text-amber-600',
  info: 'text-sky-600',
  debug: 'text-muted-foreground',
};

const KIND_DOT: Record<string, string> = {
  win: 'bg-emerald-500',
  info: 'bg-sky-500',
  error: 'bg-red-500',
};

export default function LogsPage() {
  const logs = useApi(() => getLogs(), []);
  const autoplay = useApi(() => autoplayStatus(), []);
  const { notifications, clear } = useNotifications();

  const bets = autoplay.data?.bets || [];
  const accounts = autoplay.data?.accounts || [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Logs</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { logs.refresh(); autoplay.refresh(); }}>
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="notifications">
        <TabsList>
          <TabsTrigger value="notifications">Notifications ({notifications.length})</TabsTrigger>
          <TabsTrigger value="bets">Bets ({bets.length})</TabsTrigger>
          <TabsTrigger value="accounts">Accounts ({accounts.length})</TabsTrigger>
          <TabsTrigger value="server">Server</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications">
          <Card
            title="Notifications"
            actions={
              notifications.length > 0 ? (
                <Button variant="outline" size="sm" onClick={clear}>
                  Clear all
                </Button>
              ) : undefined
            }
          >
            {notifications.length === 0 ? (
              <Empty label="No notifications yet. Full-match wins will appear here." />
            ) : (
              <div className="max-h-[70vh] space-y-1 overflow-y-auto">
                {notifications.map((n) => (
                  <div key={n.id} className="flex items-start gap-2.5 rounded px-1 py-1.5 hover:bg-muted">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${KIND_DOT[n.kind] || 'bg-sky-500'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-foreground">{n.text}</p>
                      <p className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                        {new Date(n.at).toLocaleString()}
                        {n.phone && (
                          <span className="inline-flex items-center gap-0.5 text-[11px]">
                            +{n.phone}
                            <CopyPhoneButton phone={n.phone} />
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="bets">
          <Card title={`Bet log (${bets.length})`}>
            {autoplay.loading && !autoplay.data ? (
              <Loading />
            ) : autoplay.error ? (
              <ErrorBox message={autoplay.error} />
            ) : bets.length === 0 ? (
              <Empty label="No bets recorded yet." />
            ) : (
              <BetTable bets={bets} />
            )}
          </Card>
        </TabsContent>

        <TabsContent value="accounts">
          {autoplay.loading && !autoplay.data ? (
            <Loading />
          ) : autoplay.error ? (
            <ErrorBox message={autoplay.error} />
          ) : (
            <AccountStatusCard accounts={accounts} running={autoplay.data?.running ?? false} />
          )}
        </TabsContent>

        <TabsContent value="server">
          <Card title={`Server logs (${logs.data?.logs.length ?? 0})`}>
            {logs.loading ? (
              <Loading rows={10} />
            ) : logs.error ? (
              <ErrorBox message={logs.error} />
            ) : !logs.data || !logs.data.logs?.length ? (
              <Empty label="No logs" />
            ) : (
              <div className="max-h-[70vh] space-y-1 overflow-y-auto font-mono text-xs">
                {logs.data.logs.map((l, i) => (
                  <div key={i} className="flex gap-2 whitespace-pre-wrap rounded px-1 py-0.5 hover:bg-muted">
                    <span className="text-muted-foreground">{l.ts}</span>
                    <span className={`w-14 shrink-0 uppercase ${levelColor[l.level] || 'text-muted-foreground'}`}>{l.level}</span>
                    <span className="text-foreground">{l.msg}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
