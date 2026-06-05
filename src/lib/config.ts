/**
 * Zentrale Konfiguration — alle Magic Strings an einem Ort.
 * Änderungen hier wirken sich auf die gesamte Site aus.
 */

export const SITE = {
  name: 'Beach and Food',
  tagline: 'Bei exakt 167°C — alles andere ist Wissenschaft.',
  url: 'https://beachandfood.de',
} as const

export const LINKS = {
  /** Online-Bestellsystem (iGetnow) */
  order: 'https://igetnow.com/KWFQC',

  /** Gutschein-Shop */
  voucher: 'https://www.bon-bon.de/gutschein/beach-and-food/?popup',

  /** WhatsApp-Direktlink */
  whatsapp: 'https://wa.me/4915164652760',

  /** Spotify-Playlist */
  spotify: 'https://open.spotify.com/playlist/37i9dQZF1DX4dyzvuaRJ0n',

  /** Google Maps */
  maps: 'https://maps.google.com/?q=Campingplatz+Sütel+Neukirchen',
} as const

export const CONTACT = {
  email: 'info@beachandfood.de',
  whatsappDisplay: '0151 64652760',
  owner: 'Martin Heidrich',
  address: 'Schäferkamp 3c, 23569 Lübeck',
} as const