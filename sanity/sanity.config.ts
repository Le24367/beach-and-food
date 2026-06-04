import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { schemaTypes } from './schemas'

// ── Trage hier deine Sanity-Projekt-ID und Dataset ein ──────────
// Du findest beides unter https://sanity.io/manage → dein Projekt
const PROJECT_ID = 'DEINE_PROJECT_ID'   // z.B. 'ab12cd34'
const DATASET    = 'production'          // Standard-Dataset
// ────────────────────────────────────────────────────────────────

export default defineConfig({
  name: 'beach-and-food',
  title: 'Beach and Food – CMS',

  projectId: PROJECT_ID,
  dataset: DATASET,

  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title('Beach and Food')
          .items([
            // Speisekarte
            S.listItem()
              .title('🍽️  Speisekarte')
              .child(
                S.documentTypeList('menuCategory')
                  .title('Kategorien')
              ),

            S.divider(),

            // Einstellungen als Singleton (nur 1 Dokument)
            S.listItem()
              .title('⚙️  Einstellungen')
              .child(
                S.document()
                  .schemaType('siteSettings')
                  .documentId('siteSettings')
                  .title('Öffnungszeiten & Adresse')
              ),
          ]),
    }),

    // GROQ-Query Playground (nur im Dev-Modus sichtbar)
    visionTool(),
  ],

  schema: {
    types: schemaTypes,
  },
})
