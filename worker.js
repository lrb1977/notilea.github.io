/**
 * ============================================================
 * Noticlima de Notilea — Worker v2.0
 * ============================================================
 * Cron cada 15 min:
 * 1. Verifica alertas meteorológicas en 20 ciudades de Paraguay
 * 2. Verifica avisos oficiales del DMH via RSS
 * 3. Guarda resultados en KV storage
 *
 * Endpoints:
 * GET /check       → último aviso DMH guardado
 * GET /alertas-py  → alertas activas en todo Paraguay
 * GET /force-check → fuerza verificación DMH inmediata
 * GET /force-alertas → fuerza verificación de alertas inmediata
 * ============================================================
 */

// 20 ciudades representativas de los 17 departamentos + Asunción
const PY_CIUDADES = [
  { nombre:'Asunción',         lat:-25.2867, lon:-57.6470, dept:'Asunción' },
  { nombre:'San Lorenzo',      lat:-25.3333, lon:-57.5167, dept:'Central' },
  { nombre:'Luque',            lat:-25.2667, lon:-57.4833, dept:'Central' },
  { nombre:'Concepción',       lat:-23.4000, lon:-57.4333, dept:'Concepción' },
  { nombre:'San Pedro',        lat:-24.1000, lon:-57.0833, dept:'San Pedro' },
  { nombre:'Coronel Oviedo',   lat:-25.4333, lon:-56.4333, dept:'Caaguazú' },
  { nombre:'Villarrica',       lat:-25.7500, lon:-56.4333, dept:'Guairá' },
  { nombre:'Encarnación',      lat:-27.3333, lon:-55.8667, dept:'Itapúa' },
  { nombre:'Ciudad del Este',  lat:-25.5167, lon:-54.6167, dept:'Alto Paraná' },
  { nombre:'Pedro Juan Caballero', lat:-22.5500, lon:-55.7333, dept:'Amambay' },
  { nombre:'Salto del Guairá', lat:-24.0667, lon:-54.3167, dept:'Canindeyú' },
  { nombre:'Pilar',            lat:-26.8667, lon:-58.3000, dept:'Ñeembucú' },
  { nombre:'San Juan Bautista',lat:-26.6833, lon:-57.1500, dept:'Misiones' },
  { nombre:'Paraguarí',        lat:-25.6167, lon:-57.1500, dept:'Paraguarí' },
  { nombre:'Caazapá',          lat:-26.2000, lon:-56.3667, dept:'Caazapá' },
  { nombre:'Filadelfia',       lat:-22.3500, lon:-60.0333, dept:'Boquerón' },
  { nombre:'Mariscal Estigarribia', lat:-22.0333, lon:-60.6167, dept:'Boquerón' },
  { nombre:'Fuerte Olimpo',    lat:-21.0333, lon:-57.8667, dept:'Alto Paraguay' },
  { nombre:'Nueva Asunción',   lat:-21.2167, lon:-61.9167, dept:'Presidente Hayes' },
  { nombre:'Pozo Colorado',    lat:-23.4833, lon:-58.8000, dept:'Presidente Hayes' },
];

const DMH_KV_KEY       = 'dmh_latest';
const NOTIFIED_KV_KEY  = 'dmh_last_notified_id';
const ALERTAS_KV_KEY   = 'py_alertas_latest';

const DMH_FEEDS = [
  'https://www.abc.com.py/rss/nacionales/',
  'https://www.ultimahora.com/rss/',
  'https://www.lanacion.com.py/rss/',
];

const ALERT_KEYWORDS = [
  'aviso meteorológico','aviso meteorologico',
  'boletín especial','boletin especial',
  'alerta meteorológica','alerta meteorologica',
  'tiempo severo','tormenta severa','dmh',
  'dirección de meteorología','lluvia intensa',
  'granizo','tornado','inundación','inundacion',
  'viento fuerte','emergencia climática',
];

