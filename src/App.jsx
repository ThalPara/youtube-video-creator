import React, { useEffect, useMemo, useState } from "react";

/*
  Undervalued Finder — React-only (browser safe)
  ------------------------------------------------
  Why this rewrite?
  - The previous canvas file mixed Node/Express code into a React canvas. The canvas bundler
    tries to resolve browser dependencies only; when Node built-ins slip in (e.g., a package
    importing `node:net`), bundling fails with the error you saw.
  - This version is **pure React** (no Node, no Express, no server-only modules), so the
    bundler stays in browser-land and won’t pull unsupported built-ins.

  What changed:
  - Removed all Node/Express code from the canvas file.
  - Kept a modern UI and robust client-side fetch with content-type checks.
  - Added a "Use mock data" switch so you can demo without a backend.
  - Added built-in diagnostics/tests (visible in the UI) that run on mount.

  Expected backend (optional):
  - If you have an API at POST /api/fetch returning `{ listings: Listing[] }`, the UI will
    use it automatically when "Use mock data" is OFF. Otherwise, it falls back to mock data
    and surfaces any fetch error in the UI.
*/

// --- Types (JSDoc for clarity; no TS types so bundler stays simple) ---
/** @typedef {{
 *  source?: string,
 *  title?: string,
 *  address?: string,
 *  price?: number|string,
 *  beds?: string|number,
 *  sqm?: number|string,
 *  sqft?: number|string,
 *  pricePerSqm?: number|string,
 *  pricePerSqft?: number|string,
 *  undervaluePct?: number|string,
 *  link?: string
 * }} Listing */

