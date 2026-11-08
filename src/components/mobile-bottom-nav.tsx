/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BarChart3,
  Waypoints,
  Sparkles,
  Repeat,
  Users,
  CloudRain,
  Zap,
  // PawPrint,
  TrendingDown,
} from 'lucide-react';
import { useSite } from './site-provider';

interface NavItem {
  href: string;
  label: string;
  icon: any;
  sites?: string[];
  // Hide the item for these sites (mirrors the Expo app's tab filter, e.g.
  // fungames_shamo has no regular Accounts nav item).
  excludeSites?: string[];
}

const MOBILE_NAV: NavItem[] = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/stats', label: 'Stats', icon: BarChart3 },
  { href: '/patterns', label: 'Patterns', icon: Waypoints },
  { href: '/predictions', label: 'Predictions', icon: Sparkles },
  { href: '/autoplay', label: 'Autoplay', icon: Repeat },
  { href: '/accounts', label: 'Accounts', icon: Users, excludeSites: ['fungames_shamo'] },
  { href: '/telebeat', label: 'TeleBeat', icon: Zap, excludeSites: ['fungames_shamo'] },
  { href: '/rain-accounts', label: 'Rain', icon: CloudRain, sites: ['fungames_shamo', 'fungames_tolobirr'] },
  // { href: '/chicken-road-accounts', label: 'Chicken Rd', icon: PawPrint, sites: ['fungames_shamo'] },
  { href: '/odds', label: 'Odd Drops', icon: TrendingDown },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const { siteId } = useSite();

  // Filter navigation items based on current site (exclude rules win).
  const filteredNav = MOBILE_NAV.filter(
    item =>
      (!item.excludeSites || !item.excludeSites.includes(siteId)) &&
      (!item.sites || item.sites.includes(siteId)),
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] sm:hidden">
      {/* Scrolls horizontally when the active site exposes more items than fit. */}
      <div className="flex items-stretch gap-1 overflow-x-auto px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filteredNav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex shrink-0 flex-col items-center gap-1 rounded-lg px-3 py-1 transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
