// Talk2 Service Worker - v4 (Cache bust)
const CACHE_NAME = 'talk2-v4';
const ASSETS = [
    '/manifest.json',
    '/icon.png',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// HTML and JS files should use network-first strategy
const NETWORK_FIRST = [
    '/',
    '/index.html',
    '/chat.html',
    '/style.css',
    '/client.js'
];

self.addEventListener('install', (e) => {
    // Skip waiting to activate immediately
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    // Skip socket.io and api requests
    if (e.request.url.includes('/socket.io/') || e.request.url.includes('/api/')) {
        return;
    }

    const url = new URL(e.request.url);
    
    // Network-first for HTML, CSS, JS files
    if (NETWORK_FIRST.some(path => url.pathname === path || url.pathname.endsWith('.html') || url.pathname.endsWith('.css') || url.pathname.endsWith('.js'))) {
        e.respondWith(
            fetch(e.request)
                .then(res => {
                    // Clone and cache
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                    return res;
                })
                .catch(() => caches.match(e.request))
        );
        return;
    }

    // Cache-first for other assets (fonts, icons)
    e.respondWith(
        caches.match(e.request).then((res) => {
            return res || fetch(e.request);
        })
    );
});

self.addEventListener('activate', (e) => {
    // Claim all clients immediately
    e.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches.keys().then((keyList) => {
                return Promise.all(keyList.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('Deleting old cache:', key);
                        return caches.delete(key);
                    }
                }));
            })
        ])
    );
});
