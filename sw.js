// ============================================================
// Noticlima de Notilea — Service Worker v2.0
// Verifica alertas DMH CAP + 20 ciudades PY aunque app cerrada
// ============================================================
const CACHE_NAME     = 'noticlima-v2';
const DMH_WORKER_URL = 'https://noticlima-dmh-worker.lromero585.workers.dev';

const SEVERITY = {
  EXTREME: {priority:4, vibrate:[300,100,300,100,600], requireInteraction:true},
  SEVERE:  {priority:3, vibrate:[200,100,200], requireInteraction:true},
  MODERATE:{priority:2, vibrate:[200], requireInteraction:false},
};

self.addEventListener('install',  e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', e => {
  if (e.request.url.includes('open-meteo.com') || e.request.url.includes('workers.dev')) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
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
    if (d.vigente && d.isNew) {
      const nivel = d.nivel === 'ALERTA' ? 'EXTREME' : 'SEVERE';
      const sv = SEVERITY[nivel];
      await self.registration.showNotification('📡 Aviso Oficial DMH Paraguay', {
        body:               d.titulo + (d.resumen ? ' — ' + d.resumen.slice(0,100) : ''),
        icon:               './icon-192.png',
        badge:              './badge-72.png',
        tag:                'dmh-cap',
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
