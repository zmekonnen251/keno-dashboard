'use client';

import { useSite } from './site-provider';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { NotificationsBell } from './notifications-bell';

export default function Header() {
  const { sites, siteId, setSiteId, siteName } = useSite();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header className="flex items-center justify-between gap-3 border-b border-border bg-sidebar px-3 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger />
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold">{siteName}</h1>
          <p className="text-xs text-muted-foreground">Live site: {siteId}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
          <span className="text-xs uppercase tracking-wide">Site</span>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <NotificationsBell />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Toggle theme"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        >
          {resolvedTheme === 'dark' ? <Sun /> : <Moon />}
        </Button>
      </div>
    </header>
  );
}
