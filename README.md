# Katexs Lead Scraper

Hosted Google Maps lead scraper. Trigger it (browser form or API), it runs in the
background and emails you two CSVs:

- **leads.csv** — every business: name, phone, website, domain, address, city, rating,
  review count, category, latitude, longitude, email, email status, cid, place_id
- **leads-valid.csv** — only businesses with a verified-valid email

Engine: **Serper** (Maps discovery + email search) → **MillionVerifier** (validation) →
**Resend** (delivers the CSV).

## Deploy to Railway

1. Push this folder to a GitHub repo.
2. Railway → **New Project → Deploy from GitHub repo** → pick it.
3. Railway → **Variables**, add:
   - `SERPER_API_KEY`
   - `MILLIONVERIFIER_API_KEY`
   - `RESEND_API_KEY`
   - `FROM_EMAIL` (e.g. `leads@katexs.com` — must be a Resend-verified sender/domain)
   - `SCRAPE_SECRET` (any long random string — your password to trigger scrapes)
4. Railway auto-runs `npm start`. Open the public URL → you get the form.

Railway sets `PORT` automatically; no need to configure it.

## Use it

**Browser:** open the URL, fill business type / cities / state / count / your email / secret, hit Run.

**API:**
```bash
curl -X POST https://YOUR-APP.up.railway.app/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "YOUR_SCRAPE_SECRET",
    "businessType": "HVAC companies",
    "cities": ["Dallas","Plano","Frisco","Arlington"],
    "state": "Texas",
    "count": 300,
    "deliverTo": "you@katexs.com"
  }'
```

Responds immediately with an estimated cost, then emails the CSVs when finished
(usually a few minutes). Cost runs about **$1.50–2.00 per 1,000 leads**.

## Notes
- `count` is capped at 5000 per run.
- Email finding uses Serper web search + domain-matching heuristics; it rejects
  noreply@ and social/aggregator addresses. Coverage is typically ~40–60% of sites.
- Verification via MillionVerifier is capped at a 5-minute poll; anything not returned
  in time is marked `unverified` (still delivered).
- If `RESEND_API_KEY` is missing, the run still completes and logs the summary.
