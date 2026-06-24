/**
 * Noticlima — Worker v3.1
 * Feed CAP oficial DMH Paraguay como fuente primaria
 */
const DMH_CAP_URL  = 'https://cap-sources.s3.amazonaws.com/py-dmh-es/rss.xml';
const DMH_KV_KEY   = 'dmh_latest';
const NOTIFIED_KEY = 'dmh_last_notified_id';
const ALERTAS_KEY  = 'py_alertas_latest';

const PY_CIUDADES = [
  {nombre:'Asunción',lat:-25.2867,lon:-57.6470,dept:'Asunción'},
  {nombre:'San Lorenzo',lat:-25.3333,lon:-57.5167,dept:'Central'},
  {nombre:'Concepción',lat:-23.4000,lon:-57.4333,dept:'Concepción'},
  {nombre:'San Pedro',lat:-24.1000,lon:-57.0833,dept:'San Pedro'},
  {nombre:'Coronel Oviedo',lat:-25.4333,lon:-56.4333,dept:'Caaguazú'},
  {nombre:'Villarrica',lat:-25.7500,lon:-56.4333,dept:'Guairá'},
  {nombre:'Encarnación',lat:-27.3333,lon:-55.8667,dept:'Itapúa'},
  {nombre:'Ciudad del Este',lat:-25.5167,lon:-54.6167,dept:'Alto Paraná'},
  {nombre:'Pedro Juan Caballero',lat:-22.5500,lon:-55.7333,dept:'Amambay'},
  {nombre:'Pilar',lat:-26.8667,lon:-58.3000,dept:'Ñeembucú'},
  {nombre:'San Juan Bautista',lat:-26.6833,lon:-57.1500,dept:'Misiones'},
  {nombre:'Paraguarí',lat:-25.6167,lon:-57.1500,dept:'Paraguarí'},
  {nombre:'Filadelfia',lat:-22.3500,lon:-60.0333,dept:'Boquerón'},
  {nombre:'Fuerte Olimpo',lat:-21.0333,lon:-57.8667,dept:'Alto Paraguay'},
  {nombre:'Nueva Asunción',lat:-21.2167,lon:-61.9167,dept:'Pte. Hayes'},
  {nombre:'Pozo Colorado',lat:-23.4833,lon:-58.8000,dept:'Pte. Hayes'},
  {nombre:'Salto del Guairá',lat:-24.0667,lon:-54.3167,dept:'Canindeyú'},
  {nombre:'Caazapá',lat:-26.2000,lon:-56.3667,dept:'Caazapá'},
  {nombre:'Mariscal Estigarribia',lat:-22.0333,lon:-60.6167,dept:'Boquerón'},
  {nombre:'Luque',lat:-25.2667,lon:-57.4833,dept:'Central'},
];

