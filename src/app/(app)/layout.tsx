import { SessionProvider } from '@/components/session-provider';
import { SiteProvider } from '@/components/site-provider';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/sidebar';
import Header from '@/components/header';
import { NotificationProvider } from '@/lib/notifications';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SiteProvider>
        <NotificationProvider>
          <SidebarProvider defaultOpen>
            <div className="hidden sm:block">
              <AppSidebar />
            </div>
            <div className="flex h-dvh min-w-0 flex-1 flex-col">
              <Header />
              <main className="min-h-0 flex-1 overflow-y-auto p-3 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:p-5 sm:pb-5">{children}</main>
            </div>
            <MobileBottomNav />
          </SidebarProvider>
        </NotificationProvider>
      </SiteProvider>
    </SessionProvider>
  );
}
