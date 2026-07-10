// pipeline.js — 4 phases: discover -> find emails -> verify -> export & email
// Uses global fetch / FormData / Blob (Node 18+).

const SERPER = process.env.SERPER_API_KEY;
const MV = process.env.MILLIONVERIFIER_API_KEY;
const RESEND = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "leads@katexs.com";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Domains we never treat as a business's real email/website
const JUNK_DOMAINS = new Set([
  "instagram.com", "facebook.com", "linkedin.com", "yelp.com", "zocdoc.com",
  "healthgrades.com", "wellness.com", "vagaro.com", "yellowpages.com",
  "tiktok.com", "x.com", "twitter.com", "youtube.com", "sharecare.com",
  "apple.com", "google.com", "goo.gl", "bit.ly", "wixsite.com",
]);
const REJECT_LOCALPARTS = ["noreply", "no-reply", "donotreply", "wordpress", "mailer", "postmaster", "webmaster", "example", "sentry", "wixpress"];
const FREE_HOSTS = new Set(["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com", "icloud.com", "live.com", "msn.com"]);

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

function domainOf(url = "") {
  try {
    if (!/^https?:\/\//i.test(url)) return "";
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch { return ""; }
}
function cityOf(address = "") {
  // "1234 Main St, Dallas, TX 75201" -> "Dallas"
  const parts = address.split(",").map((s) => s.trim());
  return parts.length >= 2 ? parts[parts.length - 2] : "";
}

// ---------- Phase 1: DISCOVER (Serper /maps) ----------
async function serperMaps(queries) {
  const res = await fetch("https://google.serper.dev/maps", {
    method: "POST",
    headers: { "X-API-KEY": SERPER, "Content-Type": "application/json" },
    body: JSON.stringify(queries),
  });
  if (!res.ok) throw new Error(`Serper maps ${res.status}: ${await res.text()}`);
  return res.json();
}

async function discover({ businessType, cities, state, count, log }) {
  const perCity = Math.max(1, Math.ceil(count / cities.length));
  const pages = Math.min(5, Math.ceil(perCity / 20)); // ~20 results/page, cap 5 pages
  const queries = [];
  for (const city of cities) {
    for (let page = 1; page <= pages; page++) {
      queries.push({ q: `${businessType} in ${city}, ${state}`, gl: "us", page });
    }
  }
  log(`Discovery: ${queries.length} queries across ${cities.length} cities`);

  const seen = new Map();
  // Serper accepts up to 100 query objects per POST
  for (let i = 0; i < queries.length; i += 100) {
    const batch = queries.slice(i, i + 100);
    let data;
    try { data = await serperMaps(batch); }
    catch (e) { log(`  maps batch failed: ${e.message}`); continue; }
    const arr = Array.isArray(data) ? data : [data];
    for (const block of arr) {
      for (const p of block.places || []) {
        const cid = String(p.cid || p.placeId || p.title + p.address);
        if (!cid || seen.has(cid)) continue;
        const website = p.website || "";
        seen.set(cid, {
          name: p.title || "",
          phone: p.phoneNumber || "",
          website,
          domain: domainOf(website),
          address: p.address || "",
          city: cityOf(p.address || ""),
          rating: p.rating ?? "",
          review_count: p.ratingCount ?? "",
          category: p.type || (p.types ? p.types[0] : "") || "",
          latitude: p.latitude ?? "",
          longitude: p.longitude ?? "",
          cid,
          place_id: p.placeId || "",
          email: "",
          email_status: "",
        });
      }
    }
    log(`  discovered ${seen.size} unique so far`);
  }
  return [...seen.values()].slice(0, count);
}

// ---------- Phase 2: FIND EMAILS (Serper /search) ----------
async function serperSearch(queries) {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": SERPER, "Content-Type": "application/json" },
    body: JSON.stringify(queries),
  });
  if (!res.ok) throw new Error(`Serper search ${res.status}: ${await res.text()}`);
  return res.json();
}

function pickEmail(leadDomain, text) {
  const found = (text.match(EMAIL_RE) || []).map((e) => e.toLowerCase());
  const clean = found.filter((e) => {
    const [local, host] = e.split("@");
    if (!host) return false;
    if (REJECT_LOCALPARTS.some((r) => local.includes(r))) return false;
    if (JUNK_DOMAINS.has(host)) return false;
    if (/\.(png|jpg|jpeg|gif|webp|svg)$/.test(e)) return false;
    return true;
  });
  if (!clean.length) return null;
  // Prefer an email on the lead's own domain
  const sameDomain = clean.find((e) => leadDomain && e.endsWith("@" + leadDomain));
  if (sameDomain) return sameDomain;
  // Otherwise prefer a non-free business-looking address
  const business = clean.find((e) => !FREE_HOSTS.has(e.split("@")[1]));
  return business || clean[0];
}

async function findEmails(leads, log) {
  const targets = leads.filter((l) => l.domain && !JUNK_DOMAINS.has(l.domain));
  log(`Email search: ${targets.length} leads with a real website`);
  for (let i = 0; i < targets.length; i += 100) {
    const batch = targets.slice(i, i + 100);
    const queries = batch.map((l) => ({ q: `"${l.domain}" email`, gl: "us", num: 10 }));
    let data;
    try { data = await serperSearch(queries); }
    catch (e) { log(`  search batch failed: ${e.message}`); continue; }
    const arr = Array.isArray(data) ? data : [data];
    arr.forEach((block, idx) => {
      const lead = batch[idx];
      if (!lead) return;
      const text = (block.organic || [])
        .map((o) => `${o.title || ""} ${o.snippet || ""} ${o.link || ""}`)
        .join(" ");
      const email = pickEmail(lead.domain, text);
      if (email) lead.email = email;
    });
    log(`  processed ${Math.min(i + 100, targets.length)}/${targets.length}`);
  }
  const withEmail = leads.filter((l) => l.email).length;
  log(`Emails found: ${withEmail}`);
}

