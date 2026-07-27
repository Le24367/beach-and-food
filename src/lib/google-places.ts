/**
 * google-places.ts
 *
 * Holt Live-Öffnungszeiten über die Google Places API (Place Details,
 * Feld "opening_hours") und wandelt sie in dasselbe StructuredHours-Format
 * um, das lib/hours.ts aus den Sanity-Freitextfeldern erzeugt -- so kann
 * opening-status-client.ts (computeOpenStatus) beide Quellen identisch
 * verarbeiten.
 *
 * WICHTIG zu Kosten: "opening_hours" liegt im "Pro"-SKU der Places API
 * (Details: https://developers.google.com/maps/billing-and-pricing/pricing#places-details).
 * Das kostenlose Kontingent deckt 5.000 Details-Anfragen/Monat ab -- bei
 * naivem Live-Fetch pro Seitenaufruf wäre das schnell aufgebraucht. Daher
 * cachen wir hier zusätzlich In-Memory für 24h (TTL_MS), zusätzlich zum
 * Cache-Control-Header in der API-Route (opening-hours.json.ts). Der
 * In-Memory-Cache greift nur innerhalb derselben warmen Serverless-Instanz,
 * ist also nur Best-Effort -- die eigentliche Kostenkontrolle übernimmt der
 * HTTP-Cache (s-maxage) vor der Funktion.
 */
import type { StructuredHours } from './hours'

const TTL_MS = 24 * 60 * 60 * 1000 // 24h, passend zum s-maxage der API-Route

// Google: 0 = Sonntag ... 6 = Samstag (anders als DAY_ORDER in hours.ts!)
const GOOGLE_WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const

export interface GoogleOpeningHoursResult {
  ok: true
  source: 'google'
  fetchedAt: string
  openNow: boolean | null
  periods: StructuredHours[]
  weekdayText: string[]
}

export interface GoogleOpeningHoursError {
  ok: false
  source: 'error'
  fetchedAt: string
  error: string
}

export type GoogleOpeningHoursResponse = GoogleOpeningHoursResult | GoogleOpeningHoursError

interface CacheEntry {
  value: GoogleOpeningHoursResponse
  expiresAt: number
}

// Modul-Level-Cache -- überlebt nur innerhalb derselben warmen Lambda-
// Instanz, wird aber "kostenlos" mitgenommen, wenn mehrere Requests
// dieselbe Instanz treffen (z.B. im Dev-Server dauerhaft).
let cache: CacheEntry | null = null

function toHHMM(time: string): string {
  // Google liefert "HHMM" ohne Trenner, z.B. "1130" -> "11:30"
  return `${time.slice(0, 2)}:${time.slice(2, 4)}`
}

interface GooglePeriod {
  open: { day: number; time: string }
  close?: { day: number; time: string }
}

interface GooglePlaceDetailsResponse {
  status: string
  error_message?: string
  result?: {
    opening_hours?: {
      open_now?: boolean
      periods?: GooglePeriod[]
      weekday_text?: string[]
    }
  }
}

function convertPeriods(periods: GooglePeriod[]): StructuredHours[] {
  return periods
    .filter((p) => p.open && p.close) // 24h-durchgehend-Fall (kein "close") lassen wir bewusst weg -- kein Feature bisher, das das braucht
    .map((p) => ({
      dayOfWeek: [GOOGLE_WEEKDAYS[p.open.day]],
      opens: toHHMM(p.open.time),
      closes: toHHMM(p.close!.time),
    }))
}

/**
 * Fetcht die Öffnungszeiten für GOOGLE_PLACE_ID über die Places API
 * (Place Details, legacy REST-Endpunkt). Wirft niemals -- bei jedem
 * Fehler (fehlender Key, ungültige Place ID, Netzwerkfehler, Google-
 * Fehlerstatus) kommt ein { ok: false, error } zurück, damit die
 * aufrufende API-Route immer sauber antworten kann statt zu crashen.
 */
export async function getGoogleOpeningHours(env: {
  GOOGLE_PLACES_API_KEY?: string
  GOOGLE_PLACE_ID?: string
}): Promise<GoogleOpeningHoursResponse> {
  const now = Date.now()
  if (cache && cache.expiresAt > now) {
    return cache.value
  }

  const apiKey = env.GOOGLE_PLACES_API_KEY
  const placeId = env.GOOGLE_PLACE_ID

  if (!apiKey || !placeId) {
    // Kein Cache-Eintrag hierfür -- sobald die env-Variablen gesetzt werden
    // (z.B. nach Redeploy), soll der nächste Request es sofort versuchen.
    return {
      ok: false,
      source: 'error',
      fetchedAt: new Date(now).toISOString(),
      error: 'GOOGLE_PLACES_API_KEY oder GOOGLE_PLACE_ID ist nicht gesetzt (.env / Vercel Env Vars prüfen).',
    }
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
    url.searchParams.set('place_id', placeId)
    url.searchParams.set('fields', 'opening_hours')
    url.searchParams.set('language', 'de')
    url.searchParams.set('key', apiKey)

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) {
      return {
        ok: false,
        source: 'error',
        fetchedAt: new Date(now).toISOString(),
        error: `Google Places API antwortete mit HTTP ${res.status}.`,
      }
    }

    const data = (await res.json()) as GooglePlaceDetailsResponse
    if (data.status !== 'OK') {
      // Häufige Fälle: REQUEST_DENIED (Key/Berechtigung falsch),
      // INVALID_REQUEST (Place ID falsch), OVER_QUERY_LIMIT (Kontingent).
      return {
        ok: false,
        source: 'error',
        fetchedAt: new Date(now).toISOString(),
        error: `Google Places API status "${data.status}"${data.error_message ? `: ${data.error_message}` : ''}`,
      }
    }

    const opening = data.result?.opening_hours
    if (!opening?.periods) {
      return {
        ok: false,
        source: 'error',
        fetchedAt: new Date(now).toISOString(),
        error: 'Google-Eintrag hat keine opening_hours.periods (z.B. Feld nicht angefragt oder Google hat keine Öffnungszeiten hinterlegt).',
      }
    }

    const value: GoogleOpeningHoursResult = {
      ok: true,
      source: 'google',
      fetchedAt: new Date(now).toISOString(),
      openNow: opening.open_now ?? null,
      periods: convertPeriods(opening.periods),
      weekdayText: opening.weekday_text ?? [],
    }
    cache = { value, expiresAt: now + TTL_MS }
    return value
  } catch (e) {
    return {
      ok: false,
      source: 'error',
      fetchedAt: new Date(now).toISOString(),
      error: e instanceof Error ? `Fetch fehlgeschlagen: ${e.message}` : 'Fetch fehlgeschlagen (unbekannter Fehler).',
    }
  }
}
