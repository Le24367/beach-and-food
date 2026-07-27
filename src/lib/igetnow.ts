/**
 * igetnow.ts
 *
 * Speisekarte live von igetnow (unserem Bestellsystem) geholt, damit Preise
 * und Produkte nur noch dort gepflegt werden müssen statt doppelt in Sanity.
 * Läuft ausschließlich zur Build-Zeit (SSG, wie die Sanity-Queries auch) --
 * kein Client-seitiger Aufruf, Preise sollen sich nicht live pro Seitenaufruf
 * ändern, sondern erst beim nächsten Deploy.
 *
 * WICHTIG: Das ist die interne, NICHT offiziell dokumentierte JSON-API von
 * igetnow (dieselbe, die die igetnow-Bestellseite selbst im Browser aufruft --
 * kein Login/Token nötig). Kein Vertrag, keine Versionsgarantie. Schlägt sie
 * fehl oder ändert sich ihre Form unerwartet, wirft jede Funktion hier --
 * getMenuData() in menu.ts fängt das ab und fällt automatisch auf Sanity
 * zurück. Der Build bricht dadurch nie ab.
 */
import { LINKS } from './config'
import type { MenuCategory, MenuItem, MenuSubCategory } from './sanity'

const API_BASE = 'https://api.app.igetnow.com'

// Store-Code aus derselben URL, die auch der "Jetzt bestellen"-Button nutzt
// (config.ts) -- eine Quelle der Wahrheit, falls sich der Code mal ändert.
function storeCode(): string {
  const match = LINKS.order.match(/igetnow\.com\/([A-Za-z0-9]+)/)
  if (!match) throw new Error(`Konnte igetnow-Store-Code nicht aus LINKS.order lesen: ${LINKS.order}`)
  return match[1]
}

interface IgetnowImageVariant {
  width: number
  fileName: string | null
  url: string | null
}
interface IgetnowImageSet {
  url: string
  base: string | null
  variants: IgetnowImageVariant[]
}
interface IgetnowImages {
  main?: IgetnowImageSet
  slider?: IgetnowImageSet
}

interface IgetnowLocationResolve {
  areaId: number
  area: { location: { id: number } }
}

interface IgetnowCategory {
  id: number
  name: string
  description: string
  sort: number
  visible: boolean
  available: boolean
  isPromoted: boolean
  images: IgetnowImages
}

interface IgetnowVariant {
  price: number
  preSelected: boolean
}
interface IgetnowVariantGroup {
  minSelect: number
  variants: IgetnowVariant[]
}

interface IgetnowItem {
  id: number
  categoryId: number
  name: string
  description: string
  price: number
  sort: number
  visible: boolean
  separator: boolean
  images: IgetnowImages
  variantGroups: IgetnowVariantGroup[]
}

// igetnow zeigt/berechnet den Endpreis NICHT nur aus item.price -- Extras
// wie "als Currywurst" oder "als Firecracker Curry" sind technisch
// verpflichtende Variant-Gruppen (minSelect >= 1), aber mit nur EINER
// Option, werden also nie als echte Auswahl angezeigt, sondern einfach in
// den Preis eingerechnet (bestätigt gegen die echten Preise auf
// igetnow.com/KWFQC: "Firecracker Currywurst" zeigt 7,20 € = item.price
// 4.50 + Pflicht-Variante 2.70). Optionale Gruppen (minSelect 0, z.B.
// "Möchtest du ein Brötchen?") sind echte Zusatzwahl beim Bestellen und
// fließen bewusst NICHT in den angezeigten Preis ein -- exakt wie auf der
// igetnow-Seite selbst.
function effectivePrice(item: IgetnowItem): number {
  const requiredAddOn = (item.variantGroups ?? [])
    .filter((g) => g.minSelect >= 1 && g.variants.length > 0)
    .reduce((sum, g) => {
      const chosen = g.variants.find((v) => v.preSelected) ?? g.variants.reduce((a, b) => (a.price <= b.price ? a : b))
      return sum + chosen.price
    }, 0)
  return item.price + requiredAddOn
}

