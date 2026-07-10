# Katexs Opportunity Scanner — MVP

Enter a URL → in ~30–60s get an opportunity score, detected ad pixels / chat / CRM /
CMS, PageSpeed, and an AI-written report + cold email + LinkedIn DM. Built for the
Katexs sales process. Zero npm dependencies.

## What it detects (reliably, from homepage source)
- Ad pixels: Meta, Google Ads, GTM, GA, LinkedIn, TikTok, Clarity
- Chat/AI widgets: Intercom, Drift, Tidio, Crisp, Zendesk, HubSpot, Tawk, LiveChat, Podium, Olark, Gorgias
- CMS/builder: WordPress, Shopify, Webflow, Wix, Squarespace, React/Next, GoDaddy, Duda
- CRM/booking: GoHighLevel, HubSpot, Calendly, Acuity, Stripe
- Contacts: emails, phones, socials · title/description/H1 · form count
- PageSpeed (mobile) via Google API

## Honesty guardrails (on purpose — protects your close rate)
- No fabricated ad spend / revenue / review counts. Ever.
- "No X detected on homepage" — never "they have no X".
- The score is a heuristic, not a % chance of buying.
If a prospect fact-checks your audit and one number is invented, you lose the room.
This is built so that never happens.

## Deploy today (fastest path: Railway or Render, ~10 min)
1. Push this folder to a GitHub repo.
2. On railway.app (or render.com) → New → Deploy from repo.
3. Add two environment variables:
   - `ANTHROPIC_API_KEY` = your Anthropic key
   - `PAGESPEED_API_KEY` = Google PageSpeed Insights key (free; optional — speed shows null without it)
4. Deploy. You get a URL like `https://katexs-scanner.up.railway.app`.
5. In Lovable, wire the "Scan" button to `POST {url}/scan` with body `{ "url": "<input>" }`.

## Run locally to test first
```
ANTHROPIC_API_KEY=sk-... PAGESPEED_API_KEY=AIza... node server.js
# then:
curl -s -X POST http://localhost:8787/scan -H "content-type: application/json" \
  -d '{"url":"acmehvac.com"}' | jq
```

## Use it from n8n instead (you already live here)
HTTP Request node → POST `<deploy-url>/scan` → body `{{ {"url": $json.website} }}`.
Loop your Sales Navigator sheet through it → write score + email back to the sheet →
you walk in every morning to a pre-scored, pre-written outreach list.

## Cost
- Hosting: Railway/Render free–$5/mo
- PageSpeed API: free
- Claude per scan: fractions of a cent on Sonnet
Effectively ~$5/mo + pennies per lead.

## Real business data (Google Places)
`places.js` enriches each scan with the company's real Google rating, review count,
and address, then nudges the score (100+ reviews = more leads at stake). Add
`GOOGLE_PLACES_API_KEY` (Places API New, Text Search enabled). If a listing can't be
confidently matched to the domain, it returns "no confident match" and cites nothing —
so you never quote fake review numbers on a call.

## The two frontends (paste into Lovable)
Both are self-contained React and preview on built-in sample data. To go live, set the
endpoint constant at the top of each file.

**`ScannerDashboard.jsx`** — internal rep tool. Enter a URL → opportunity score,
signal readout (ads / chat gap / CRM gap / speed / Google), "why this is a target",
and an AI-written cold email + LinkedIn DM with copy buttons. Set `SCAN_ENDPOINT`.

**`FreeAudit.jsx`** — public lead magnet for the site. Visitor enters their own URL →
sees their score + gaps → to unlock the full report + PDF they enter name/email/phone
(that's the lead). Then: download branded PDF (print-to-PDF, zero deps) + book a call.
Set `SCAN_ENDPOINT`, `LEAD_ENDPOINT` (your Supabase/Resend handler — same one the
funnel uses), and `CALENDLY`.

## Suggested rollout
1. Deploy `server.js`, add the 3 keys (Anthropic, PageSpeed, Places).
2. Drop `ScannerDashboard.jsx` into Lovable at `/scanner` (internal) → reps use it Monday.
3. Drop `FreeAudit.jsx` at `/audit` (public) → run ads/DMs to it → captured leads hit
   `support@katexs.com` via your existing Resend flow.
4. Loop Sales Navigator lists through `/scan` in n8n → pre-scored, pre-written outreach every morning.

## PDF: today vs. automated
`FreeAudit.jsx` generates a branded report client-side (opens print dialog → Save as PDF)
— works today, no infra. To auto-email a PDF to every lead, add a small Puppeteer render
step in n8n/your backend that takes the same audit JSON and emails the file. v1.1.

## Files
- `detect.js` — pure detection + scoring (unit-tested, no network)
- `places.js` — Google Places enrichment + score nudge
- `server.js` — fetch + PageSpeed + Places + Claude pipeline, `/scan` endpoint
- `test.js` — offline test (`npm test`), 8 passing checks
- `ScannerDashboard.jsx` — internal rep dashboard (Lovable)
- `FreeAudit.jsx` — public lead-magnet page (Lovable)
