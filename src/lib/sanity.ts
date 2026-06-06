import { createClient } from '@sanity/client'
import imageUrlBuilder from '@sanity/image-url'
import type { SanityImageSource } from '@sanity/image-url/lib/types/types'

const PROJECT_ID = '6a4o5kn7'
const DATASET    = 'production'

export const sanityClient = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: '2024-01-01',
  useCdn: true,
})

const builder = imageUrlBuilder(sanityClient)
export function urlFor(source: SanityImageSource) {
  return builder.image(source)
}

// ── Types ────────────────────────────────────────────────────────

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

export interface MenuSubCategory {
  _id: string
  title: string
  description?: string
  image?: SanityImageSource
  emoji?: string
  categoryId: string
  order: number
  active: boolean
}

export interface MenuItem {
  _id: string
  title: string
  categoryId: string
  subCategoryId?: string        // optional — bestehende Produkte haben keinen Wert
  price: number
  description?: string
  image?: SanityImageSource
  emoji?: string
  badges?: { label: string; color: string }[]
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
  // NEU: Links und Legal aus Sanity
  links?: {
    order?: string
    voucher?: string
    spotify?: string
    whatsapp?: string
  }
  legal?: {
    owner?: string
    address?: string
    siteName?: string
    tagline?: string
  }
}

// ── Queries ──────────────────────────────────────────────────────

export async function getMenuCategories(): Promise<MenuCategory[]> {
  return sanityClient.fetch(
    `*[_type == "menuCategory" && active == true] | order(order asc) {
      _id, title, description, image, emoji, badge, order, active
    }`
  )
}

export async function getMenuSubCategories(): Promise<MenuSubCategory[]> {
  return sanityClient.fetch(
    `*[_type == "menuSubCategory" && active == true] | order(order asc) {
      _id,
      title,
      description,
      image,
      emoji,
      "categoryId": category._ref,
      order,
      active
    }`
  )
}

export async function getMenuItems(): Promise<MenuItem[]> {
  return sanityClient.fetch(
    `*[_type == "menuItem" && active == true] | order(order asc) {
      _id,
      title,
      "categoryId": category._ref,
      "subCategoryId": subCategory._ref,   // null wenn nicht gesetzt — kein Fehler
      price,
      description,
      image,
      emoji,
      badges,
      order,
      active
    }`
  )
}

export async function getSiteSettings(): Promise<SiteSettings | null> {
  return sanityClient.fetch(
    `*[_type == "siteSettings" && _id == "siteSettings"][0] {
      address,
      contact,
      openingHours,
      seasonNote,
      links,
      legal
    }`
  )
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Gibt gemergte Links zurück: Sanity siteSettings.links überschreibt config.ts.
 * Einmal aufrufen pro Build — alle Komponenten nutzen diesen Wert.
 */
export interface ResolvedLinks {
  order: string
  voucher: string
  whatsapp: string
  spotify: string
  maps: string
}

export interface ResolvedLegal {
  owner: string
  address: string
  siteName: string
  tagline: string
}

export async function getLinks(): Promise<ResolvedLinks> {
  const { LINKS } = await import('./config')
  try {
    const settings = await getSiteSettings()
    return { ...LINKS, ...settings?.links }
  } catch {
    return { ...LINKS }
  }
}

export async function getLegal(): Promise<ResolvedLegal> {
  const { SITE, CONTACT } = await import('./config')
  const fallback: ResolvedLegal = {
    owner: CONTACT.owner,
    address: CONTACT.address,
    siteName: SITE.name,
    tagline: SITE.tagline,
  }
  try {
    const settings = await getSiteSettings()
    return { ...fallback, ...settings?.legal }
  } catch {
    return fallback
  }
}