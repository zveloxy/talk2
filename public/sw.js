// Talk2 Service Worker - v6 (Updated Strategy)
const CACHE_NAME = 'talk2-v6';
const ASSETS = [
    '/manifest.json',
    '/icon.png',
    '/logo.svg',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    '/flags/us.svg', '/flags/tr.svg', '/flags/de.svg', '/flags/ru.svg', 
    '/flags/ph.svg', '/flags/es.svg', '/flags/fr.svg', '/flags/it.svg', '/flags/br.svg'
];

// Network-First (Freshness Priority): HTML, JS, CSS
const NETWORK_FIRST = [
    '/', '/index.html', '/chat.html', '/style.css', '/client.js'
];

// Stale-While-Revalidate (Speed + Updates): Locales
// Cache-First: Images, Fonts

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // 1. Exclude API & Socket.io
    if (url.pathname.startsWith('/socket.io/') || url.pathname.startsWith('/api/') || e.request.method !== 'GET') {
        return;
    }

    // 2. Network-First: Updates important files immediately
    if (NETWORK_FIRST.some(path => url.pathname === path || (url.pathname.endsWith('.html') || url.pathname.endsWith('.js') && !url.pathname.includes('sw.js')))) {
        e.respondWith(
            fetch(e.request)
                .then(res => {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                    return res;
                })
                .catch(() => caches.match(e.request))
        );
        return;
    }

    // 3. Stale-While-Revalidate: Locales (json)
    if (url.pathname.startsWith('/locales/')) {
        e.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return cache.match(e.request).then(response => {
                    const fetchPromise = fetch(e.request).then(networkResponse => {
                        cache.put(e.request, networkResponse.clone());
                        return networkResponse;
                    });
                    return response || fetchPromise;
                });
            })
        );
        return;
    }

    // 4. Cache-First: Assets (Images, Fonts, CSS libraries)
    e.respondWith(
        caches.match(e.request).then((res) => {
            return res || fetch(e.request).then(response => {
                return caches.open(CACHE_NAME).then(cache => {
                    cache.put(e.request, response.clone());
                    return response;
                });
            });
        })
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        }).then(() => self.clients.claim())
    );
});
