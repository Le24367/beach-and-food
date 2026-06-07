/**
 * sanity.ts
 *
 * ZWEI CLIENTS — wichtig für Sicherheit:
 *
 * 1. serverClient  → hat den SANITY_TOKEN, darf NIEMALS in einem <script>-Tag
 *                    oder client-seitigen Import verwendet werden.
 *                    Nur in .astro-Frontmatter (zwischen den --- Zeilen).
 *
 * 2. publicClient  → kein Token, darf im Browser verwendet werden.
 *                    Kann nur öffentlich freigegebene Daten lesen.
 *
 * Faustregel: Siehst du "import { serverClient }" in einem <script>-Tag?
 *             → Sofort auf publicClient umstellen oder den Fetch ins Frontmatter verschieben.
 */

import { createClient } from '@sanity/client'
import imageUrlBuilder from '@sanity/image-url'
import type { SanityImageSource } from '@sanity/image-url/lib/types/types'

// ─────────────────────────────────────────────────────────────────────────────
// Server-Client (mit Token) — NUR in .astro-Frontmatter verwenden
// ─────────────────────────────────────────────────────────────────────────────
export const serverClient = createClient({
  projectId: import.meta.env.SANITY_PROJECT_ID,
  dataset:   import.meta.env.SANITY_DATASET ?? 'production',
  apiVersion: '2024-01-01',
  token:     import.meta.env.SANITY_TOKEN,   // Nicht PUBLIC_ → bleibt serverseitig
  useCdn:    false,                           // false bei Schreib-Operationen / Token-Nutzung
})

// ─────────────────────────────────────────────────────────────────────────────
// Public-Client (ohne Token) — darf im Browser und im Frontmatter verwendet werden
// ─────────────────────────────────────────────────────────────────────────────
export const publicClient = createClient({
  projectId: import.meta.env.PUBLIC_SANITY_PROJECT_ID,   // PUBLIC_ → im Browser verfügbar
  dataset:   import.meta.env.PUBLIC_SANITY_DATASET ?? 'production',
  apiVersion: '2024-01-01',
  // Kein Token!
  useCdn:    true,
})

// Rückwärtskompatibilität: bestehende Imports von "sanityClient" funktionieren weiter.
// Alle Fetches dieser App brauchen keinen Token → publicClient reicht.
export const sanityClient = publicClient

// ─────────────────────────────────────────────────────────────────────────────
// Image URL Builder
// ─────────────────────────────────────────────────────────────────────────────
const builder = imageUrlBuilder(publicClient)

export function urlFor(source: SanityImageSource) {
  return builder.image(source)
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface MenuCategory {
  _id:         string
  title:       string
  description: string
  emoji?:      string
  image?:      SanityImageSource
  badge?: {
    label:       string
    color:       string
    customColor?: string
  }
  order:  number
  active: boolean
}

export interface MenuSubCategory {
  _id:         string
  title:       string
  description?: string
  emoji?:      string
  image?:      SanityImageSource
  categoryId:  string
  order?:      number
}

export interface MenuItem {
  _id:           string
  title:         string
  price?:        number
  description?:  string
  emoji?:        string
  image?:        SanityImageSource
  categoryId:    string
  subCategoryId?: string
  badges?: Array<{ label: string; color: string }>
  available:     boolean
}

export interface SiteLinks {
  order:   string
  voucher: string
  spotify: string
  maps:    string
  phone:   string
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries — alle Fetches laufen im Frontmatter (serverseitig / Build-Zeit)
// ─────────────────────────────────────────────────────────────────────────────

export async function getMenuCategories(): Promise<MenuCategory[]> {
  return publicClient.fetch<MenuCategory[]>(
    `*[_type == "menuCategory" && active == true] | order(order asc) {
      _id, title, description, emoji, image, badge, order, active
    }`
  )
}

export async function getMenuItems(): Promise<MenuItem[]> {
  return publicClient.fetch<MenuItem[]>(
    `*[_type == "menuItem" && available == true] | order(order asc) {
      _id, title, price, description, emoji, image,
      "categoryId":    category->_id,
      "subCategoryId": subCategory->_id,
      badges, available
    }`
  )
}

export async function getMenuSubCategories(): Promise<MenuSubCategory[]> {
  return publicClient.fetch<MenuSubCategory[]>(
    `*[_type == "menuSubCategory"] | order(order asc) {
      _id, title, description, emoji, image,
      "categoryId": category->_id,
      order
    }`
  )
}

export async function getLinks(): Promise<SiteLinks> {
  const data = await publicClient.fetch<SiteLinks | null>(
    `*[_type == "siteSettings"][0] { order, voucher, spotify, maps, phone }`
  )
  // Fallback-Werte falls Sanity noch nicht konfiguriert ist
  return {
    order:   data?.order   ?? '#',
    voucher: data?.voucher ?? '#',
    spotify: data?.spotify ?? '#',
    maps:    data?.maps    ?? '#',
    phone:   data?.phone   ?? '#',
  }
}