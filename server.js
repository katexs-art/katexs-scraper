import express from "express";
import { runScrape, estimateCost } from "./pipeline.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const SECRET = process.env.SCRAPE_SECRET || "";

function parseCities(input) {
  if (Array.isArray(input)) return input.map((s) => s.trim()).filter(Boolean);
  return String(input || "").split(",").map((s) => s.trim()).filter(Boolean);
}

// health check
app.get("/health", (_req, res) => res.json({ ok: true }));

// trigger a scrape (form-post or JSON). Responds immediately, runs in background.
app.post("/scrape", (req, res) => {
  const { secret, businessType, cities, state, count, deliverTo } = req.body;

  if (!SECRET || secret !== SECRET) return res.status(401).json({ error: "bad secret" });
  if (!businessType || !cities || !state || !deliverTo)
    return res.status(400).json({ error: "need businessType, cities, state, deliverTo" });

  const opts = {
    businessType: String(businessType).trim(),
    cities: parseCities(cities),
    state: String(state).trim(),
    count: Math.min(5000, Math.max(1, parseInt(count) || 300)),
    deliverTo: String(deliverTo).trim(),
  };

  const cost = estimateCost(opts);

  // fire-and-forget; email delivers the result
  runScrape(opts).catch((e) => console.error("scrape failed:", e));

  res.json({
    status: "started",
    message: `Scraping ~${opts.count} ${opts.businessType} across ${opts.cities.length} cities. The CSV will be emailed to ${opts.deliverTo} when done (usually a few minutes).`,
    estimatedCost: `$${cost.toFixed(2)}`,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Katexs lead scraper on :${PORT}`));
