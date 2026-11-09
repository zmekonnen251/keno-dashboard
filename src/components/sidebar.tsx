'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  BarChart3,
  Sparkles,
  Users,
  Repeat,
  ShieldCheck,
  BellRing,
  CloudRain,
  PawPrint,
  TrendingDown,
  UserCog,
  LogOut,
  Moon,
  Sun,
  Zap,
  Server,
  UsersRound,
  Wallet,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import { logout } from '@/lib/api';
import { useSite } from '@/components/site-provider';
import { useSession } from '@/components/session-provider';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  sites?: string[];
}

const STATIC_NAV: NavItem[] = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard, end: true },
  { href: '/stats', label: 'Stats', icon: BarChart3 },
  { href: '/ml-alerts', label: 'ML Alerts', icon: BellRing },
  { href: '/autoplay', label: 'Autoplay', icon: Repeat },
  { href: '/accounts', label: 'Accounts', icon: UsersRound },
  {href: '/rain-accounts', label: 'Rain Accounts', icon: CloudRain},
  { href: '/odds', label: 'Odd Drops', icon: TrendingDown },
  { href: '/users', label: 'Users', icon: UserCog },
];

// Viewers get the assigned-account surfaces only: the shamo rain autoplay page
// and the withdrawal-account page.
const VIEWER_NAV: NavItem[] = [
  { href: '/autoplay', label: 'Rain Autoplay', icon: Repeat },
  { href: '/withdrawal-account', label: 'Withdrawal Account', icon: Wallet },
];

const PROVIDER_NAV: NavItem[] = [
  { href: '/accounts', label: 'Accounts', icon: Users, sites: ['fungames_tolobirr', 'phoenixbet'] },
  { href: '/proxies', label: 'Proxies', icon: ShieldCheck, sites: ['fungames_tolobirr', 'phoenixbet'] },
  { href: '/telebeat', label: 'TeleBeat', icon: Zap, sites: ['fungames_tolobirr', 'phoenixbet'] },
  { href: '/rain-accounts', label: 'Rain', icon: CloudRain, sites: ['fungames_shamo', 'fungames_tolobirr'] },
  { href: '/chicken-road-accounts', label: 'Chicken Road', icon: PawPrint, sites: ['fungames_shamo'] },
  { href: '/providers', label: 'Providers', icon: Server },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { siteId } = useSite();
  const { isAdmin, loading: sessionLoading } = useSession();
  const [busy, setBusy] = useState(false);
  const {state} = useSidebar();
  const [providers, setProviders] = useState<string[]>([]);
  
  // Fetch providers dynamically (admin-only endpoint; viewers never need it).
  useEffect(() => {
    if (!isAdmin) return;
    async function loadProviders() {
      try {
        const res = await fetch('/api/providers?includeInactive=true');
        const data = await res.json();
        if (data.ok && data.providers) {
          setProviders(data.providers.map((p: { code: string }) => p.code));
        }
      } catch {
        // fallback to defaults
        setProviders(['fungames_shamo', 'fungames_tolobirr', 'phoenixbet']);
      }
    }
    loadProviders();
  }, [isAdmin]);
  
  // Show provider nav only for providers that exist and match the active site,
  // mirroring the mobile bottom nav's per-site rules.
  const filteredNav = !isAdmin
    ? VIEWER_NAV
    : [
        ...STATIC_NAV,
        ...PROVIDER_NAV.filter(
          item => !item.sites || (providers.includes(siteId) && item.sites.includes(siteId)),
        ),
      ];
  const navItems = sessionLoading ? [] : filteredNav;
  
  async function onLogout() {
    setBusy(true);
    try {
      await logout();
    } finally {
      setBusy(false);
      router.push('/login');
      router.refresh();
    }
  }
  
  return (
		<Sidebar collapsible='icon'>
			<SidebarHeader>
				{state === 'collapsed' ? (
					<div className='flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground'>
						<Sparkles className='h-4 w-4' />
					</div>
				) : (
					<div className='flex items-center gap-2 px-2 py-1'>
						<div className='flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground'>
							<Sparkles className='h-4 w-4' />
						</div>
						<div className='leading-tight'>
							<div className='text-sm font-bold'>Keno Control</div>
							<div className='text-xs text-muted-foreground'>
								Predictive engine
							</div>
						</div>
					</div>
				)}
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Navigation</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{navItems.map((item) => {
								const active = item.end
									? pathname === item.href
									: pathname === item.href ||
										pathname.startsWith(item.href + '/');
								const Icon = item.icon;
								return (
									<SidebarMenuItem key={item.href} className='my-1'>
										<SidebarMenuButton asChild isActive={active}>
											<Link href={item.href}>
												<Icon />
												<span>{item.label}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
      <SidebarFooter>
        <SidebarGroupLabel>Actions</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem className='my-1'>
              <SidebarMenuButton asChild>
                <Button
                  variant='ghost'
                  size='sm'
                  className='w-full justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive'
                  onClick={onLogout}
                  disabled={busy}
                >
                  <LogOut />
                  <span>{busy ? 'Signing out…' : 'Sign out'}</span>
                </Button>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem className='my-1'>
              <SidebarMenuButton asChild>
                <Button
                  variant='ghost'
                  size='sm'
                  className='w-full justify-start gap-2'
                  onClick={() =>
                    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
                  }
                >
                  {/* CSS-switched so server and client render identical trees —
                      see header.tsx (hydration error #418). */}
                  <Sun className="hidden dark:block" />
                  <Moon className="block dark:hidden" />
                  <span>Toggle theme</span>
                </Button>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarFooter>
		</Sidebar>
	);
}