// ---------- Phase 3: VERIFY (MillionVerifier bulk) ----------
async function verify(leads, log) {
  const emails = [...new Set(leads.filter((l) => l.email).map((l) => l.email))];
  if (!emails.length || !MV) { log("Verify: skipped (no emails or no MV key)"); return; }
  log(`Verify: uploading ${emails.length} emails to MillionVerifier`);

  const form = new FormData();
  form.append("file_contents", new Blob([emails.join("\n")], { type: "text/plain" }), "emails.txt");
  form.append("file_name", "katexs-scrape");

  let fileId;
  try {
    const up = await fetch(`https://bulkapi.millionverifier.com/bulkapi/v2/upload?key=${MV}`, { method: "POST", body: form });
    const j = await up.json();
    fileId = j.file_id;
    if (!fileId) throw new Error("no file_id in upload response");
  } catch (e) { log(`  MV upload failed: ${e.message}`); return; }

  // Poll, capped at 5 min
  const start = Date.now();
  while (Date.now() - start < 5 * 60 * 1000) {
    await sleep(20000);
    try {
      const r = await fetch(`https://bulkapi.millionverifier.com/bulkapi/v2/fileinfo?file_id=${fileId}&key=${MV}`);
      const j = await r.json();
      log(`  MV status=${j.status} verified=${j.verified}/${j.total}`);
      if (j.status === "finished") break;
    } catch { /* keep polling */ }
  }

  // Download
  const map = {};
  try {
    const dl = await fetch(`https://bulkapi.millionverifier.com/bulkapi/v2/download?file_id=${fileId}&key=${MV}&filter=all`);
    const csv = await dl.text();
    for (const line of csv.split("\n").slice(1)) {
      const [email, , result] = line.split(",");
      if (!email) continue;
      const r = (result || "").trim();
      map[email.trim().toLowerCase()] =
        r === "ok" ? "valid" :
        r === "catch_all" ? "risky" :
        r === "unknown" ? "unknown" :
        (r === "" ? "unverified" : "invalid");
    }
  } catch (e) { log(`  MV download failed: ${e.message}`); }

  for (const l of leads) if (l.email) l.email_status = map[l.email] || "unverified";
}

// ---------- Phase 4: EXPORT + EMAIL ----------
const COLS = ["name", "phone", "website", "domain", "address", "city", "rating", "review_count", "category", "latitude", "longitude", "email", "email_status", "cid", "place_id"];

function toCSV(rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [COLS.join(","), ...rows.map((r) => COLS.map((c) => esc(r[c])).join(","))].join("\n");
}

async function emailResults({ deliverTo, businessType, state, leads, cost, log }) {
  const withPhone = leads.filter((l) => l.phone).length;
  const withEmail = leads.filter((l) => l.email).length;
  const validEmail = leads.filter((l) => l.email_status === "valid").length;
  const validRows = leads.filter((l) => l.email_status === "valid");

  const allCsv = toCSV(leads);
  const validCsv = toCSV(validRows.length ? validRows : leads.filter((l) => l.email));

  const summary =
`${businessType} — ${state} — scrape complete

Businesses:        ${leads.length}
With phone:        ${withPhone}
With email:        ${withEmail}
Verified valid:    ${validEmail}
Est. API cost:     $${cost.toFixed(2)}

Two files attached:
  leads.csv        every business (name, phone, website, address, city, rating, reviews, category, coordinates, email + status)
  leads-valid.csv  businesses with a verified-valid email`;

  if (!RESEND) { log("No RESEND_API_KEY — skipping email. Summary:\n" + summary); return { summary }; }

  const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: deliverTo,
      subject: `Leads: ${leads.length} ${businessType} (${validEmail} verified emails)`,
      text: summary,
      attachments: [
        { filename: "leads.csv", content: b64(allCsv) },
        { filename: "leads-valid.csv", content: b64(validCsv) },
      ],
    }),
  });
  if (!res.ok) log(`Resend failed: ${res.status} ${await res.text()}`);
  else log(`Emailed results to ${deliverTo}`);
  return { summary };
}

// Rough cost estimate before spending
export function estimateCost({ cities, count }) {
  const perCity = Math.max(1, Math.ceil(count / cities.length));
  const pages = Math.min(5, Math.ceil(perCity / 20));
  const mapsCredits = cities.length * pages * 3;      // 3 credits/maps query
  const searchCredits = count * 0.75;                 // ~75% have a website, 1 credit each
  const serper = (mapsCredits + searchCredits) / 1000 * 1; // ~$1 / 1000 credits
  const mvEmails = count * 0.5;                        // ~50% yield emails
  const mvCost = mvEmails * 0.0007;
  return Math.round((serper + mvCost) * 100) / 100;
}

// Full run
export async function runScrape(opts, log = console.log) {
  const cost = estimateCost(opts);
  log(`Estimated API cost: $${cost.toFixed(2)}`);
  const leads = await discover({ ...opts, log });
  if (!leads.length) { log("No businesses found — check inputs."); await emailResults({ ...opts, leads, cost, log }); return; }
  await findEmails(leads, log);
  await verify(leads, log);
  return emailResults({ ...opts, leads, cost, log });
}
