'use client';

import { useSite } from './site-provider';
import { useSession } from './session-provider';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Moon, Sun, ChevronDown } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { NotificationsBell } from './notifications-bell';
import { useState } from 'react';

export default function Header() {
  const { sites, siteId, setSiteId, siteName } = useSite();
  const { isAdmin } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const [showMobileSiteSelector, setShowMobileSiteSelector] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex shrink-0 items-center justify-between gap-2 border-b border-border bg-sidebar px-3 py-2 sm:gap-3 sm:px-5 sm:py-3">
      <div className="flex min-w-0 items-center gap-2">
        <div className="hidden sm:block">
          <SidebarTrigger />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold sm:text-base">{siteName}</h1>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">Live site: {siteId}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Site switching is admin-only; viewers are pinned to shamo. */}
        {isAdmin && <div className="sm:hidden relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMobileSiteSelector(!showMobileSiteSelector)}
            className="flex items-center gap-1"
          >
            <span className="text-xs">Site</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
          {showMobileSiteSelector && (
            <div className="absolute right-0 top-full mt-2 z-50 bg-background border border-border rounded-lg shadow-lg p-2 min-w-50">
              {sites.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSiteId(s.id);
                    setShowMobileSiteSelector(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted ${
                    s.id === siteId ? 'bg-muted font-medium' : ''
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>}

        {/* Desktop site selector */}
        {isAdmin && <label className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
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
        </label>}
        <NotificationsBell />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Toggle theme"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        >
          {/* Render both icons and switch with CSS: resolvedTheme is undefined
              during SSR, so picking the icon in JS made the server and client
              render different SVG trees (React hydration error #418). */}
          <Sun className="hidden dark:block" />
          <Moon className="block dark:hidden" />
        </Button>
      </div>
    </header>
  );
}
