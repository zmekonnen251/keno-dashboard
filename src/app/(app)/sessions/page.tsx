'use client';

import { useState } from 'react';
import { getSessions, createSession, deleteSession, refreshSession } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

export default function SessionsPage() {
  const { data, error, loading, refresh } = useApi(() => getSessions(), []);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  async function onCreate() {
    if (!url) return;
    setBusy(true);
    try {
      await createSession(url);
      setUrl('');
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: number) {
    await deleteSession(id);
    refresh();
  }

  async function onRefresh(id: number) {
    await refreshSession(id);
    refresh();
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Empty label="No sessions" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Sessions</h2>
        <Button variant="outline" onClick={refresh}>Refresh</Button>
      </div>

      <Card title="Add session">
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://site.example"
          />
          <Button onClick={onCreate} disabled={busy || !url}>Add</Button>
        </div>
      </Card>

      {data.providers.map((group) => (
        <Card key={group.provider} title={`${group.name} (${group.sessions.length})`}>
          {group.sessions.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Last draw</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.sessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.name || s.id}</TableCell>
                      <TableCell>{s.status}</TableCell>
                      <TableCell className="max-w-[240px] truncate text-xs">{s.url}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatTime(s.last_draw_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => onRefresh(s.id)}>Refresh</Button>
                          <Button variant="destructive" size="sm" onClick={() => onDelete(s.id)}>Delete</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Empty label="No sessions" />
          )}
        </Card>
      ))}
    </div>
  );
}
