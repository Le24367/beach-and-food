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
 * sanityClient bleibt als Alias auf publicClient → kein Breaking Change
 * in bestehenden Komponenten.
 */

import { createClient } from '@sanity/client'
import imageUrlBuilder from '@sanity/image-url'
import type { SanityImageSource } from '@sanity/image-url/lib/types/types'

// FIX: Liest jetzt aus den in env.d.ts deklarierten PUBLIC_-Variablen,
// mit dem bisherigen Wert als Fallback. Vorher waren die ENV-Deklarationen
// in env.d.ts vorhanden, wurden hier aber nie tatsächlich gelesen — die
// Projekt-ID war ausschließlich hart kodiert. Kein Sicherheitsproblem
// (Projekt-ID ist ohnehin öffentlich), aber inkonsistent zur eigenen
// Doku. Jetzt lässt sich Projekt-ID/Dataset bei Bedarf per ENV
// überschreiben, ohne den Code anzufassen.
const PROJECT_ID = import.meta.env.PUBLIC_SANITY_PROJECT_ID || '6a4o5kn7'
const DATASET    = import.meta.env.PUBLIC_SANITY_DATASET    || 'production'

// ─────────────────────────────────────────────────────────────────────────────
// Server-Client (mit Token) — NUR in .astro-Frontmatter verwenden
// ─────────────────────────────────────────────────────────────────────────────
export const serverClient = createClient({
  projectId: PROJECT_ID,
  dataset:   DATASET,
  apiVersion: '2024-01-01',
  token:     import.meta.env.SANITY_TOKEN,
  useCdn:    false,
})

// ─────────────────────────────────────────────────────────────────────────────
// Public-Client (ohne Token) — darf im Browser und im Frontmatter verwendet werden
// ─────────────────────────────────────────────────────────────────────────────
export const publicClient = createClient({
  projectId: PROJECT_ID,
  dataset:   DATASET,
  apiVersion: '2024-01-01',
  useCdn:    true,
})

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
  subCategoryId?: string
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

export interface PaymentMethod {
  _key: string
  label: string
  emoji?: string
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
    telephone?: string
    whatsapp: string
    whatsappDisplay: string
  }
  openingHours: OpeningHoursEntry[]
  seasonNote?: string
  youtubeId?: string
  paymentMethods?: PaymentMethod[]
  links?: {
    order?: string
    voucher?: string
    spotify?: string
    whatsapp?: string
  }
  legal?: {
    companyName?: string
    managingDirector?: string
    owner?: string
    address?: string
    registerCourt?: string
    registerNumber?: string
    vatId?: string
    siteName?: string
    tagline?: string
  }
}

export interface ResolvedLinks {
  order: string
  voucher: string
  whatsapp: string
  spotify: string
  maps: string
}

export interface ResolvedLegal {
  // Bestehende Felder — unverändert, damit Layout.astro/Kontakt.astro
  // ohne Anpassung weiterlaufen.
  owner: string
  address: string
  siteName: string
  tagline: string
  // Neu: Impressum-Pflichtangaben (§ 5 DDG) für die GmbH.
  companyName: string
  managingDirector: string
  registerCourt: string
  registerNumber: string
  vatId: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

export async function getMenuCategories(): Promise<MenuCategory[]> {
  return publicClient.fetch(
    `*[_type == "menuCategory" && active == true] | order(order asc) {
      _id, title, description, image, emoji, badge, order, active
    }`
  )
}

export async function getMenuSubCategories(): Promise<MenuSubCategory[]> {
  return publicClient.fetch(
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
  return publicClient.fetch(
    `*[_type == "menuItem" && active == true] | order(order asc) {
      _id,
      title,
      "categoryId": category._ref,
      "subCategoryId": subCategory._ref,
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
  return publicClient.fetch(
    `*[_type == "siteSettings" && _id == "siteSettings"][0] {
      address,
      contact,
      openingHours,
      seasonNote,
      youtubeId,
      paymentMethods,
      links,
      legal
    }`
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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
  const { SITE, CONTACT, LEGAL } = await import('./config')
  const fallback: ResolvedLegal = {
    owner:            CONTACT.owner,
    address:          CONTACT.address,
    siteName:         SITE.name,
    tagline:          SITE.tagline,
    companyName:      LEGAL.companyName,
    managingDirector: LEGAL.managingDirector,
    registerCourt:    LEGAL.registerCourt,
    registerNumber:   LEGAL.registerNumber,
    vatId:            LEGAL.vatId,
  }
  try {
    const settings = await getSiteSettings()
    return { ...fallback, ...settings?.legal }
  } catch {
    return fallback
  }
}
