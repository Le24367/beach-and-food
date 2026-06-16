import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://beachandfood.de',
  integrations: [
    sitemap(),
  ],
  vite: {
    build: {
      cssCodeSplit: true,
      // Beide CSS-Dateien zusammen ~9.5 KiB → Limit auf 12 KB setzen
      // damit sie inline eingebettet werden und nicht render-blocking laden.
      // Für eine kleine One-Page-Site ist das der richtige Trade-off:
      // kein extra HTTP-Request, kein render-blocking, marginaler HTML-Overhead.
      assetsInlineLimit: 12288,
    },
  },
})