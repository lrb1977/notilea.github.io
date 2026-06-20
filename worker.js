export default {
  async scheduled(event, env, ctx) {
    await checkAndStore(env);
    await fetchAndStoreEventos(env);
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,OPTIONS" } });
    }

    // DMH alertas
    if (url.pathname === "/check") {
      let data = await env.DMH_KV.get("dmh_latest", { type: "json" });
      return new Response(JSON.stringify(data || { vigente: false, checked: false }), { headers: cors });
    }
    if (url.pathname === "/force-check") {
      let result = await checkAndStore(env);
      return new Response(JSON.stringify(result), { headers: cors });
    }

    // Eventos severos
    if (url.pathname === "/eventos") {
      let data = await env.DMH_KV.get("eventos_latest", { type: "json" });
      return new Response(JSON.stringify(data || []), { headers: cors });
    }
    if (url.pathname === "/force-eventos") {
      let result = await fetchAndStoreEventos(env);
      return new Response(JSON.stringify(result), { headers: cors });
    }

    return new Response(JSON.stringify({ ok: true, msg: "Noticlima Worker OK — /check /force-check /eventos /force-eventos" }), { headers: cors });
  }
};

// ── DMH — Avisos oficiales via RSS ─────────────────────────
async function checkAndStore(env) {
  const KEYWORDS = [
    "aviso meteorologico", "aviso meteorológico",
    "boletin especial", "boletín especial",
    "alerta meteorologica", "alerta meteorológica",
    "tiempo severo", "tormenta severa",
    "dmh paraguay", "viento fuerte",
    "lluvia intensa", "granizo", "tornado"
  ];
  const FEEDS = [
    "https://www.abc.com.py/rss/nacionales/",
    "https://www.ultimahora.com/rss/",
    "https://www.lanacion.com.py/rss/"
  ];
  let found = null;
  for (let feedUrl of FEEDS) {
    try {
      let resp = await fetch(feedUrl, { headers: { "User-Agent": "Noticlima/1.0" } });
      if (!resp.ok) continue;
      let xml = await resp.text();
      let items = xml.match(/<item>([\s\S]*?)<\/item>/gi) || [];
      for (let item of items) {
        let title = extractTag(item, 'title');
        let link  = extractTag(item, 'link');
        let desc  = extractTag(item, 'description');
        let pub   = extractTag(item, 'pubDate');
        let age = pub ? Date.now() - new Date(pub).getTime() : 0;
        if (age > 86400000) continue;
        let text = (title + " " + desc).toLowerCase();
        if (KEYWORDS.find(kw => text.includes(kw))) {
          found = { title, link, desc: desc.replace(/<[^>]*>/g,'').trim().slice(0,200), feedUrl };
          break;
        }
      }
      if (found) break;
    } catch(e) {}
  }

  let result;
  if (found) {
    let avisoId = found.link || found.title;
    let last = await env.DMH_KV.get("dmh_last_id");
    result = {
      vigente: true,
      titulo: found.title,
      resumen: found.desc,
      fuente_url: found.link,
      nivel: "VIGILANCIA",
      isNew: last !== avisoId,
      checked: true,
      checkedAt: new Date().toISOString()
    };
    if (result.isNew) await env.DMH_KV.put("dmh_last_id", avisoId);
  } else {
    result = { vigente: false, checked: true, checkedAt: new Date().toISOString(), isNew: false };
  }
  await env.DMH_KV.put("dmh_latest", JSON.stringify(result), { expirationTtl: 3600 });
  return result;
}

