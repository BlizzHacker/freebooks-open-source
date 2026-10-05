/*
 * FreeBooks install service worker.
 * Financial documents, API responses, and app pages are never cached here.
 * Browsers always request current content from the selected server.
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
