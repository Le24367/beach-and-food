/**
 * hours-export.ts
 *
 * Gegenrichtung zu parseOpeningHours() in lib/hours.ts: wandelt die
 * strukturierten, pro-Tag-Perioden von Google Places (StructuredHours[],
 * ein Eintrag pro einzelnem offenen Wochentag, siehe lib/google-places.ts)
 * in Sanitys Freitext-Format (OpeningHoursEntry[] mit "days"/"hours" als
 * Text) um -- für den "Zeiten über Google API fetchen"-Button im Sanity
 * Studio, der siteSettings.openingHours direkt befüllt.
 *
 * Eigene Datei statt Erweiterung von hours.ts, weil dessen Docstring
 * bewusst "Sanity-Text -> strukturiert" als Richtung beschreibt -- die
 * Gegenrichtung hier vermischt das nicht und bleibt unabhängig testbar.
 */
import { DAY_ORDER, DAY_NAMES } from './hours'
import type { StructuredHours } from './hours'
import type { OpeningHoursEntry } from './sanity'

interface DaySlot {
  opens: string
  closes: string
}

/**
 * Gruppiert Googles pro-Tag-Perioden zu Sanitys Freitext-Zeilen -- fasst
 * aufeinanderfolgende Wochentage mit identischen Öffnungszeiten zu einem
 * Eintrag zusammen (z.B. "Mo – Fr" / "11:30 – 20:00" statt sieben
 * Einzelzeilen), im selben Format wie siteSettings.openingHours es schon
 * hat ("Mo – Do" / "Geschlossen" als initialValue-Beispiel).
 *
 * Ein Wochentag, der in "periods" gar nicht vorkommt, gilt als geschlossen
 * -- Google lässt geschlossene Tage in "periods" einfach weg.
 *
 * Bekannte Lücke (geerbt von convertPeriods() in google-places.ts): ein
 * durchgehend 24h geöffneter Tag (Google-Periode ohne "close") wird dort
 * schon rausgefiltert und sieht hier ununterscheidbar von "geschlossen"
 * aus. Für einen Strand-Imbiss ohne Nachtbetrieb praktisch irrelevant.
 */
export function groupOpeningHours(periods: StructuredHours[]): OpeningHoursEntry[] {
  const byDay = new Map<string, DaySlot>()
  for (const period of periods) {
    for (const day of period.dayOfWeek) {
      byDay.set(day, { opens: period.opens, closes: period.closes })
    }
  }

  const week = DAY_ORDER.map((abbr) => ({ abbr, slot: byDay.get(DAY_NAMES[abbr]) }))

  const entries: OpeningHoursEntry[] = []
  let i = 0
  while (i < week.length) {
    const { slot } = week[i]
    let j = i
    while (
      j + 1 < week.length &&
      sameSlot(week[j + 1].slot, slot)
    ) {
      j++
    }

    const days = i === j ? week[i].abbr : `${week[i].abbr} – ${week[j].abbr}`
    entries.push({
      _key: `google-${i}`,
      days,
      hours: slot ? `${slot.opens} – ${slot.closes}` : 'Geschlossen',
      closed: !slot,
    })

    i = j + 1
  }

  return entries
}

function sameSlot(a: DaySlot | undefined, b: DaySlot | undefined): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return a.opens === b.opens && a.closes === b.closes
}
