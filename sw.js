/* WordTap Service Worker：应用外壳离线缓存（Cache-first） */
const CACHE = 'wordtap-shell-v1';
// 全部使用 SW 作用域相对路径，兼容部署在子路径（如 user.github.io/wordtap/）
const PRECACHE = ['./', 'manifest.webmanifest', 'index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // 跨域请求（在线词典 API、TTS 等）：直接网络，不缓存
  if (url.origin !== self.location.origin) return;
  // 导航请求：网络优先，离线回退缓存的首页（相对于 SW 作用域）
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./')),
    );
    return;
  }
  // 静态资源：缓存优先，后台更新
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetched = fetch(e.request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fetched;
    }),
  );
});
