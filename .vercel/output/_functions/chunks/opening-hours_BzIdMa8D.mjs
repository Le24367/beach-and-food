const TTL_MS = 24 * 60 * 60 * 1e3;
const GOOGLE_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];
let cache = null;
function toHHMM(time) {
  return `${time.slice(0, 2)}:${time.slice(2, 4)}`;
}
function convertPeriods(periods) {
  return periods.filter((p) => p.open && p.close).map((p) => ({
    dayOfWeek: [GOOGLE_WEEKDAYS[p.open.day]],
    opens: toHHMM(p.open.time),
    closes: toHHMM(p.close.time)
  }));
}
async function getGoogleOpeningHours(env) {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.value;
  }
  const apiKey = env.GOOGLE_PLACES_API_KEY;
  const placeId = env.GOOGLE_PLACE_ID;
  if (!apiKey || !placeId) {
    return {
      ok: false,
      source: "error",
      fetchedAt: new Date(now).toISOString(),
      error: "GOOGLE_PLACES_API_KEY oder GOOGLE_PLACE_ID ist nicht gesetzt (.env / Vercel Env Vars prüfen)."
    };
  }
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("fields", "opening_hours");
    url.searchParams.set("language", "de");
    url.searchParams.set("key", apiKey);
    const res = await fetch(url, { signal: AbortSignal.timeout(8e3) });
    if (!res.ok) {
      return {
        ok: false,
        source: "error",
        fetchedAt: new Date(now).toISOString(),
        error: `Google Places API antwortete mit HTTP ${res.status}.`
      };
    }
    const data = await res.json();
    if (data.status !== "OK") {
      return {
        ok: false,
        source: "error",
        fetchedAt: new Date(now).toISOString(),
        error: `Google Places API status "${data.status}"${data.error_message ? `: ${data.error_message}` : ""}`
      };
    }
    const opening = data.result?.opening_hours;
    if (!opening?.periods) {
      return {
        ok: false,
        source: "error",
        fetchedAt: new Date(now).toISOString(),
        error: "Google-Eintrag hat keine opening_hours.periods (z.B. Feld nicht angefragt oder Google hat keine Öffnungszeiten hinterlegt)."
      };
    }
    const value = {
      ok: true,
      source: "google",
      fetchedAt: new Date(now).toISOString(),
      openNow: opening.open_now ?? null,
      periods: convertPeriods(opening.periods),
      weekdayText: opening.weekday_text ?? []
    };
    cache = { value, expiresAt: now + TTL_MS };
    return value;
  } catch (e) {
    return {
      ok: false,
      source: "error",
      fetchedAt: new Date(now).toISOString(),
      error: e instanceof Error ? `Fetch fehlgeschlagen: ${e.message}` : "Fetch fehlgeschlagen (unbekannter Fehler)."
    };
  }
}

const prerender = false;
const GET = async () => {
  const env = {
    GOOGLE_PLACES_API_KEY: "AIzaSyC7kCBZleJHnTZq1yYpkFrgNr_PwqsIdyo",
    GOOGLE_PLACE_ID: "ChIJg2PYXul-rUcRflC8UwzCGB0"
  };
  const result = await getGoogleOpeningHours(env);
  const cacheControl = result.ok ? "public, max-age=0, s-maxage=86400, stale-while-revalidate=3600" : "public, max-age=0, s-maxage=60, stale-while-revalidate=30";
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheControl
    }
  });
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
