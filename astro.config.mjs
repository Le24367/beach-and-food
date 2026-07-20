import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  // FIX: www-Domain, passend zur bisherigen, extern verlinkten und bei
  // Google indexierten Version (Google Maps, Yelp, TripAdvisor, Facebook
  // verlinken auf www.beachandfood.de). Die Sitemap wird mit dieser
  // Domain generiert — daher muss dieser Wert exakt zur finalen,
  // öffentlichen URL passen.
  site: 'https://www.beachandfood.de',
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