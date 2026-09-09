'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/lib/notifications';

const KIND_DOT: Record<string, string> = {
  win: 'bg-emerald-500',
  info: 'bg-sky-500',
  error: 'bg-red-500',
};

export function NotificationsBell() {
  const { notifications, unread, clear, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  function toggle() {
    if (!open) markAllRead();
    setOpen((v) => !v);
  }

  return (
    <div className='relative'>
      <Button variant='ghost' size='icon-sm' aria-label='Notifications' onClick={toggle}>
        <span className='relative'>
          <Bell />
          {unread > 0 && (
            <span className='absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold text-white'>
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </span>
      </Button>

      {open && (
        <>
          <div className='fixed inset-0 z-40' onClick={() => setOpen(false)} />
          <div className='absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-background shadow-xl sm:w-96'>
            <div className='flex items-center justify-between border-b border-border px-4 py-2.5'>
              <span className='text-sm font-bold text-foreground'>Notifications</span>
              <div className='flex items-center gap-1'>
                <Link
                  href='/logs'
                  onClick={() => setOpen(false)}
                  className='rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground'
                >
                  View all
                </Link>
                <button
                  onClick={clear}
                  className='rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground'
                >
                  Clear
                </button>
              </div>
            </div>
            <div className='max-h-96 overflow-y-auto'>
              {notifications.length === 0 ? (
                <p className='px-4 py-8 text-center text-xs text-muted-foreground'>
                  No notifications yet. Full-match wins will appear here.
                </p>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className='flex items-start gap-2.5 border-b border-border/60 px-4 py-2.5 last:border-0'>
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${KIND_DOT[n.kind] || 'bg-sky-500'}`} />
                    <div className='min-w-0'>
                      <p className='text-xs text-foreground'>{n.text}</p>
                      <p className='mt-0.5 font-mono text-[10px] text-muted-foreground'>
                        {new Date(n.at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
