// Service Worker des Familienplans.
// 1. Zeigt Push-Nachrichten an und öffnet beim Antippen die App.
// 2. Startet die App sofort aus dem Speicher, auch ohne Netz im Supermarkt.
// 3. Sucht im Hintergrund nach einer neuen Fassung und meldet sie der App.

const CACHE = 'familienplan-v5';
const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
const SHELL = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest', 'icons/haus-192.png',
  'js/config.js', 'js/app.js', 'js/logic.js', 'js/store.js', 'js/seed.js', 'js/ferien.js', 'js/abfuhr.js',
  'js/aufgaben.js', 'js/termine.js', 'js/push.js', 'js/naehrwerte.js', 'js/planer.js', 'js/haushalt.js', 'js/packungen.js', 'js/neu.js', 'js/rueckblick.js',
  // Lernplaner: gehört dazu, damit neue Fassungen auch dort ankommen.
  'lernen.html', 'lernen.webmanifest', 'icons/lernen-192.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Einzeln laden, damit eine fehlende Datei nicht alles verhindert.
    await Promise.all(SHELL.map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    await cache.add(new Request(LIB, { mode: 'no-cors' })).catch(() => {});
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

// Startet sofort aus dem Speicher des Handys. Im Hintergrund schaut der Service Worker nach einer neuen Fassung.
// Hat sich etwas geändert, lädt er alle Dateien der App zusammen neu und meldet es der App erst danach,
// damit nie alte und neue Dateien gemischt werden.
let lastCheck = 0;
let checking = null;
async function same(a, b) {
  const x = new Uint8Array(await a.arrayBuffer());
  const y = new Uint8Array(await b.arrayBuffer());
  if (x.length !== y.length) return false;
  for (let i = 0; i < x.length; i += 1) if (x[i] !== y[i]) return false;
  return true;
}
function checkUpdate(force) {
  if (checking) return checking;
  if (!force && Date.now() - lastCheck < 60000) return Promise.resolve();
  lastCheck = Date.now();
  checking = (async () => {
    const cache = await caches.open(CACHE);
    const fresh = await Promise.all(SHELL.map(async (u) => {
      try {
        const res = await fetch(new Request(u, { cache: 'no-cache' }));
        return res && res.ok ? [u, res] : null;
      } catch (err) { return null; }
    }));
    const got = fresh.filter(Boolean);
    // Ohne Netz oder bei Lücken nichts ändern.
    if (got.length < SHELL.length) return;
    let changed = false;
    for (const [u, res] of got) {
      const old = await cache.match(new Request(u), { ignoreSearch: true });
      if (!old || !(await same(old, res.clone()))) { changed = true; break; }
    }
    if (!changed) return;
    await Promise.all(got.map(([u, res]) => cache.put(new Request(u), res)));
    for (const c of await self.clients.matchAll({ type: 'window' })) c.postMessage({ type: 'neue-version' });
  })().finally(() => { checking = null; });
  return checking;
}

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'pruefen') e.waitUntil(checkUpdate(!!e.data.sofort));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const own = url.origin === self.location.origin;
  const lib = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname);
  if (!own && !lib) return; // Datenbank und alles andere laufen unverändert direkt

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Seitenaufrufe mit ?woche=… oder #einkauf sind dieselbe Seite.
    const key = req.mode === 'navigate' ? new Request(url.origin + url.pathname) : req;
    const cached = await cache.match(key, { ignoreSearch: own });
    if (cached) {
      if (req.mode === 'navigate') e.waitUntil(checkUpdate(false));
      return cached;
    }
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) cache.put(key, res.clone()).catch(() => {});
    return res;
  })());
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Familienplan', {
    body: d.body || '',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    lang: 'de',
    icon: 'icons/haus-192.png',
    badge: 'icons/haus-192.png',
    data: { url: d.url || './', actionUrls: d.actionUrls || {} },
    actions: Array.isArray(d.actions) ? d.actions.slice(0, 2) : [],
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const data = e.notification.data || {};
  // Knopf in der Nachricht (z. B. „Ich gehe einkaufen“) hat eine eigene Adresse, sonst die normale.
  const target = (e.action && data.actionUrls && data.actionUrls[e.action]) || data.url || './';
  const url = new URL(target, self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope)) {
        await w.focus();
        if ('navigate' in w) await w.navigate(url).catch(() => {});
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
