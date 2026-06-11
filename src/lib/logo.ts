/**
 * logo.ts
 *
 * Sucht zur Build-Zeit in public/logo/ nach einer Logo-Datei
 * und gibt den passenden öffentlichen Pfad zurück.
 *
 * Unterstützte Formate (Priorität): svg → png → webp → jpg → jpeg
 * Fallback: /logo/logo.png (damit der <img> nicht leer bleibt)
 *
 * Kein @types/node nötig — verwendet nur Web-Standard-APIs.
 */

const FORMATS = ['svg', 'png', 'webp', 'jpg', 'jpeg'] as const

function findLogo(): string {
  for (const ext of FORMATS) {
    try {
      // import.meta.glob prüft zur Build-Zeit ob die Datei existiert
      const glob = import.meta.glob('/public/logo/*', { eager: false })
      const key  = `/public/logo/logo.${ext}`
      if (key in glob) return `/logo/logo.${ext}`
    } catch {
      // ignore
    }
  }
  return '/logo/logo.png'
}

// import.meta.glob muss auf oberster Ebene stehen (Vite-Einschränkung)
const _glob = import.meta.glob('/public/logo/*', { eager: false })

export const LOGO_SRC = (() => {
  for (const ext of FORMATS) {
    if (`/public/logo/logo.${ext}` in _glob) return `/logo/logo.${ext}`
  }
  return '/logo/logo.png'
})()