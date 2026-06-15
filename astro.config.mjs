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
      // Inline CSS unter 4KB direkt im HTML — verkürzt den kritischen Pfad
      assetsInlineLimit: 4096,
    },
  },
})