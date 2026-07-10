// places.js — enrich a scan with REAL business data from Google Places (New).
// Turns "we think they get leads" into "4.2 stars, 87 reviews, verified open".
// No fabrication: if we can't confidently match a listing, we return null and say so.
//
// Uses Places API (New) Text Search:
//   POST https://places.googleapis.com/v1/places:searchText
// Set GOOGLE_PLACES_API_KEY in the environment.

const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Strip a homepage <title> down to something searchable ("Acme HVAC — Dallas AC" -> "Acme HVAC Dallas AC")
function businessQueryFromMeta(meta, url) {
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } })();
  const raw = (meta.title || meta.h1 || host || "").split(/[|\-–—:·]/)[0].trim();
  return raw || host;
}

async function enrich(meta, url) {
  if (!PLACES_KEY) return { available: false, reason: "GOOGLE_PLACES_API_KEY not set" };
  const query = businessQueryFromMeta(meta, url);
  if (!query) return { available: false, reason: "No business name derivable from page" };

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": PLACES_KEY,
        // Only request the fields we use — keeps it in the cheaper billing SKU.
        "X-Goog-FieldMask": [
          "places.displayName",
          "places.formattedAddress",
          "places.rating",
          "places.userRatingCount",
          "places.businessStatus",
          "places.primaryTypeDisplayName",
          "places.websiteUri",
        ].join(","),
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: 3 }),
    });
    const data = await res.json();
    const places = data.places || [];
    if (places.length === 0) return { available: true, matched: false, query };

    // Prefer a listing whose website matches the domain we scanned — that's a confident match.
    const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } })();
    const byDomain = places.find(
      (p) => p.websiteUri && p.websiteUri.replace(/^https?:\/\/(www\.)?/, "").startsWith(host)
    );
    const top = byDomain || places[0];

    return {
      available: true,
      matched: true,
      confident: Boolean(byDomain), // only true when the Google listing links back to their site
      name: top.displayName?.text || null,
      address: top.formattedAddress || null,
      rating: top.rating ?? null,
      reviews: top.userRatingCount ?? null,
      status: top.businessStatus || null,
      category: top.primaryTypeDisplayName?.text || null,
      query,
    };
  } catch (e) {
    return { available: false, reason: String(e.message || e) };
  }
}

// Nudge the opportunity score using REAL review signal.
// Lots of reviews = established demand = a lead-handling gap costs them more.
function applyPlacesToScore(opportunity, places) {
  if (!places?.matched || places.reviews == null) return opportunity;
  const reasons = [...opportunity.reasons];
  let score = opportunity.score;
  if (places.reviews >= 100) { score += 10; reasons.push(`${places.reviews} Google reviews — high call volume, more leads at stake`); }
  else if (places.reviews >= 25) { score += 5; reasons.push(`${places.reviews} Google reviews — established local demand`); }
  if (places.rating != null && places.rating < 4.0) { reasons.push(`${places.rating}★ rating — review-request automation is an easy add-on win`); }
  score = Math.max(0, Math.min(100, score));
  const band = score >= 70 ? "High" : score >= 45 ? "Medium" : "Low";
  return { score, band, reasons };
}

module.exports = { enrich, applyPlacesToScore, businessQueryFromMeta };
