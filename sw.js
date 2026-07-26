// ============================================================
// Noticlima de Notilea — Service Worker v2.0
// Verifica alertas DMH CAP + 20 ciudades PY aunque app cerrada
// ============================================================
const CACHE_NAME     = 'noticlima-v3';
const DMH_WORKER_URL = 'https://noticlima-dmh-worker.lromero585.workers.dev';

// App-shell mínimo: sin esto, un WebAPK instalado que falla la
// primera carga de red no tiene a qué "caer" y Chrome muestra
// "No se puede ejecutar el sitio".
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './favicon.png',
];

const SEVERITY = {
  EXTREME: {priority:4, vibrate:[300,100,300,100,600], requireInteraction:true},
  SEVERE:  {priority:3, vibrate:[200,100,200], requireInteraction:true},
  MODERATE:{priority:2, vibrate:[200], requireInteraction:false},
};

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .catch(() => {}) // no bloquear la instalación si algún asset falla
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;

  // Solo interceptamos GET http(s). Cualquier otra cosa (POST,
  // chrome-extension://, etc.) se deja pasar directo: si el SW
  // llama fetch() sobre eso puede lanzar una excepción y romper
  // la carga entera de la app instalada.
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  if (req.url.includes('open-meteo.com') || req.url.includes('workers.dev')) return;

  // Navegación (abrir/lanzar la app): red primero, y si falla,
  // servir el index.html cacheado en vez de dejar la pantalla en blanco.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Resto de assets: red primero, con fallback a caché y,
  // si tampoco hay caché, se actualiza la caché con lo que llegó.
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) caches.open(CACHE_NAME).then(c => c.put(req, res.clone()));
        return res;
      })
      .catch(() => caches.match(req))
  );
});

// ── Notification click ────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  const url = (e.notification.data && e.notification.data.url) || DMH_WORKER_URL.replace('.workers.dev','') + '/#alertas';
  e.waitUntil(
    self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients => {
      for (const c of clients) {
        if (c.url.includes('notilea') && 'focus' in c) { c.focus(); c.postMessage({type:'SHOW_ALERTS'}); return; }
      }
      self.clients.openWindow('https://lrb1977.github.io/notilea.github.io/#alertas');
    })
  );
});

// ── Periodic Sync (background real) ──────────────────────
self.addEventListener('periodicsync', e => {
  if (e.tag === 'noticlima-check') {
    e.waitUntil(runAllChecks());
  }
});

// ── Mensaje desde la app ──────────────────────────────────
self.addEventListener('message', e => {
  if (!e.data) return;
  if (e.data.type === 'CHECK_NOW') runAllChecks();
  if (e.data.type === 'STORE_LOCATION') {
    self._lat = e.data.lat; self._lon = e.data.lon; self._loc = e.data.location;
  }
});

// ── Verificación completa ─────────────────────────────────
async function runAllChecks() {
  await Promise.all([checkDMH(), checkAlertasPY()]);
}

// 1) Avisos oficiales DMH (feed CAP vía Worker)
async function checkDMH() {
  try {
    const r = await fetch(DMH_WORKER_URL + '/check');
    if (!r.ok) return;
    const d = await r.json();
    if (!d.vigente || !d.isNew) return;

    // Notificar cada aviso nuevo individualmente (usando d.nuevos[] si existe)
    const avisosNuevos = (d.nuevos && d.nuevos.length > 0)
      ? d.nuevos
      : [{title: d.titulo, desc: d.resumen, nivel: d.nivel, link: d.fuente_url}];

    for (const av of avisosNuevos) {
      const titulo = av.title || av.titulo || 'Aviso Oficial DMH Paraguay';
      const resumen = av.desc || av.resumen || '';
      const nivel = (av.nivel === 'ALERTA') ? 'EXTREME' : 'SEVERE';
      const sv = SEVERITY[nivel];
      const tag = 'dmh-' + (av.guid || titulo).slice(0,30).replace(/\s/g,'_');

      await self.registration.showNotification('📡 DMH Paraguay: ' + titulo, {
        body:               resumen ? resumen.slice(0,120) : 'Aviso meteorológico vigente. Toca para ver detalles.',
        icon:               './icon-192.png',
        badge:              './badge-72.png',
        tag,
        renotify:           true,
        requireInteraction: sv.requireInteraction,
        vibrate:            sv.vibrate,
        data:               {url:'#alertas', level:nivel},
        actions: [{action:'ver',title:'Ver aviso'},{action:'dismiss',title:'OK'}],
      });
    }
  } catch(e) {}
}

// 2) Alertas en 20 ciudades de Paraguay (Open-Meteo vía Worker)
async function checkAlertasPY() {
  try {
    const r = await fetch(DMH_WORKER_URL + '/alertas-py');
    if (!r.ok) return;
    const d = await r.json();
    const alertas = (d.alertas || []).filter(a => a.nivel === 'EXTREMO' || a.nivel === 'SEVERO');

    for (const al of alertas) {
      const tag = 'py_' + al.tipo + '_' + al.ciudad;
      // Verificar si ya fue notificada (usando IDB sería ideal pero usamos cache como flag)
      const cached = await caches.open('noticlima-notified');
      const already = await cached.match(new Request('https://flag/' + tag));
      if (already) {
        // Revisar si es vieja (>45 min)
        const ts = await already.text();
        if (Date.now() - parseInt(ts) < 45 * 60000) continue;
      }

      const nivel = al.nivel === 'EXTREMO' ? 'EXTREME' : 'SEVERE';
      const sv = SEVERITY[nivel];
      await self.registration.showNotification(al.titulo, {
        body:               al.body,
        icon:               './icon-192.png',
        badge:              './badge-72.png',
        tag,
        renotify:           true,
        requireInteraction: sv.requireInteraction,
        vibrate:            sv.vibrate,
        data:               {url:'#alertas', level:nivel},
        actions: [{action:'ver',title:'Ver alerta'},{action:'dismiss',title:'OK'}],
      });

      // Guardar timestamp de notificación
      await cached.put(new Request('https://flag/' + tag), new Response(String(Date.now())));
    }
  } catch(e) {}
}
