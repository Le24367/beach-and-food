/**
 * /api/cron/refresh-opening-hours
 *
 * Von Vercel Cron (siehe vercel.json, "crons") täglich zu fester Uhrzeit
 * aufgerufen -- macht automatisiert dasselbe wie der "Zeiten über Google
 * API fetchen"-Button im Sanity Studio: holt aktuelle Google-Öffnungszeiten,
 * gruppiert sie (lib/hours-export.ts -- dieselbe Logik wie im Studio-Button,
 * dort dupliziert weil Studio ein separates Repo ist), schreibt sie in
 * siteSettings.openingHours und stößt danach denselben "deploy"-Dokument-
 * Mechanismus an wie der Studio-Button, damit auch wirklich ein Rebuild
 * losläuft (sonst würde Sanity sich aktualisieren, aber die Live-Seite
 * bliebe auf dem alten Stand eingefroren).
 *
 * VORAUSSETZUNG: serverClient (lib/sanity.ts) braucht einen SCHREIBFÄHIGEN
 * SANITY_TOKEN. Der Token existiert zwar schon als Env-Var, wurde bisher
 * im Code aber nirgends tatsächlich für Schreibzugriffe genutzt -- vor dem
 * ersten scharfen Lauf in Sanity (manage.sanity.io → Projekt → API →
 * Tokens) prüfen/auf "Editor"-Rechte setzen, sonst schlägt der Patch fehl.
 *
 * Gegen Missbrauch per CRON_SECRET abgesichert: Vercel schickt den Wert
 * automatisch als "Authorization: Bearer <CRON_SECRET>"-Header mit, wenn
 * die gleichnamige Env-Var im Projekt gesetzt ist (Vercel-Standardmuster
 * für Cron-Job-Absicherung). Ohne gesetzten CRON_SECRET läuft die Route
 * ungeschützt -- nur zum lokalen Testen akzeptabel.
 */
import type { APIRoute } from 'astro'
import { getGoogleOpeningHours } from '../../../lib/google-places'
import { groupOpeningHours } from '../../../lib/hours-export'
import { serverClient } from '../../../lib/sanity'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  const secret = import.meta.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const env = {
    GOOGLE_PLACES_API_KEY: import.meta.env.GOOGLE_PLACES_API_KEY,
    GOOGLE_PLACE_ID: import.meta.env.GOOGLE_PLACE_ID,
  }
  const result = await getGoogleOpeningHours(env)
  if (!result.ok) {
    return new Response(JSON.stringify({ ok: false, error: result.error }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }

  const entries = groupOpeningHours(result.periods)

  try {
    // Alles in EINER Transaktion -- siteSettings-Patch + Deploy-Trigger
    // (schemaTypes/deploy.tsx + actions/deployAction.tsx im Studio-Repo)
    // zusammen committen, nicht als getrennte Aufrufe. Getrennte commit()s
    // wurden von Sanitys Webhook live beobachtet als mehrere unabhängige
    // Schreibvorgänge gewertet -- führte zu mehreren ausgelösten Vercel-
    // Builds pro Lauf statt einem.
    await serverClient
      .transaction()
      .patch('siteSettings', (p) => p.set({ openingHours: entries }))
      .createIfNotExists({ _id: 'deploy', _type: 'deploy' })
      .patch('deploy', (p) => p.set({ lastDeploy: new Date().toISOString() }))
      .commit()
  } catch (e) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: `Sanity-Schreibvorgang fehlgeschlagen (Token evtl. ohne Schreibrechte?): ${
          e instanceof Error ? e.message : 'unbekannt'
        }`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    )
  }

  return new Response(JSON.stringify({ ok: true, entries }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}
