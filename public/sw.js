// Satori Media Asset Cache Service Worker (v1.3)
const MEDIA_CACHE_NAME = 'satori-media-assets-v1.3';

// Domains and patterns designated for Cache-First image caching
const MEDIA_DOMAINS = [
  's4.anilist.co',
  'uploads.mangadex.org',
  'images.unsplash.com',
  'coverImage',
  'media.kitsu.io',
  'cdn.myanimelist.net',
];

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp|avif|gif|svg)(\?.*)?$/i;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== MEDIA_CACHE_NAME && key.startsWith('satori-media-')) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests and non-http protocols
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Check if the request is an image or targeted media asset
  const isImageDestination = request.destination === 'image';
  const isImageExtension = IMAGE_EXTENSIONS.test(url.pathname);
  const isMediaDomain = MEDIA_DOMAINS.some((domain) => url.hostname.includes(domain));

  if (isImageDestination || isImageExtension || isMediaDomain) {
    event.respondWith(
      caches.open(MEDIA_CACHE_NAME).then(async (cache) => {
        // 1. Cache-First check
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // 2. Network Fetch & Cache
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            cache.put(request, networkResponse.clone()).catch(() => {
              // Cache quota exceeded or write failure handled silently
            });
          }
          return networkResponse;
        } catch (err) {
          // If offline and not in cache, fallback to empty or return nothing
          return cachedResponse || new Response('', { status: 408, headers: { 'Content-Type': 'image/svg+xml' } });
        }
      })
    );
  }
});
