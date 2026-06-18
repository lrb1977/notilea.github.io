// ============================================================
// Noticlima de Notilea — Service Worker v1.1
// Maneja notificaciones push de tiempo severo (CAP/WMO) + DMH
// ============================================================
const CACHE_NAME = 'noticlima-v1';
const CHECK_INTERVAL = 10 * 60 * 1000; // cada 10 min

// URL del Worker propio que vigila los avisos DMH con Claude IA.
// CAMBIAR esta URL por la tuya real despues de desplegar el Worker.
const DMH_WORKER_URL = 'https://noticlima-dmh-worker.TU-SUBDOMINIO.workers.dev';

// Niveles de alerta según WMO/CAP
const SEVERITY_LEVELS = {
  EXTREME:  { color: '#ef4444', priority: 4, sound: true },
  SEVERE:   { color: '#f97316', priority: 3, sound: true },
  MODERATE: { color: '#f59e0b', priority: 2, sound: false },
  MINOR:    { color: '#22c55e', priority: 1, sound: false },
};

// ── Install ──────────────────────────────────────────────
self.addEventListener('install', e => {
  self.skipWaiting();
  console.log('[SW] Noticlima SW instalado');
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
  console.log('[SW] Noticlima SW activo');
});

// ── Fetch (cache passthrough) ─────────────────────────────
self.addEventListener('fetch', e => {
  // Solo cachear assets estáticos
  if (e.request.url.includes('open-meteo.com') ||
      e.request.url.includes('api.anthropic.com')) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

// ── Push event ────────────────────────────────────────────
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err) {}

  const title   = data.title   || '⚠️ Alerta Meteorológica — Noticlima';
  const body    = data.body    || 'Se ha detectado tiempo severo en tu área.';
  const level   = data.level   || 'MODERATE';
  const icon    = data.icon    || './icon-192.png';
  const badge   = data.badge   || './badge-72.png';
  const tag     = data.tag     || 'noticlima-alert';
  const url     = data.url     || './';

  const sv = SEVERITY_LEVELS[level] || SEVERITY_LEVELS.MODERATE;

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      renotify: true,
      requireInteraction: sv.priority >= 3,
      vibrate: sv.sound ? [200, 100, 200, 100, 400] : [200, 100, 200],
      data: { url, level, timestamp: Date.now() },
      actions: [
        { action: 'ver',     title: 'Ver detalles' },
        { action: 'dismiss', title: 'Descartar'    },
      ],
    })
  );
});

// ── Notification click ────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;

  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if (client.url.includes('noticlima') && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'SHOW_ALERTS' });
          return;
        }
      }
      self.clients.openWindow(url + '#alertas');
    })
  );
});

// ── Background sync — verificación periódica ─────────────
self.addEventListener('periodicsync', e => {
  if (e.tag === 'noticlima-check') {
    e.waitUntil(Promise.all([
      checkWeatherBackground(),
      checkDMHBackground(),
    ]));
  }
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'CHECK_NOW') {
    checkWeatherBackground(e.data.lat, e.data.lon, e.data.location);
    checkDMHBackground();
  }
  if (e.data && e.data.type === 'STORE_LOCATION') {
    // Guardar ubicación para checks en background
    self._lat = e.data.lat;
    self._lon = e.data.lon;
    self._location = e.data.location;
  }
});

// ── Verificación de Aviso Oficial DMH via Worker propio ────
// El Worker ya consultó a Claude con web_search en su propio cron;
// aquí solo leemos el resultado guardado — es instantáneo y gratis.
let _dmhLastNotifiedId = null;

async function checkDMHBackground() {
  try {
    const resp = await fetch(DMH_WORKER_URL + '/check');
    if (!resp.ok) return;
    const result = await resp.json();

    if (result.vigente && result.isNew) {
      const avisoId = result.numero || result.titulo || 'aviso';
      if (_dmhLastNotifiedId === avisoId) return; // ya notificado en esta sesión del SW

      const nivel = result.nivel === 'ALERTA' ? 'EXTREME' : 'SEVERE';
      const sv = SEVERITY_LEVELS[nivel] || SEVERITY_LEVELS.SEVERE;
      const body = (result.titulo || 'Aviso meteorológico vigente') +
        (result.departamentos ? ' — ' + result.departamentos : '');

      await self.registration.showNotification('📡 Aviso Oficial DMH Paraguay', {
        body,
        icon: './icon-192.png',
        badge: './badge-72.png',
        tag: 'dmh-' + avisoId,
        renotify: true,
        requireInteraction: sv.priority >= 3,
        vibrate: sv.sound ? [300,100,300,100,600] : [200,100,200],
        data: { url: './#alertas', level: nivel, fuente: result.fuente_url || null },
        actions: [
          { action: 'ver', title: 'Ver aviso' },
          { action: 'dismiss', title: 'OK' },
        ],
      });
      _dmhLastNotifiedId = avisoId;
    }
  } catch(err) {
    console.log('[SW] Error consultando Worker DMH:', err);
  }
}

