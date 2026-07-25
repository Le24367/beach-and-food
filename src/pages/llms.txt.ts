// Als Astro-Endpunkt statt statischer Datei in public/, damit der
// Content-Type explizit "charset=utf-8" traegt -- eine reine public/*.txt-
// Datei wird sonst ohne Charset-Angabe als "text/plain" ausgeliefert, und
// Browser raten dann oft falsch (Umlaute wie "Sütel" kamen als "SÃ¼tel" an).
import type { APIRoute } from 'astro'
import { SITE } from '../lib/config'

const body = `# Beach and Food

> Foodtruck 2.0 direkt am Sütel-Strand (Campingplatz Sütel, 23779 Neukirchen): Fischbrötchen, Currywurst, Pommes und kalte Drinks, bei exakt 167°C frittiert. Ein umgebauter Linienbus mit Indoor-Sitzbereich, Self-Order-Terminals und Online-Vorbestellung.

Saisonbetrieb. Aktuelle Öffnungszeiten stehen strukturiert im JSON-LD (\`LocalBusiness\` → \`openingHoursSpecification\`) auf der Startseite und sind damit jederzeit maschinenlesbar aktuell — dieser Text wird nicht bei jeder Änderung neu gebaut.

## Seiten

- [Startseite](${SITE.url}/): Speisekarte, Online-Bestellen, Über uns, Kontakt & Anfahrt
- [Speisekarte](${SITE.url}/#angebot): alle Kategorien und Gerichte mit Preisen
- [Kontakt & Anfahrt](${SITE.url}/#kontakt): Adresse, Öffnungszeiten, Karte
- [Impressum](${SITE.url}/impressum)
- [Datenschutzerklärung](${SITE.url}/datenschutz)

## Für Agenten / strukturierte Daten

- Speisekarte als JSON (Name, Preis, Beschreibung, Bild je Gericht): [/menu.json](${SITE.url}/menu.json)
- Dieselbe Speisekarte zusätzlich als \`schema.org/Menu\`-JSON-LD im \`<head>\` der Startseite
- Adresse, Geokoordinaten, Telefon und Öffnungszeiten als \`schema.org/LocalBusiness\` + \`FoodEstablishment\`-JSON-LD im \`<head>\` jeder Seite

## Bestellen & Kontakt

- Online bestellen: https://igetnow.com/KWFQC
- Gutschein kaufen: https://www.bon-bon.de/gutschein/beach-and-food/?popup
- E-Mail: info@beachandfood.de
- Adresse: Campingplatz Sütel, Sütel-Strand, 23779 Neukirchen
`

export const GET: APIRoute = () => {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
