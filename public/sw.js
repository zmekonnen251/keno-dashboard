// Service worker for full-match win and rain-claim push notifications.
// Served statically at /sw.js and registered on demand from the autoplay page.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === 'string' ? data.title : 'Keno notification';
  const body = typeof data.body === 'string' ? data.body : 'You have a new update.';
  const url = typeof data.url === 'string' ? data.url : '/autoplay';
  const isRain = !!data.rainId;
  const tag = isRain
    ? `keno-rain-${data.rainId}-${data.accountId ?? ''}`
    : `keno-win-${(data.spots || []).join(',')}-${data.accountId ?? ''}`;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url },
      tag,
      renotify: true,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/autoplay';
  let pathname = '/';
  try { pathname = new URL(url, self.location.origin).pathname; } catch {}
  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of windows) {
        try {
          if (new URL(w.url, self.location.origin).pathname === pathname) {
            await w.focus();
            return;
          }
        } catch { /* skip malformed */ }
      }
      await clients.openWindow(url);
    })(),
  );
});