export default {
  async scheduled(event, env, ctx) {
    // Ejecutar ambas verificaciones en paralelo
    await Promise.all([
      checkAndStoreDMH(env),
      checkAndStoreAlertasPY(env),
    ]);
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { ...cors, 'Access-Control-Allow-Methods': 'GET,OPTIONS' } });
    }

    // GET /check — último aviso DMH
    if (url.pathname === '/check') {
      const data = await env.DMH_KV.get(DMH_KV_KEY, { type: 'json' });
      return new Response(JSON.stringify(data || { vigente: false, checked: false }), { headers: cors });
    }

    // GET /alertas-py — alertas activas en todo Paraguay
    if (url.pathname === '/alertas-py') {
      const data = await env.DMH_KV.get(ALERTAS_KV_KEY, { type: 'json' });
      return new Response(JSON.stringify(data || { alertas: [], checkedAt: null }), { headers: cors });
    }

    // GET /force-check — fuerza verificación DMH
    if (url.pathname === '/force-check') {
      const result = await checkAndStoreDMH(env);
      return new Response(JSON.stringify(result), { headers: cors });
    }

    // GET /force-alertas — fuerza verificación de alertas en Paraguay
    if (url.pathname === '/force-alertas') {
      const result = await checkAndStoreAlertasPY(env);
      return new Response(JSON.stringify(result), { headers: cors });
    }

    return new Response(JSON.stringify({ ok: true, msg: 'Noticlima DMH Worker v2.0' }), { headers: cors });
  },
};

// ── Verificación DMH via RSS ─────────────────────────────────
async function checkAndStoreDMH(env) {
  let found = null;

  for (const feedUrl of DMH_FEEDS) {
    try {
      const resp = await fetch(feedUrl, { headers: { 'User-Agent': 'Noticlima/2.0' } });
      if (!resp.ok) continue;
      const xml = await resp.text();
      const items = xml.match(/<item>([\s\S]*?)<\/item>/gi) || [];

      for (const item of items) {
        const title = extractXML(item, 'title');
        const link  = extractXML(item, 'link');
        const desc  = extractXML(item, 'description');
        const pub   = extractXML(item, 'pubDate');
        if (pub && Date.now() - new Date(pub).getTime() > 86400000) continue;
        const text  = (title + ' ' + desc).toLowerCase();
        if (ALERT_KEYWORDS.some(kw => text.includes(kw))) {
          found = { title, link, desc: desc.replace(/<[^>]*>/g,'').slice(0,200), feedUrl };
          break;
        }
      }
      if (found) break;
    } catch(e) {}
  }

  let result;
  if (found) {
    const avisoId = found.link || found.title;
    const last = await env.DMH_KV.get(NOTIFIED_KV_KEY);
    result = {
      vigente: true,
      titulo: found.title,
      resumen: found.desc,
      fuente_url: found.link,
      nivel: 'VIGILANCIA',
      isNew: last !== avisoId,
      checked: true,
      checkedAt: new Date().toISOString(),
    };
    if (result.isNew) await env.DMH_KV.put(NOTIFIED_KV_KEY, avisoId);
  } else {
    result = { vigente: false, checked: true, checkedAt: new Date().toISOString(), isNew: false };
  }

  await env.DMH_KV.put(DMH_KV_KEY, JSON.stringify(result), { expirationTtl: 3600 });
  return result;
}