// Wählt die kleinste verfügbare Bildbreite >= target, sonst die größte
// vorhandene -- igetnow liefert nur feste Breitenstufen (kein beliebiges
// Zuschneiden wie bei Sanity), das reicht aber, weil jedes <img> im Frontend
// per CSS object-fit:cover croppt.
//
// Zwei unterschiedliche Formen je nach Herkunft: Item-Bilder liefern die
// fertige, absolute URL direkt in variant.url. Kategorie-Bilder liefern nur
// einen Dateinamen (variant.fileName), der mit der gemeinsamen Basis-URL
// (set.url) zusammengesetzt werden muss.
function resolveImageUrl(images: IgetnowImages | undefined, targetWidth: number): string | undefined {
  const set = images?.main ?? images?.slider
  if (!set || set.variants.length === 0) return set?.base ? `${set.url}${set.base}` : undefined

  // Nächstliegende Breitenstufe statt "kleinste die reicht" -- igetnow hat
  // teils große Lücken zwischen den Stufen (z.B. 600 -> 900 bei Kategorie-
  // bildern). Bei "kleinste >= target" würden card (Ziel 640) und full
  // (Ziel 900) beide auf 900 landen; "nächstliegend" nutzt 600 für card.
  const variant = set.variants.reduce((best, v) =>
    Math.abs(v.width - targetWidth) < Math.abs(best.width - targetWidth) ? v : best
  )

  if (variant.url) return variant.url
  if (variant.fileName) return `${set.url}${variant.fileName}`
  return set.base ? `${set.url}${set.base}` : undefined
}

function resolveImageUrls(images: IgetnowImages | undefined): { thumb: string; card: string; full: string } | undefined {
  const full = resolveImageUrl(images, 900)
  if (!full) return undefined
  return {
    thumb: resolveImageUrl(images, 200) ?? full,
    card:  resolveImageUrl(images, 640) ?? full,
    full,
  }
}

let locationPromise: Promise<{ locationId: number; areaId: number }> | null = null

function resolveLocation(): Promise<{ locationId: number; areaId: number }> {
  if (!locationPromise) {
    const code = storeCode()
    locationPromise = fetch(`${API_BASE}/locations/code/${code}?requestType=2`)
      .then((res) => {
        if (!res.ok) throw new Error(`igetnow location resolve: HTTP ${res.status}`)
        return res.json() as Promise<IgetnowLocationResolve>
      })
      .then((data) => ({ locationId: data.area.location.id, areaId: data.areaId }))
  }
  return locationPromise
}

async function fetchCategories(locationId: number, areaId: number): Promise<IgetnowCategory[]> {
  const res = await fetch(`${API_BASE}/locations/${locationId}/areas/${areaId}/categories?returnHidden=false`)
  if (!res.ok) throw new Error(`igetnow categories: HTTP ${res.status}`)
  return res.json()
}

async function fetchItems(locationId: number, areaId: number, categoryId: number): Promise<IgetnowItem[]> {
  // includeVariants=true ist Pflicht hier -- ohne das liefert die API zwar
  // noch variantGroups mit, aber "variantsFullyLoaded: false" und teils
  // unvollständig, was effectivePrice() falsche (zu niedrige) Preise
  // ausrechnen ließe.
  const res = await fetch(
    `${API_BASE}/locations/${locationId}/areas/${areaId}/categories/${categoryId}/items/app?returnHidden=false&includeVariants=true`
  )
  if (!res.ok) throw new Error(`igetnow items (category ${categoryId}): HTTP ${res.status}`)
  return res.json()
}

export interface IgetnowMenuData {
  categories: MenuCategory[]
  items: MenuItem[]
  subCategories: MenuSubCategory[]
}

