'use client';

import { getClients } from '@/lib/api';
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
import { Card, Empty, ErrorBox, Loading } from '@/components/app';
import { formatTime } from '@/lib/format';

export default function ClientsPage() {
  const { data, error, loading, refresh } = useApi(() => getClients(), []);

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Empty label="No clients" />;

  const clients = data.clients || [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Clients</h2>
        <Button variant="outline" onClick={refresh}>Refresh</Button>
      </div>

      {clients.length ? (
        <Card title={`Clients (${clients.length})`}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Connected</TableHead>
                  <TableHead>Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.id}</TableCell>
                    <TableCell>{c.type ?? '—'}</TableCell>
                    <TableCell>{c.label ?? '—'}</TableCell>
                    <TableCell>{c.ip ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatTime(c.connectedAt)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatTime(c.lastSeen)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        <Empty label="No connected clients" />
      )}
    </div>
  );
}
