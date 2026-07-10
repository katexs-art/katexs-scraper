// server.js — the Katexs Opportunity Scanner engine.
// Zero npm dependencies. Node 18+ (uses built-in fetch + http).
//
//   ANTHROPIC_API_KEY=sk-... PAGESPEED_API_KEY=AIza... node server.js
//
// Then POST { "url": "acmehvac.com" } to http://localhost:8787/scan
// Returns the full JSON report. Wire your Lovable "Scan" button to this.

const http = require("http");
const { analyze } = require("./detect");
const { enrich, applyPlacesToScore } = require("./places");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const PAGESPEED_API_KEY = process.env.PAGESPEED_API_KEY; // optional; speed just = null without it
const MODEL = process.env.MODEL || "claude-sonnet-5";
const PORT = process.env.PORT || 8787;

// Our fixed service menu — the model recommends only from this list.
const SERVICES = [
  "AI Receptionist (answers every call 24/7)",
  "Missed Call Recovery (texts back in 60s)",
  "Booking Agent (fills the calendar automatically)",
  "Free GHL CRM setup + pipeline",
  "AI Lead Generation (paid media add-on)",
];

function normalizeUrl(raw) {
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u;
}

async function fetchHomepage(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (KatexsScanner/1.0)" },
    });
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

async function fetchPageSpeed(url) {
  if (!PAGESPEED_API_KEY) return null;
  try {
    const api =
      "https://www.googleapis.com/pagespeedonline/v5/runPagespeed" +
      `?url=${encodeURIComponent(url)}&strategy=mobile&key=${PAGESPEED_API_KEY}`;
    const res = await fetch(api);
    const data = await res.json();
    const score = data?.lighthouseResult?.categories?.performance?.score;
    return score != null ? Math.round(score * 100) : null;
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = `You are an AI infrastructure consultant for Katexs, a company that deploys AI receptionists, missed-call recovery, booking agents, GHL CRM, and lead-gen for service businesses.

You are given ONLY signals detectable from a company's homepage source plus a PageSpeed score. Write a sharp sales-ready assessment.

HARD RULES — credibility depends on these:
- NEVER invent numbers. Do not state ad spend, revenue, employee count, or review counts — you cannot see them. If useful, say "runs paid ads (spend unknown)".
- Say "no X detected on the homepage", never "they have no X". Absence of a widget in page source is not proof.
- The opportunity score you are given is a heuristic, not a probability of buying. Do not restate it as a percent chance.
- Recommend ONLY from the provided Katexs service list.

Return STRICT JSON, no markdown, with this exact shape:
{
  "headline": string,                 // one punchy line a rep can read on a call
  "top_problems": [string, ...],      // 3-5, each tied to a detected signal
  "recommended_services": [string],   // subset of the provided list, ordered by ROI
  "why_now": string,                  // the single strongest reason to reach out today
  "cold_email": { "subject": string, "body": string },
  "linkedin_dm": string
}`;

async function runLLM(url, report) {
  if (!ANTHROPIC_API_KEY) {
    return { note: "ANTHROPIC_API_KEY not set — returning detection only." };
  }
  const placesLine = report.places?.matched
    ? `Google Places (real): ${report.places.name || "?"} · ${report.places.rating ?? "?"}★ · ${report.places.reviews ?? "?"} reviews · ${report.places.address || "?"} · ${report.places.status || "?"}`
    : "Google Places: no confident listing match — do not cite review/rating data.";

  const userContent =
    `Company URL: ${url}\n\n` +
    `Detected signals:\n${JSON.stringify(report.signals, null, 2)}\n\n` +
    `${placesLine}\n\n` +
    `Heuristic opportunity: ${report.opportunity.score}/100 (${report.opportunity.band})\n` +
    `Reasons: ${report.opportunity.reasons.join("; ")}\n\n` +
    `Katexs service menu (recommend only from these):\n- ${SERVICES.join("\n- ")}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return { raw: text, note: "Model did not return clean JSON; showing raw." };
  }
}

async function scan(rawUrl) {
  const url = normalizeUrl(rawUrl);
  const [html, speed] = await Promise.all([fetchHomepage(url), fetchPageSpeed(url)]);
  const report = analyze(html, { speed });

  // Enrich with real Google business data, then let it nudge the score.
  const places = await enrich(report.signals.meta, url);
  report.opportunity = applyPlacesToScore(report.opportunity, places);
  report.places = places;

  const ai = await runLLM(url, report);
  return {
    url,
    scanned_at: new Date().toISOString(),
    opportunity: report.opportunity,
    signals: report.signals,
    places,
    ai,
    disclaimer:
      "Signals are limited to homepage source + PageSpeed + Google Places. Score is a heuristic, not a purchase probability. No ad-spend or revenue figures are inferred.",
  };
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  if (req.method !== "POST" || req.url !== "/scan") {
    res.writeHead(404, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: "POST /scan with { url }" }));
  }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", async () => {
    try {
      const { url } = JSON.parse(body || "{}");
      if (!url) throw new Error("Missing 'url'");
      const result = await scan(url);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(result, null, 2));
    } catch (e) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: String(e.message || e) }));
    }
  });
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`Katexs scanner on http://localhost:${PORT}/scan`));
}

module.exports = { scan };
