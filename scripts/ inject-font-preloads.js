/**
 * inject-font-preloads.js
 *
 * Läuft NACH dem Astro-Build und:
 *   1. Liest alle *.woff2-Dateien aus dist/_astro/
 *   2. Filtert auf DM Sans 400, DM Sans 600 und Playfair Display 700
 *      (die drei am häufigsten genutzten → für oberen Seitenbereich kritisch)
 *   3. Fügt <link rel="preload"> Tags in dist/index.html ein,
 *      direkt nach dem öffnenden <head>-Tag
 *
 * Ergebnis: Fonts werden PARALLEL zum CSS geladen statt sequenziell danach.
 * Das verkürzt die kritische Pfad-Kette um ~200-600 ms.
 *
 * Aufruf (wird automatisch via package.json build-Skript aufgerufen):
 *   node scripts/inject-font-preloads.js
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'

const ROOT     = resolve(process.cwd())
const ASTRO_DIR = join(ROOT, 'dist', '_astro')
const HTML_FILE = join(ROOT, 'dist', 'index.html')

if (!existsSync(ASTRO_DIR)) {
  console.error('❌  dist/_astro nicht gefunden – bitte zuerst `astro build` ausführen.')
  process.exit(1)
}
if (!existsSync(HTML_FILE)) {
  console.error('❌  dist/index.html nicht gefunden.')
  process.exit(1)
}

// ── Relevante Font-Dateien finden ─────────────────────────────────────────────
const PRIORITY_FONTS = [
  'dm-sans-latin-400-normal',
  'dm-sans-latin-600-normal',
  'playfair-display-latin-700-normal',
]

const allFiles = readdirSync(ASTRO_DIR)
const fontFiles = allFiles.filter(f => f.endsWith('.woff2'))

const preloadLinks = []

for (const pattern of PRIORITY_FONTS) {
  const match = fontFiles.find(f => f.startsWith(pattern))
  if (match) {
    preloadLinks.push(
      `  <link rel="preload" as="font" type="font/woff2" crossorigin href="/_astro/${match}" />`
    )
    console.log(`✅  Font gefunden: ${match}`)
  } else {
    console.warn(`⚠️  Font nicht gefunden: ${pattern}`)
  }
}

if (preloadLinks.length === 0) {
  console.warn('⚠️  Keine Fonts zum Preloaden gefunden – HTML bleibt unverändert.')
  process.exit(0)
}

// ── In index.html injizieren ──────────────────────────────────────────────────
let html = readFileSync(HTML_FILE, 'utf-8')

const MARKER = '<!-- font-preload-inject -->'
const INJECT = `${MARKER}\n${preloadLinks.join('\n')}`

if (html.includes(MARKER)) {
  // Bereits injiziert (z.B. zweiter Build) → ersetzen
  html = html.replace(new RegExp(`${MARKER}[\\s\\S]*?(?=<link|<meta|<title|<script)`, 'm'), INJECT + '\n  ')
} else {
  // Ersten Mal: direkt nach <head> einfügen
  html = html.replace('<head>', `<head>\n${INJECT}`)
}

writeFileSync(HTML_FILE, html, 'utf-8')
console.log(`\n✅  ${preloadLinks.length} Font-Preload-Tags in dist/index.html injiziert.`)