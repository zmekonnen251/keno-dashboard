'use client';

import { useRef, useState } from 'react';
import { getAccounts, deleteAccount, createAccounts, uploadAccounts, checkBalances } from '@/lib/api';
import { useSite } from '@/components/site-provider';
import { useApi } from '@/lib/hooks';
import type { CheckBalanceItem } from '@/lib/types';
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
import { parseAccountFile } from '@/lib/phone';

export default function AccountsPage() {
  const { siteId } = useSite();
  const { data, error, loading, refresh } = useApi(() => getAccounts(siteId), [siteId]);

  const [createCount, setCreateCount] = useState('5');
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ valid: number; rejected: number; sample: string[] } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  function onFileChange(f: File | null) {
    setSelectedFile(f);
    setUploadMsg('');
    if (!f) { setPreview(null); return; }
    // Client-side check: validate + normalize the phones before uploading so the
    // admin sees immediately how many rows are usable and in what format.
    f.text().then((text) => {
      const parsed = parseAccountFile(text, f.name);
      setPreview({
        valid: parsed.valid,
        rejected: parsed.rejected,
        sample: parsed.rows.slice(0, 3).map((r) => String(r.phone)),
      });
    }).catch(() => setPreview(null));
  }

  async function onCreate() {
    setCreating(true);
    setCreateMsg('Creating accounts…');
    try {
      const res = await createAccounts(parseInt(createCount || '0', 10) || 1);
      setCreateMsg(res.timedOut
        ? `Created ${res.created} so far (request timed out; check again shortly).`
        : `Created ${res.created} account(s).`);
      refresh();
    } catch (e) {
      setCreateMsg('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setCreating(false);
    }
  }

  async function onUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    setUploadMsg('Uploading…');
    try {
      const res = await uploadAccounts(file);
      setUploadMsg(
        res.rejected
          ? `Imported ${res.inserted ?? 0} of ${res.provided} rows (${res.rejected} rejected — invalid/blank Ethiopian phone or missing password).`
          : `Imported ${res.inserted ?? 0} of ${res.provided} rows.`
      );
      refresh();
    } catch (e) {
      setUploadMsg('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setUploading(false);
      setSelectedFile(null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onDelete(id: number) {
    await deleteAccount(id);
    refresh();
  }

  const [checkingIds, setCheckingIds] = useState<Set<number>>(new Set());
  const [balances, setBalances] = useState<Record<number, CheckBalanceItem>>({});

  async function onCheckBalance(id: number) {
    setCheckingIds((prev) => new Set(prev).add(id));
    try {
      const res = await checkBalances(id);
      setBalances((prev) => {
        const next = { ...prev };
        (res.results || []).forEach((r) => (next[r.accountId] = r));
        return next;
      });
    } catch {
      // Surface failures inline in the balance cell rather than blocking.
      setBalances((prev) => ({
        ...prev,
        [id]: { accountId: id, phone: '', token: false, refreshed: false, balance: null, failed: true },
      }));
    } finally {
      setCheckingIds((prev) => new Set([...prev].filter((x) => x !== id)));
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Empty label="No accounts" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Accounts</h2>
        <Button variant="outline" onClick={refresh}>Refresh</Button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Create accounts">
          <p className="mb-3 text-xs text-muted-foreground">
            Register new ToloBirr accounts (phone + access token). No spinning is
            performed here.
          </p>
          <div className="flex items-end gap-2">
            <div className="w-28">
              <Label htmlFor="create-count">How many</Label>
              <Input id="create-count" type="number" min={1} max={100} value={createCount} onChange={(e) => setCreateCount(e.target.value)} />
            </div>
            <Button onClick={onCreate} disabled={creating}>{creating ? 'Creating…' : 'Create accounts'}</Button>
          </div>
          {createMsg && <p className="mt-2 text-xs text-muted-foreground">{createMsg}</p>}
        </Card>

        <Card title="Import accounts from CSV / JSON">
          <p className="mb-3 text-xs text-muted-foreground">
            CSV: <code>phone,password[,token]</code> per line. JSON: array of{' '}
            <code>{'{ phone, password, token? }'}</code>. Phones are normalized
            to <code>2517… / 2519…</code> (no <code>+</code>, no leading
            <code>0</code>); invalid ones are rejected.
          </p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="accounts-file">File (.csv / .json)</Label>
              <Input id="accounts-file" ref={fileRef} type="file" accept=".csv,.json,.txt" onChange={(e) => onFileChange(e.target.files?.[0] || null)} />
            </div>
            <Button
              onClick={() => onUpload(selectedFile)}
              disabled={uploading || !selectedFile || (preview !== null && preview.valid === 0)}
            >
              {uploading ? 'Uploading…' : 'Import'}
            </Button>
          </div>
          {preview && (
            <p className={`mt-2 text-xs ${preview.valid === 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
              {preview.valid} valid row(s), {preview.rejected} rejected.
              {preview.sample.length > 0 && <> Sample: {preview.sample.join(', ')}.</>}
              {preview.valid === 0 && ' No importable rows found.'}
            </p>
          )}
          {uploadMsg && <p className="mt-2 text-xs text-muted-foreground">{uploadMsg}</p>}
        </Card>
      </div>

      <Card title={`Accounts (${data.accounts.length})`}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Reward</TableHead>
                <TableHead>Last spin</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">+{a.phone}</TableCell>
                  <TableCell>
                    <div>{a.balance}</div>
                    {balances[a.id] && (
                      <div className="mt-0.5 text-xs">
                        {balances[a.id].failed ? (
                          <span className="text-red-600 dark:text-red-400">balance unavailable</span>
                        ) : balances[a.id].balance?.balance != null ? (
                          <span className="text-muted-foreground">live: {balances[a.id].balance?.balance} ETB</span>
                        ) : null}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{a.reward ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatTime(a.last_spin_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={checkingIds.has(a.id)}
                        onClick={() => onCheckBalance(a.id)}
                      >
                        {checkingIds.has(a.id) ? 'Checking…' : 'Check balance'}
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => onDelete(a.id)}>Delete</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
