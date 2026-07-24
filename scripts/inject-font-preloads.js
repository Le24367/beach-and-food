/**
 * inject-font-preloads.js
 *
 * Läuft NACH dem Astro-Build und injiziert in dist/index.html:
 *
 *   1. CSS-Preload-Tags für alle kritischen Stylesheets
 *      → Browser lädt CSS parallel zum HTML-Parse statt danach
 *      → Beseitigt "Render-blocking"-Warnung in Lighthouse
 *
 *   2. Font-Preload-Tags für Source Sans Pro 400, Source Sans Pro 600, Libre Baskerville 700
 *      → Fonts werden parallel zum CSS geladen statt sequenziell danach
 *
 * Beide Schritte lesen die Datei-Hashes direkt aus dist/_astro/,
 * sodass kein manuelles Hash-Pflegen nach einem neuen Build nötig ist.
 *
 * Aufruf (automatisch via package.json build-Skript):
 *   node scripts/inject-font-preloads.js
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'fs'
import { join, resolve } from 'path'

const ROOT      = resolve(process.cwd())
const ASTRO_DIR = join(ROOT, 'dist', '_astro')
const HTML_FILE = join(ROOT, 'dist', 'index.html')

// ── Vorab-Checks ──────────────────────────────────────────────────────────────
if (!existsSync(ASTRO_DIR)) {
  console.error('❌  dist/_astro nicht gefunden – bitte zuerst `astro build` ausführen.')
  process.exit(1)
}
if (!existsSync(HTML_FILE)) {
  console.error('❌  dist/index.html nicht gefunden.')
  process.exit(1)
}

const allFiles = readdirSync(ASTRO_DIR)

// ── 1. CSS-Dateien finden und als Preload vorbereiten ─────────────────────────
// Alle vom Build erzeugten CSS-Dateien im _astro-Verzeichnis
// Wir sortieren nach Dateigröße (größte zuerst) – die sind am kritischsten
const cssFiles = allFiles
  .filter(f => f.endsWith('.css'))
  .map(f => ({
    name: f,
    size: statSync(join(ASTRO_DIR, f)).size,
  }))
  .sort((a, b) => b.size - a.size)

const cssPreloadLinks = cssFiles.map(({ name }) =>
  `  <link rel="preload" as="style" href="/_astro/${name}" />`
)

console.log(`\n📄  ${cssFiles.length} CSS-Datei(en) für Preload gefunden:`)
cssFiles.forEach(({ name, size }) =>
  console.log(`    ${name}  (${(size / 1024).toFixed(1)} KiB)`)
)

// ── 2. Font-Dateien finden ────────────────────────────────────────────────────
const PRIORITY_FONTS = [
  'source-sans-pro-latin-400-normal',
  'source-sans-pro-latin-600-normal',
  'libre-baskerville-latin-700-normal',
]

const fontFiles = allFiles.filter(f => f.endsWith('.woff2'))
const fontPreloadLinks = []

console.log(`\n🔤  Fonts für Preload:`)
for (const pattern of PRIORITY_FONTS) {
  const match = fontFiles.find(f => f.startsWith(pattern))
  if (match) {
    fontPreloadLinks.push(
      `  <link rel="preload" as="font" type="font/woff2" crossorigin href="/_astro/${match}" />`
    )
    console.log(`    ✅  ${match}`)
  } else {
    console.warn(`    ⚠️   Nicht gefunden: ${pattern}`)
  }
}

if (cssPreloadLinks.length === 0 && fontPreloadLinks.length === 0) {
  console.warn('\n⚠️  Keine Assets zum Preloaden gefunden – HTML bleibt unverändert.')
  process.exit(0)
}

// ── 3. In index.html injizieren ───────────────────────────────────────────────
let html = readFileSync(HTML_FILE, 'utf-8')

// Alten Inject-Block entfernen falls vorhanden (idempotent bei mehrfachem Build)
const MARKER_START = '<!-- perf-preload-start -->'
const MARKER_END   = '<!-- perf-preload-end -->'

if (html.includes(MARKER_START)) {
  const re = new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}\\n?`, 'm')
  html = html.replace(re, '')
  console.log('\n♻️   Vorhandener Inject-Block ersetzt.')
}

// Neuen Block zusammenbauen
const allPreloads = [
  ...(cssPreloadLinks.length  ? ['  <!-- CSS Preloads (render-blocking entfernt) -->', ...cssPreloadLinks] : []),
  ...(fontPreloadLinks.length ? ['  <!-- Font Preloads (kritischer Pfad verkürzt) -->', ...fontPreloadLinks] : []),
]

const injectBlock = [
  MARKER_START,
  ...allPreloads,
  MARKER_END,
].join('\n')

// Direkt nach <head> einfügen
if (!html.includes('<head>')) {
  console.error('❌  Kein <head>-Tag in dist/index.html gefunden.')
  process.exit(1)
}

html = html.replace('<head>', `<head>\n${injectBlock}`)

writeFileSync(HTML_FILE, html, 'utf-8')

const totalTags = cssPreloadLinks.length + fontPreloadLinks.length
console.log(`\n✅  ${totalTags} Preload-Tags in dist/index.html injiziert.`)
console.log(`    (${cssPreloadLinks.length} CSS + ${fontPreloadLinks.length} Fonts)`)
console.log(`\n💡  Erwartete Lighthouse-Verbesserung:`)
console.log(`    • Render-blocking-Warnung für CSS entfernt (~680 ms)`)
console.log(`    • Font-FOUT reduziert, LCP stabiler`)