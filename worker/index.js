/**
 * Bansko 2027 — CSV proxy
 *
 * Zoho's published-sheet endpoint returns the CSV happily to a server, but sends
 * no Access-Control-Allow-Origin header, so a browser can't fetch it directly.
 * This Worker sits in the middle: it fetches server-side and re-serves with CORS.
 *
 * Useful side effect: the Zoho URL never reaches the browser, so the sheet isn't
 * discoverable from the page source or the repo. That's a genuine improvement on
 * the original Google Sheets design, where the data URL was public.
 */

// The published CSV link lives in a Worker secret, NOT in this file — this repo
// is public, and anyone holding that URL can read the whole roster including
// everyone's access keys.
//
// Set or rotate it with:
//   echo "https://sheet.zohopublic.eu/sheet/published/<id>?download=csv&sheetname=Sheet1" \
//     | npx wrangler secret put SHEET_CSV

// Only the trip site may read this. Anything else gets refused.
const ALLOWED_ORIGINS = [
  "https://bansko.jh-tech.co.uk",
  "http://localhost:8752",   // local preview
];

const corsHeaders = origin => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Vary": "Origin",
});

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = ALLOWED_ORIGINS.includes(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: allowed ? 204 : 403,
        headers: allowed ? corsHeaders(origin) : {},
      });
    }

    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    // No Origin at all means a direct visit rather than a page fetch. Let it
    // through unlabelled so it's easy to eyeball, but don't hand out CORS.
    if (origin && !allowed) {
      return new Response("Not allowed from this origin", { status: 403 });
    }

    if (!env.SHEET_CSV) {
      return new Response(
        "SHEET_CSV secret is not set on this Worker. See the comment at the top of index.js.",
        { status: 500, headers: origin ? corsHeaders(origin) : {} }
      );
    }

    let upstream;
    try {
      upstream = await fetch(env.SHEET_CSV, {
        // 60s edge cache: Zoho's publish endpoint is slow and the roster
        // changes a handful of times a year, not a second.
        cf: { cacheTtl: 60, cacheEverything: true },
      });
    } catch (err) {
      return new Response("Could not reach the sheet: " + err.message, {
        status: 502,
        headers: origin ? corsHeaders(origin) : {},
      });
    }

    if (!upstream.ok) {
      return new Response("Sheet returned HTTP " + upstream.status, {
        status: 502,
        headers: origin ? corsHeaders(origin) : {},
      });
    }

    const csv = await upstream.text();

    // A published-but-empty sheet, or an unpublished one, comes back as HTML.
    // Fail loudly rather than letting the page try to parse a login screen.
    if (!/^\s*(name|"name")\s*,/i.test(csv)) {
      return new Response(
        "That didn't look like the roster CSV. Check the sheet is still published " +
        "and that the first column is called Name.",
        { status: 502, headers: origin ? corsHeaders(origin) : {} }
      );
    }

    return new Response(csv, {
      headers: {
        ...(origin ? corsHeaders(origin) : {}),
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "public, max-age=60",
      },
    });
  },
};
