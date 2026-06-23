/**
 * Noticlima de Notilea — Worker v3.0
 * Fuente primaria: feed CAP oficial DMH Paraguay
 * Cron cada 15 min — verifica alertas aunque la app esté cerrada
 */

const DMH_CAP_URL   = 'https://cap-sources.s3.amazonaws.com/py-dmh-es/rss.xml';
const DMH_KV_KEY    = 'dmh_latest';
const NOTIFIED_KEY  = 'dmh_last_notified_id';
const ALERTAS_KEY   = 'py_alertas_latest';

// 20 ciudades de Paraguay para monitoreo Open-Meteo
const PY_CIUDADES = [
  {nombre:'Asunción',lat:-25.2867,lon:-57.6470,dept:'Asunción'},
  {nombre:'San Lorenzo',lat:-25.3333,lon:-57.5167,dept:'Central'},
  {nombre:'Luque',lat:-25.2667,lon:-57.4833,dept:'Central'},
  {nombre:'Concepción',lat:-23.4000,lon:-57.4333,dept:'Concepción'},
  {nombre:'San Pedro',lat:-24.1000,lon:-57.0833,dept:'San Pedro'},
  {nombre:'Coronel Oviedo',lat:-25.4333,lon:-56.4333,dept:'Caaguazú'},
  {nombre:'Villarrica',lat:-25.7500,lon:-56.4333,dept:'Guairá'},
  {nombre:'Encarnación',lat:-27.3333,lon:-55.8667,dept:'Itapúa'},
  {nombre:'Ciudad del Este',lat:-25.5167,lon:-54.6167,dept:'Alto Paraná'},
  {nombre:'Pedro Juan Caballero',lat:-22.5500,lon:-55.7333,dept:'Amambay'},
  {nombre:'Salto del Guairá',lat:-24.0667,lon:-54.3167,dept:'Canindeyú'},
  {nombre:'Pilar',lat:-26.8667,lon:-58.3000,dept:'Ñeembucú'},
  {nombre:'San Juan Bautista',lat:-26.6833,lon:-57.1500,dept:'Misiones'},
  {nombre:'Paraguarí',lat:-25.6167,lon:-57.1500,dept:'Paraguarí'},
  {nombre:'Caazapá',lat:-26.2000,lon:-56.3667,dept:'Caazapá'},
  {nombre:'Filadelfia',lat:-22.3500,lon:-60.0333,dept:'Boquerón'},
  {nombre:'Fuerte Olimpo',lat:-21.0333,lon:-57.8667,dept:'Alto Paraguay'},
  {nombre:'Nueva Asunción',lat:-21.2167,lon:-61.9167,dept:'Pte. Hayes'},
  {nombre:'Pozo Colorado',lat:-23.4833,lon:-58.8000,dept:'Pte. Hayes'},
  {nombre:'Mariscal Estigarribia',lat:-22.0333,lon:-60.6167,dept:'Boquerón'},
];

