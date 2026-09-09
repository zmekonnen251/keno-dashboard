import { SiteProvider } from '@/components/site-provider';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/sidebar';
import Header from '@/components/header';
import { NotificationProvider } from '@/lib/notifications';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteProvider>
      <NotificationProvider>
        <SidebarProvider defaultOpen>
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header />
            <main className="flex-1 overflow-y-auto p-4 sm:p-5">{children}</main>
          </div>
        </SidebarProvider>
      </NotificationProvider>
    </SiteProvider>
  );
}
