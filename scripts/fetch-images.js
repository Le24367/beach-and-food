/**
 * fetch-images.js
 *
 * Läuft VOR dem Astro-Build und:
 *   1. Fragt Sanity nach allen Bild-Referenzen:
 *        - MenuItems, MenuCategories, MenuSubCategories → public/product-images/
 *        - siteSettings.gallery (Über-uns-Karussell)   → public/gallery-images/
 *   2. Lädt jedes Bild in zwei Versionen herunter:
 *        - thumb:  200×200 px, quality 40  → für Kacheln im Modal
 *        - full:  1200px breit, quality 85 → für Karussell / Lightbox
 *   3. Schreibt src/generated/image-map.json      { sanityUrl → { thumb, full } }
 *      und   src/generated/gallery-images.json    [ { src, alt, caption } ]
 */

import { createClient }    from '@sanity/client'
import imageUrlBuilder     from '@sanity/image-url'
import { createHash }      from 'crypto'
import { existsSync, mkdirSync, writeFileSync, createWriteStream } from 'fs'
import { resolve, join }   from 'path'
import { get as httpsGet } from 'https'

// ── Verzeichnisse ─────────────────────────────────────────────────────────────
const ROOT         = resolve(process.cwd())
const IMG_DIR      = join(ROOT, 'public', 'product-images')
const GALLERY_DIR  = join(ROOT, 'public', 'gallery-images')
const GEN_DIR      = join(ROOT, 'src', 'generated')
const MAP_FILE     = join(GEN_DIR, 'image-map.json')
const GALLERY_FILE = join(GEN_DIR, 'gallery-images.json')

