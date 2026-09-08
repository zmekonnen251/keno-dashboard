'use client';

import { useEffect, useRef, useState } from 'react';
import { getAccounts, deleteAccount, createAccounts, uploadAccounts, syncBalances, refreshWsToken, setAccountEnabled, cleanupSpentAccounts, getLiveBalances, checkBalances } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, Empty, ErrorBox, Loading } from '@/components/app';
import { parseAccountFile } from '@/lib/phone';
import { DataTable } from '@/components/ui/data-table';
import { AccountMobileCard, columns } from '@/components/accounts-columns';

export default function AccountsPage() {
  const { data, error, loading, refresh } = useApi(() => getAccounts('fungames'), []);
  const [createCount, setCreateCount] = useState('5');
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [checking, setChecking] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanMsg, setCleanMsg] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ valid: number; rejected: number; sample: string[] } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  
  useEffect(() => {
    const t = setInterval(() => refresh(), 10000);
    return () => clearInterval(t);
  }, [refresh]);

  function onFileChange(f: File | null) {
    setSelectedFile(f);
    setUploadMsg('');
    if (!f) { setPreview(null); return; }
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

  async function onToggleEnabled(id: number, enabled: boolean) {
    await setAccountEnabled(id, enabled);
    refresh();
  }

  async function onRefreshWsToken(id: number) {
    setSyncing(true);
    setSyncMsg('Refreshing WS token…');
    try {
      await refreshWsToken(id);
      setSyncMsg('WS token refreshed.');
      refresh();
    } catch (e) {
      setSyncMsg('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSyncing(false);
    }
  }

  async function onSyncWallets() {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await syncBalances();
      setSyncMsg(
        `Synced ${res.synced ?? 0} of ${res.count} wallets` +
          (res.timedOut ? ' (partial).' : '.') +
          (res.deleted ? ` ${res.deleted} empty account(s) removed.` : '')
      );
      refresh();
    } catch (e) {
      setSyncMsg('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSyncing(false);
    }
  }

  async function onCheckLiveBalances() {
    setChecking(true);
    try {
      const res = await getLiveBalances();
      setSyncMsg(`Live balances: ${res.wsHits} from gateway streams, ${res.stored} stored (total ${res.count}).`);
      refresh();
    } catch (e) {
      setSyncMsg('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setChecking(false);
    }
  }

  async function onCheckBalance(id: number, phone: string) {
    setSyncMsg(`Checking live balance for +${phone}…`);
    try {
      const res = await checkBalances(id, true);
      const row = res.results?.[0];
      setSyncMsg(
        row && !row.failed && row.balance != null
          ? `+${phone}: ${row.balance} ETB (verified from game server).`
          : `+${phone}: check failed.`
      );
      refresh();
    } catch (e) {
      setSyncMsg('Error: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function onCleanupSpent() {
    if (!data) return;
    const eligible = data.accounts.filter((a) => (a.balance ?? 0) < 2 && a.last_bet_at != null);
    if (eligible.length === 0) return;
    const ok = window.confirm(
      `Delete ${eligible.length} spent account(s)?\n\nThese placed at least one bet, are below 2 ETB, and have no unsettled bets. Fresh (never-bet) accounts are never touched.`
    );
    if (!ok) return;
    setCleaning(true);
    setCleanMsg('');
    try {
      const res = await cleanupSpentAccounts();
      const skipped = res.skippedPending.length > 0 ? ` ${res.skippedPending.length} skipped (bet still pending).` : '';
      setCleanMsg(`Deleted ${res.deleted} of ${res.candidates} spent account(s).${skipped}`);
      refresh();
    } catch (e) {
      setCleanMsg('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setCleaning(false);
    }
  }

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox message={error} />;
  if (!data) return <Empty label="No accounts" />;

  const spentIdleCount = data.accounts.filter((a) => (a.balance ?? 0) < 2 && a.last_bet_at != null).length;

  return (
		<div className='space-y-5'>
			<div className='flex flex-wrap items-center justify-between gap-3'>
				<h2 className='text-lg font-bold text-foreground'>Accounts</h2>
				<div className='flex flex-wrap gap-2'>
					<Button variant='outline' onClick={onCleanupSpent} disabled={cleaning || spentIdleCount === 0}>
						{cleaning ? 'Deleting…' : `Delete spent idle (${spentIdleCount})`}
					</Button>
					<Button variant='outline' onClick={onSyncWallets} disabled={syncing}>
						{syncing ? 'Syncing…' : 'Sync wallets'}
					</Button>
					<Button variant='outline' onClick={onCheckLiveBalances} disabled={checking}>
						{checking ? 'Checking…' : 'WS balances'}
					</Button>
					<Button variant='outline' onClick={refresh}>
						Refresh
					</Button>
				</div>
			</div>
			<p className='text-xs text-muted-foreground'>
				Balance is the live ToloBirr wallet, written to the database every
				couple of minutes (and when you click Sync wallets). New accounts start
				at 2 ETB until the first sync. “Spent idle” means: placed at least one
				bet, below 2 ETB, and no unsettled bet — safe to delete in one click.
			</p>
			{syncMsg && <p className='text-xs text-muted-foreground'>{syncMsg}</p>}
			{cleanMsg && <p className='text-xs text-muted-foreground'>{cleanMsg}</p>}

			<div className='grid grid-cols-1 gap-5 lg:grid-cols-2'>
				<Card title='Create accounts'>
					<p className='mb-3 text-xs text-muted-foreground'>
						Register new ToloBirr accounts (phone + access token). No spinning
						is performed here.
					</p>
					<div className='flex items-end gap-2'>
						<div className='w-28'>
							<Label htmlFor='create-count'>How many</Label>
							<Input
								id='create-count'
								type='number'
								min={1}
								max={100}
								value={createCount}
								onChange={(e) => setCreateCount(e.target.value)}
							/>
						</div>
						<Button onClick={onCreate} disabled={creating}>
							{creating ? 'Creating…' : 'Create accounts'}
						</Button>
					</div>
					{createMsg && (
						<p className='mt-2 text-xs text-muted-foreground'>{createMsg}</p>
					)}
				</Card>

				<Card title='Import accounts from CSV / JSON'>
					<p className='mb-3 text-xs text-muted-foreground'>
						CSV: <code>phone,password[,token]</code> per line. JSON: array of{' '}
						<code>{'{ phone, password, token? }'}</code>. Phones are normalized
						to <code>2517… / 2519…</code> (no <code>+</code>, no leading
						<code>0</code>); invalid ones are rejected.
					</p>
					<div className='flex items-end gap-2'>
						<div className='flex-1'>
							<Label htmlFor='accounts-file'>File (.csv / .json)</Label>
							<Input
								id='accounts-file'
								ref={fileRef}
								type='file'
								accept='.csv,.json,.txt'
								onChange={(e) => onFileChange(e.target.files?.[0] || null)}
							/>
						</div>
						<Button
							onClick={() => onUpload(selectedFile)}
							disabled={
								uploading ||
								!selectedFile ||
								(preview !== null && preview.valid === 0)
							}
						>
							{uploading ? 'Uploading…' : 'Import'}
						</Button>
					</div>
					{preview && (
						<p
							className={`mt-2 text-xs ${preview.valid === 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}
						>
							{preview.valid} valid row(s), {preview.rejected} rejected.
							{preview.sample.length > 0 && (
								<> Sample: {preview.sample.join(', ')}.</>
							)}
							{preview.valid === 0 && ' No importable rows found.'}
						</p>
					)}
					{uploadMsg && (
						<p className='mt-2 text-xs text-muted-foreground'>{uploadMsg}</p>
					)}
				</Card>
			</div>

			<Card title={`Accounts (${data.accounts.length})`}>
				<DataTable
					columns={columns}
					data={data.accounts}
					meta={{ onDelete, onRefreshWsToken, onToggleEnabled, onCheckBalance }}
					groupOptions={[
						{
							value: 'provider',
							label: 'Group provider',
						},
					]}
					renderMobileRowCard={(account) => (
						<AccountMobileCard
							account={account}
							onDelete={onDelete}
							onRefreshWsToken={onRefreshWsToken}
							onToggleEnabled={onToggleEnabled}
							onCheckBalance={onCheckBalance}
						/>
					)}
				/>
			</Card>
		</div>
	);
}
