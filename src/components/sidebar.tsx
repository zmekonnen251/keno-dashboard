'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  BarChart3,
  Waypoints,
  Sparkles,
  Lightbulb,
  Radio,
  Users,
  Repeat,
  ShieldCheck,
  Handshake,
  ScrollText,
  BellRing,
  CloudRain,
  PawPrint,
  TrendingDown,
  UserCog,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState } from 'react';
import { logout } from '@/lib/api';
import { useSite } from '@/components/site-provider';
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

const NAV = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard, end: true },
  { href: '/stats', label: 'Stats', icon: BarChart3 },
  { href: '/patterns', label: 'Patterns', icon: Waypoints },
  { href: '/predictions', label: 'Predictions', icon: Sparkles },
  { href: '/ml-alerts', label: 'ML Alerts', icon: BellRing },
  { href: '/insights', label: 'Insights', icon: Lightbulb },
  { href: '/sessions', label: 'Sessions', icon: Radio },
  { href: '/accounts', label: 'Accounts', icon: Users, sites: ['fungames_tolobirr', 'phoenixbet'] },
  { href: '/autoplay', label: 'Autoplay', icon: Repeat },
  { href: '/proxies', label: 'Proxies', icon: ShieldCheck, sites: ['fungames_tolobirr', 'phoenixbet'] },
  { href: '/rain-accounts', label: 'Rain', icon: CloudRain, sites: ['fungames_shamo', 'fungames_tolobirr'] },
  { href: '/chicken-road-accounts', label: 'Chicken Road', icon: PawPrint, sites: ['fungames_shamo'] },
  { href: '/odds', label: 'Odd Drops', icon: TrendingDown },
  { href: '/clients', label: 'Clients', icon: Handshake },
  { href: '/logs', label: 'Logs', icon: ScrollText },
  { href: '/users', label: 'Users', icon: UserCog },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { siteId } = useSite();
  const [busy, setBusy] = useState(false);
  const {state} = useSidebar();
  
  // Filter navigation items based on current site
  const filteredNav = NAV.filter(item => !item.sites || item.sites.includes(siteId));
  
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
							{filteredNav.map((item) => {
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
                  {resolvedTheme === 'dark' ? <Sun /> : <Moon />}
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
