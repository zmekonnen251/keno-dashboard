'use client';

import { useState } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '@/lib/api';
import type { User } from '@/lib/types';
import { useApi } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, Empty, ErrorBox, Loading, Badge, TableCell, TableRow } from '@/components/app';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
} from '@/components/ui/table';
import { Modal } from '@/components/ui/modal';
import { formatTime } from '@/lib/format';

// Dashboard login accounts. Backed by /api/users (admin-only CRUD): create,
// change role / display name / active, reset password, delete. Created users can
// sign in with username + password on the login page; both roles get a session
// cookie, but only role=admin can reach the admin REST routes.

interface UserFormInput {
  username: string;
  password: string;
  role: 'admin' | 'viewer';
  displayName: string | null;
  isActive: boolean;
}

function RoleBadge({ role }: { role: User['role'] }) {
  return role === 'admin' ? (
    <Badge className="bg-violet-600 text-white">Admin</Badge>
  ) : (
    <Badge variant="secondary">Viewer</Badge>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge className="bg-emerald-600 text-white">Active</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Disabled
    </Badge>
  );
}

function UserForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: User | null;
  onSave: (input: UserFormInput) => Promise<void>;
  onCancel: () => void;
}) {
  const editing = initial !== null;
  const [username, setUsername] = useState(initial?.username ?? '');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '');
  const [role, setRole] = useState<'admin' | 'viewer'>(initial?.role ?? 'viewer');
  const [active, setActive] = useState(initial?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!editing && !username.trim()) {
      setError('Username is required.');
      return;
    }
    if (!editing && !password) {
      setError('Password is required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave({
        username: username.trim(),
        password,
        role,
        displayName: displayName.trim() || null,
        isActive: active,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-3"
    >
      <div>
        <Label htmlFor="user-username">Username</Label>
        <Input
          id="user-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={editing}
          autoFocus={!editing}
          placeholder="e.g. operator"
        />
      </div>
      <div>
        <Label htmlFor="user-password">{editing ? 'New password (optional)' : 'Password'}</Label>
        <Input
          id="user-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={editing ? 'Leave blank to keep current password' : ''}
        />
      </div>
      <div>
        <Label htmlFor="user-display">Display name (optional)</Label>
        <Input
          id="user-display"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Shown in the UI"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="user-role">Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'viewer')}>
            <SelectTrigger id="user-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin — full access</SelectItem>
              <SelectItem value="viewer">Viewer — read only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {editing && (
          <div>
            <Label htmlFor="user-active">Status</Label>
            <Select value={active ? 'active' : 'disabled'} onValueChange={(v) => setActive(v === 'active')}>
              <SelectTrigger id="user-active" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Create user'}
        </Button>
      </div>
    </form>
  );
}

export default function UsersPage() {
  const { data, error, loading, refresh } = useApi(() => getUsers(), []);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [actionError, setActionError] = useState('');

  async function saveNew(input: UserFormInput) {
    await createUser({
      username: input.username,
      password: input.password,
      role: input.role,
      displayName: input.displayName,
    });
    setAdding(false);
    refresh();
  }

  async function saveEdit(input: UserFormInput) {
    if (!editing) return;
    await updateUser(editing.id, {
      ...(input.password ? { password: input.password } : {}),
      role: input.role,
      displayName: input.displayName,
      isActive: input.isActive,
    });
    setEditing(null);
    refresh();
  }

  async function remove(user: User) {
    if (!window.confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;
    setActionError('');
    try {
      await deleteUser(user.id);
      refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  const users = data?.users ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Users</h2>
          <p className="text-sm text-muted-foreground">
            Dashboard accounts and their roles. Created users sign in with their username and password.
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>Add user</Button>
      </div>

      {actionError && <ErrorBox message={actionError} />}

      <Card>
        {loading ? (
          <Loading rows={4} />
        ) : error ? (
          <ErrorBox message={error} />
        ) : users.length === 0 ? (
          <Empty label="No users yet — add one to get started." />
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Display name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.username}</TableCell>
                  <TableCell className="text-muted-foreground">{u.displayName || '—'}</TableCell>
                  <TableCell>
                    <RoleBadge role={u.role} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge active={u.isActive} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatTime(u.createdAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatTime(u.lastLoginAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditing(u)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-rose-600 hover:text-rose-700 dark:text-rose-400"
                        onClick={() => void remove(u)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}
      </Card>

      {adding && (
        <Modal title="Add user" onClose={() => setAdding(false)}>
          <UserForm initial={null} onSave={saveNew} onCancel={() => setAdding(false)} />
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit ${editing.username}`} onClose={() => setEditing(null)}>
          <UserForm initial={editing} onSave={saveEdit} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}
