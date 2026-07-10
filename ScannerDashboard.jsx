import React, { useState } from "react";
import { Search, Copy, Check, Zap, AlertTriangle, Star } from "lucide-react";

// ── Wire this to your deployed scanner (server.js /scan). Leave "" to run on sample data. ──
const SCAN_ENDPOINT = ""; // e.g. "https://katexs-scanner.up.railway.app/scan"

const C = {
  bg: "#0a0a0a", surface: "#111", surface2: "#0d0d0d",
  border: "rgba(255,255,255,0.12)", borderStrong: "rgba(255,255,255,0.28)",
  text: "#fff", mute: "rgba(255,255,255,0.55)", faint: "rgba(255,255,255,0.35)",
  green: "#4ade80", amber: "#fbbf24", red: "#f87171",
  mono: "ui-monospace, 'SF Mono', Menlo, monospace",
};

const SAMPLE = {
  url: "https://acmehvac.com",
  opportunity: {
    score: 90, band: "High",
    reasons: [
      "Spending on paid traffic (Meta + Google Ads pixels present) — they value leads and have budget",
      "No live chat / AI chat widget detected on homepage",
      "No booking or CRM widget detected — likely manual follow-up",
      "Slow mobile site (PageSpeed 41/100) — leads drop before converting",
      "140 Google reviews — high call volume, more leads at stake",
    ],
  },
  signals: {
    ads: ["Meta Pixel", "Google Ads (gtag)"],
    chat: [], crm_booking: [], cms: ["WordPress"],
    speed: 41,
    contacts: { phones: ["+12145551234"], emails: ["office@acmehvac.com"], socials: [] },
    meta: { title: "Acme HVAC — Heating & Air Conditioning Dallas TX", formCount: 1 },
  },
  places: { matched: true, confident: true, name: "Acme HVAC", rating: 3.8, reviews: 140, address: "Dallas, TX", status: "OPERATIONAL" },
  ai: {
    headline: "Paying for clicks, then losing the calls those clicks generate.",
    top_problems: [
      "Running paid ads but no after-hours or overflow call handling detected",
      "Mobile site loads in ~5s — a chunk of paid traffic bounces before converting",
      "No booking or instant-follow-up path, so form fills sit until someone gets to them",
    ],
    recommended_services: [
      "AI Receptionist (answers every call 24/7)",
      "Missed Call Recovery (texts back in 60s)",
      "Booking Agent (fills the calendar automatically)",
    ],
    why_now: "They're actively spending on Google + Meta ads right now — every missed call is paid traffic wasted.",
    cold_email: {
      subject: "Acme HVAC — quick question",
      body: "Hi — noticed Acme HVAC is running Google and Meta ads, but I couldn't find an after-hours call handler on the site. For most Dallas HVAC shops that means paid clicks turning into missed calls after 5pm. We deploy an AI that answers every call 24/7 and books it — live in 48 hours. Worth 15 minutes?",
    },
    linkedin_dm: "Hey — saw Acme HVAC is running paid ads in Dallas. Quick one: when a call comes in after hours, who picks up? We plug that gap with a 24/7 AI receptionist, live in 48h. Open to a quick look?",
  },
};

function Dot({ color }) {
  return <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 999, background: color, marginRight: 8, verticalAlign: "middle" }} />;
}

function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); }}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", color: done ? C.green : C.mute,
        border: `0.5px solid ${C.border}`, borderRadius: 999, padding: "6px 12px", fontFamily: C.mono, fontSize: 11, cursor: "pointer" }}>
      {done ? <Check size={13} /> : <Copy size={13} />}{done ? "Copied" : "Copy"}
    </button>
  );
}

function SignalRow({ label, gap, has, detail }) {
  // gap=true means the ABSENCE is the opportunity (green). has=list of detected items.
  const opportunity = gap && (!has || has.length === 0);
  const color = opportunity ? C.green : C.faint;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `0.5px solid ${C.border}` }}>
      <span style={{ fontFamily: C.mono, fontSize: 12, color: C.mute, letterSpacing: "0.04em" }}>{label}</span>
      <span style={{ fontFamily: C.mono, fontSize: 12, color, textAlign: "right", maxWidth: "60%" }}>
        {opportunity ? <><Dot color={C.green} />GAP — OPPORTUNITY</> : (detail || (has && has.length ? has.join(" · ") : "—"))}
      </span>
    </div>
  );
}

