/// <reference types="astro/client" />

/**
 * Umgebungsvariablen
 *
 * WICHTIGE REGEL:
 *   Variablen OHNE "PUBLIC_" Präfix  → nur serverseitig / Build-Zeit
 *   Variablen MIT "PUBLIC_" Präfix   → auch im Browser-Bundle sichtbar
 *
 * SANITY_TOKEN hat kein PUBLIC_ → landet NIEMALS im Browser.
 * PUBLIC_SANITY_PROJECT_ID ist öffentlich → darf im Browser verwendet werden.
 */
interface ImportMetaEnv {
  // ── Serverseitig (geheim) ─────────────────────────────────────────
  readonly SANITY_TOKEN:      string   // Geheimer API-Token → NUR serverClient
  readonly SANITY_PROJECT_ID: string   // Wird für serverClient verwendet
  readonly SANITY_DATASET:    string   // z.B. "production"

  // ── Browser-sicher (PUBLIC_ Präfix) ──────────────────────────────
  readonly PUBLIC_SANITY_PROJECT_ID: string  // Gleiche ID, aber für publicClient + Browser
  readonly PUBLIC_SANITY_DATASET:    string

  // ── Google Places (Live-Öffnungszeiten) — nur serverseitig ───────
  // Siehe .env.example für Anleitung, wie man an beide Werte kommt.
  readonly GOOGLE_PLACES_API_KEY: string  // Google Cloud Console → API-Key mit "Places API" freigeschaltet
  readonly GOOGLE_PLACE_ID:       string  // Place ID des Google-Business-Eintrags
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}