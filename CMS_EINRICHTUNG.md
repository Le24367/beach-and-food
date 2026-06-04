# Beach and Food – CMS Einrichtung

## 1. Abhängigkeiten installieren

```bash
npm install
```

## 2. Sanity Projekt-ID eintragen

Öffne diese beiden Dateien und trage deine Projekt-ID ein:

- `sanity/sanity.config.ts` → Zeile: `const PROJECT_ID = 'DEINE_PROJECT_ID'`
- `src/lib/sanity.ts`       → Zeile: `const PROJECT_ID = 'DEINE_PROJECT_ID'`

Deine Projekt-ID findest du unter https://sanity.io/manage → dein Projekt.

## 3. Sanity Studio einrichten

```bash
# Im Projektordner:
cd sanity
npx sanity init --reconfigure

# Oder Studio direkt starten (nach einmaliger Initialisierung):
npx sanity dev
```

Das Studio läuft dann auf http://localhost:3333

## 4. CORS-Einstellungen in Sanity

Damit Astro auf die Sanity-API zugreifen darf:

1. https://sanity.io/manage → dein Projekt → API → CORS Origins
2. `http://localhost:4321` hinzufügen (Astro Dev-Server)
3. Später auch deine Produktions-Domain hinzufügen

## 5. Inhalte in Sanity pflegen

### Speisekarte
- Studio → **Speisekarte** → **Neue Kategorie** anlegen
- Felder: Name, Beschreibung, Bild, Emoji (Fallback), Badge, Reihenfolge
- `Aktiv`-Toggle zum schnellen Ein-/Ausblenden

### Öffnungszeiten & Adresse
- Studio → **Einstellungen**
- Öffnungszeiten-Einträge können frei hinzugefügt, bearbeitet und gelöscht werden

## 6. Astro starten

```bash
npm run dev    # Entwicklung auf http://localhost:4321
npm run build  # Produktions-Build
```

## Hinweis: Statischer Build vs. On-Demand

Astro baut standardmäßig **statisch** — Sanity-Daten werden beim `npm run build`
einmalig abgerufen. Nach Änderungen im CMS muss also neu gebaut werden.

Für automatische Aktualisierungen ohne Re-Build:
→ Sanity Webhook → Build-Hook deines Hosting-Anbieters (Netlify/Vercel) einrichten.
