/**
 * Fallback-Konfiguration — greift wenn Sanity nicht erreichbar ist
 * oder ein Feld in siteSettings noch nicht befüllt wurde.
 *
 * Vorrang: Sanity siteSettings.links > diese Werte
 */

export const SITE = {
  name: 'Beach and Food',
  tagline: 'Bei exakt 167°C — alles andere ist Wissenschaft.',
  url: 'https://beachandfood.de',
} as const

export const LINKS = {
  order:   'https://igetnow.com/KWFQC',
  voucher: 'https://www.bon-bon.de/gutschein/beach-and-food/?popup',
  whatsapp:'https://wa.me/4915164652760',
  spotify: 'https://open.spotify.com/playlist/37i9dQZF1DX4dyzvuaRJ0n',
  maps:    'https://maps.google.com/?q=Campingplatz+Sütel+Neukirchen',
} as const

export const CONTACT = {
  email:          'info@beachandfood.de',
  whatsappDisplay:'0151 64652760',
  owner:          'Martin Heidrich',
  address:        'Schäferkamp 3c, 23569 Lübeck',
} as const

/**
 * Merged zur Laufzeit mit Sanity-Daten.
 * Verwendung in Komponenten:
 *
 *   import { LINKS } from '../lib/config'
 *   import type { SiteSettings } from '../lib/sanity'
 *
 *   const links = { ...LINKS, ...settings?.links }
 */