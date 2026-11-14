// Cache hors ligne + mise à jour automatique. 202611141706 est remplacé par build.py (un numéro par publication).
// Chaque publication change ce fichier : le navigateur installe alors la nouvelle version, vide l'ancien cache
// et recharge le jeu tout seul.
const VERSION = '202611141706', PREFIX = 'remuntada-v2-', CACHE = PREFIX + VERSION;
const EXTRA = ['./manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './icon-180.png'];
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    const r = await fetch(new Request('./index.html', { cache: 'reload' }));
    if (!r.ok) throw new Error('index ' + r.status);
    // on ne garde le jeu que si c'est bien CETTE version (sinon on réessaiera à la prochaine ouverture)
    const txt = await r.clone().text();
    if (txt.indexOf('<!--build:' + VERSION + '-->') < 0) throw new Error('index pas encore à jour');
    await c.put('./index.html', r);
    await Promise.all(EXTRA.map(u => fetch(new Request(u, { cache: 'reload' })).then(x => { if (x.ok) return c.put(u, x); }).catch(() => {})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  const ready = (async () => {
    const old = (await caches.keys()).filter(k => k.indexOf(PREFIX) === 0 && k !== CACHE);
    await Promise.all(old.map(k => caches.delete(k)));
    await self.clients.claim();
    return old.length;
  })();
  e.waitUntil(ready);
  // une ancienne version était installée : on recharge les fenêtres ouvertes. Hors de waitUntil, sinon le rechargement
  // attendrait la fin de l'activation, qui attendrait le rechargement.
  ready.then(n => {
    if (!n) return;                                // première installation : rien à recharger
    setTimeout(async () => {
      const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const cl of cs) {
        try { cl.postMessage({ type: 'remuntada-update', v: VERSION }); } catch (err) {}
        try { if (cl.navigate) cl.navigate(cl.url).catch(() => {}); } catch (err) {}
      }
    }, 300);
  }).catch(() => {});
});
self.addEventListener('message', e => { if (e.data && e.data.type === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const rq = e.request; if (rq.method !== 'GET') return;
  const u = new URL(rq.url); if (u.origin !== self.location.origin) return;
  if (/\/sw\.js$/.test(u.pathname)) return;        // toujours le réseau
  const page = rq.mode === 'navigate' || /\/(index\.html)?$/.test(u.pathname);
  e.respondWith(caches.open(CACHE).then(c => page ? c.match('./index.html') : c.match(rq, { ignoreSearch: true })).then(r => r || fetch(rq)));
});