async function checkWeatherBackground(lat, lon, location) {
  const la = lat || self._lat || -25.2867;
  const lo = lon || self._lon || -57.6470;
  const loc = location || self._location || 'Asuncion';

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}`
      + `&current=weather_code,wind_speed_10m,temperature_2m,precipitation_probability,surface_pressure`
      + `&timezone=America%2FAsuncion`;

    const resp  = await fetch(url);
    const data  = await resp.json();
    const c     = data.current;

    const alerts = detectAlerts(c, loc);
    for (const alert of alerts) {
      await self.registration.showNotification(alert.title, {
        body:             alert.body,
        icon:             './icon-192.png',
        badge:            './badge-72.png',
        tag:              alert.tag,
        renotify:         true,
        requireInteraction: alert.priority >= 3,
        vibrate:          alert.priority >= 3 ? [300,100,300,100,600] : [200,100,200],
        data:             { url: './#alertas', level: alert.level },
        actions: [
          { action: 'ver', title: 'Ver alerta' },
          { action: 'dismiss', title: 'OK' },
        ],
      });
    }
  } catch(err) {
    console.log('[SW] Error en check background:', err);
  }
}

function detectAlerts(c, location) {
  const alerts = [];
  const code  = c.weather_code || 0;
  const wind  = c.wind_speed_10m || 0;
  const temp  = c.temperature_2m || 25;
  const press = c.surface_pressure || 1013;
  const rain  = c.precipitation_probability || 0;

  // TORMENTA ELÉCTRICA SEVERA (WMO 95-99)
  if (code >= 95) {
    const granizo = code >= 96;
    alerts.push({
      title:    '⛈️ TORMENTA ELÉCTRICA ACTIVA',
      body:     `${granizo ? 'Tormenta con GRANIZO' : 'Tormenta eléctrica'} en ${location}. Busca refugio de inmediato. Riesgo de rayos y ráfagas fuertes.`,
      tag:      'storm',
      level:    'EXTREME',
      priority: 4,
    });
  }
  // LLUVIA TORRENCIAL / DILUVIO (WMO 82-84)
  else if (code >= 82 || (rain >= 80 && code >= 61)) {
    alerts.push({
      title:    '🌧️ LLUVIA TORRENCIAL',
      body:     `Precipitaciones intensas en ${location}. Riesgo de inundaciones y anegamientos. Evita zonas bajas.`,
      tag:      'heavy-rain',
      level:    'SEVERE',
      priority: 3,
    });
  }

  // VIENTO EXTREMO (posible ciclón/tromba)
  if (wind >= 80) {
    alerts.push({
      title:    '🌪️ VIENTO EXTREMO — PELIGRO',
      body:     `Vientos de ${Math.round(wind)} km/h en ${location}. Riesgo de daños estructurales. Permanece en interiores.`,
      tag:      'extreme-wind',
      level:    'EXTREME',
      priority: 4,
    });
  } else if (wind >= 60) {
    alerts.push({
      title:    '💨 Viento fuerte',
      body:     `Ráfagas de ${Math.round(wind)} km/h en ${location}. Precaución con objetos sueltos y árboles.`,
      tag:      'strong-wind',
      level:    'SEVERE',
      priority: 3,
    });
  }

  // PRESIÓN MUY BAJA — indicador ciclónico
  if (press < 990) {
    alerts.push({
      title:    '🌀 SISTEMA CICLÓNICO DETECTADO',
      body:     `Presión de ${Math.round(press)} hPa en ${location}. Condición asociada a sistema de baja presión intenso. Atención meteorológica máxima.`,
      tag:      'cyclone',
      level:    'EXTREME',
      priority: 4,
    });
  } else if (press < 998) {
    alerts.push({
      title:    '🌀 Presión atmosférica muy baja',
      body:     `${Math.round(press)} hPa en ${location}. Posible desarrollo de sistema severo. Monitorea Noticlima.`,
      tag:      'low-pressure',
      level:    'SEVERE',
      priority: 3,
    });
  }

  // CALOR EXTREMO
  if (temp >= 42) {
    alerts.push({
      title:    '🌡️ CALOR EXTREMO — PELIGRO VITAL',
      body:     `${Math.round(temp)}°C en ${location}. Riesgo de golpe de calor. Hidratación urgente. Evita exposición solar.`,
      tag:      'extreme-heat',
      level:    'EXTREME',
      priority: 4,
    });
  } else if (temp >= 38) {
    alerts.push({
      title:    '🌡️ Calor intenso',
      body:     `${Math.round(temp)}°C en ${location}. Evita actividades al aire libre. Mantente hidratado.`,
      tag:      'heat',
      level:    'SEVERE',
      priority: 3,
    });
  }

  return alerts;
}
