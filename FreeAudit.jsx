import React, { useState } from "react";
import { Search, Lock, Download, Calendar, Check, Star } from "lucide-react";

// ── Wire these to your infra. Leave "" to preview on sample data. ──
const SCAN_ENDPOINT = ""; // "https://katexs-scanner.up.railway.app/scan"
const LEAD_ENDPOINT = ""; // your Supabase/Resend lead handler; receives the audit + contact
const CALENDLY = "https://calendly.com/katexs/onboarding";

const C = {
  bg: "#0a0a0a", surface: "#0d0d0d", border: "rgba(255,255,255,0.12)", borderStrong: "rgba(255,255,255,0.28)",
  text: "#fff", mute: "rgba(255,255,255,0.55)", faint: "rgba(255,255,255,0.35)",
  green: "#4ade80", amber: "#fbbf24", red: "#f87171",
  mono: "ui-monospace, 'SF Mono', Menlo, monospace",
};

const SAMPLE = {
  url: "https://acmehvac.com",
  opportunity: { score: 90, band: "High" },
  signals: { ads: ["Meta Pixel", "Google Ads (gtag)"], chat: [], crm_booking: [], cms: ["WordPress"], speed: 41, meta: { formCount: 1 } },
  places: { matched: true, name: "Acme HVAC", rating: 3.8, reviews: 140, address: "Dallas, TX" },
  ai: {
    headline: "You're paying for clicks, then losing the calls those clicks generate.",
    top_problems: [
      "Running paid ads but no after-hours or overflow call handling detected",
      "Mobile site loads slowly — some paid traffic bounces before converting",
      "No booking or instant follow-up path detected, so leads sit until someone gets to them",
    ],
    recommended_services: [
      "AI Receptionist — answers every call 24/7",
      "Missed Call Recovery — texts back in 60 seconds",
      "Booking Agent — fills the calendar automatically",
    ],
  },
};

function subScores(d) {
  const s = d.signals;
  const aiReadiness = s.chat?.length || s.crm_booking?.length ? 65 : 22;
  const leadCapture = (s.crm_booking?.length ? 40 : 0) + (s.meta?.formCount ? 20 : 0) + (s.chat?.length ? 20 : 0);
  const speed = s.speed ?? 50;
  return { aiReadiness, leadCapture: Math.min(100, leadCapture), speed };
}

