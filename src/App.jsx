import React, { useEffect, useMemo, useState } from "react";

// React-only UI. Calls your backend for real data.
// New: a "Search Rightmove" mode that sends structured params to /api/search-rightmove.
// Fallback: the original "Paste URL" mode that posts raw portal URLs to /api/fetch.

function toNumber(v) {
  if (v === null || v === undefined) return NaN;
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
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
  } catch (_) {}
  return null;
}

export default function App() {
  // Mode: 'url' (paste portal URLs) or 'search' (Rightmove query)
  const [mode, setMode] = useState("search");

  // URL mode
  const [rightmoveUrl, setRightmoveUrl] = useState("");
  const [zooplaUrl, setZooplaUrl] = useState("");

  // Search mode (Rightmove)
  const [searchLocation, setSearchLocation] = useState(""); // e.g., "SW1A" or "Manchester"
  const [radiusKm, setRadiusKm] = useState(3); // Rightmove uses miles; backend can convert
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);
  const [minBeds, setMinBeds] = useState(0);
  const [maxBeds, setMaxBeds] = useState(0);
  const [propertyType, setPropertyType] = useState(""); // e.g., "houses", "flats"

  // Filters
  const [threshold, setThreshold] = useState(20);
  const [requireArea, setRequireArea] = useState(true);
  const [sort, setSort] = useState("uv");

  // Data & UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [listings, setListings] = useState([]);

  async function fetchListings() {
    setLoading(true);
    setError(null);
    try {
      let resp;
      if (mode === "search") {
        // Hit the search endpoint with structured params (backend resolves locationIdentifier/etc.)
        const payload = {
          portal: "rightmove",
          location: searchLocation || undefined,
          radiusKm: Number(radiusKm) || undefined,
          minPrice: Number(minPrice) || undefined,
          maxPrice: Number(maxPrice) || undefined,
          minBeds: Number(minBeds) || undefined,
          maxBeds: Number(maxBeds) || undefined,
          propertyType: propertyType || undefined,
        };
        resp = await fetch("/api/search-rightmove", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        // Legacy: accept pasted portal URLs
        resp = await fetch("/api/fetch", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ rightmoveUrl: rightmoveUrl || undefined, zooplaUrl: zooplaUrl || undefined })
        });
      }
      const ct = resp.headers.get("content-type") || "";
      const text = await resp.text();
      const data = parseMaybeJson(text, ct);
      if (!data) {
        const snippet = text.slice(0, 180).replace(/\s+/g, " ");
        throw new Error(`API returned ${resp.status} ${resp.statusText} with non-JSON body: ${snippet}`);
      }
      if (!resp.ok) throw new Error(data.error || `API error ${resp.status}`);
      setListings(Array.isArray(data.listings) ? data.listings : []);
    } catch (e) {
      setListings([]);
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
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
            <div style={{ fontWeight: 800 }}>Undervalued Property Finder</div>
            <span style={{ fontSize: 12, padding: "4px 8px", border: "1px solid #1f2937", borderRadius: 999, marginLeft: 8 }}>Beta</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setMode("search")} style={{ padding: "8px 10px", borderRadius: 8, border: mode === "search" ? "2px solid #2563eb" : "1px solid #1f2937", background: "transparent", color: "#e6edf6" }}>Search Rightmove</button>
            <button onClick={() => setMode("url")} style={{ padding: "8px 10px", borderRadius: 8, border: mode === "url" ? "2px solid #2563eb" : "1px solid #1f2937", background: "transparent", color: "#e6edf6" }}>Paste URLs</button>
          </div>
        </header>

        {mode === "search" ? (
          <section style={{ background: "#111827", borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, opacity: .8, marginBottom: 6 }}>Location</label>
                <input value={searchLocation} onChange={e => setSearchLocation(e.target.value)} placeholder="e.g., SW1A or Manchester" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #1f2937", background: "transparent", color: "#e6edf6" }} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 12, marginTop: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, opacity: .8, marginBottom: 6 }}>Radius (km)</label>
                <input type="number" value={radiusKm} onChange={e => setRadiusKm(Number(e.target.value) || 0)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #1f2937", background: "transparent", color: "#e6edf6" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, opacity: .8, marginBottom: 6 }}>Min £</label>
                <input type="number" value={minPrice} onChange={e => setMinPrice(Number(e.target.value) || 0)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #1f2937", background: "transparent", color: "#e6edf6" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, opacity: .8, marginBottom: 6 }}>Max £</label>
                <input type="number" value={maxPrice} onChange={e => setMaxPrice(Number(e.target.value) || 0)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #1f2937", background: "transparent", color: "#e6edf6" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, opacity: .8, marginBottom: 6 }}>Min beds</label>
                <input type="number" value={minBeds} onChange={e => setMinBeds(Number(e.target.value) || 0)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #1f2937", background: "transparent", color: "#e6edf6" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, opacity: .8, marginBottom: 6 }}>Max beds</label>
                <input type="number" value={maxBeds} onChange={e => setMaxBeds(Number(e.target.value) || 0)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #1f2937", background: "transparent", color: "#e6edf6" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, opacity: .8, marginBottom: 6 }}>Type</label>
                <select value={propertyType} onChange={e => setPropertyType(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #1f2937", background: "transparent", color: "#e6edf6" }}>
                  <option value="">Any</option>
                  <option value="houses">Houses</option>
                  <option value="flats">Flats/Apartments</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>Threshold (%)
                <input type="number" value={threshold} onChange={e => setThreshold(Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 0)} style={{ width: 90, padding: "8px 10px", borderRadius: 10, border: "1px solid #1f2937", background: "transparent", color: "#e6edf6" }} />
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>Require area
                <input type="checkbox" checked={requireArea} onChange={e => setRequireArea(e.target.checked)} />
              </label>
              <select value={sort} onChange={e => setSort(e.target.value)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #1f2937", background: "transparent", color: "#e6edf6" }}>
                <option value="uv">Sort: Undervalue %</option>
                <option value="price">Sort: Price</option>
                <option value="sqm">Sort: £/m²</option>
              </select>
              <button onClick={fetchListings} disabled={loading} style={{ background: "#2563eb", color: "#fff", padding: "10px 14px", borderRadius: 10, border: "none", fontWeight: 700 }}>
                {loading ? "Searching…" : "Search"}
              </button>
            </div>
            {error && <div style={{ color: "#ef4444", marginTop: 8 }}>Error: {error}</div>}
          </section>
        ) : (
          <section style={{ background: "#111827", borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, opacity: .8, marginBottom: 6 }}>Rightmove URL</label>
                <input value={rightmoveUrl} onChange={e => setRightmoveUrl(e.target.value)} placeholder="https://www.rightmove.co.uk/property-for-sale/find.html?..." style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #1f2937", background: "transparent", color: "#e6edf6" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, opacity: .8, marginBottom: 6 }}>Zoopla URL (optional)</label>
                <input value={zooplaUrl} onChange={e => setZooplaUrl(e.target.value)} placeholder="https://www.zoopla.co.uk/for-sale/property/..." style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #1f2937", background: "transparent", color: "#e6edf6" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>Threshold (%)
                <input type="number" value={threshold} onChange={e => setThreshold(Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 0)} style={{ width: 90, padding: "8px 10px", borderRadius: 10, border: "1px solid #1f2937", background: "transparent", color: "#e6edf6" }} />
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>Require area
                <input type="checkbox" checked={requireArea} onChange={e => setRequireArea(e.target.checked)} />
              </label>
              <select value={sort} onChange={e => setSort(e.target.value)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #1f2937", background: "transparent", color: "#e6edf6" }}>
                <option value="uv">Sort: Undervalue %</option>
                <option value="price">Sort: Price</option>
                <option value="sqm">Sort: £/m²</option>
              </select>
              <button onClick={fetchListings} disabled={loading} style={{ background: "#2563eb", color: "#fff", padding: "10px 14px", borderRadius: 10, border: "none", fontWeight: 700 }}>
                {loading ? "Fetching…" : "Fetch listings"}
              </button>
            </div>
            {error && <div style={{ color: "#ef4444", marginTop: 8 }}>Error: {error}</div>}
          </section>
        )}

        <section style={{ background: "#111827", borderRadius: 16, padding: 16 }}>
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
