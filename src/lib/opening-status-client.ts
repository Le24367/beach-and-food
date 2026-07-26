/**
 * opening-status-client.ts
 *
 * Rein clientseitige "ist gerade geöffnet"-Berechnung -- geteilt zwischen
 * OpeningStatus.astro (Live-Badge) und WeatherWidget.astro (das je nach
 * Status unterschiedlich formuliert: offen = Bestell-Anspielung,
 * geschlossen = nächste Öffnungszeit statt "komm doch vorbei").
 *
 * Bewusst Europe/Berlin statt der lokalen Zeit des Besuchers -- sonst zeigt
 * jemand aus einer anderen Zeitzone einen falschen Status.
 */

export interface HoursEntry {
  dayOfWeek: string[]
  opens: string
  closes: string
}

export interface OpenStatus {
  open: boolean
  closesAt?: string
  nextOpenWhen?: string
  nextOpenAt?: string
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const WEEKDAYS_DE: Record<string, string> = {
  Monday: 'Montag', Tuesday: 'Dienstag', Wednesday: 'Mittwoch', Thursday: 'Donnerstag',
  Friday: 'Freitag', Saturday: 'Samstag', Sunday: 'Sonntag',
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function getBerlinNow(): { weekday: string; minutes: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(new Date())
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Monday'
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10)
  return { weekday, minutes: hour * 60 + minute }
}

export function computeOpenStatus(entries: HoursEntry[]): OpenStatus {
  const { weekday, minutes } = getBerlinNow()

  for (const e of entries) {
    if (e.dayOfWeek.includes(weekday)) {
      const opensM = toMinutes(e.opens)
      const closesM = toMinutes(e.closes)
      if (minutes >= opensM && minutes < closesM) {
        return { open: true, closesAt: e.closes }
      }
    }
  }

  // Naechste Öffnung suchen: heute (spaeter), sonst die kommenden Tage der
  // Reihe nach -- deckt sowohl "taeglich gleiche Zeit" als auch
  // unregelmaessige Wochenplaene ab, ohne Spezialfaelle zu brauchen.
  const todayIdx = WEEKDAYS.indexOf(weekday)
  for (let offset = 0; offset < 7; offset++) {
    const day = WEEKDAYS[(todayIdx + offset) % 7]
    const dayEntries = entries
      .filter((e) => e.dayOfWeek.includes(day))
      .sort((a, b) => toMinutes(a.opens) - toMinutes(b.opens))
    for (const e of dayEntries) {
      if (offset > 0 || toMinutes(e.opens) > minutes) {
        const when = offset === 0 ? 'heute' : offset === 1 ? 'morgen' : WEEKDAYS_DE[day]
        return { open: false, nextOpenWhen: when, nextOpenAt: e.opens }
      }
    }
  }
  return { open: false }
}
