'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit, Eye, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { getProviders, createProvider, updateProvider, deleteProvider, getDefaultProvider } from '@/lib/api';
import { ProviderSummary } from '@/lib/types';
import { Empty } from '@/components/app';

interface Provider {
  id: number;
  code: string;
  name: string;
  base_url: string;
  api_base_url: string;
  gateway_ws_url: string | null;
  spin_wheel_config: {
    enabled: boolean;
    spin_url?: string;
    check_url?: string;
    cost_per_spin?: number;
  } | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface ProvidersResponse {
  ok: boolean;
  providers: Provider[];
  error?: string;
}

interface ProviderResponse {
  ok: boolean;
  provider?: Provider;
  error?: string;
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    base_url: '',
    api_base_url: '',
    gateway_ws_url: '',
    spin_enabled: false,
    spin_url: '',
    check_url: '',
    cost_per_spin: 1,
    is_active: true,
    is_default: false,
  });

  async function loadProviders() {
    setLoading(true);
    try {
      const res = await fetch('/api/providers?includeInactive=true');
      const data: ProvidersResponse = await res.json();
      if (data.ok) {
        setProviders(data.providers);
      } else {
        setMsg(data.error || 'Failed to load providers');
      }
    } catch (e) {
      setMsg('Failed to load providers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProviders();
  }, []);

  function resetForm() {
    setFormData({
      code: '',
      name: '',
      base_url: '',
      api_base_url: '',
      gateway_ws_url: '',
      spin_enabled: false,
      spin_url: '',
      check_url: '',
      cost_per_spin: 1,
      is_active: true,
      is_default: false,
    });
    setEditing(null);
    setShowCreate(false);
  }

  function handleEdit(provider: Provider) {
    setFormData({
      code: provider.code,
      name: provider.name,
      base_url: provider.base_url,
      api_base_url: provider.api_base_url,
      gateway_ws_url: provider.gateway_ws_url || '',
      spin_enabled: provider.spin_wheel_config?.enabled ?? false,
      spin_url: provider.spin_wheel_config?.spin_url ?? '',
      check_url: provider.spin_wheel_config?.check_url ?? '',
      cost_per_spin: provider.spin_wheel_config?.cost_per_spin ?? 1,
      is_active: provider.is_active,
      is_default: provider.is_default,
    });
    setEditing(provider);
    setShowCreate(false);
  }

  async function handleCreate() {
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: formData.code,
          name: formData.name,
          base_url: formData.base_url,
          api_base_url: formData.api_base_url,
          gateway_ws_url: formData.gateway_ws_url || null,
          spin_wheel_config: formData.spin_enabled ? {
            enabled: formData.spin_enabled,
            spin_url: formData.spin_url,
            check_url: formData.check_url,
            cost_per_spin: formData.cost_per_spin,
          } : undefined,
          is_active: formData.is_active,
          is_default: formData.is_default,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMsg('Provider created successfully');
        await loadProviders();
        resetForm();
      } else {
        setMsg(data.error || 'Failed to create provider');
      }
    } catch (e) {
      setMsg('Failed to create provider');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!editing) return;
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch(`/api/providers/${editing.code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          base_url: formData.base_url,
          api_base_url: formData.api_base_url,
          gateway_ws_url: formData.gateway_ws_url || null,
          spin_wheel_config: formData.spin_enabled ? {
            enabled: formData.spin_enabled,
            spin_url: formData.spin_url,
            check_url: formData.check_url,
            cost_per_spin: formData.cost_per_spin,
          } : null,
          is_active: formData.is_active,
          is_default: formData.is_default,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMsg('Provider updated successfully');
        await loadProviders();
        resetForm();
      } else {
        setMsg(data.error || 'Failed to update provider');
      }
    } catch (e) {
      setMsg('Failed to update provider');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(provider: Provider) {
    if (!window.confirm(`Delete "${provider.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/providers/${provider.code}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        setMsg('Provider deleted');
        await loadProviders();
      } else {
        setMsg(data.error || 'Failed to delete provider');
      }
    } catch (e) {
      setMsg('Failed to delete provider');
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Provider Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage API providers and their spin-wheel configurations
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreate(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add Provider
        </Button>
      </div>

      {msg && (
        <div className="text-sm text-emerald-600 dark:text-emerald-400 mb-4">{msg}</div>
      )}

      {(showCreate || editing) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{editing ? 'Edit Provider' : 'Create Provider'}</CardTitle>
            <CardDescription>
              Configure API endpoints and spin-wheel settings for a provider
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); editing ? handleUpdate() : handleCreate(); }} className="space-y-4 max-w-2xl">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="code">Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase() })}
                    placeholder="e.g. fungames_shamo"
                    disabled={!!editing}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Display Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Fungames Shamo"
                    required
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="base_url">Base URL *</Label>
                  <Input
                    id="base_url"
                    value={formData.base_url}
                    onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                    placeholder="https://shamo.bet"
                    required
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="api_base_url">API Base URL *</Label>
                  <Input
                    id="api_base_url"
                    value={formData.api_base_url}
                    onChange={(e) => setFormData({ ...formData, api_base_url: e.target.value })}
                    placeholder="https://api.tolobirr.com"
                    required
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="gateway_ws_url">Gateway WebSocket URL</Label>
                  <Input
                    id="gateway_ws_url"
                    value={formData.gateway_ws_url}
                    onChange={(e) => setFormData({ ...formData, gateway_ws_url: e.target.value })}
                    placeholder="wss://gateway.fungames.live/v2/ws"
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.spin_enabled}
                    onChange={(e) => setFormData({ ...formData, spin_enabled: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="font-medium">Enable Spin Wheel</span>
                </Label>
              </div>

              {formData.spin_enabled && (
                <div className="border rounded-lg p-4 space-y-4">
                  <h4 className="font-medium">Spin Wheel Configuration</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="spin_url">Spin URL *</Label>
                      <Input
                        id="spin_url"
                        value={formData.spin_url}
                        onChange={(e) => setFormData({ ...formData, spin_url: e.target.value })}
                        placeholder="https://nodes.cloudflareworkers.io/spin-wheel/spin/"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="check_url">Check URL *</Label>
                      <Input
                        id="check_url"
                        value={formData.check_url}
                        onChange={(e) => setFormData({ ...formData, check_url: e.target.value })}
                        placeholder="https://nodes.cloudflareworkers.io/spin-wheel/wheel/"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cost_per_spin">Cost Per Spin (tokens) *</Label>
                      <Input
                        id="cost_per_spin"
                        type="number"
                        min="1"
                        value={formData.cost_per_spin}
                        onChange={(e) => setFormData({ ...formData, cost_per_spin: Number(e.target.value) })}
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t">
                <Label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span>Active</span>
                </Label>
                <Label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span>Default Provider</span>
                </Label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : (editing ? 'Update' : 'Create')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Providers ({providers.length})</CardTitle>
          <CardDescription>
            Configure API providers and their spin-wheel settings. Only one default provider is allowed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : providers.length === 0 ? (
            <Empty label="No providers configured. Click 'Add Provider' to create one." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Base URL</TableHead>
                    <TableHead>API Base URL</TableHead>
                    <TableHead className="text-center">Spin Wheel</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Default</TableHead>
                    <TableHead className="w-48">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providers.map((provider) => (
                    <TableRow key={provider.code}>
                      <TableCell className="font-medium">{provider.name}</TableCell>
                      <TableCell className="font-mono text-sm">{provider.code}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-xs">{provider.base_url}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-xs">{provider.api_base_url}</TableCell>
                      <TableCell className="text-center">
                        {provider.spin_wheel_config?.enabled ? (
                          <Badge variant="default" className="bg-emerald-100 text-emerald-800">
                            <CheckCircle className="h-3 w-3 mr-1" /> Enabled
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {provider.is_active ? (
                          <Badge className="bg-emerald-100 text-emerald-800">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {provider.is_default ? (
                          <Badge className="bg-blue-100 text-blue-800">Default</Badge>
                        ) : (
                          <Badge variant="secondary">—</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(provider)}
                            title="Edit"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(provider)}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(dateStr: string) {
  return format(new Date(dateStr), 'MMM d, yyyy HH:mm');
}