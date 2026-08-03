'use strict';

const CACHE_PREFIX = 'vavr-shell-';
const CACHE_NAME = CACHE_PREFIX + '2026-08-03-02';
const SHELL_PATHS = [
  './',
  './index.html',
  './valsang-engine.js',
  './hardfork-engine.js',
  './ordekon-kelly.js',
  './ordekon-engine.js',
  './ordekon-worker.js',
  './manifest.webmanifest',
  './icons/vavr-icon.svg',
  './icons/vavr-180.png',
  './icons/vavr-192.png',
  './icons/vavr-512.png',
  './icons/vavr-maskable-512.png'
];

const shellUrls = () => SHELL_PATHS.map(path => new URL(path, self.registration.scope).href);
const indexUrl = () => new URL('./index.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(shellUrls()))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.href.startsWith(scope.href)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(indexUrl(), response.clone());
          }
          return response;
        } catch (error) {
          return caches.match(indexUrl());
        }
      })()
    );
    return;
  }

  if (shellUrls().includes(url.href)) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request))
    );
  }
});
