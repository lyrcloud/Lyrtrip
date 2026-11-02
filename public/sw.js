// Lyrtrip push notifications: booking updates sent by the API (see infra/lambda/notify.mjs)
self.addEventListener('push', event => {
  let msg = {};
  try { msg = event.data ? event.data.json() : {}; } catch { msg = { title: event.data?.text() }; }
  event.waitUntil(self.registration.showNotification(msg.title || 'Lyrtrip', {
    body: msg.body && msg.body !== msg.title ? msg.body : undefined,
    icon: '/logo.png',
    badge: '/logo.png',
    data: { url: msg.url || '/dashboard' },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => c.url.startsWith(self.location.origin) && 'focus' in c);
    if (open && url.startsWith(self.location.origin)) return open.navigate(url).then(c => c?.focus());
    return clients.openWindow(url);
  }));
});