// igetnow kennt keine eigenständigen Unterkategorie-Objekte -- stattdessen
// steckt innerhalb der Items-Liste einer Kategorie ein "separator"-Eintrag
// (price 0, kein echtes Produkt) als Trennzeile. Nach sort geordnet gehört
// jedes nachfolgende Produkt zu der zuletzt gesehenen Trennzeile, bis die
// naechste kommt -- bestätigt gegen mehrere echte Kategorien (z.B.
// "Foodclassics": Trennzeile "Die Beach and Food Klassiker" vor "Beach
// Currywurst" etc.). Produkte VOR der ersten Trennzeile bleiben ohne
// Unterkategorie, genau wie Angebot.astro es fuer Sanity-Items ohne
// subCategory bereits handhabt ("Weitere"-Gruppe).
function splitItemsAndSubCategories(
  cat: IgetnowCategory,
  rawItems: IgetnowItem[]
): { items: MenuItem[]; subCategories: MenuSubCategory[] } {
  const sorted = rawItems.filter((item) => item.visible).sort((a, b) => a.sort - b.sort)
  const items: MenuItem[] = []
  const subCategories: MenuSubCategory[] = []
  let currentSubCategoryId: string | undefined

  for (const item of sorted) {
    if (item.separator) {
      currentSubCategoryId = `igetnow-subcat-${item.id}`
      subCategories.push({
        _id: currentSubCategoryId,
        title: item.name.trim(),
        categoryId: `igetnow-cat-${cat.id}`,
        order: item.sort,
        active: true,
        imageUrls: resolveImageUrls(item.images),
      })
      continue
    }
    items.push({
      _id: `igetnow-item-${item.id}`,
      title: item.name.trim(),
      categoryId: `igetnow-cat-${cat.id}`,
      subCategoryId: currentSubCategoryId,
      price: effectivePrice(item),
      description: item.description || undefined,
      order: item.sort,
      active: true,
      imageUrls: resolveImageUrls(item.images),
    })
  }
  return { items, subCategories }
}

/**
 * Holt die komplette Speisekarte von igetnow und bildet sie auf dieselben
 * Typen ab, die Angebot.astro/menu.ts bisher von Sanity bekamen -- dadurch
 * brauchen beide Konsumenten (bis auf die Bild-Auflösung, siehe imageUrls
 * in sanity.ts) keine Sonderfälle für die Quelle.
 *
 * Bewusst NICHT unterstützt (V1, kein Sanity-Äquivalent in der igetnow-API):
 *   - Badges/Emoji: igetnow liefert kein Äquivalent zu Sanitys frei
 *     vergebenen Badge-Labels -- bleiben leer statt geraten.
 *   - "ab"-Preise: hat ein Pflicht-Auswahlfeld (minSelect >= 1) MEHRERE
 *     Varianten (echte Wahl, nicht nur ein einzelner Zwangs-Aufpreis), zeigt
 *     igetnow.com selbst "ab X €". effectivePrice() rechnet dafür die
 *     günstigste Variante ein (identischer Zahlenwert), zeigt aber kein
 *     "ab"-Prefix an -- kam in der aktuellen Speisekarte nicht vor, ist aber
 *     ein bekannter blinder Fleck falls sich das ändert.
 */
export async function getIgetnowMenu(): Promise<IgetnowMenuData> {
  const { locationId, areaId } = await resolveLocation()
  const rawCategories = await fetchCategories(locationId, areaId)
  const visibleCategories = rawCategories.filter((c) => c.visible && c.available)

  const itemsByCategory = await Promise.all(
    visibleCategories.map((cat) => fetchItems(locationId, areaId, cat.id))
  )

  const categories: MenuCategory[] = visibleCategories
    .map((cat) => ({
      _id: `igetnow-cat-${cat.id}`,
      title: cat.name.trim(),
      description: cat.description ?? '',
      order: cat.sort,
      active: true,
      imageUrls: resolveImageUrls(cat.images),
    }))
    .sort((a, b) => a.order - b.order)

  const built = visibleCategories.map((cat, i) => splitItemsAndSubCategories(cat, itemsByCategory[i]))

  const items = built.flatMap((b) => b.items).sort((a, b) => a.order - b.order)
  const subCategories = built.flatMap((b) => b.subCategories).sort((a, b) => a.order - b.order)

  return { categories, items, subCategories }
}