function ScoreRing({ label, value, invert }) {
  // invert=true → low value is BAD (speed, readiness). Color accordingly.
  const good = invert ? value >= 60 : value >= 60;
  const color = good ? C.green : value >= 35 ? C.amber : C.red;
  return (
    <div style={{ background: C.surface, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: "18px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 34, fontWeight: 700, color }}>{value}<span style={{ fontSize: 15, color: C.faint }}>/100</span></div>
      <div style={{ fontFamily: C.mono, fontSize: 11, color: C.mute, marginTop: 4, letterSpacing: "0.04em" }}>{label}</div>
    </div>
  );
}

function printReport(d) {
  const ss = subScores(d);
  const rows = (d.ai?.recommended_services || []).map(x => `<li>${x}</li>`).join("");
  const probs = (d.ai?.top_problems || []).map(x => `<li>${x}</li>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf8"><title>Katexs AI Audit — ${d.url}</title>
  <style>
    body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111;margin:40px;max-width:720px}
    .brand{font-family:ui-monospace,Menlo,monospace;letter-spacing:.18em;color:#666;font-size:12px}
    h1{font-size:26px;margin:6px 0 2px} .url{color:#666;font-family:ui-monospace,monospace;font-size:13px}
    .score{font-size:60px;font-weight:800;margin:16px 0 0}
    .grid{display:flex;gap:12px;margin:16px 0}
    .cell{flex:1;border:1px solid #eee;border-radius:10px;padding:14px;text-align:center}
    .cell b{font-size:26px;display:block} .cell span{font-size:11px;color:#666;font-family:monospace}
    h2{font-size:14px;text-transform:uppercase;letter-spacing:.08em;color:#333;margin:26px 0 8px}
    li{margin:5px 0;font-size:14px} .cta{margin-top:28px;padding:16px;background:#0a0a0a;color:#fff;border-radius:10px}
    .foot{margin-top:24px;color:#999;font-size:11px;border-top:1px solid #eee;padding-top:12px}
  </style></head><body>
    <div class="brand">KATEXS // AI INFRASTRUCTURE AUDIT</div>
    <h1>${d.places?.name || "Your business"}</h1>
    <div class="url">${d.url}</div>
    <div class="score">${d.opportunity.score}<span style="font-size:22px;color:#999">/100 opportunity</span></div>
    <div class="grid">
      <div class="cell"><b>${ss.aiReadiness}</b><span>AI READINESS</span></div>
      <div class="cell"><b>${ss.leadCapture}</b><span>LEAD CAPTURE</span></div>
      <div class="cell"><b>${ss.speed}</b><span>SITE SPEED</span></div>
    </div>
    <h2>What we found</h2><ul>${probs}</ul>
    <h2>Recommended for you</h2><ul>${rows}</ul>
    <div class="cta"><b>Next step:</b> a 15-minute strategy session to review these findings and how we'd deploy — live in 48 hours.</div>
    <div class="foot">Signals are limited to your homepage source, PageSpeed, and Google Places. This is a heuristic assessment, not a purchase probability. No ad-spend or revenue figures are inferred. · Katexs AI · support@katexs.com</div>
  </body></html>`;
  const w = window.open("", "_blank");
  if (!w) { alert("Allow pop-ups to download your report."); return; }
  w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
}

export default function FreeAudit() {
  const [stage, setStage] = useState("input"); // input → teaser → unlocked
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(SAMPLE);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  async function runScan() {
    if (!url.trim()) return;
    setLoading(true);
    try {
      if (SCAN_ENDPOINT) {
        const res = await fetch(SCAN_ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
        setData(await res.json());
      } else { await new Promise(r => setTimeout(r, 900)); setData({ ...SAMPLE, url }); }
      setStage("teaser");
    } catch { setData({ ...SAMPLE, url }); setStage("teaser"); }
    setLoading(false);
  }

  async function submitLead() {
    if (!form.email || !form.name) return;
    try { if (LEAD_ENDPOINT) await fetch(LEAD_ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, url, audit: data }) }); } catch {}
    setStage("unlocked");
  }

  const ss = subScores(data);
  const wrap = { background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "system-ui, sans-serif",
    backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "24px 24px" };
  const inner = { maxWidth: 620, margin: "0 auto", padding: "56px 20px" };

  if (stage === "input") return (
    <div style={wrap}><div style={{ ...inner, textAlign: "center", paddingTop: 120 }}>
      <div style={{ fontFamily: C.mono, fontSize: 12, color: C.green, letterSpacing: "0.18em", marginBottom: 14 }}>● FREE AI INFRASTRUCTURE AUDIT</div>
      <h1 style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.1, margin: "0 0 14px" }}>See exactly where you're<br />losing leads.</h1>
      <p style={{ color: C.mute, fontFamily: C.mono, fontSize: 14, maxWidth: 400, margin: "0 auto 32px" }}>Enter your website. In 60 seconds we'll score your AI readiness, lead capture, and speed — and show you what to fix.</p>
      <div style={{ display: "flex", gap: 10, maxWidth: 480, margin: "0 auto" }}>
        <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && runScan()} placeholder="yourbusiness.com"
          style={{ flex: 1, background: C.surface, border: `0.5px solid ${C.border}`, borderRadius: 999, color: C.text, fontFamily: C.mono, fontSize: 15, padding: "16px 22px", outline: "none" }} />
        <button onClick={runScan} disabled={loading} style={{ background: "#fff", color: "#000", border: "none", borderRadius: 999, padding: "0 26px", fontWeight: 600, fontSize: 15, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
          {loading ? "Scanning…" : "Run audit"}
        </button>
      </div>
      <div style={{ fontFamily: C.mono, fontSize: 11, color: C.faint, marginTop: 16 }}>No signup to see your score · takes ~1 minute</div>
    </div></div>
  );

  return (
    <div style={wrap}><div style={inner}>
      <div style={{ fontFamily: C.mono, fontSize: 11, color: C.faint, letterSpacing: "0.12em", marginBottom: 4 }}>KATEXS // AUDIT RESULT</div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 2px" }}>{data.places?.name || "Your business"}</h1>
      <div style={{ fontFamily: C.mono, fontSize: 12, color: C.mute, marginBottom: 22 }}>{data.url}</div>

      <div style={{ background: C.surface, border: `0.5px solid ${C.borderStrong}`, borderRadius: 14, padding: 24, marginBottom: 16, textAlign: "center" }}>
        <div style={{ fontFamily: C.mono, fontSize: 11, color: C.faint, letterSpacing: "0.1em" }}>OPPORTUNITY SCORE</div>
        <div style={{ fontSize: 62, fontWeight: 700, color: data.opportunity.band === "High" ? C.green : C.amber, lineHeight: 1.1 }}>{data.opportunity.score}</div>
        {data.places?.matched && <div style={{ fontFamily: C.mono, fontSize: 12, color: C.mute }}><Star size={11} style={{ verticalAlign: -1 }} /> {data.places.rating} · {data.places.reviews} reviews · {data.places.address}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
        <ScoreRing label="AI READINESS" value={ss.aiReadiness} invert />
        <ScoreRing label="LEAD CAPTURE" value={ss.leadCapture} invert />
        <ScoreRing label="SITE SPEED" value={ss.speed} invert />
      </div>

      <div style={{ fontFamily: C.mono, fontSize: 11, color: C.red, marginBottom: 10, letterSpacing: "0.06em" }}>WHAT WE FOUND</div>
      {data.ai.top_problems.map((p, i) => (
        <div key={i} style={{ display: "flex", gap: 10, padding: "7px 0", fontSize: 14, color: "rgba(255,255,255,0.85)" }}>
          <span style={{ color: C.red }}>—</span>{p}
        </div>
      ))}

      {stage === "teaser" && (
        <div style={{ marginTop: 20, background: C.surface, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 24 }}>
          <div style={{ fontFamily: C.mono, fontSize: 12, color: C.green, marginBottom: 6 }}><Lock size={13} style={{ verticalAlign: -2 }} /> UNLOCK YOUR FULL REPORT</div>
          <div style={{ fontSize: 15, color: C.mute, marginBottom: 18 }}>Get your personalized recommendations, the downloadable PDF, and a plan to fix these — free.</div>
          {["name", "email", "phone"].map(f => (
            <input key={f} value={form[f]} onChange={e => setForm({ ...form, [f]: e.target.value })}
              placeholder={f === "name" ? "Your name" : f === "email" ? "Work email" : "Phone"}
              style={{ width: "100%", boxSizing: "border-box", background: C.bg, border: `0.5px solid ${C.border}`, borderRadius: 10, color: C.text, fontFamily: C.mono, fontSize: 14, padding: "12px 16px", marginBottom: 10, outline: "none" }} />
          ))}
          <button onClick={submitLead} style={{ width: "100%", background: "#fff", color: "#000", border: "none", borderRadius: 10, padding: "13px", fontWeight: 600, fontSize: 15, cursor: "pointer" }}>Show my full report →</button>
        </div>
      )}

      {stage === "unlocked" && (
        <>
          <div style={{ fontFamily: C.mono, fontSize: 11, color: C.green, margin: "22px 0 10px", letterSpacing: "0.06em" }}><Check size={12} style={{ verticalAlign: -2 }} /> RECOMMENDED FOR YOU</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {data.ai.recommended_services.map((s, i) => (
              <span key={i} style={{ fontFamily: C.mono, fontSize: 12.5, color: C.green, border: `0.5px solid ${C.green}`, borderRadius: 999, padding: "8px 16px" }}>{s}</span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => printReport(data)} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: "transparent", color: C.text, border: `0.5px solid ${C.borderStrong}`, borderRadius: 10, padding: "14px", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
              <Download size={16} /> Download PDF
            </button>
            <a href={CALENDLY} target="_blank" rel="noreferrer" style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#fff", color: "#000", borderRadius: 10, padding: "14px", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
              <Calendar size={16} /> Book a strategy call
            </a>
          </div>
          <div style={{ fontFamily: C.mono, fontSize: 11, color: C.faint, textAlign: "center", marginTop: 14 }}>Live in 48 hours · No contracts · Cancel anytime</div>
        </>
      )}

      <div style={{ fontFamily: C.mono, fontSize: 10, color: C.faint, textAlign: "center", marginTop: 26 }}>
        Heuristic assessment from public signals. No ad-spend or revenue inferred.
      </div>
    </div></div>
  );
}
