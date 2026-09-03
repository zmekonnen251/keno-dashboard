// Small formatting helpers shared by pages.

export function formatTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

// accuracy: { total, wins } | null  -> percentage string like "58.3%"
export function winRate(accuracy: { total?: number; wins?: number } | null | undefined): string {
  const total = accuracy?.total ?? 0;
  if (!total) return '—';
  return `${((((accuracy?.wins ?? 0) / total) * 100)).toFixed(1)}%`;
}

export function formatMoney(n?: number | null): string {
  if (n == null) return '—';
  return n.toLocaleString();
}
