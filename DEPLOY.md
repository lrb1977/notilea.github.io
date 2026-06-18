# Cómo desplegar el Worker DMH de Noticlima

Este backend hace que las alertas oficiales del DMH lleguen a tu
celular automáticamente, sin que tengas que abrir la app ni tocar
"Revisar ahora". Corre en Cloudflare, gratis (tier free: 100,000
requests/día, más que suficiente).

## Qué necesitás antes de empezar

1. Una cuenta gratis en https://dash.cloudflare.com/sign-up
2. Tu API key de Anthropic (la mismas que usás en consoles de Claude)
3. Node.js instalado en tu computadora (no en el celular — esta parte
   se hace una sola vez desde una PC)

## Paso 1 — Instalar Wrangler (herramienta de Cloudflare)

Abrí una terminal y ejecutá:

```
npm install -g wrangler
wrangler login
```

Esto va a abrir el navegador para que inicies sesión en Cloudflare.

## Paso 2 — Crear el KV Namespace (donde se guarda el último aviso)

```
cd noticlima-worker
wrangler kv namespace create DMH_KV
```

Esto te va a devolver algo como:

```
{ binding = "DMH_KV", id = "abc123def456..." }
```

Copiá ese `id` y pegalo en el archivo `wrangler.toml`, reemplazando
`REEMPLAZAR_CON_EL_ID_QUE_TE_DE_WRANGLER`.

## Paso 3 — Guardar tu API key de Anthropic como secreto

```
wrangler secret put ANTHROPIC_API_KEY
```

Te va a pedir que pegues la key — pegala y presioná Enter. Esto la
guarda encriptada en Cloudflare, nunca queda en ningún archivo de texto.

## Paso 4 — Desplegar el Worker

```
wrangler deploy
```

Al terminar te va a mostrar una URL como:

```
https://noticlima-dmh-worker.tu-usuario.workers.dev
```

**Copiá esa URL completa.**

## Paso 5 — Conectar tu app a esta URL

Necesitás reemplazar la URL de ejemplo en DOS archivos:

### En `index.html`, buscá esta línea (cerca del inicio de la sección de alertas):
```js
const DMH_WORKER_URL = 'https://noticlima-dmh-worker.TU-SUBDOMINIO.workers.dev';
```
Reemplazá por tu URL real del paso 4.

### En `sw.js`, buscá la misma línea cerca del inicio del archivo:
```js
const DMH_WORKER_URL = 'https://noticlima-dmh-worker.TU-SUBDOMINIO.workers.dev';
```
Reemplazá también ahí.

Subí ambos archivos actualizados a tu repo de GitHub Pages como siempre.

## Paso 6 — Probar que funciona

Abrí en el navegador (desde cualquier dispositivo):

```
https://noticlima-dmh-worker.tu-usuario.workers.dev/force-check
```

Si todo está bien configurado, vas a ver un JSON como:

```json
{"vigente": false, "checked": true, "checkedAt": "2026-06-18T..."}
```

o si hay un aviso activo:

```json
{"vigente": true, "numero": "658/2026", "titulo": "...", ...}
```

## Cómo funciona después de esto

- El Worker se despierta **solo, cada 15 minutos**, las 24 horas,
  aunque tu celular esté apagado — porque corre en el servidor de
  Cloudflare, no en tu teléfono.
- Cuando detecta un aviso nuevo, lo guarda.
- Tu Service Worker (en el celular) consulta ese resultado guardado
  cada vez que: (a) la app está abierta y pasan los minutos configurados,
  o (b) Android ejecuta el `periodicSync` en background (si tu Android
  lo soporta — no todos lo hacen, es una limitación del sistema, no
  de la app).
- Cuando hay un aviso nuevo, te llega la notificación push normal,
  igual que las demás alertas de tormenta/viento/etc.

## Costos

Con el tier gratuito de Cloudflare Workers:
- 100,000 requests/día gratis (vos vas a usar ~96/día con el cron)
- KV storage gratis hasta 1GB
- Esto no debería costarte nada salvo que tengas miles de usuarios

El único costo real es el de las llamadas a la API de Anthropic
(96 llamadas/día con web_search). Revisá el pricing actual en
https://docs.claude.com si querés estimar el gasto mensual.
