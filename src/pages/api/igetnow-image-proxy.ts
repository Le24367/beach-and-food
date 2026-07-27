/**
 * /api/igetnow-image-proxy?url=...
 *
 * Lädt ein igetnow-Bild serverseitig und reicht es mit permissivem CORS-
 * Header weiter. Grund: der "Daten von igetnow übernehmen"-Button im
 * Sanity Studio lädt Bilder direkt aus dem Browser hoch (client.assets.upload())
 * -- dabei zeigte sich live, dass images.igetnow.com (anders als
 * assets-igetnow.com) KEINEN Access-Control-Allow-Origin-Header sendet.
 * Der Browser blockiert den fetch() dann komplett, das Bild landet im
 * "übersprungen"-Log, obwohl die URL selbst erreichbar ist (curl/Server-
 * Fetch funktioniert, nur der Browser verweigert das Lesen der Antwort).
 *
 * Diese Route umgeht das: ein Server-zu-Server-Fetch kennt kein CORS,
 * und die Antwort wird mit einem eigenen, permissiven CORS-Header
 * zurückgegeben -- die Studio-Origin darf sie dann lesen.
 *
 * ALLOWED_HOSTS ist eine bewusste Allowlist (kein offener Proxy!) --
 * ohne die könnte jeder diese Route missbrauchen, um beliebige URLs über
 * unseren Server abzurufen (SSRF-Risiko).
 */
import type { APIRoute } from 'astro'

export const prerender = false

const ALLOWED_HOSTS = ['images.igetnow.com', 'assets-igetnow.com']

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

export const GET: APIRoute = async ({ url }) => {
  const target = url.searchParams.get('url')
  if (!target) {
    return new Response('Fehlender "url"-Parameter', { status: 400, headers: CORS_HEADERS })
  }

  let parsed: URL
  try {
    parsed = new URL(target)
  } catch {
    return new Response('Ungültige URL', { status: 400, headers: CORS_HEADERS })
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return new Response(`Host nicht erlaubt: ${parsed.hostname}`, { status: 403, headers: CORS_HEADERS })
  }

  let upstream: Response
  try {
    upstream = await fetch(parsed.toString())
  } catch (e) {
    return new Response(
      `Fehler beim Laden: ${e instanceof Error ? e.message : 'unbekannt'}`,
      { status: 502, headers: CORS_HEADERS }
    )
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(`Upstream-Fehler: HTTP ${upstream.status}`, { status: 502, headers: CORS_HEADERS })
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      ...CORS_HEADERS,
    },
  })
}

export const OPTIONS: APIRoute = async () => new Response(null, { status: 204, headers: CORS_HEADERS })