export default {
  async scheduled(event, env, ctx) {
    await Promise.all([
      checkDMHCap(env),
      checkAlertasPY(env),
    ]);
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = {'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};
    if (request.method === 'OPTIONS') return new Response(null,{headers:cors});

    if (url.pathname === '/check') {
      const d = await env.DMH_KV.get(DMH_KV_KEY,{type:'json'});
      return new Response(JSON.stringify(d || {vigente:false,checked:false}),{headers:cors});
    }
    if (url.pathname === '/alertas-py') {
      const d = await env.DMH_KV.get(ALERTAS_KEY,{type:'json'});
      return new Response(JSON.stringify(d || {alertas:[],checkedAt:null}),{headers:cors});
    }
    if (url.pathname === '/force-check') {
      return new Response(JSON.stringify(await checkDMHCap(env)),{headers:cors});
    }
    if (url.pathname === '/force-alertas') {
      return new Response(JSON.stringify(await checkAlertasPY(env)),{headers:cors});
    }
    return new Response(JSON.stringify({ok:true,msg:'Noticlima Worker v3.0 — /check /alertas-py /force-check /force-alertas'}),{headers:cors});
  },
};

// ── Feed CAP oficial DMH (fuente primaria) ──────────────────
async function checkDMHCap(env) {
  try {
    const resp = await fetch(DMH_CAP_URL, {headers:{'User-Agent':'Noticlima/3.0'}});
    if (!resp.ok) throw new Error('HTTP '+resp.status);
    const xml = await resp.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m => m[1]);

    const alertas = [];
    const now = Date.now();

    for (const item of items) {
      const title   = extractXML(item,'title');
      const desc    = extractXML(item,'description').replace(/<[^>]*>/g,'').trim();
      const link    = extractXML(item,'link');
      const pubDate = extractXML(item,'pubDate');
      const guid    = extractXML(item,'guid');
      const age     = pubDate ? now - new Date(pubDate).getTime() : 0;
      if (age > 48 * 3600000) continue; // ignorar >48h

      const nivel = clasificarNivel(title, desc);
      alertas.push({title, desc, link, guid, pubDate, nivel});
    }

    if (!alertas.length) {
      const result = {vigente:false,checked:true,checkedAt:new Date().toISOString(),isNew:false};
      await env.DMH_KV.put(DMH_KV_KEY,JSON.stringify(result),{expirationTtl:3600});
      return result;
    }

    // El aviso más reciente
    const best   = alertas[0];
    const avisoId = best.guid || best.link;
    const last    = await env.DMH_KV.get(NOTIFIED_KEY);
    const isNew   = last !== avisoId;

    const result = {
      vigente:     true,
      titulo:      best.title,
      resumen:     best.desc.slice(0,300),
      fuente_url:  best.link,
      nivel:       best.nivel,
      todos:       alertas.map(a=>({titulo:a.title,resumen:a.desc.slice(0,150),nivel:a.nivel,fuente_url:a.link})),
      isNew,
      checked:     true,
      checkedAt:   new Date().toISOString(),
    };

    if (isNew) await env.DMH_KV.put(NOTIFIED_KEY, avisoId);
    await env.DMH_KV.put(DMH_KV_KEY,JSON.stringify(result),{expirationTtl:3600});
    return result;

  } catch(e) {
    const fallback = {vigente:false,checked:false,error:e.message,checkedAt:new Date().toISOString()};
    return fallback;
  }
}

function clasificarNivel(title, desc) {
  const t = (title+' '+desc).toLowerCase();
  if (t.includes('extremo') || t.includes('peligro') || t.includes('emergencia') || t.includes('ciclón') || t.includes('tornado')) return 'ALERTA';
  if (t.includes('tormenta') || t.includes('granizo') || t.includes('100 km') || t.includes('90 km')) return 'ALERTA';
  if (t.includes('helada') && t.includes('≤') || t.includes('menor o igual')) return 'ALERTA';
  if (t.includes('alerta') || t.includes('severo') || t.includes('fuerte') || t.includes('intenso')) return 'ALERTA';
  return 'VIGILANCIA';
}

