/**
 * /api/igetnow-menu.json
 *
 * Server-Endpunkt, der die aktuelle igetnow-Speisekarte (Kategorien,
 * Unterkategorien, Produkte inkl. korrekt berechneter Preise) zurückgibt --
 * gedacht für den "Daten von igetnow übernehmen"-Button im Sanity Studio
 * (separates Repo/separate Origin), NICHT für die Webseite selbst.
 *
 * Grund für den Umweg über diese Route statt igetnow direkt aus der Studio
 * heraus aufzurufen: unklares CORS-Verhalten von api.app.igetnow.com
 * gegenüber fremden Origins, und die Preis-/Unterkategorie-Logik lebt
 * bereits vollständig in lib/igetnow.ts -- hier nur ein dünner Wrapper, der
 * dieselbe Funktion aufruft wie der Live-Fallback-Pfad in lib/menu.ts.
 *
 * "export const prerender = false" ist zwingend -- ohne das würde Astro
 * (output: 'static') diese Route beim Build einmalig einfrieren, statt bei
 * jedem Klick auf den Import-Button frische Daten zu liefern.
 *
 * Keine Cache-Control-Header nötig (anders als /api/opening-hours.json):
 * diese Route wird nur manuell von einem Editor aufgerufen, nicht von
 * jedem Seitenbesucher -- kein Kostendruck, im Gegenteil, der ganze Zweck
 * ist "gib mir den aktuellsten Stand", ein Cache würde dem entgegenlaufen.
 */
import type { APIRoute } from 'astro'
import { getIgetnowMenu } from '../../lib/igetnow'

export const prerender = false

// Rein öffentliche Speisekarten-Daten (dieselben, die igetnow.com selbst an
// jeden Besucher-Browser ausliefert) -- permissiver CORS-Header, damit die
// Sanity-Studio-Origin (localhost:3333 im Dev, ggf. andere im Betrieb)
// diese Route aufrufen darf.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

export const GET: APIRoute = async () => {
  try {
    const menu = await getIgetnowMenu()
    return new Response(JSON.stringify(menu), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...CORS_HEADERS,
      },
    })
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler' }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...CORS_HEADERS,
        },
      }
    )
  }
}

export const OPTIONS: APIRoute = async () => new Response(null, { status: 204, headers: CORS_HEADERS })
