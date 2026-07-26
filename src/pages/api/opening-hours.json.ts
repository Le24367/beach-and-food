/**
 * /api/opening-hours.json
 *
 * Server-Endpunkt, der die Öffnungszeiten live von der Google Places API
 * (Place Details, Feld "opening_hours") holt -- die Seite selbst muss dafür
 * NICHT neu gebaut werden, ändert sich der Google-Eintrag, spiegelt sich
 * das binnen des Cache-Fensters unten automatisch wider.
 *
 * WICHTIG: "export const prerender = false" ist hier zwingend -- ohne das
 * würde Astro (output: 'static', Astro-Default) diese Route beim Build
 * einmalig ausführen und das Ergebnis als statische Datei einfrieren, also
 * exakt das Gegenteil von "live". Das erfordert einen Adapter mit
 * On-Demand-Rendering (siehe astro.config.mjs -- @astrojs/vercel).
 *
 * Caching (Kostengründe -- "opening_hours" ist im "Pro"-Tier der Places
 * API, 5.000 Details-Requests/Monat sind kostenlos):
 *   1. Cache-Control mit s-maxage=86400 -- Vercels Edge-Cache/CDN liefert
 *      bis zu 24h lang aus dem Cache, ohne dass diese Funktion überhaupt
 *      aufgerufen wird. stale-while-revalidate sorgt dafür, dass Besucher
 *      nie auf einen langsamen Live-Call warten, selbst wenn der Cache
 *      gerade abgelaufen ist.
 *   2. Zusätzlich ein In-Memory-Cache in lib/google-places.ts als
 *      Best-Effort-Fallback für warme Lambda-Instanzen.
 * Fehlerfälle (kein Key, falsche Place ID, Google down, Kontingent
 * aufgebraucht) liefern HTTP 200 mit { ok: false, error } zurück -- damit
 * das Frontend sauber auf die Sanity-Fallback-Daten zurückfallen kann,
 * statt dass fetch() im Browser eine 4xx/5xx-Response behandeln muss.
 * Fehler-Antworten werden bewusst NICHT lange gecacht, damit ein
 * behobener Fehler (z.B. Key nachträglich eingetragen) schnell wirkt.
 */
import type { APIRoute } from 'astro'
import { getGoogleOpeningHours } from '../../lib/google-places'

export const prerender = false

// Öffentliche, nicht-sensible Daten (dieselben Öffnungszeiten, die eh im
// JSON-LD und im Live-Status-Badge landen) -- permissiver CORS-Header,
// damit der "Zeiten über Google API fetchen"-Button im Sanity Studio
// (andere Origin) diese Route aufrufen darf.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

export const GET: APIRoute = async () => {
  // import.meta.env deckt sowohl lokale .env-Dateien als auch die Vercel
  // Project Env Vars ab (Vercel injiziert sie zur Build-/Laufzeit genauso
  // wie process.env) -- funktioniert in beiden Fällen zuverlässig.
  const env = {
    GOOGLE_PLACES_API_KEY: import.meta.env.GOOGLE_PLACES_API_KEY,
    GOOGLE_PLACE_ID: import.meta.env.GOOGLE_PLACE_ID,
  }

  const result = await getGoogleOpeningHours(env)

  const cacheControl = result.ok
    ? 'public, max-age=0, s-maxage=86400, stale-while-revalidate=3600'
    : 'public, max-age=0, s-maxage=60, stale-while-revalidate=30'

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControl,
      ...CORS_HEADERS,
    },
  })
}

export const OPTIONS: APIRoute = async () => new Response(null, { status: 204, headers: CORS_HEADERS })
