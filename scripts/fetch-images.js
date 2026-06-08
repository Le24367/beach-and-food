/**
 * fetch-images.mjs
 *
 * Läuft VOR dem Astro-Build und:
 *   1. Fragt Sanity nach allen Bild-Referenzen (MenuItems, MenuCategories, MenuSubCategories)
 *   2. Lädt jedes Bild in zwei Versionen herunter:
 *        - thumb:  200×200 px, quality 40  → schnell, für Kacheln im Modal
 *        - full:  1200px breit, quality 85 → für die Lightbox
 *   3. Speichert die Dateien in public/product-images/
 *   4. Schreibt src/generated/image-map.json  { sanityUrl → { thumb, full } }
 *
 * Nach dem Build liegen alle Bilder statisch auf Vercel/Cloudflare.
 * Kein Besucher kontaktiert Sanity zur Laufzeit.
 */

import { createClient } from '@sanity/client'
import imageUrlBuilder  from '@sanity/image-url'
import { createHash }   from 'crypto'
import { existsSync, mkdirSync, writeFileSync, createWriteStream } from 'fs'
import { pipeline }     from 'stream/promises'
import { resolve, join } from 'path'
import { get as httpsGet } from 'https'

// ── Verzeichnisse ─────────────────────────────────────────────────────────────
const ROOT       = resolve(process.cwd())
const IMG_DIR    = join(ROOT, 'public', 'product-images')
const GEN_DIR    = join(ROOT, 'src', 'generated')
const MAP_FILE   = join(GEN_DIR, 'image-map.json')

for (const dir of [IMG_DIR, GEN_DIR]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

// ── Sanity Client ─────────────────────────────────────────────────────────────
const PROJECT_ID = '6a4o5kn7'
const DATASET    = 'production'

const client = createClient({
  projectId:  PROJECT_ID,
  dataset:    DATASET,
  apiVersion: '2024-01-01',
  useCdn:     false,   // Immer Origin beim Build, damit nichts gecacht wird
})

const builder = imageUrlBuilder(client)

function urlFor(source) {
  return builder.image(source)
}

// ── Bild-Versionen ────────────────────────────────────────────────────────────
function thumbUrl(source) {
  return urlFor(source).width(200).height(200).fit('crop').quality(40).auto('format').url()
}
function fullUrl(source) {
  return urlFor(source).width(1200).quality(85).auto('format').url()
}

// ── Dateiname aus URL-Hash ────────────────────────────────────────────────────
// Wir hashen die Sanity-Asset-ID, damit der Dateiname deterministisch und
// unabhängig von Query-Parametern ist.
function localName(sanityUrl, suffix) {
  const hash = createHash('sha1').update(sanityUrl).digest('hex').slice(0, 12)
  // Endung: Sanity liefert meist .webp wenn auto('format') gesetzt ist
  return `${hash}-${suffix}.webp`
}

// ── Download-Funktion ─────────────────────────────────────────────────────────
async function download(url, destPath) {
  // Bereits vorhanden? Überspringen → beschleunigt Rebuilds enorm
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

// ── Sanity-Daten holen ────────────────────────────────────────────────────────
async function fetchAllImages() {
  const [items, categories, subCats] = await Promise.all([
    client.fetch(`*[_type == "menuItem" && active == true && defined(image)] { _id, image }`),
    client.fetch(`*[_type == "menuCategory" && active == true && defined(image)] { _id, image }`),
    client.fetch(`*[_type == "menuSubCategory" && active == true && defined(image)] { _id, image }`),
  ])
  return [...items, ...categories, ...subCats]
}

// ── Hauptprogramm ─────────────────────────────────────────────────────────────
async function main() {
  console.log('🖼  Sanity-Bilder werden abgerufen …')
  let records
  try {
    records = await fetchAllImages()
  } catch (err) {
    console.warn('⚠️  Sanity nicht erreichbar – Bild-Download übersprungen.', err.message)
    // Falls Map schon existiert, weiterlaufen lassen (z.B. bei erneutem lokalen Build)
    if (!existsSync(MAP_FILE)) writeFileSync(MAP_FILE, '{}', 'utf-8')
    return
  }

  console.log(`   ${records.length} Einträge mit Bild gefunden.`)

  const imageMap = {}   // { sanityThumbUrl → { thumb: '/product-images/…', full: '/product-images/…' } }
  const queue    = []

  for (const rec of records) {
    const tUrl  = thumbUrl(rec.image)
    const fUrl  = fullUrl(rec.image)
    const tName = localName(tUrl, 'thumb')
    const fName = localName(fUrl, 'full')
    const tPath = join(IMG_DIR, tName)
    const fPath = join(IMG_DIR, fName)

    // Map: Sanity-Thumb-URL → lokale Pfade (relativ zu public/)
    imageMap[tUrl] = {
      thumb: `/product-images/${tName}`,
      full:  `/product-images/${fName}`,
    }

    queue.push({ url: tUrl, path: tPath, label: `thumb ${rec._id}` })
    queue.push({ url: fUrl, path: fPath, label: `full  ${rec._id}` })
  }

  // Downloads parallel, aber max. 6 gleichzeitig (Rate-Limit-freundlich)
  const CONCURRENCY = 6
  let i = 0
  let done = 0

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

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  console.log(`\n✅  ${done} Dateien in public/product-images/`)

  writeFileSync(MAP_FILE, JSON.stringify(imageMap, null, 2), 'utf-8')
  console.log(`✅  Bild-Map gespeichert: src/generated/image-map.json`)
}

main().catch(err => {
  console.error('❌  fetch-images fehlgeschlagen:', err)
  process.exit(1)
})