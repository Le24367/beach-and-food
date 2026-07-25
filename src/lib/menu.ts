/**
 * menu.ts
 *
 * schema.org/Menu-Aufbau aus den Sanity-Speisekarten-Daten -- ausgelagert
 * aus Angebot.astro, damit dieselbe Struktur an zwei Stellen ohne doppelte
 * Logik verwendet werden kann:
 *   1. Angebot.astro:  JSON-LD <script> im Seiten-<head> (Rich Results)
 *   2. /menu.json:      maschinenlesbarer Endpunkt fuer Agenten, die die
 *                        Seite lesen statt Klicks auszufuehren
 */
import { getMenuCategories, getMenuItems, getMenuSubCategories, urlFor } from './sanity'
import { SITE } from './config'
import imageMapRaw from '../generated/image-map.json'

const imageMap: Record<string, { thumb: string; card: string; full: string }> = imageMapRaw as any

function localOrRemote(sanityUrl: string, mode: 'thumb' | 'card' | 'full'): string {
  const entry = imageMap[sanityUrl]
  if (!entry) return sanityUrl
  if (mode === 'thumb') return entry.thumb
  if (mode === 'card')  return entry.card
  return entry.full
}

export async function buildMenuJsonLd() {
  let items: Awaited<ReturnType<typeof getMenuCategories>> = []
  let menuItems: Awaited<ReturnType<typeof getMenuItems>> = []
  let subCategories: Awaited<ReturnType<typeof getMenuSubCategories>> = []

  try {
    ;[items, menuItems, subCategories] = await Promise.all([
      getMenuCategories(),
      getMenuItems(),
      getMenuSubCategories(),
    ])
  } catch (e) {
    console.warn('[menu] Sanity nicht erreichbar.', e)
  }

  function subCatsForCategory(categoryId: string) {
    return subCategories.filter(s => s.categoryId === categoryId)
  }

  // Bild-URL fuer JSON-LD: localOrRemote() gibt nur dann einen lokalen Pfad
  // ("/product-images/...") zurueck, wenn image-map.json (aus fetch-images.js)
  // einen Treffer hat -- sonst kommt die bereits absolute Sanity-CDN-URL
  // unveraendert zurueck. Nur den lokalen Fall mit SITE.url voranstellen,
  // sonst entsteht "https://www.beachandfood.dehttps://cdn.sanity.io/...".
  function schemaMenuItems(categoryId: string, subCategoryId?: string) {
    return menuItems
      .filter(p => p.categoryId === categoryId && (subCategoryId ? p.subCategoryId === subCategoryId : !p.subCategoryId))
      .map(p => {
        const sanityImgUrl = p.image ? urlFor(p.image).width(900).quality(80).auto('format').url() : null
        const localImg = sanityImgUrl ? localOrRemote(sanityImgUrl, 'full') : null
        const absoluteImg = localImg
          ? (localImg.startsWith('/') ? `${SITE.url}${localImg}` : localImg)
          : undefined
        return {
          '@type': 'MenuItem',
          name: p.title,
          ...(p.description ? { description: p.description } : {}),
          ...(absoluteImg ? { image: absoluteImg } : {}),
          offers: {
            '@type': 'Offer',
            price: p.price.toFixed(2),
            priceCurrency: 'EUR',
          },
        }
      })
  }

  const hasMenuSection = items
    .map(cat => {
      const directItems = schemaMenuItems(cat._id)
      const subSections = subCatsForCategory(cat._id)
        .map(sub => ({
          '@type': 'MenuSection',
          name: sub.title,
          ...(sub.description ? { description: sub.description } : {}),
          hasMenuItem: schemaMenuItems(cat._id, sub._id),
        }))
        .filter(s => s.hasMenuItem.length > 0)

      return {
        '@type': 'MenuSection',
        name: cat.title,
        ...(cat.description ? { description: cat.description } : {}),
        ...(directItems.length > 0 ? { hasMenuItem: directItems } : {}),
        ...(subSections.length > 0 ? { hasMenuSection: subSections } : {}),
      }
    })
    .filter(section => (section.hasMenuItem?.length ?? 0) > 0 || (section.hasMenuSection?.length ?? 0) > 0)

  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    name: 'Speisekarte – Beach and Food',
    url: `${SITE.url}/#angebot`,
    hasMenuSection,
  }
}
