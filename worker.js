/**
 * ============================================================
 * Noticlima de Notilea — Worker de Avisos DMH
 * ============================================================
 * Este Worker corre en Cloudflare (gratis) y hace 2 cosas:
 *
 * 1. CRON (automático, cada 15 min): consulta a Claude con
 *    web_search si el DMH Paraguay tiene un aviso vigente,
 *    y guarda el resultado en KV storage.
 *
 * 2. HTTP GET /check: el Service Worker de tu app consulta
 *    este endpoint periódicamente. Es instantáneo porque no
 *    llama a Claude en cada request, solo lee lo que el cron
 *    ya guardó.
 *
 * Tu API key de Anthropic vive SOLO aquí, nunca en el HTML.
 * ============================================================
 */

const DMH_KV_KEY = "dmh_latest";
const NOTIFIED_KV_KEY = "dmh_last_notified_id";

export default {
  // Se ejecuta automáticamente según el cron configurado en wrangler.toml
  async scheduled(event, env, ctx) {
    await checkAndStoreAlert(env);
  },

  // Maneja peticiones HTTP desde tu app / Service Worker
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS — permite que GitHub Pages le pregunte a este Worker
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // GET /check — devuelve el último aviso guardado (instantáneo, sin llamar a Claude)
    if (url.pathname === "/check") {
      const stored = await env.DMH_KV.get(DMH_KV_KEY, { type: "json" });
      return new Response(JSON.stringify(stored || { vigente: false, checked: false }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // GET /force-check — fuerza una verificación inmediata (botón "Revisar ahora")
    if (url.pathname === "/force-check") {
      const result = await checkAndStoreAlert(env);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response("Noticlima DMH Worker — endpoints: /check, /force-check", {
      headers: corsHeaders,
    });
  },
};

async function checkAndStoreAlert(env) {
  const today = new Date().toLocaleDateString("es-PY", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 700,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content:
            `Busca en meteorologia.gov.py y noticias paraguayas recientes (hoy ${today}) si la ` +
            `Direccion de Meteorologia e Hidrologia (DMH) de Paraguay tiene actualmente un Aviso ` +
            `Meteorologico o Boletin Especial VIGENTE para cualquier zona del pais. ` +
            `Responde SOLO con JSON, sin markdown, con este formato exacto: ` +
            `{"vigente": true|false, "numero": "numero de aviso o null", "titulo": "titulo corto o null", ` +
            `"resumen": "resumen de 2 lineas o null", "departamentos": "lista de departamentos afectados o null", ` +
            `"nivel": "ALERTA|VIGILANCIA|null", "fuente_url": "url de la fuente o null"}`,
        }],
      }),
    });

    const data = await resp.json();
    const textBlock = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    const match = textBlock.replace(/```json|```/g, "").match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Respuesta sin JSON valido");

    const result = JSON.parse(match[0]);
    result.checked = true;
    result.checkedAt = new Date().toISOString();

    // Marcamos si este aviso es "nuevo" comparando con el ultimo notificado
    const avisoId = result.vigente ? (result.numero || result.titulo || "aviso") : null;
    const lastNotified = await env.DMH_KV.get(NOTIFIED_KV_KEY);
    result.isNew = result.vigente && avisoId !== lastNotified;

    await env.DMH_KV.put(DMH_KV_KEY, JSON.stringify(result), {
      expirationTtl: 3600, // se renueva cada hora aunque el cron falle
    });

    if (result.vigente && result.isNew) {
      await env.DMH_KV.put(NOTIFIED_KV_KEY, avisoId);
    }

    return result;
  } catch (e) {
    const fallback = { vigente: false, checked: false, error: e.message, checkedAt: new Date().toISOString() };
    return fallback;
  }
}

