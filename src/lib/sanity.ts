import { createClient } from '@sanity/client'
import imageUrlBuilder from '@sanity/image-url'
import type { SanityImageSource } from '@sanity/image-url/lib/types/types'

// ── Trage hier deine Sanity-Projekt-ID ein ──────────────────────
// Gleiche Werte wie in sanity/sanity.config.ts
const PROJECT_ID = '6a4o5kn7'   // z.B. 'ab12cd34'
const DATASET    = 'production'
// ────────────────────────────────────────────────────────────────

export const sanityClient = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: '2024-01-01',
  useCdn: true,         // CDN für schnelle Ladezeiten im Build
})

// Bild-URL-Builder
const builder = imageUrlBuilder(sanityClient)

export function urlFor(source: SanityImageSource) {
  return builder.image(source)
}

// ── TypeScript-Typen ────────────────────────────────────────────

export interface MenuCategory {
  _id: string
  title: string
  description: string
  image?: SanityImageSource
  emoji?: string
  badge?: {
    label?: string
    color?: string
    customColor?: string
  }
  order: number
  active: boolean
}

export interface OpeningHoursEntry {
  _key: string
  days: string
  hours: string
  closed: boolean
}

export interface SiteSettings {
  address: {
    name: string
    street: string
    zip: string
    mapsUrl: string
  }
  contact: {
    email: string
    whatsapp: string
    whatsappDisplay: string
  }
  openingHours: OpeningHoursEntry[]
  seasonNote?: string
}

// ── GROQ Queries ────────────────────────────────────────────────

/** Alle aktiven Speisekarten-Kategorien, sortiert nach `order` */
export async function getMenuCategories(): Promise<MenuCategory[]> {
  return sanityClient.fetch(
    `*[_type == "menuCategory" && active == true] | order(order asc) {
      _id,
      title,
      description,
      image,
      emoji,
      badge,
      order,
      active
    }`
  )
}

/** Seiteneinstellungen (Singleton) */
export async function getSiteSettings(): Promise<SiteSettings | null> {
  return sanityClient.fetch(
    `*[_type == "siteSettings" && _id == "siteSettings"][0] {
      address,
      contact,
      openingHours,
      seasonNote
    }`
  )
}

export interface MenuItem {
  _id: string
  title: string
  categoryId: string
  price: number
  description?: string
  image?: SanityImageSource
  badges?: { label: string; color: string }[]
  order: number
  active: boolean
}

export async function getMenuItems(): Promise<MenuItem[]> {
  return sanityClient.fetch(
    `*[_type == "menuItem" && active == true] | order(order asc) {
      _id,
      title,
      "categoryId": category._ref,
      price,
      description,
      image,
      badges,
      order,
      active
    }`
  )
}
