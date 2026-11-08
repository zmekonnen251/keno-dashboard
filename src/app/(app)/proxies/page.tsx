'use client';

import { useRef, useState } from 'react';
import { getProxies, addProxy, deleteProxy, toggleProxy, uploadProxies, testProxy, testAllProxies } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function ProxiesPage() {
  const { data, error, loading, refresh } = useApi(() => getProxies(), []);
  const [entry, setEntry] = useState('');
  const [busy, setBusy] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [testingIds, setTestingIds] = useState<Record<number, boolean>>({});
  const [testingAll, setTestingAll] = useState(false);
  const [testAllMsg, setTestAllMsg] = useState('');

  async function onTest(id: number) {
    setTestingIds((m) => ({ ...m, [id]: true }));
    try {
      const r = await testProxy(id);
      refresh();
      return r;
    } finally {
      setTestingIds((m) => ({ ...m, [id]: false }));
    }
  }

  async function onTestAll() {
    setTestingAll(true);
    setTestAllMsg('Testing all proxies…');
    try {
      const r = await testAllProxies();
      setTestAllMsg(`Tested ${r.tested}: ${r.passed} working, ${r.failed} failed.`);
      refresh();
    } catch (e) {
      setTestAllMsg('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setTestingAll(false);
    }
  }

  async function onAdd() {
    if (!entry) return;
    setBusy(true);
    try {
      await addProxy(entry);
      setEntry('');
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    setUploadMsg('Uploading…');
    try {
      const res = await uploadProxies(file);
      const parts = [`Imported ${res.added ?? 0} of ${res.provided} proxies`];
      if (res.rejected) parts.push(`${res.rejected} rejected`);
      if (res.passed != null) parts.push(`${res.passed} passed test`);
      if (res.failed) parts.push(`${res.failed} failed test`);
      setUploadMsg(parts.join(' — ') + '.');
      refresh();
    } catch (e) {
      setUploadMsg('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setUploading(false);
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onDelete(id: number) {
    await deleteProxy(id);
    refresh();
  }

  async function onToggle(id: number, active: boolean) {
    await toggleProxy(id, !active);
    refresh();
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Empty label="No proxies" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">Proxies</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onTestAll} disabled={testingAll}>
            {testingAll ? 'Testing…' : 'Test All'}
          </Button>
          <Button variant="outline" onClick={refresh}>Refresh</Button>
        </div>
      </div>
      {testAllMsg && <p className="text-xs text-muted-foreground">{testAllMsg}</p>}

      <Card title="Add proxy">
        <div className="flex gap-2">
          <Input
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            placeholder="host:port or protocol://user:pass@host:port"
          />
          <Button onClick={onAdd} disabled={busy || !entry}>Add</Button>
        </div>
      </Card>

      <Card title="Import proxies from CSV / JSON">
        <p className="mb-3 text-xs text-muted-foreground">
          CSV: header <code>proxy,protocol,...</code> with rows{' '}
          <code>http://ip:port</code>. JSON: array of{' '}
          <code>{'{ proxy: "http://ip:port" }'}</code>.
        </p>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="proxies-file">File (.csv / .json)</Label>
            <Input id="proxies-file" ref={fileRef} type="file" accept=".csv,.json,.txt" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
          </div>
          <Button
            onClick={() => onUpload(selectedFile)}
            disabled={uploading || !selectedFile}
          >
            {uploading ? 'Uploading…' : 'Import'}
          </Button>
        </div>
        {uploadMsg && <p className="mt-2 text-xs text-muted-foreground">{uploadMsg}</p>}
      </Card>

      <Card title={`Proxies (${data.count})`}>
        {data.proxies.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Host</TableHead>
                  <TableHead>Port</TableHead>
                  <TableHead>Protocol</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.proxies.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.host}</TableCell>
                    <TableCell>{p.port}</TableCell>
                    <TableCell>{p.protocol}</TableCell>
                    <TableCell>
                      {p.is_active ? 'Active' : 'Inactive'}
                      {p.last_ok != null && (
                        <span className={`ml-2 text-xs ${p.last_ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {p.last_ok ? '✔ ok' : `✖ ${p.last_error || 'dead'}`}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatTime(p.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={testingIds[p.id]}
                          onClick={async () => {
                            const r = await onTest(p.id);
                            if (r) {
                              // Brief inline feedback via the status column refresh.
                              refresh();
                            }
                          }}
                        >
                          {testingIds[p.id] ? 'Testing…' : 'Test Connection'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => onToggle(p.id, p.is_active)}>
                          {p.is_active ? 'Disable' : 'Enable'}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => onDelete(p.id)}>Delete</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Empty label="No proxies" />
        )}
      </Card>
    </div>
  );
}
