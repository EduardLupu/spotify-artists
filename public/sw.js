const WB_VERSION = '6.5.4';
importScripts(`https://storage.googleapis.com/workbox-cdn/releases/${WB_VERSION}/workbox-sw.js`);

if (typeof workbox === 'undefined') {
  console.warn('Workbox failed to load. Offline support is disabled.');
} else {
  workbox.core.setCacheNameDetails({ prefix: 'wta' });
  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  workbox.precaching.precacheAndRoute([]);

  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new workbox.strategies.NetworkFirst({
      cacheName: 'wta-html',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 20,
          purgeOnQuotaError: true,
        }),
      ],
    })
  );

  workbox.routing.registerRoute(
    ({ url }) => url.origin === self.location.origin && url.pathname.endsWith('.json'),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'wta-data',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 60 * 60,
          purgeOnQuotaError: true,
        }),
      ],
    })
  );

  workbox.routing.registerRoute(
    ({ request, url }) =>
      request.destination === 'image' &&
      (url.origin === self.location.origin || url.hostname.endsWith('scdn.co')),
    new workbox.strategies.CacheFirst({
      cacheName: 'wta-images',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 200,
          maxAgeSeconds: 60 * 60 * 24 * 14,
          purgeOnQuotaError: true,
        }),
      ],
    })
  );

  workbox.routing.registerRoute(
    ({ request }) => ['script', 'style', 'font'].includes(request.destination),
    new workbox.strategies.CacheFirst({
      cacheName: 'wta-static',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 60 * 60 * 24 * 30,
          purgeOnQuotaError: true,
        }),
      ],
    })
  );
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
