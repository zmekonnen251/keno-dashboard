'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getPaymentMethods } from '@/lib/api';
import type { PaymentMethod } from '@/lib/types';

// Radix Select cannot use empty strings as item values, so the "clear" and
// "custom" choices get sentinels and are mapped back to real values below.
const CUSTOM = '__custom__';
const NONE = '__none__';

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Match a stored method (canonical key, an alias, or a numeric id) back to the
// catalogue entry so the select shows the right option when editing.
function findMethod(value: string, methods: PaymentMethod[]): PaymentMethod | null {
  const v = value.trim();
  if (!v) return null;
  if (/^\d+$/.test(v)) return methods.find((m) => m.id === Number(v)) ?? null;
  const n = normalize(v);
  return (
    methods.find((m) => normalize(m.key) === n || m.aliases.some((a) => normalize(a) === n)) ?? null
  );
}

// Payment-method picker shared by the global withdrawal config and the per rain
// account form. Lists the methods the server knows about and falls back to a
// free-text "custom" input (a numeric id or name) for methods we cannot map.
export function PaymentMethodSelect({
  id,
  value,
  onChange,
  emptyLabel,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** When set, adds an option that clears the value (e.g. "Use global default"). */
  emptyLabel?: string;
}) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [customPicked, setCustomPicked] = useState(false);

  useEffect(() => {
    let alive = true;
    getPaymentMethods()
      .then((res) => {
        // Defensive: a payload without `methods` used to crash the whole page
        // (methods became undefined and find/map threw on the next render).
        if (alive) setMethods(res.methods ?? []);
      })
      .catch(() => {
        /* fall back to the custom input only */
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const matched = findMethod(value, methods);
  const showCustom = customPicked || (loaded && value.trim() !== '' && !matched);
  const selected = showCustom ? CUSTOM : matched ? matched.key : emptyLabel ? NONE : '';

  return (
    <div className="space-y-1.5">
      <Select
        value={selected}
        onValueChange={(v) => {
          if (v === CUSTOM) {
            setCustomPicked(true);
            return;
          }
          setCustomPicked(false);
          onChange(v === NONE ? '' : v);
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Select a method" />
        </SelectTrigger>
        <SelectContent>
          {emptyLabel && <SelectItem value={NONE}>{emptyLabel}</SelectItem>}
          {methods.map((m) => (
            <SelectItem key={m.id} value={m.key}>
              {m.label}
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM}>Custom method…</SelectItem>
        </SelectContent>
      </Select>
      {showCustom && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Numeric method id (e.g. 7) or name"
        />
      )}
    </div>
  );
}
