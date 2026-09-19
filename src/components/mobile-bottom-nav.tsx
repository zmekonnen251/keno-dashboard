'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  BarChart3,
  Waypoints,
  Sparkles,
  Repeat,
  CloudRain,
  PawPrint,
} from 'lucide-react';
import { useSite } from './site-provider';

interface NavItem {
  href: string;
  label: string;
  icon: any;
}

const MOBILE_NAV: NavItem[] = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/stats', label: 'Stats', icon: BarChart3 },
  { href: '/patterns', label: 'Patterns', icon: Waypoints },
  { href: '/predictions', label: 'Predictions', icon: Sparkles },
  { href: '/autoplay', label: 'Autoplay', icon: Repeat },
  { href: '/rain-accounts', label: 'Rain', icon: CloudRain },
  { href: '/chicken-road-accounts', label: 'Chicken Rd', icon: PawPrint },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const { siteId, setSiteId, sites } = useSite();
  const [showSiteSelector, setShowSiteSelector] = useState(false);

  return (
    <>
      {/* Mobile bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background sm:hidden">
        <div className="flex items-center justify-around px-2 py-2">
          {MOBILE_NAV.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Mobile site selector modal */}
      {showSiteSelector && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowSiteSelector(false)}
          />
          <div className="absolute bottom-20 left-4 right-4 bg-background border border-border rounded-lg shadow-xl p-4">
            <h3 className="text-sm font-semibold mb-3">Select Site</h3>
            <div className="space-y-2">
              {sites.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSiteId(s.id);
                    setShowSiteSelector(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted ${
                    s.id === siteId ? 'bg-muted font-medium' : ''
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Site selector button */}
      <div className="fixed bottom-20 right-4 z-40 sm:hidden">
        <button
          onClick={() => setShowSiteSelector(!showSiteSelector)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-full shadow-lg"
        >
          <span className="text-xs font-medium">{sites.find(s => s.id === siteId)?.name || 'Site'}</span>
        </button>
      </div>
    </>
  );
}
