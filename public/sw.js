self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()))

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  const title = data.title ?? 'New message on Sondar'
  const body  = data.body  ?? 'Someone sent you a message'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:    '/icons/icon-192.svg',
      badge:   '/icons/icon-192.svg',
      tag:     data.tag ?? 'sondar-message',
      data:    { url: data.url ?? '/messages' },
      vibrate: [100, 50, 100],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/messages'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(url) && 'focus' in c) return c.focus()
      }
      return clients.openWindow(url)
    })
  )
})
