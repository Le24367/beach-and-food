import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import vercel from '@astrojs/vercel'

export default defineConfig({
  // FIX: www-Domain, passend zur bisherigen, extern verlinkten und bei
  // Google indexierten Version (Google Maps, Yelp, TripAdvisor, Facebook
  // verlinken auf www.beachandfood.de). Die Sitemap wird mit dieser
  // Domain generiert — daher muss dieser Wert exakt zur finalen,
  // öffentlichen URL passen.
  site: 'https://www.beachandfood.de',
  // "output" bleibt auf dem Astro-Default 'static' -- fast die gesamte
  // Seite bleibt vorgerendertes HTML wie bisher (kein Umstieg auf volles
  // SSR). Der Adapter wird trotzdem gebraucht, weil /api/opening-hours.json
  // sich per "export const prerender = false" davon abmeldet und zur
  // Laufzeit (on-demand) läuft, um live bei Google nachzufragen -- dafür
  // braucht Astro einen Server-Adapter, auch im "static"-Modus. Vercel
  // passt hier, weil das Projekt schon dort gehostet wird (vercel.json,
  // @vercel/analytics) -- Astro/Vercel führt diese eine Route dann als
  // Vercel Function aus, der Rest bleibt statisches Hosting wie bisher.
  output: 'static',
  adapter: vercel(),
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