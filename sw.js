/* 850 Basic English — service worker.
 * Precaches the app shell + dataset; stale-while-revalidate for everything else.
 * Only active when served over http(s); the app also works from file:// without it.
 */
'use strict';

var CACHE = 'b850-v2';
var SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './data/words.js',
  './js/store.js',
  './js/srs.js',
  './js/speech.js',
  './js/app.js',
  './js/modes/common.js',
  './js/modes/home.js',
  './js/modes/flashcards.js',
  './js/modes/quiz.js',
  './js/modes/typing.js',
  './js/modes/spelling.js',
  './js/modes/review.js',
  './js/modes/stats.js',
  './js/modes/settings.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(SHELL); }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') { return; }
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) { return; } // never touch the network for other origins

  event.respondWith(
    caches.match(req).then(function (hit) {
      var fetchPromise = fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || fetchPromise;
    })
  );
});
