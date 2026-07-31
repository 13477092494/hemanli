/* 禾蔓里·美甲美睫工作室 - 离线缓存 Service Worker
   策略：
   - HTML（index.html / demo.html / 导航请求）→ 网络优先，拿到新版立即用，断网回落缓存
     （这样手机/iPad 上已安装的 App 每次联网打开都能自动拿到最新功能）
   - 图标 / manifest 等静态资源 → 缓存优先，省流量
   ⚠️ 每次发版请把下面的 CACHE 版本号 +1 */
const CACHE = 'hemanli-v3';
const ASSETS = [
  './',
  './index.html',
  './demo.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png',
  './icon-180.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isHtml(request, url) {
  return request.mode === 'navigate' ||
         (request.destination === 'document') ||
         /\.html?$/i.test(url.pathname) ||
         url.pathname.endsWith('/');
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // 仅处理同源请求；跨域（如二维码 API、Supabase SDK）不缓存，直接放行
  if (url.origin !== self.location.origin) return;

  if (isHtml(event.request, url)) {
    // 网络优先：有网就用最新版，同时刷新缓存；断网用缓存
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE).then((c) => c.put(event.request, clone));
          }
          return resp;
        })
        .catch(() =>
          caches.match(event.request).then((c) => c || caches.match('./index.html'))
        )
    );
    return;
  }

  // 静态资源：缓存优先
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((resp) => {
          if (resp && resp.ok && resp.type === 'basic') {
            const clone = resp.clone();
            caches.open(CACHE).then((c) => c.put(event.request, clone));
          }
          return resp;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});

/* 支持页面主动触发更新 */
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