// ── Verificación de alertas en 20 ciudades de Paraguay ───────
async function checkAndStoreAlertasPY(env) {
  // Consultar Open-Meteo con las 20 ciudades en una sola llamada (batch)
  const lats = PY_CIUDADES.map(c => c.lat).join(',');
  const lons = PY_CIUDADES.map(c => c.lon).join(',');

  let alertas = [];

  try {
    const url = `https://api.open-meteo.com/v1/forecast?`
      + `latitude=${lats}&longitude=${lons}`
      + `&current=weather_code,wind_speed_10m,temperature_2m,precipitation_probability,surface_pressure`
      + `&hourly=weather_code,wind_speed_10m,precipitation_probability`
      + `&forecast_hours=3`
      + `&timezone=America%2FAsuncion`;

    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();

    const ciudadesData = Array.isArray(data) ? data : [data];

    ciudadesData.forEach((d, i) => {
      const ciudad = PY_CIUDADES[i];
      if (!ciudad || !d.current) return;

      const c     = d.current;
      const code  = c.weather_code || 0;
      const wind  = c.wind_speed_10m || 0;
      const rain  = c.precipitation_probability || 0;
      const press = c.surface_pressure || 1013;
      const temp  = c.temperature_2m || 25;

      // También revisar próximas 3 horas
      let maxCode  = code;
      let maxWind  = wind;
      let maxRain  = rain;
      if (d.hourly) {
        (d.hourly.weather_code || []).forEach((hc, j) => { if (hc > maxCode) maxCode = hc; });
        (d.hourly.wind_speed_10m || []).forEach((hw, j) => { if (hw > maxWind) maxWind = hw; });
        (d.hourly.precipitation_probability || []).forEach((hr, j) => { if (hr > maxRain) maxRain = hr; });
      }

      const nombre = ciudad.nombre;
      const dept   = ciudad.dept;

      // TORMENTA ELÉCTRICA
      if (maxCode >= 95) {
        alertas.push({
          tipo: 'TORMENTA',
          nivel: 'EXTREMO',
          ciudad: nombre,
          dept,
          titulo: `⛈️ Tormenta eléctrica${maxCode >= 96 ? ' con granizo' : ''} — ${nombre}`,
          body: `Tormenta eléctrica activa o inminente en ${nombre}, ${dept}. Busca refugio.`,
          icon: '⛈️',
          color: '#ef4444',
        });
      }
      // LLUVIA TORRENCIAL
      else if (maxCode >= 80 || (maxRain >= 75 && maxCode >= 61)) {
        alertas.push({
          tipo: 'LLUVIA',
          nivel: 'SEVERO',
          ciudad: nombre,
          dept,
          titulo: `🌧️ Lluvia torrencial — ${nombre}`,
          body: `Precipitaciones muy intensas en ${nombre}, ${dept}. Riesgo de inundaciones.`,
          icon: '🌧️',
          color: '#f97316',
        });
      }
      // LLUVIA INTENSA
      else if (maxCode >= 61 || maxRain >= 65) {
        alertas.push({
          tipo: 'LLUVIA',
          nivel: 'MODERADO',
          ciudad: nombre,
          dept,
          titulo: `🌦️ Lluvia intensa — ${nombre}`,
          body: `Lluvia intensa en ${nombre}, ${dept}. ${maxRain}% prob. Precaución en rutas.`,
          icon: '🌦️',
          color: '#f59e0b',
        });
      }

      // VIENTO FUERTE
      if (maxWind >= 60) {
        alertas.push({
          tipo: 'VIENTO',
          nivel: maxWind >= 80 ? 'EXTREMO' : 'SEVERO',
          ciudad: nombre,
          dept,
          titulo: `💨 Viento ${maxWind >= 80 ? 'extremo' : 'fuerte'} — ${nombre}`,
          body: `Ráfagas de ${Math.round(maxWind)} km/h en ${nombre}, ${dept}. Asegura techos y objetos.`,
          icon: '💨',
          color: maxWind >= 80 ? '#ef4444' : '#f97316',
        });
      }

      // SISTEMA CICLÓNICO
      if (press < 998) {
        alertas.push({
          tipo: 'CICLON',
          nivel: press < 990 ? 'EXTREMO' : 'SEVERO',
          ciudad: nombre,
          dept,
          titulo: `🌀 ${press < 990 ? 'Sistema ciclónico' : 'Baja presión'} — ${nombre}`,
          body: `Presión de ${Math.round(press)} hPa en ${nombre}, ${dept}. Monitorea Noticlima.`,
          icon: '🌀',
          color: press < 990 ? '#ef4444' : '#f97316',
        });
      }

      // CALOR EXTREMO
      if (temp >= 40) {
        alertas.push({
          tipo: 'CALOR',
          nivel: 'EXTREMO',
          ciudad: nombre,
          dept,
          titulo: `🌡️ Calor extremo — ${nombre}`,
          body: `${Math.round(temp)}°C en ${nombre}, ${dept}. Riesgo de golpe de calor.`,
          icon: '🌡️',
          color: '#ef4444',
        });
      }
    });

  } catch(e) {
    console.log('[Worker] Error verificando alertas PY:', e.message);
  }

  // Eliminar duplicados por tipo+ciudad
  const seen = new Set();
  alertas = alertas.filter(a => {
    const key = a.tipo + '_' + a.ciudad;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Ordenar por severidad
  const orden = { EXTREMO: 0, SEVERO: 1, MODERADO: 2 };
  alertas.sort((a, b) => (orden[a.nivel] || 2) - (orden[b.nivel] || 2));

  const result = {
    alertas,
    total: alertas.length,
    extremos: alertas.filter(a => a.nivel === 'EXTREMO').length,
    checkedAt: new Date().toISOString(),
  };

  await env.DMH_KV.put(ALERTAS_KV_KEY, JSON.stringify(result), { expirationTtl: 1800 });
  return result;
}

function extractXML(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'))
    || block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].trim() : '';
}
