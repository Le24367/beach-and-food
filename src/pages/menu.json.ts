// Maschinenlesbarer Speisekarten-Endpunkt (schema.org/Menu, dieselbe
// Struktur wie das JSON-LD auf der Startseite -- siehe src/lib/menu.ts).
// Gedacht fuer Agenten/Tools, die Gerichte und Preise direkt abfragen
// wollen, ohne HTML zu parsen oder Klicks im Modal auszufuehren.
import type { APIRoute } from 'astro'
import { buildMenuJsonLd } from '../lib/menu'

export const GET: APIRoute = async () => {
  const menu = await buildMenuJsonLd()
  return new Response(JSON.stringify(menu, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
