/**
 * hours.ts
 *
 * Wandelt die Freitext-Öffnungszeiten aus Sanity ("Montag-Sonntag",
 * "11:30-20:00" o.ä.) in eine strukturierte Form um. Ausgelagert aus
 * Layout.astro, wo das urspruenglich nur fuer das JSON-LD gebraucht wurde --
 * dieselbe Struktur treibt jetzt zusaetzlich den Live-Status
 * "Jetzt geöffnet" in Kontakt.astro (siehe OpeningStatus.astro).
 */
import type { OpeningHoursEntry } from './sanity'

export interface StructuredHours {
  dayOfWeek: string[] // Englische Namen ("Monday" ...), wie von schema.org erwartet
  opens: string        // "HH:MM"
  closes: string        // "HH:MM"
}

// Reihenfolge ist zugleich die Woche selbst -- ein Bereich wird als
// Ausschnitt daraus gelesen, kein Wrap-around nötig, da "So" (Sonntag)
// immer das Ende der Liste ist.
// Exportiert, weil lib/hours-export.ts (Google -> Sanity-Freitext, die
// Gegenrichtung zu parseOpeningHours() hier) dieselbe Zuordnung braucht.
export const DAY_ORDER = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const
export const DAY_NAMES: Record<string, string> = {
  Mo: 'Monday', Di: 'Tuesday', Mi: 'Wednesday', Do: 'Thursday',
  Fr: 'Friday', Sa: 'Saturday', So: 'Sunday',
}
// Das "days"-Feld ist Freitext im Sanity-Studio -- deckt sowohl Abkürzungen
// als auch ausgeschriebene deutsche Tagesnamen ab, case-insensitiv.
const DAY_ALIASES: Record<string, typeof DAY_ORDER[number]> = {
  mo: 'Mo', montag: 'Mo',
  di: 'Di', dienstag: 'Di',
  mi: 'Mi', mittwoch: 'Mi',
  do: 'Do', donnerstag: 'Do',
  fr: 'Fr', freitag: 'Fr',
  sa: 'Sa', samstag: 'Sa', sonnabend: 'Sa',
  so: 'So', sonntag: 'So',
}

// Erlaubt kommagetrennte Listen aus Einzeltagen/Bereichen ("Fr, Sa, So").
function parseDayRange(days: string): string[] {
  const result: string[] = []
  for (const segment of days.split(',')) {
    const tokens = segment.split(/[–—-]/).map((s) => DAY_ALIASES[s.trim().toLowerCase()]).filter(Boolean)
    if (tokens.length === 1) {
      result.push(DAY_NAMES[tokens[0]])
    } else if (tokens.length === 2) {
      const startIdx = DAY_ORDER.indexOf(tokens[0])
      const endIdx = DAY_ORDER.indexOf(tokens[1])
      if (startIdx !== -1 && endIdx >= startIdx) {
        result.push(...DAY_ORDER.slice(startIdx, endIdx + 1).map((d) => DAY_NAMES[d]))
      }
    }
  }
  return [...new Set(result)]
}

function parseHourRange(hours: string): { opens: string; closes: string } | null {
  const match = hours.match(/(\d{1,2}[:.]\d{2})\s*[–-]\s*(\d{1,2}[:.]\d{2})/)
  if (!match) return null
  return { opens: match[1].replace('.', ':'), closes: match[2].replace('.', ':') }
}

export function parseOpeningHours(entries: OpeningHoursEntry[]): StructuredHours[] {
  return entries.flatMap((entry) => {
    if (entry.closed) return []
    const dayOfWeek = parseDayRange(entry.days)
    const time = parseHourRange(entry.hours)
    if (dayOfWeek.length === 0 || !time) return []
    return [{ dayOfWeek, opens: time.opens, closes: time.closes }]
  })
}
