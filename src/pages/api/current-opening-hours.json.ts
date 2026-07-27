/**
 * /api/current-opening-hours.json
 *
 * Liefert die aktuell in Sanity hinterlegten Öffnungszeiten (siteSettings.
 * openingHours), strukturiert im selben {ok, periods}-Format wie
 * /api/opening-hours.json -- aber OHNE selbst bei Google anzufragen.
 *
 * Grund für die eigene Route statt einfach /api/opening-hours.json
 * umzubauen: die läuft weiterhin unverändert für den "Zeiten über Google
 * API fetchen"-Button im Sanity Studio (tools/importGoogleHours.ts) --
 * die braucht zwingend echte Live-Google-Daten, sonst würde sie nur noch
 * Sanitys eigenen Wert an sich selbst zurückschreiben (zirkulär, nie
 * wieder eine echte Aktualisierung).
 *
 * Diese Route hier ist für den Live-"Jetzt geöffnet"-Badge (OpeningStatus.
 * astro/WeatherWidget.astro) gedacht: der zeigt beim Laden sowieso schon
 * serverseitig gerenderte Sanity-Daten an und hat bisher zusätzlich noch
 * live bei Google nachgefragt -- das konnte kurzzeitig von dem abweichen,
 * was der tägliche Cron (api/cron/refresh-opening-hours.ts) zuletzt nach
 * Sanity geschrieben hat. Jetzt liest der Badge stattdessen genau
 * denselben Sanity-Wert wie der Cron zuletzt reingeschrieben hat -- beide
 * Wege zeigen dadurch immer exakt dasselbe, keine Inkonsistenz mehr
 * möglich.
 */
import type { APIRoute } from 'astro'
import { getSiteSettings } from '../../lib/sanity'
import { parseOpeningHours } from '../../lib/hours'

export const prerender = false

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

export const GET: APIRoute = async () => {
  try {
    const settings = await getSiteSettings()
    const periods = parseOpeningHours(settings?.openingHours ?? [])

    if (periods.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'Keine Öffnungszeiten in Sanity hinterlegt.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=60', ...CORS_HEADERS },
      })
    }

    return new Response(JSON.stringify({ ok: true, periods }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        // Kurzes Cache-Fenster reicht -- Sanity ändert sich hier ohnehin
        // nur 1x täglich (Cron) oder bei einem manuellen Klick im Studio,
        // beides löst danach sowieso einen Rebuild aus.
        'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=60',
        ...CORS_HEADERS,
      },
    })
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : 'Sanity nicht erreichbar' }),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=60', ...CORS_HEADERS } }
    )
  }
}

export const OPTIONS: APIRoute = async () => new Response(null, { status: 204, headers: CORS_HEADERS })