for (const dir of [IMG_DIR, GALLERY_DIR, GEN_DIR]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

// ── Sanity Client ─────────────────────────────────────────────────────────────
const PROJECT_ID = '6a4o5kn7'
const DATASET    = 'production'

const client = createClient({
  projectId:  PROJECT_ID,
  dataset:    DATASET,
  apiVersion: '2024-01-01',
  useCdn:     false,
})

const builder = imageUrlBuilder(client)
const urlFor  = (source) => builder.image(source)

// ── Bild-Versionen ────────────────────────────────────────────────────────────
const thumbUrl = (source) =>
  urlFor(source).width(200).height(200).fit('crop').quality(40).auto('format').url()
const fullUrl  = (source) =>
  urlFor(source).width(1200).quality(85).auto('format').url()

// ── Dateiname aus URL-Hash ────────────────────────────────────────────────────
function localName(sanityUrl, suffix) {
  const hash = createHash('sha1').update(sanityUrl).digest('hex').slice(0, 12)
  return `${hash}-${suffix}.webp`
}

// ── Download ──────────────────────────────────────────────────────────────────
async function download(url, destPath) {
  if (existsSync(destPath)) return
  await new Promise((resolve, reject) => {
    const file = createWriteStream(destPath)
    httpsGet(url, (res) => {
      if (res.statusCode !== 200) {
        file.close()
        reject(new Error(`HTTP ${res.statusCode} für ${url}`))
        return
      }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
    }).on('error', reject)
  })
}

// ── Parallele Downloads mit Concurrency-Limit ─────────────────────────────────
async function runQueue(queue, concurrency = 6) {
  let i = 0, done = 0
  async function worker() {
    while (i < queue.length) {
      const job = queue[i++]
      try {
        await download(job.url, job.path)
        done++
        process.stdout.write(`\r   ${done}/${queue.length} Bilder geladen …`)
      } catch (err) {
        console.warn(`\n⚠️  Fehler bei ${job.label}: ${err.message}`)
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  return done
}

// ── Sanity-Queries ────────────────────────────────────────────────────────────
async function fetchProductImages() {
  const [items, categories, subCats] = await Promise.all([
    client.fetch(`*[_type == "menuItem"        && active == true && defined(image)] { _id, image }`),
    client.fetch(`*[_type == "menuCategory"    && active == true && defined(image)] { _id, image }`),
    client.fetch(`*[_type == "menuSubCategory" && active == true && defined(image)] { _id, image }`),
  ])
  return [...items, ...categories, ...subCats]
}

async function fetchGalleryFromSettings() {
  const result = await client.fetch(
    `*[_type == "siteSettings" && _id == "siteSettings"][0] {
      "gallery": gallery[] { image, alt, caption }
    }`
  )
  return result?.gallery ?? []
}

// ── Hauptprogramm ─────────────────────────────────────────────────────────────
async function main() {

  // ── 1. Produktbilder ──────────────────────────────────────────────────────
  console.log('🖼  Sanity-Produktbilder werden abgerufen …')
  let productRecords
  try {
    productRecords = await fetchProductImages()
  } catch (err) {
    console.warn('⚠️  Sanity nicht erreichbar – Bild-Download übersprungen.', err.message)
    if (!existsSync(MAP_FILE))     writeFileSync(MAP_FILE,     '{}', 'utf-8')
    if (!existsSync(GALLERY_FILE)) writeFileSync(GALLERY_FILE, '[]', 'utf-8')
    return
  }

  console.log(`   ${productRecords.length} Produkt-Einträge mit Bild gefunden.`)

  const imageMap     = {}
  const productQueue = []

  for (const rec of productRecords) {
    const tUrl  = thumbUrl(rec.image)
    const fUrl  = fullUrl(rec.image)
    const tName = localName(tUrl, 'thumb')
    const fName = localName(fUrl, 'full')
    const entry = {
      thumb: `/product-images/${tName}`,
      full:  `/product-images/${fName}`,
    }
    imageMap[tUrl] = entry
    imageMap[fUrl] = entry
    productQueue.push({ url: tUrl, path: join(IMG_DIR, tName), label: `thumb ${rec._id}` })
    productQueue.push({ url: fUrl, path: join(IMG_DIR, fName), label: `full  ${rec._id}` })
  }

  const productDone = await runQueue(productQueue)
  console.log(`\n✅  ${productDone} Produktbild-Dateien in public/product-images/`)
  writeFileSync(MAP_FILE, JSON.stringify(imageMap, null, 2), 'utf-8')
  console.log(`✅  Produkt-Bild-Map gespeichert: src/generated/image-map.json`)

  // ── 2. Galerie-Bilder aus siteSettings ────────────────────────────────────
  console.log('\n🖼  Galerie-Bilder aus siteSettings werden abgerufen …')
  let galleryEntries
  try {
    galleryEntries = await fetchGalleryFromSettings()
  } catch (err) {
    console.warn('⚠️  Galerie-Abfrage fehlgeschlagen:', err.message)
    if (!existsSync(GALLERY_FILE)) writeFileSync(GALLERY_FILE, '[]', 'utf-8')
    return
  }

  console.log(`   ${galleryEntries.length} Galeriebilder gefunden.`)

  const galleryQueue  = []
  const galleryOutput = []

  for (const entry of galleryEntries) {
    if (!entry.image) continue
    const fUrl  = fullUrl(entry.image)
    const fName = localName(fUrl, 'gallery')
    galleryQueue.push({ url: fUrl, path: join(GALLERY_DIR, fName), label: `gallery` })
    galleryOutput.push({
      src:     `/gallery-images/${fName}`,
      alt:     entry.alt     ?? '',
      caption: entry.caption ?? null,
    })
  }

  const galleryDone = await runQueue(galleryQueue)
  console.log(`\n✅  ${galleryDone} Galeriebild-Dateien in public/gallery-images/`)
  writeFileSync(GALLERY_FILE, JSON.stringify(galleryOutput, null, 2), 'utf-8')
  console.log(`✅  Galerie-Liste gespeichert: src/generated/gallery-images.json`)
}

main().catch(err => {
  console.error('❌  fetch-images fehlgeschlagen:', err)
  process.exit(1)
})