// ── 20 ciudades con Open-Meteo ──────────────────────────────
async function checkAlertasPY(env) {
  const lats = PY_CIUDADES.map(c=>c.lat).join(',');
  const lons = PY_CIUDADES.map(c=>c.lon).join(',');
  let alertas = [];

  try {
    const url = `https://api.open-meteo.com/v1/forecast?`
      +`latitude=${lats}&longitude=${lons}`
      +`&current=weather_code,wind_speed_10m,temperature_2m,precipitation_probability,surface_pressure`
      +`&hourly=weather_code,wind_speed_10m,precipitation_probability`
      +`&forecast_hours=3&timezone=America%2FAsuncion`;

    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP '+resp.status);
    const data = await resp.json();
    const arr  = Array.isArray(data) ? data : [data];

    arr.forEach((d,i) => {
      const c = PY_CIUDADES[i];
      if (!c || !d.current) return;
      const cur   = d.current;
      let maxCode = cur.weather_code||0;
      let maxWind = cur.wind_speed_10m||0;
      let maxRain = cur.precipitation_probability||0;

      if (d.hourly) {
        (d.hourly.weather_code||[]).forEach(v=>{if(v>maxCode)maxCode=v;});
        (d.hourly.wind_speed_10m||[]).forEach(v=>{if(v>maxWind)maxWind=v;});
        (d.hourly.precipitation_probability||[]).forEach(v=>{if(v>maxRain)maxRain=v;});
      }

      const nombre = c.nombre, dept = c.dept;
      const press  = cur.surface_pressure||1013;
      const temp   = cur.temperature_2m||25;

      if (maxCode>=95)
        alertas.push({tipo:'TORMENTA',nivel:'EXTREMO',ciudad:nombre,dept,
          titulo:`⛈️ Tormenta eléctrica${maxCode>=96?' con granizo':''} — ${nombre}`,
          body:`Tormenta activa o inminente en ${nombre}, ${dept}. Busca refugio.`,icon:'⛈️',color:'#ef4444'});
      else if (maxCode>=80||(maxRain>=75&&maxCode>=61))
        alertas.push({tipo:'LLUVIA',nivel:'SEVERO',ciudad:nombre,dept,
          titulo:`🌧️ Lluvia torrencial — ${nombre}`,
          body:`Precipitaciones muy intensas en ${nombre}, ${dept}. Riesgo de inundaciones.`,icon:'🌧️',color:'#f97316'});
      else if (maxCode>=61||maxRain>=65)
        alertas.push({tipo:'LLUVIA',nivel:'MODERADO',ciudad:nombre,dept,
          titulo:`🌦️ Lluvia intensa — ${nombre}`,
          body:`Lluvia intensa en ${nombre}, ${dept}. ${maxRain}% prob. Precaución en rutas.`,icon:'🌦️',color:'#f59e0b'});

      if (maxWind>=70)
        alertas.push({tipo:'VIENTO',nivel:'EXTREMO',ciudad:nombre,dept,
          titulo:`🌪️ Viento extremo — ${nombre}`,
          body:`Ráfagas de ${Math.round(maxWind)} km/h en ${nombre}. Permanece en interiores.`,icon:'🌪️',color:'#ef4444'});
      else if (maxWind>=50)
        alertas.push({tipo:'VIENTO',nivel:'SEVERO',ciudad:nombre,dept,
          titulo:`💨 Viento fuerte — ${nombre}`,
          body:`Ráfagas de ${Math.round(maxWind)} km/h en ${nombre}, ${dept}.`,icon:'💨',color:'#f97316'});

      if (press<990)
        alertas.push({tipo:'CICLON',nivel:'EXTREMO',ciudad:nombre,dept,
          titulo:`🌀 Sistema ciclónico — ${nombre}`,
          body:`Presión ${Math.round(press)} hPa en ${nombre}, ${dept}. Seguir instrucciones Defensa Civil.`,icon:'🌀',color:'#ef4444'});
      else if (press<998)
        alertas.push({tipo:'CICLON',nivel:'SEVERO',ciudad:nombre,dept,
          titulo:`🌀 Baja presión intensa — ${nombre}`,
          body:`Presión ${Math.round(press)} hPa en ${nombre}. Condición de tiempo severo.`,icon:'🌀',color:'#f97316'});

      if (temp>=40)
        alertas.push({tipo:'CALOR',nivel:'EXTREMO',ciudad:nombre,dept,
          titulo:`🌡️ Calor extremo — ${nombre}`,
          body:`${Math.round(temp)}°C en ${nombre}. Riesgo de golpe de calor.`,icon:'🌡️',color:'#ef4444'});
    });

  } catch(e) { console.log('[Worker] alertas-py error:',e.message); }

  // Deduplicar
  const seen = new Set();
  alertas = alertas.filter(a=>{const k=a.tipo+'_'+a.ciudad;if(seen.has(k))return false;seen.add(k);return true;});
  const orden = {EXTREMO:0,SEVERO:1,MODERADO:2};
  alertas.sort((a,b)=>(orden[a.nivel]||2)-(orden[b.nivel]||2));

  const result = {alertas,total:alertas.length,extremos:alertas.filter(a=>a.nivel==='EXTREMO').length,checkedAt:new Date().toISOString()};
  await env.DMH_KV.put(ALERTAS_KEY,JSON.stringify(result),{expirationTtl:1800});
  return result;
}

function extractXML(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'))
    || block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].trim() : '';
}