export default {
  async scheduled(event, env, ctx) {
    await Promise.all([checkDMHCap(env), checkAlertasPY(env)]);
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = {'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};
    if (request.method==='OPTIONS') return new Response(null,{headers:cors});
    if (url.pathname==='/check')
      return new Response(JSON.stringify(await env.DMH_KV.get(DMH_KV_KEY,{type:'json'})||{vigente:false,checked:false}),{headers:cors});
    if (url.pathname==='/alertas-py')
      return new Response(JSON.stringify(await env.DMH_KV.get(ALERTAS_KEY,{type:'json'})||{alertas:[],checkedAt:null}),{headers:cors});
    if (url.pathname==='/force-check')
      return new Response(JSON.stringify(await checkDMHCap(env)),{headers:cors});
    if (url.pathname==='/force-alertas')
      return new Response(JSON.stringify(await checkAlertasPY(env)),{headers:cors});
    return new Response(JSON.stringify({ok:true,msg:'Noticlima Worker v3.1'}),{headers:cors});
  },
};

async function checkDMHCap(env) {
  try {
    const resp = await fetch(DMH_CAP_URL,{headers:{'User-Agent':'Noticlima/3.1'}});
    if (!resp.ok) throw new Error('HTTP '+resp.status);
    const xml  = await resp.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>m[1]);
    const now  = Date.now();
    const alertas = [];
    for (const item of items) {
      const title  = extractXML(item,'title');
      const desc   = extractXML(item,'description').replace(/<[^>]*>/g,'').trim();
      const link   = extractXML(item,'link');
      const guid   = extractXML(item,'guid');
      const pubRaw = extractXML(item,'pubDate');
      const pub    = pubRaw ? new Date(pubRaw) : new Date();
      if (now - pub.getTime() > 72*3600000) continue;
      const fechaLocal = pub.toLocaleDateString('es-PY',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
      const nivel  = clasificarNivel(title,desc);
      alertas.push({title,desc,link,guid,fechaLocal,nivel});
    }
    if (!alertas.length) {
      const r = {vigente:false,checked:true,checkedAt:new Date().toISOString(),isNew:false};
      await env.DMH_KV.put(DMH_KV_KEY,JSON.stringify(r),{expirationTtl:3600});
      return r;
    }
    const best = alertas[0];
    const avisoId = best.guid||best.link;
    const last = await env.DMH_KV.get(NOTIFIED_KEY);
    const isNew = last !== avisoId;
    const result = {
      vigente:true, titulo:best.title, resumen:best.desc,
      fuente_url:best.link, nivel:best.nivel, fechaLocal:best.fechaLocal,
      todos:alertas, isNew, checked:true, checkedAt:new Date().toISOString(),
    };
    if (isNew) await env.DMH_KV.put(NOTIFIED_KEY, avisoId);
    await env.DMH_KV.put(DMH_KV_KEY,JSON.stringify(result),{expirationTtl:3600});
    return result;
  } catch(e) {
    return {vigente:false,checked:false,error:e.message,checkedAt:new Date().toISOString()};
  }
}

function clasificarNivel(title,desc) {
  const t=(title+' '+desc).toLowerCase();
  if (t.includes('100 km')||t.includes('extremo')||t.includes('tornado')||t.includes('ciclón')) return 'ALERTA ROJA';
  if (t.includes('tormenta')||t.includes('granizo')||t.includes('90 km')||t.includes('80 km')||t.includes('helada')||t.includes('bajas temp')) return 'ALERTA';
  return 'VIGILANCIA';
}

async function checkAlertasPY(env) {
  const lats=PY_CIUDADES.map(c=>c.lat).join(',');
  const lons=PY_CIUDADES.map(c=>c.lon).join(',');
  let alertas=[];
  try {
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}`
      +`&current=weather_code,wind_speed_10m,temperature_2m,precipitation_probability,surface_pressure`
      +`&hourly=weather_code,wind_speed_10m,precipitation_probability&forecast_hours=3`
      +`&timezone=America%2FAsuncion`;
    const r=await fetch(url); if(!r.ok) throw new Error('HTTP '+r.status);
    const data=await r.json();
    const arr=Array.isArray(data)?data:[data];
    arr.forEach((d,i)=>{
      const c=PY_CIUDADES[i]; if(!c||!d.current) return;
      const cur=d.current;
      let maxCode=cur.weather_code||0,maxWind=cur.wind_speed_10m||0,maxRain=cur.precipitation_probability||0;
      if(d.hourly){
        (d.hourly.weather_code||[]).forEach(v=>{if(v>maxCode)maxCode=v;});
        (d.hourly.wind_speed_10m||[]).forEach(v=>{if(v>maxWind)maxWind=v;});
        (d.hourly.precipitation_probability||[]).forEach(v=>{if(v>maxRain)maxRain=v;});
      }
      const press=cur.surface_pressure||1013,temp=cur.temperature_2m||25;
      const n=c.nombre,dp=c.dept;
      if(maxCode>=95) alertas.push({tipo:'TORMENTA',nivel:'EXTREMO',ciudad:n,dept:dp,titulo:`⛈️ Tormenta${maxCode>=96?' c/granizo':''} — ${n}`,body:`Tormenta activa en ${n}, ${dp}.`,icon:'⛈️',color:'#ef4444'});
      else if(maxCode>=80||(maxRain>=75&&maxCode>=61)) alertas.push({tipo:'LLUVIA',nivel:'SEVERO',ciudad:n,dept:dp,titulo:`🌧️ Lluvia torrencial — ${n}`,body:`Lluvia muy intensa en ${n}, ${dp}.`,icon:'🌧️',color:'#f97316'});
      else if(maxCode>=61||maxRain>=65) alertas.push({tipo:'LLUVIA',nivel:'MODERADO',ciudad:n,dept:dp,titulo:`🌦️ Lluvia intensa — ${n}`,body:`${maxRain}% prob lluvia en ${n}.`,icon:'🌦️',color:'#f59e0b'});
      if(maxWind>=70) alertas.push({tipo:'VIENTO',nivel:'EXTREMO',ciudad:n,dept:dp,titulo:`🌪️ Viento extremo — ${n}`,body:`${Math.round(maxWind)} km/h en ${n}.`,icon:'🌪️',color:'#ef4444'});
      else if(maxWind>=50) alertas.push({tipo:'VIENTO',nivel:'SEVERO',ciudad:n,dept:dp,titulo:`💨 Viento fuerte — ${n}`,body:`${Math.round(maxWind)} km/h en ${n}.`,icon:'💨',color:'#f97316'});
      if(press<990) alertas.push({tipo:'CICLON',nivel:'EXTREMO',ciudad:n,dept:dp,titulo:`🌀 Ciclón — ${n}`,body:`Presión ${Math.round(press)} hPa en ${n}.`,icon:'🌀',color:'#ef4444'});
      else if(press<998) alertas.push({tipo:'CICLON',nivel:'SEVERO',ciudad:n,dept:dp,titulo:`🌀 Baja presión — ${n}`,body:`${Math.round(press)} hPa en ${n}.`,icon:'🌀',color:'#f97316'});
      if(temp<=4) alertas.push({tipo:'HELADA',nivel:'EXTREMO',ciudad:n,dept:dp,titulo:`❄️ Helada — ${n}`,body:`${Math.round(temp)}°C en ${n}. Riesgo de helada.`,icon:'❄️',color:'#60a5fa'});
      else if(temp<=8) alertas.push({tipo:'FRIO',nivel:'SEVERO',ciudad:n,dept:dp,titulo:`🌡️ Frío intenso — ${n}`,body:`${Math.round(temp)}°C en ${n}.`,icon:'🌡️',color:'#93c5fd'});
      else if(temp>=40) alertas.push({tipo:'CALOR',nivel:'EXTREMO',ciudad:n,dept:dp,titulo:`🌡️ Calor extremo — ${n}`,body:`${Math.round(temp)}°C en ${n}.`,icon:'🌡️',color:'#ef4444'});

      // FRÍO / HELADA
      if(temp<=2) alertas.push({tipo:'FRIO',nivel:'EXTREMO',ciudad:n,dept:dp,titulo:`🥶 HELADA — ${n}`,body:`${Math.round(temp)}°C en ${n}, ${dp}. Riesgo de helada. Proteger cultivos y personas vulnerables.`,icon:'🥶',color:'#60a5fa'});
      else if(temp<=6) alertas.push({tipo:'FRIO',nivel:'SEVERO',ciudad:n,dept:dp,titulo:`❄️ Frío intenso — ${n}`,body:`${Math.round(temp)}°C en ${n}, ${dp}. Frío intenso. Abrigarse bien.`,icon:'❄️',color:'#93c5fd'});
    });
  } catch(e){ console.log('[Worker]',e.message); }
  const seen=new Set();
  alertas=alertas.filter(a=>{const k=a.tipo+'_'+a.ciudad;if(seen.has(k))return false;seen.add(k);return true;});
  const orden={EXTREMO:0,SEVERO:1,MODERADO:2};
  alertas.sort((a,b)=>(orden[a.nivel]||2)-(orden[b.nivel]||2));
  const result={alertas,total:alertas.length,extremos:alertas.filter(a=>a.nivel==='EXTREMO').length,checkedAt:new Date().toISOString()};
  await env.DMH_KV.put(ALERTAS_KEY,JSON.stringify(result),{expirationTtl:1800});
  return result;
}

function extractXML(block,tag){
  const m=block.match(new RegExp('<'+tag+'[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></'+tag+'>','i'))
    ||block.match(new RegExp('<'+tag+'[^>]*>([\\s\\S]*?)</'+tag+'>','i'));
  return m?m[1].trim():'';
}