// ── EVENTOS SEVEROS — busca en RSS y clasifica ─────────────
async function fetchAndStoreEventos(env) {
  const EVENTO_KEYWORDS = [
    { kw: ["tormenta", "tormenta eléctrica", "trueno", "rayo"], tipo: "TORMENTA" },
    { kw: ["inundacion", "inundación", "anegamiento", "crecida", "desborde"], tipo: "INUNDACION" },
    { kw: ["granizo"], tipo: "GRANIZO" },
    { kw: ["viento fuerte", "ráfaga", "rafaga", "viento intenso", "tornado", "tromba"], tipo: "VIENTO" },
    { kw: ["lluvia torrencial", "lluvia intensa", "diluvio", "precipitacion intensa"], tipo: "LLUVIA" },
    { kw: ["calor extremo", "ola de calor", "temperatura record", "42 grados", "43 grados", "44 grados"], tipo: "CALOR" },
  ];
  const EXTREME_KW = ["tornado", "tromba", "granizo", "evacuacion", "evacuación", "emergencia", "victima", "víctima", "muerto", "herido"];
  const DEPTS = ["Concepción","San Pedro","Cordillera","Guairá","Guaira","Caaguazú","Caaguazu","Caazapá","Caazapa","Itapúa","Itapua","Misiones","Paraguarí","Paraguari","Alto Paraná","Alto Parana","Central","Ñeembucú","Neembucu","Amambay","Canindeyú","Canindeyú","Presidente Hayes","Boquerón","Boqueron","Alto Paraguay","Asunción","Asuncion","Ciudad del Este","Encarnación","Encarnacion","Pedro Juan Caballero","Villarrica","Coronel Oviedo","Caacupé","Caacupe","San Lorenzo","Luque","Fernando de la Mora","Lambaré","Lambare","Capiatá","Capiata","Limpio","Mariano Roque Alonso","Nueva Asunción","Nueva Asuncion","Fuerte Olimpo"];

  const FEEDS = [
    "https://www.abc.com.py/rss/nacionales/",
    "https://www.abc.com.py/rss/",
    "https://www.ultimahora.com/rss/",
    "https://www.lanacion.com.py/rss/",
    "https://www.ip.gov.py/ip/feed/"
  ];

  const eventos = [];
  const seen = new Set();

  for (let feedUrl of FEEDS) {
    try {
      let resp = await fetch(feedUrl, { headers: { "User-Agent": "Noticlima/1.0" } });
      if (!resp.ok) continue;
      let xml = await resp.text();
      let items = xml.match(/<item>([\s\S]*?)<\/item>/gi) || [];

      for (let item of items) {
        let title = extractTag(item, 'title');
        let link  = extractTag(item, 'link');
        let desc  = extractTag(item, 'description').replace(/<[^>]*>/g,'').trim().slice(0,300);
        let pub   = extractTag(item, 'pubDate');

        if (!title || seen.has(link)) continue;
        let age = pub ? Date.now() - new Date(pub).getTime() : 0;
        if (age > 7 * 86400000) continue; // solo últimos 7 días

        let text = (title + " " + desc).toLowerCase();
        let matchedTipo = null;
        for (let { kw, tipo } of EVENTO_KEYWORDS) {
          if (kw.some(k => text.includes(k))) { matchedTipo = tipo; break; }
        }
        if (!matchedTipo) continue;

        // Buscar lugar mencionado
        let lugar = "Paraguay";
        for (let dept of DEPTS) {
          if ((title + " " + desc).toLowerCase().includes(dept.toLowerCase())) {
            lugar = dept; break;
          }
        }

        // Severidad
        let extremo = EXTREME_KW.some(k => text.includes(k));
        let severidad = extremo ? "EXTREMO" : (["TORMENTA","INUNDACION","GRANIZO","VIENTO"].includes(matchedTipo) ? "SEVERO" : "MODERADO");

        // Fecha corta
        let fecha = pub ? new Date(pub).toLocaleDateString('es-PY',{day:'numeric',month:'short'}) : '';

        seen.add(link);
        eventos.push({ titulo: title, lugar, fecha, tipo: matchedTipo, severidad, resumen: desc.slice(0,200), fuente_url: link });

        if (eventos.length >= 10) break;
      }
    } catch(e) {}
    if (eventos.length >= 10) break;
  }

  // Ordenar: EXTREMO primero, luego SEVERO
  eventos.sort((a,b) => {
    const ord = { EXTREMO: 0, SEVERO: 1, MODERADO: 2 };
    return (ord[a.severidad] || 2) - (ord[b.severidad] || 2);
  });

  await env.DMH_KV.put("eventos_latest", JSON.stringify(eventos), { expirationTtl: 3600 });
  return eventos;
}

function extractTag(block, tag) {
  let m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'))
       || block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].trim() : '';
}