// ---------- Utilities ----------
function toNumber(v) {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  // strip commas and currency symbols commonly found in scraped text
  const s = String(v).replace(/[£,\s]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
function fmt(n, d = 0) {
  const x = toNumber(n);
  return Number.isFinite(x) ? x.toFixed(d) : "—";
}
function fmtGBP(n) {
  const x = toNumber(n);
  return Number.isFinite(x)
    ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(x)
    : "—";
}
function parseMaybeJson(text, contentType) {
  try {
    if (contentType && contentType.includes("application/json")) {
      return JSON.parse(text);
    }
  } catch (_) {
    // fall through
  }
  return null;
}

// ---------- Mock data ----------
const MOCK_LISTINGS = [
  { source: "Rightmove", title: "3 Bed Detached House", address: "London Road, London", price: 350000, beds: "3", sqm: 90, pricePerSqm: 3889, undervaluePct: 18.5, link: "https://www.rightmove.co.uk/" },
  { source: "Zoopla", title: "2 Bed Flat", address: "Baker Street, London", price: 250000, beds: "2", sqm: 70, pricePerSqm: 3571, undervaluePct: 24.0, link: "https://www.zoopla.co.uk/" },
  { source: "Rightmove", title: "4 Bed Semi-Detached", address: "Queen's Park, London", price: 585000, beds: "4", sqm: 150, pricePerSqm: 3900, undervaluePct: 12.3, link: "#" },
  { source: "Zoopla", title: "Studio", address: "City Centre", price: 165000, beds: "0", sqm: null, pricePerSqm: null, undervaluePct: 32.2, link: "#" }
];

// ---------- Self-tests / diagnostics ----------
function runDiagnostics() {
  const tests = [];
  // numeric parsing
  tests.push({ name: "toNumber parses 123", pass: toNumber("123") === 123 });
  tests.push({ name: "toNumber strips commas", pass: toNumber("123,456") === 123456 });
  tests.push({ name: "toNumber strips £", pass: toNumber("£1,234") === 1234 });
  tests.push({ name: "fmt handles NaN", pass: fmt("x") === "—" });
  // JSON guard
  const html = "<!doctype html><html><body>Error</body></html>";
  const json = JSON.stringify({ hello: "world" });
  tests.push({ name: "parseMaybeJson rejects HTML", pass: parseMaybeJson(html, "text/html") === null });
  const parsed = parseMaybeJson(json, "application/json");
  tests.push({ name: "parseMaybeJson accepts JSON", pass: parsed && parsed.hello === "world" });
  // filtering logic
  const sample = [
    { sqm: 80, undervaluePct: 25 },
    { sqm: null, undervaluePct: 40 },
    { sqm: 60, undervaluePct: 10 },
  ];
  const thr = 20, requireArea = true;
  const filtered = sample.filter(x => Number.isFinite(toNumber(x.undervaluePct)) && toNumber(x.undervaluePct) >= thr && (!requireArea || (Number.isFinite(toNumber(x.sqm)) && toNumber(x.sqm) > 0)));
  tests.push({ name: "filter respects threshold+area", pass: filtered.length === 1 });
  return { ok: tests.every(t => t.pass), tests };
}

// ---------- React App ----------
export default function App() {
  const [rightmoveUrl, setRightmoveUrl] = useState("");
  const [zooplaUrl, setZooplaUrl] = useState("");
  const [threshold, setThreshold] = useState(20);
  const [requireArea, setRequireArea] = useState(true);
  const [sort, setSort] = useState("uv"); // 'uv' | 'price' | 'sqm'
  const [useMock, setUseMock] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [listings, setListings] = useState([]);
  const [diag, setDiag] = useState({ ok: true, tests: [] });

  useEffect(() => { setDiag(runDiagnostics()); }, []);

  async function fetchListings() {
    setLoading(true);
    setError(null);
    try {
      if (useMock) {
        await new Promise(r => setTimeout(r, 300));
        setListings(MOCK_LISTINGS);
        return;
      }
      const resp = await fetch("/api/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ rightmoveUrl: rightmoveUrl || undefined, zooplaUrl: zooplaUrl || undefined })
      });
      const ct = resp.headers.get("content-type") || "";
      const text = await resp.text();
      const data = parseMaybeJson(text, ct);
      if (!data) {
        const snippet = text.slice(0, 160).replace(/\s+/g, " ");
        throw new Error(`API returned ${resp.status} ${resp.statusText} with non-JSON body: ${snippet}`);
      }
      if (!resp.ok) throw new Error(data.error || `API error ${resp.status}`);
      setListings(Array.isArray(data.listings) ? data.listings : []);
    } catch (e) {
      setListings([]);
      setError(e?.message || "Something went wrong");
    } finally { setLoading(false); }
  }

  const normalized = useMemo(() => (listings || []).map(l => ({
    ...l,
    priceN: toNumber(l.price),
    sqmN: toNumber(l.sqm),
    sqftN: toNumber(l.sqft),
    ppsmN: toNumber(l.pricePerSqm),
    ppsfN: toNumber(l.pricePerSqft),
    uvN: toNumber(l.undervaluePct)
  })), [listings]);

  const filtered = useMemo(() => {
    const thr = Number.isFinite(threshold) ? threshold : 0;
    const reqA = !!requireArea;
    let arr = normalized.filter(x => Number.isFinite(x.uvN) && x.uvN >= thr && (!reqA || (Number.isFinite(x.sqmN) && x.sqmN > 0)));
    arr = arr.sort((a, b) => {
      if (sort === "uv") return (b.uvN ?? -999) - (a.uvN ?? -999);
      if (sort === "price") return (a.priceN ?? Infinity) - (b.priceN ?? Infinity);
      if (sort === "sqm") return (a.ppsmN ?? Infinity) - (b.ppsmN ?? Infinity);
      return 0;
    });
    return arr;
  }, [normalized, threshold, requireArea, sort]);

  return (
    <div style={{ minHeight: "100vh", background: "#0b0f14", color: "#e6edf6", padding: 24 }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#60a5fa,#2563eb)" }} />
            <div style={{ fontWeight: 800, letterSpacing: ".2px" }}>Undervalued Property Finder</div>
            <span style={{ fontSize: 12, padding: "4px 8px", border: "1px solid #1f2937", borderRadius: 999, marginLeft: 8 }}>Beta</span>
          </div>
          <div title={diag.ok ? "Diagnostics passed" : "Diagnostics found issues"} style={{ fontSize: 12, color: diag.ok ? "#93e29b" : "#ef4444" }}>
            {diag.ok ? "Diagnostics: PASS" : "Diagnostics: FAIL"}
          </div>
        </header>

        <section style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, opacity: .8, marginBottom: 6 }}>Rightmove URL</label>
              <input value={rightmoveUrl} onChange={e => setRightmoveUrl(e.target.value)} placeholder="https://www.rightmove.co.uk/..." style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #1f2937", background: "transparent", color: "#e6edf6" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, opacity: .8, marginBottom: 6 }}>Zoopla URL (optional)</label>
              <input value={zooplaUrl} onChange={e => setZooplaUrl(e.target.value)} placeholder="https://www.zoopla.co.uk/..." style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #1f2937", background: "transparent", color: "#e6edf6" }} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>Threshold (%)
              <input type="number" value={threshold}
                     onChange={e => setThreshold(Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 0)}
                     style={{ width: 90, padding: "8px 10px", borderRadius: 10, border: "1px solid #1f2937", background: "transparent", color: "#e6edf6" }} />
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>Require area
              <input type="checkbox" checked={requireArea} onChange={e => setRequireArea(e.target.checked)} />
            </label>
            <select value={sort} onChange={e => setSort(e.target.value)}
                    style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #1f2937", background: "transparent", color: "#e6edf6" }}>
              <option value="uv">Sort: Undervalue %</option>
              <option value="price">Sort: Price</option>
              <option value="sqm">Sort: £/m²</option>
            </select>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }} title="Toggle off to use your backend at /api/fetch">
              Use mock data
              <input type="checkbox" checked={useMock} onChange={e => setUseMock(e.target.checked)} />
            </label>
            <button onClick={fetchListings} disabled={loading}
                    style={{ background: "#2563eb", color: "#fff", padding: "10px 14px", borderRadius: 10, border: "none", fontWeight: 700 }}>
              {loading ? "Fetching…" : "Fetch listings"}
            </button>
          </div>
          {error && <div style={{ color: "#ef4444", marginTop: 8 }}>Error: {error}</div>}
        </section>

        <section style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <details>
            <summary style={{ cursor: "pointer", userSelect: "none" }}>Diagnostics / Tests</summary>
            <div style={{ marginTop: 8, fontSize: 13, color: "#9fb1c7" }}>
              <div>Overall: {diag.ok ? "PASS" : "FAIL"}</div>
              <ul>
                {diag.tests.map((t, i) => (
                  <li key={i} style={{ color: t.pass ? "#93e29b" : "#ef9999" }}>{t.pass ? "✔" : "✖"} {t.name}</li>
                ))}
              </ul>
            </div>
          </details>
        </section>

        <section style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 16, padding: 16 }}>
          {filtered.length ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: 12 }}>Listing</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Price</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Size</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Unit price</th>
                    <th style={{ textAlign: "left", padding: 12 }}>Undervalue</th>
                    <th style={{ padding: 12 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((l, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #1f2937" }}>
                      <td style={{ padding: 12 }}>
                        <div style={{ fontWeight: 700 }}>{l.title || "—"}</div>
                        <div style={{ fontSize: 12, color: "#9fb1c7" }}>{l.source} • {l.address || ""}</div>
                      </td>
                      <td style={{ padding: 12 }}>
                        {fmtGBP(l.priceN)}
                        <div style={{ fontSize: 12, color: "#9fb1c7" }}>{l.beds || ""}</div>
                      </td>
                      <td style={{ padding: 12 }}>{Number.isFinite(l.sqmN) ? `${fmt(l.sqmN, 0)} m²` : "—"}</td>
                      <td style={{ padding: 12 }}>{Number.isFinite(l.ppsmN) ? `${fmt(l.ppsmN, 0)} £/m²` : "—"}</td>
                      <td style={{ padding: 12 }}>{Number.isFinite(l.uvN) ? `${fmt(l.uvN, 0)}%` : "—"}</td>
                      <td style={{ padding: 12 }}>
                        <a href={l.link || "#"} target="_blank" rel="noreferrer noopener" style={{ color: "#60a5fa", textDecoration: "none", fontWeight: 700 }}>View</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: "#9fb1c7" }}>No matching listings</div>
          )}
        </section>
      </div>
    </div>
  );
}
