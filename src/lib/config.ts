/**
 * Fallback-Konfiguration — greift wenn Sanity nicht erreichbar ist
 * oder ein Feld in siteSettings noch nicht befüllt wurde.
 *
 * Vorrang: Sanity siteSettings > diese Werte
 */

export const SITE = {
  name: 'Beach and Food',
  tagline: 'Bei exakt 167°C — alles andere ist Wissenschaft.',
  url: 'https://www.beachandfood.de',
} as const

export const LINKS = {
  order:     'https://igetnow.com/KWFQC',
  voucher:   'https://www.bon-bon.de/gutschein/beach-and-food/?popup',
  whatsapp:  'https://wa.me/4915164652760',
  spotify:   'https://open.spotify.com/playlist/37i9dQZF1DX4dyzvuaRJ0n',
  maps:      'https://maps.google.com/?q=Campingplatz+Sütel+Neukirchen',
  // Dieselbe URL stand bisher schon hart im JSON-LD (Layout.astro,
  // "sameAs") -- hier zentral, damit beide Stellen nie auseinanderlaufen.
  instagram: 'https://www.instagram.com/beach_and_food',
} as const

export const CONTACT = {
  email:          'info@beachandfood.de',
  telephone:      '+4915164652760',
  whatsappDisplay:'0151 64652760',
  owner:          'Martin Heidrich',
  address:        'Schäferkamp 3c, 23569 Lübeck',
} as const

/**
 * Impressum-Pflichtangaben (§ 5 DDG, ex-TMG) für die GmbH.
 *
 * WICHTIG: Die mit ⚠️ markierten Werte sind Platzhalter und MÜSSEN
 * vor Livegang durch die echten Angaben des Kunden ersetzt werden —
 * entweder hier oder (empfohlen) direkt im Sanity-Feld "legal".
 * Diese Konstanten greifen nur als Fallback, falls Sanity nicht
 * erreichbar ist.
 */
export const LEGAL = {
  companyName:      'Beach and Food GmbH ⚠️ BITTE PRÜFEN',
  managingDirector: 'Martin Heidrich ⚠️ BITTE PRÜFEN',
  registerCourt:    '⚠️ BITTE AUSFÜLLEN (z.B. Amtsgericht Lübeck)',
  registerNumber:   '⚠️ BITTE AUSFÜLLEN (z.B. HRB 12345)',
  vatId:            '⚠️ BITTE AUSFÜLLEN (z.B. DE123456789)',
} as const