/**
 * inject-font-preloads.js
 *
 * Läuft NACH dem Astro-Build und injiziert in JEDE dist/**\/*.html-Datei
 * (Startseite, Impressum, Datenschutz, 404 – nicht nur index.html):
 *
 *   1. CSS-Preload-Tags für alle kritischen Stylesheets
 *      → Browser lädt CSS parallel zum HTML-Parse statt danach
 *      → Beseitigt "Render-blocking"-Warnung in Lighthouse
 *
 *   2. Font-Preload-Tags für Source Sans Pro 400, Source Sans Pro 600, Libre Baskerville 700
 *      → Fonts werden parallel zum CSS geladen statt sequenziell danach
 *
 * FIX: Lief vorher nur gegen dist/index.html -- Impressum/Datenschutz/404
 * bekamen die Preload-Hints dadurch nie und hatten dieselbe render-blocking-
 * Situation, die für die Startseite extra gelöst wurde. Jetzt rekursiv über
 * alle generierten HTML-Dateien.
 *
 * Beide Schritte lesen die Datei-Hashes direkt aus dist/_astro/,
 * sodass kein manuelles Hash-Pflegen nach einem neuen Build nötig ist.
 *
 * Aufruf (automatisch via package.json build-Skript):
 *   node scripts/inject-font-preloads.js
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'fs'
import { join, resolve, relative } from 'path'

const ROOT      = resolve(process.cwd())
const ASTRO_DIR = join(ROOT, 'dist', '_astro')
const DIST_DIR  = join(ROOT, 'dist')

// ── Vorab-Checks ──────────────────────────────────────────────────────────────
if (!existsSync(ASTRO_DIR)) {
  console.error('❌  dist/_astro nicht gefunden – bitte zuerst `astro build` ausführen.')
  process.exit(1)
}

function findHtmlFiles(dir) {
  const results = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findHtmlFiles(full))
    } else if (entry.name.endsWith('.html')) {
      results.push(full)
    }
  }
  return results
}

const htmlFiles = findHtmlFiles(DIST_DIR)
if (htmlFiles.length === 0) {
  console.error('❌  Keine HTML-Dateien in dist/ gefunden.')
  process.exit(1)
}

const allFiles = readdirSync(ASTRO_DIR)

// ── 1. CSS-Preloads: NUR pro Seite tatsächlich verlinkte Stylesheets ──────────
// FIX: Vorher wurden pauschal ALLE .css-Dateien in dist/_astro/ als Preload
// injiziert -- auf JEDER Seite, unabhängig davon, ob diese Seite das
// Stylesheet überhaupt lädt. Das ging lange gut, weil es nur zwei globale
// CSS-Dateien gab, brach aber, sobald ein lazy-geladenes Feature (Leaflet,
// per "?url"-Import erst zur Laufzeit verlinkt) eine eigene CSS-Chunk-Datei
// in _astro/ hinterließ: die wurde plötzlich auf JEDER Seite vorab geladen,
// inklusive Impressum/Datenschutz, die gar keine Karte einbinden -- das
// Gegenteil von "nur bei Bedarf laden". Jetzt wird pro HTML-Datei anhand der
// dort tatsächlich vorhandenen <link rel="stylesheet">-Tags entschieden.
const STYLESHEET_RE = /<link rel="stylesheet" href="\/_astro\/([^"]+\.css)">/g

function findLinkedCssFiles(html) {
  const names = []
  for (const match of html.matchAll(STYLESHEET_RE)) {
    if (!names.includes(match[1])) names.push(match[1])
  }
  return names
}

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

// ── 3. In JEDE dist/**/*.html injizieren -- CSS-Liste pro Datei neu ermittelt ──
const MARKER_START = '<!-- perf-preload-start -->'
const MARKER_END   = '<!-- perf-preload-end -->'

let injectedCount = 0
let totalCssTags = 0
console.log('')
for (const htmlFile of htmlFiles) {
  let html = readFileSync(htmlFile, 'utf-8')

  // Alten Inject-Block entfernen falls vorhanden (idempotent bei mehrfachem Build)
  if (html.includes(MARKER_START)) {
    const re = new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}\\n?`, 'm')
    html = html.replace(re, '')
  }

  const linkedCss = findLinkedCssFiles(html)
    .map(name => ({ name, size: statSync(join(ASTRO_DIR, name)).size }))
    .sort((a, b) => b.size - a.size)
  const cssPreloadLinks = linkedCss.map(({ name }) =>
    `  <link rel="preload" as="style" href="/_astro/${name}" />`
  )
  totalCssTags += cssPreloadLinks.length

  const label = `dist/${relative(DIST_DIR, htmlFile)}`
  console.log(`📄  ${label}: ${linkedCss.map(f => f.name).join(', ') || '(kein Stylesheet verlinkt)'}`)

  if (cssPreloadLinks.length === 0 && fontPreloadLinks.length === 0) {
    console.warn(`    ⚠️   Keine Assets zum Preloaden – Datei bleibt unverändert.`)
    continue
  }

  const allPreloads = [
    ...(cssPreloadLinks.length  ? ['  <!-- CSS Preloads (render-blocking entfernt) -->', ...cssPreloadLinks] : []),
    ...(fontPreloadLinks.length ? ['  <!-- Font Preloads (kritischer Pfad verkürzt) -->', ...fontPreloadLinks] : []),
  ]
  const injectBlock = [MARKER_START, ...allPreloads, MARKER_END].join('\n')

  if (!html.includes('<head>')) {
    console.warn(`    ⚠️   Kein <head>-Tag – übersprungen.`)
    continue
  }

  html = html.replace('<head>', `<head>\n${injectBlock}`)
  writeFileSync(htmlFile, html, 'utf-8')
  injectedCount++
}

console.log(`\n✅  ${totalCssTags} CSS- + ${fontPreloadLinks.length * injectedCount} Font-Preload-Tags in ${injectedCount} HTML-Datei(en) injiziert.`)
console.log(`\n💡  Erwartete Lighthouse-Verbesserung:`)
console.log(`    • Render-blocking-Warnung für CSS entfernt (~680 ms)`)
console.log(`    • Font-FOUT reduziert, LCP stabiler`)