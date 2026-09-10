'use client';

import { Card as ShadcnCard, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from '@/components/ui/table';

export { Badge };

export function Card({
  title,
  children,
  actions,
  className,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <ShadcnCard className={className}>
      {(title || actions) && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {actions}
        </CardHeader>
      )}
      <CardContent className="p-4">{children}</CardContent>
    </ShadcnCard>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'default' | 'positive' | 'negative' | 'accent';
}) {
  const toneClass = {
    default: 'text-foreground',
    positive: 'text-emerald-600 dark:text-emerald-400',
    negative: 'text-red-600 dark:text-red-400',
    accent: 'text-blue-600 dark:text-blue-400',
  }[tone];
  return (
    <ShadcnCard>
      <CardContent className="p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </ShadcnCard>
  );
}

export function PrettyNumbers({ nums }: { nums: number[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {(nums || []).map((n, i) => (
        <span
          key={i}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-muted text-xs font-semibold text-foreground"
        >
          {n}
        </span>
      ))}
    </span>
  );
}

// Colored number chips for prediction sub-views (ticket / whole draw).
export function Picks({
  nums,
  tone = 'default',
}: {
  nums: number[];
  tone?: 'default' | 'violet' | 'emerald';
}) {
  const toneClass = {
    default: 'bg-muted text-foreground',
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  }[tone];
  return (
    <span className="inline-flex flex-wrap gap-1">
      {(nums || []).map((n, i) => (
        <span
          key={i}
          className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-xs font-semibold ${toneClass}`}
        >
          {n}
        </span>
      ))}
    </span>
  );
}

export function Empty({ label }: { label: string }) {
  return <div className="py-8 text-center text-sm text-muted-foreground">{label}</div>;
}

export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      {message}
    </div>
  );
}

export function DataTable({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {head.map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}

export { TableCell, TableRow };
