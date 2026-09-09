// Service worker for full-match win push notifications.
// Served statically at /sw.js and registered on demand from the autoplay page.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === 'string' ? data.title : 'Keno full match!';
  const body = typeof data.body === 'string' ? data.body : 'One of your tickets matched every spot.';
  const url = typeof data.url === 'string' ? data.url : '/autoplay';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url },
      tag: `keno-win-${(data.spots || []).join(',')}-${data.accountId ?? ''}`,
      renotify: true,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/autoplay';
  event.waitUntil(
    (async () => {
      const wins = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const win of wins) {
        if (win.url.includes('/autoplay')) {
          await win.focus();
          return;
        }
      }
      await clients.openWindow(url);
    })(),
  );
});