export default function ScannerDashboard() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(SAMPLE);
  const [err, setErr] = useState("");

  async function run() {
    if (!url.trim()) { setData(SAMPLE); return; }
    setErr(""); setLoading(true);
    try {
      if (!SCAN_ENDPOINT) { await new Promise(r => setTimeout(r, 700)); setData({ ...SAMPLE, url }); }
      else {
        const res = await fetch(SCAN_ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
        setData(await res.json());
      }
    } catch (e) { setErr("Scan failed — check the endpoint. Showing last result."); }
    setLoading(false);
  }

  const bandColor = data.opportunity.band === "High" ? C.green : data.opportunity.band === "Medium" ? C.amber : C.faint;
  const s = data.signals;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "system-ui, sans-serif",
      backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "24px 24px", padding: "40px 20px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        <div style={{ fontFamily: C.mono, fontSize: 12, color: C.faint, letterSpacing: "0.18em", marginBottom: 6 }}>KATEXS // OPPORTUNITY SCANNER</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 24px" }}>Who do we call today, and why.</h1>

        <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
          <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && run()}
            placeholder="acmehvac.com"
            style={{ flex: 1, background: C.surface, border: `0.5px solid ${C.border}`, borderRadius: 10, color: C.text,
              fontFamily: C.mono, fontSize: 14, padding: "12px 16px", outline: "none" }} />
          <button onClick={run} disabled={loading}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", color: "#000", border: "none",
              borderRadius: 10, padding: "0 22px", fontWeight: 600, fontSize: 14, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
            <Search size={16} />{loading ? "Scanning…" : "Run scan"}
          </button>
        </div>
        {!SCAN_ENDPOINT && <div style={{ fontFamily: C.mono, fontSize: 11, color: C.faint, marginBottom: 24 }}>Preview mode — set SCAN_ENDPOINT to go live.</div>}
        {err && <div style={{ fontFamily: C.mono, fontSize: 11, color: C.amber, marginBottom: 24 }}>{err}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginTop: 16 }}>

          {/* Score + signals */}
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16 }}>
            <div style={{ background: C.surface2, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 24, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontFamily: C.mono, fontSize: 11, color: C.faint, letterSpacing: "0.1em" }}>OPPORTUNITY</div>
              <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.1, color: bandColor }}>{data.opportunity.score}</div>
              <div style={{ fontFamily: C.mono, fontSize: 13, color: bandColor }}><Dot color={bandColor} />{data.opportunity.band.toUpperCase()} PRIORITY</div>
              <div style={{ marginTop: 14, fontFamily: C.mono, fontSize: 11, color: C.faint, wordBreak: "break-all" }}>{data.url}</div>
              <div style={{ marginTop: 4, fontFamily: C.mono, fontSize: 11, color: C.mute }}>heuristic score · not a buy probability</div>
            </div>

            <div style={{ background: C.surface2, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: "8px 20px 14px" }}>
              <SignalRow label="AD PIXELS" has={s.ads} detail={s.ads?.length ? s.ads.join(" · ") : "none detected"} />
              <SignalRow label="CHAT / AI WIDGET" gap has={s.chat} />
              <SignalRow label="BOOKING / CRM" gap has={s.crm_booking} />
              <SignalRow label="PLATFORM" has={s.cms} detail={s.cms?.join(" · ") || "—"} />
              <SignalRow label="MOBILE SPEED" has={[String(s.speed)]}
                detail={<span style={{ color: s.speed < 50 ? C.green : s.speed < 75 ? C.amber : C.faint }}>{s.speed}/100 {s.speed < 50 ? "· slow (opportunity)" : ""}</span>} />
              <SignalRow label="GOOGLE" has={["x"]}
                detail={data.places?.matched
                  ? <span><Star size={11} style={{ verticalAlign: -1 }} /> {data.places.rating ?? "?"} · {data.places.reviews ?? "?"} reviews</span>
                  : "no confident match"} />
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0" }}>
                <span style={{ fontFamily: C.mono, fontSize: 12, color: C.mute }}>CONTACT</span>
                <span style={{ fontFamily: C.mono, fontSize: 12, color: C.mute }}>{s.contacts?.phones?.[0] || ""} {s.contacts?.emails?.[0] ? "· " + s.contacts.emails[0] : ""}</span>
              </div>
            </div>
          </div>

          {/* Why this is a target */}
          <div style={{ background: C.surface2, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
            <div style={{ fontFamily: C.mono, fontSize: 11, color: C.green, letterSpacing: "0.1em", marginBottom: 12 }}><Dot color={C.green} />WHY THIS IS A TARGET</div>
            {data.opportunity.reasons.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "6px 0", fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
                <Zap size={15} style={{ color: C.green, flexShrink: 0, marginTop: 2 }} /><span>{r}</span>
              </div>
            ))}
          </div>

          {/* AI output */}
          {data.ai && !data.ai.note && (
            <div style={{ background: C.surface2, border: `0.5px solid ${C.borderStrong}`, borderRadius: 14, padding: 24 }}>
              <div style={{ fontFamily: C.mono, fontSize: 11, color: C.faint, letterSpacing: "0.1em", marginBottom: 8 }}>AI ASSESSMENT</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 18 }}>{data.ai.headline}</div>

              <div style={{ fontFamily: C.mono, fontSize: 11, color: C.red, marginBottom: 8 }}><AlertTriangle size={12} style={{ verticalAlign: -2 }} /> TOP PROBLEMS</div>
              {data.ai.top_problems?.map((p, i) => (
                <div key={i} style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", padding: "4px 0", paddingLeft: 18, position: "relative" }}>
                  <span style={{ position: "absolute", left: 0, color: C.red }}>—</span>{p}
                </div>
              ))}

              <div style={{ fontFamily: C.mono, fontSize: 11, color: C.green, margin: "18px 0 10px" }}>RECOMMENDED SERVICES</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {data.ai.recommended_services?.map((svc, i) => (
                  <span key={i} style={{ fontFamily: C.mono, fontSize: 12, color: C.green, border: `0.5px solid ${C.green}`, borderRadius: 999, padding: "6px 14px" }}>{svc}</span>
                ))}
              </div>

              <div style={{ marginTop: 18, padding: "12px 14px", background: "rgba(74,222,128,0.06)", border: `0.5px solid ${C.border}`, borderRadius: 10 }}>
                <span style={{ fontFamily: C.mono, fontSize: 11, color: C.green }}>WHY NOW · </span>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>{data.ai.why_now}</span>
              </div>

              {/* Cold email */}
              <div style={{ marginTop: 20, border: `0.5px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: `0.5px solid ${C.border}` }}>
                  <span style={{ fontFamily: C.mono, fontSize: 11, color: C.mute }}>COLD EMAIL · {data.ai.cold_email?.subject}</span>
                  <CopyBtn text={`Subject: ${data.ai.cold_email?.subject}\n\n${data.ai.cold_email?.body}`} />
                </div>
                <div style={{ padding: 14, fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.6 }}>{data.ai.cold_email?.body}</div>
              </div>

              {/* LinkedIn DM */}
              <div style={{ marginTop: 12, border: `0.5px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: `0.5px solid ${C.border}` }}>
                  <span style={{ fontFamily: C.mono, fontSize: 11, color: C.mute }}>LINKEDIN DM</span>
                  <CopyBtn text={data.ai.linkedin_dm} />
                </div>
                <div style={{ padding: 14, fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.6 }}>{data.ai.linkedin_dm}</div>
              </div>
            </div>
          )}

          <div style={{ fontFamily: C.mono, fontSize: 10, color: C.faint, textAlign: "center", marginTop: 4 }}>
            Signals limited to homepage source + PageSpeed + Google Places. No ad-spend or revenue is inferred.
          </div>
        </div>
      </div>
    </div>
  );
}
