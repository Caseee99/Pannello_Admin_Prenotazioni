// Service Worker per Gestione Web Push PWA - Pannello Admin Prenotazioni

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Gestione dell'evento Push (notifica in arrivo da backend)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || '🚕 Pannello Prenotazioni';
    const options = {
      body: data.body || 'Nuovo aggiornamento disponibile',
      icon: data.icon || '/icons/icon-192x192.png',
      badge: data.badge || '/icons/badge-72x72.png',
      data: data.data || { url: '/' },
      vibrate: [100, 50, 100],
      actions: [
        { action: 'open', title: 'Apri Pannello' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (err) {
    console.error('[ServiceWorker] Errore parsing notifica push:', err);
  }
});

// Gestione del tocco/click sulla notifica
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
