/**
 * menu.ts
 *
 * Speisekarten-Daten fuer zwei Konsumenten, beide ueber getMenuData():
 *   1. Angebot.astro:  Kacheln + Modal, sowie JSON-LD <script> im Seiten-<head>
 *   2. /menu.json:      maschinenlesbarer Endpunkt fuer Agenten, die die
 *                        Seite lesen statt Klicks auszufuehren
 */
import { getMenuCategories, getMenuItems, getMenuSubCategories, getShowPrices, urlFor } from './sanity'
import type { MenuCategory, MenuItem, MenuSubCategory } from './sanity'
import { getIgetnowMenu } from './igetnow'
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

export interface MenuData {
  categories: MenuCategory[]
  menuItems: MenuItem[]
  subCategories: MenuSubCategory[]
  source: 'igetnow' | 'sanity'
}

// Primärquelle Sanity -- wird über den "Daten von igetnow übernehmen"-Button
// im Sanity Studio synchron gehalten, editierbar (z.B. ein manuell
// gesetztes Kategoriebild via imageOverride, siehe lib/igetnow.ts), und ist
// damit die Quelle, die auch tatsächlich live gehen soll. Der Live-Fetch
// direkt von igetnow bleibt nur als Notfall-Fallback -- z.B. bevor der
// allererste Import je gelaufen ist, oder falls Sanity komplett down ist.
// Modul-Level-Cache wie bei den Sanity-Getters: EIN Fetch pro Build-Lauf,
// auch wenn sowohl Angebot.astro als auch /menu.json aufrufen.
let menuDataPromise: Promise<MenuData> | null = null

export async function getMenuData(): Promise<MenuData> {
  if (!menuDataPromise) {
    menuDataPromise = (async () => {
      try {
        const [categories, menuItems, subCategories] = await Promise.all([
          getMenuCategories(),
          getMenuItems(),
          getMenuSubCategories(),
        ])
        if (categories.length > 0) {
          return { categories, menuItems, subCategories, source: 'sanity' as const }
        }
        console.warn('[menu] Sanity lieferte keine Kategorien, Notfall-Fallback auf igetnow.')
      } catch (e) {
        console.warn('[menu] Sanity nicht erreichbar, Notfall-Fallback auf igetnow.', e)
      }

      try {
        const { categories, items, subCategories } = await getIgetnowMenu()
        return { categories, menuItems: items, subCategories, source: 'igetnow' as const }
      } catch (e) {
        console.warn('[menu] igetnow (Notfall-Fallback) ebenfalls nicht erreichbar.', e)
        return { categories: [], menuItems: [], subCategories: [], source: 'sanity' as const }
      }
    })()
  }
  return menuDataPromise
}

// Bild-URL fuers JSON-LD: igetnow-Items bringen bereits fertige, absolute
// URLs in imageUrls.full mit (siehe lib/igetnow.ts) -- kein urlFor()/
// localOrRemote()-Umweg noetig, der ist nur fuer Sanity-Bild-Refs da.
function jsonLdImage(p: MenuItem): string | undefined {
  if (p.imageUrls) return p.imageUrls.full
  if (!p.image) return undefined
  const sanityImgUrl = urlFor(p.image).width(900).quality(80).auto('format').url()
  const localImg = localOrRemote(sanityImgUrl, 'full')
  return localImg.startsWith('/') ? `${SITE.url}${localImg}` : localImg
}

export async function buildMenuJsonLd() {
  const { categories: items, menuItems, subCategories } = await getMenuData()
  const showPrices = await getShowPrices()

  function subCatsForCategory(categoryId: string) {
    return subCategories.filter(s => s.categoryId === categoryId)
  }

  function schemaMenuItems(categoryId: string, subCategoryId?: string) {
    return menuItems
      .filter(p => p.categoryId === categoryId && (subCategoryId ? p.subCategoryId === subCategoryId : !p.subCategoryId))
      .map(p => {
        const absoluteImg = jsonLdImage(p)
        return {
          '@type': 'MenuItem',
          name: p.title,
          ...(p.description ? { description: p.description } : {}),
          ...(absoluteImg ? { image: absoluteImg } : {}),
          ...(showPrices ? {
            offers: {
              '@type': 'Offer',
              price: p.price.toFixed(2),
              priceCurrency: 'EUR',
            },
          } : {}),
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
