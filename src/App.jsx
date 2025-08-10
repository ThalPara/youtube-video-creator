import React, { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, ExternalLink, Sun, Moon, TriangleAlert, ArrowUpDown } from "lucide-react";

// Types
interface Listing {
  source: string;
  title: string;
  address: string;
  price?: number;
  beds?: string;
  sqm?: number;
  sqft?: number;
  pricePerSqm?: number;
  pricePerSqft?: number;
  undervaluePct?: number;
  link?: string;
}

function useTheme() {
  const [theme, setTheme] = useState<string>(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("theme") as string) || "dark";
  });
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = theme;
      localStorage.setItem("theme", theme);
    }
  }, [theme]);
  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return { theme, toggle };
}

export default function App() {
  const [rightmoveUrl, setRightmoveUrl] = useState("");
  const [zooplaUrl, setZooplaUrl] = useState("");
  const [threshold, setThreshold] = useState<number>(20);
  const [requireArea, setRequireArea] = useState<boolean>(true);
  const [sort, setSort] = useState<"uv" | "price" | "sqm">("uv");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);

  const { theme, toggle } = useTheme();

  const filtered = useMemo(() => {
    const hasArea = (x: Listing) => Number.isFinite(x.sqm) && (x.sqm ?? 0) > 0;
    let arr = (listings || []).filter(
      (x) => Number.isFinite(x.undervaluePct) && (x.undervaluePct ?? -999) >= threshold && (!requireArea || hasArea(x))
    );
    arr = [...arr].sort((a, b) => {
      if (sort === "uv") return (b.undervaluePct ?? -999) - (a.undervaluePct ?? -999);
      if (sort === "price") return (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY);
      if (sort === "sqm") return (a.pricePerSqm ?? Number.POSITIVE_INFINITY) - (b.pricePerSqm ?? Number.POSITIVE_INFINITY);
      return 0;
    });
    return arr;
  }, [listings, threshold, requireArea, sort]);

  async function fetchListings() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rightmoveUrl: rightmoveUrl || undefined,
          zooplaUrl: zooplaUrl || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Failed to fetch");
      setListings(data?.listings || []);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
      setListings([]);
    } finally {
      setLoading(false);
    }
  }

  const fmtGBP = (n?: number) =>
    Number.isFinite(n as number)
      ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n as number)
      : "—";
  const fmt = (n?: number, d = 0) => (Number.isFinite(n as number) ? Number(n).toFixed(d) : "—");

  return (
    <div className="min-h-screen bg-gradient-to-b from-[rgb(12,18,32)] to-[rgb(11,15,20)] text-[var(--text)] p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        {/* Top bar */}
        <Card className="backdrop-blur supports-[backdrop-filter]:bg-white/5 border-white/10">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-md bg-gradient-to-br from-blue-400 to-blue-600" />
              <div className="font-extrabold tracking-tight">Undervalued Property Finder</div>
              <Badge variant="secondary" className="ml-1">Beta</Badge>
            </div>
            <Button variant="outline" onClick={toggle} className="gap-2 border-white/20">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span className="hidden sm:inline">{theme === "dark" ? "Light" : "Dark"} mode</span>
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_.8fr]">
          {/* Search panel */}
          <Card className="border-white/10">
            <CardHeader>
              <CardTitle>Search sources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Rightmove search URL</Label>
                  <Input placeholder="https://www.rightmove.co.uk/property-for-sale/find.html?..." value={rightmoveUrl} onChange={(e) => setRightmoveUrl(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Zoopla search URL (optional)</Label>
                  <Input placeholder="https://www.zoopla.co.uk/for-sale/property/..." value={zooplaUrl} onChange={(e) => setZooplaUrl(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[auto_auto_1fr]">
                <div className="flex items-center gap-3 rounded-full border border-white/10 px-3 py-2">
                  <Label className="text-sm">Threshold</Label>
                  <Input type="number" className="w-24 border-none bg-transparent p-0" min={5} max={60} step={1} value={threshold} onChange={(e) => setThreshold(Math.max(0, Number(e.target.value || 0)))} />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <div className="flex items-center gap-3 rounded-full border border-white/10 px-3 py-2">
                  <Label className="text-sm">Require area</Label>
                  <Switch checked={requireArea} onCheckedChange={setRequireArea} />
                </div>
                <div className="flex items-center justify-end gap-3">
                  <Select value={sort} onValueChange={(v: any) => setSort(v)}>
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uv">Sort: Undervalue %</SelectItem>
                      <SelectItem value="price">Sort: Price</SelectItem>
                      <SelectItem value="sqm">Sort: £/m²</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button className="gap-2" onClick={fetchListings} disabled={loading}>
                    {loading ? (
                      <span className="mr-1 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    {loading ? "Fetching…" : "Fetch listings"}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Tip: Apply filters on the portals, copy the results URL, paste here.</p>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="border-white/10">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {error ? (
                <div className="flex items-center gap-2 text-red-400">
                  <TriangleAlert className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              ) : listings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet. Paste a search and click Fetch.</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  <b>{filtered.length}</b> undervalued of <b>{listings.length}</b> listings (≥ {threshold}%{requireArea ? ", area required" : ""}).
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        {listings.length > 0 && (
          <Card className="border-white/10">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Listing</TableHead>
                      <TableHead className="whitespace-nowrap">Price</TableHead>
                      <TableHead className="whitespace-nowrap">Size</TableHead>
                      <TableHead className="whitespace-nowrap">Unit price</TableHead>
                      <TableHead className="whitespace-nowrap">Undervalue</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <div className="font-semibold leading-tight">{item.title || "—"}</div>
                          <div className="text-xs text-muted-foreground">{item.source} • {item.address || ""}</div>
                        </TableCell>
                        <TableCell>
                          <div>{fmtGBP(item.price)}</div>
                          <div className="text-xs text-muted-foreground">{item.beds || ""}</div>
                        </TableCell>
                        <TableCell>
                          <div>{Number.isFinite(item.sqm as number) ? `${fmt(item.sqm, 0)} m²` : "—"}</div>
                          <div className="text-xs text-muted-foreground">{Number.isFinite(item.sqft as number) ? `${fmt(item.sqft, 0)} ft²` : ""}</div>
                        </TableCell>
                        <TableCell>
                          <div>{Number.isFinite(item.pricePerSqm as number) ? `${fmt(item.pricePerSqm, 0)} £/m²` : "—"}</div>
                          <div className="text-xs text-muted-foreground">{Number.isFinite(item.pricePerSqft as number) ? `${fmt(item.pricePerSqft, 0)} £/ft²` : ""}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={Number.isFinite(item.undervaluePct as number) && (item.undervaluePct as number) >= 0 ? "default" : "destructive"}>
                            {Number.isFinite(item.undervaluePct as number) ? `${fmt(item.undervaluePct, 0)}%` : "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" asChild className="gap-2">
                            <a href={item.link || "#"} target="_blank" rel="noreferrer">
                              View <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filtered.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">No results match your filters.</div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Light / dark CSS vars */}
      <style>{`:root{--text:#e6edf6} :root[data-theme="light"]{--text:#0b1220}`}</style>
    </div>
  );
}
