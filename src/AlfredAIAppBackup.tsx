import React, { useMemo, useRef, useState } from "react";
import { Download, Upload, Link as LinkIcon, RefreshCcw, Filter, TrendingUp, DollarSign, Package, Settings2, ShieldCheck } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

type Recommendation = {
  run_id: string;
  sku: string;
  product_name: string;
  available: number;
  units_ordered: number;
  current_price: number;
  gross_profit_unit: number;
  strategy: string;      // "hold" | "premium_position" | ...
  price_action: string;  // "none" | "increase" | "decrease"
  price_change_pct: number;
  ad_action?: string;
  reason?: string;
  created_at?: string;
};

interface Payload {
  run_id: string;
  sku_count: number;
  recommendations: Recommendation[];
}

// ===== Live Lambda URL (you can change this later) =====
const LIVE_LAMBDA_URL = "https://4dvjlg6lcxnsyitduj633oazcq0pviog.lambda-url.us-east-1.on.aws/";



function withDerived(rec: Recommendation) {
  const suggested_new_price = rec.current_price * (1 + (rec.price_change_pct || 0));
  const suggested_price_delta = suggested_new_price - rec.current_price;
  const revenue_impact_est = (rec.units_ordered || 0) * suggested_price_delta;
  const gross_profit_total = (rec.gross_profit_unit || 0) * (rec.units_ordered || 0);
  return { ...rec, suggested_new_price, suggested_price_delta, revenue_impact_est, gross_profit_total };
}

function formatMoney(n?: number) {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
function formatPct(p?: number) {
  const v = Number(p || 0);
  return (v * 100).toFixed(0) + "%";
}

export default function AlfredAIApp() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [lambdaUrl, setLambdaUrl] = useState<string>(LIVE_LAMBDA_URL);
  const [search, setSearch] = useState("");
  const [strategyFilter, setStrategyFilter] = useState<string>("all");
  const [priceActionFilter, setPriceActionFilter] = useState<string>("all");
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function fetchFromLambda(url: string) {
    setLoading(true);
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as Payload;
      setPayload(data);
    } catch (e: any) {
      alert("Failed to load from Lambda: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  function onUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as Payload;
        setPayload(data);
      } catch {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  }

  const rows = useMemo(() => {
    const base = payload?.recommendations?.map(withDerived) || [];
    return base
      .filter((r) =>
        !search
          ? true
          : r.sku.toLowerCase().includes(search.toLowerCase()) ||
            r.product_name.toLowerCase().includes(search.toLowerCase())
      )
      .filter((r) => (strategyFilter === "all" ? true : r.strategy === strategyFilter))
      .filter((r) => (priceActionFilter === "all" ? true : r.price_action === priceActionFilter));
  }, [payload, search, strategyFilter, priceActionFilter]);

  const kpis = useMemo(() => {
    const skuAnalyzed = payload?.sku_count ?? rows.length;
    const hold = rows.filter((r) => r.strategy === "hold").length;
    const premium = rows.filter((r) => r.strategy === "premium_position").length;
    const increases = rows.filter((r) => r.price_action === "increase").length;
    const estRevenue = rows.reduce((acc, r) => acc + (r.revenue_impact_est || 0), 0);
    const estGrossProfit = rows.reduce((acc, r) => acc + (r.gross_profit_total || 0), 0);
    return { skuAnalyzed, hold, premium, increases, estRevenue, estGrossProfit };
  }, [payload, rows]);

  const strategyMix = useMemo(() => {
    const counts: Record<string, number> = {};
    rows.forEach((r) => (counts[r.strategy] = (counts[r.strategy] || 0) + 1));
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [rows]);

  const topByUnits = useMemo(() => {
    const sorted = [...rows].sort((a, b) => (b.units_ordered || 0) - (a.units_ordered || 0));
    return sorted.slice(0, 10).map((r) => ({ sku: r.sku, units: r.units_ordered }));
  }, [rows]);

  const actionPlan = useMemo(() => {
    const increases = rows
      .filter((r) => r.price_action === "increase")
      .sort((a, b) => (b.revenue_impact_est || 0) - (a.revenue_impact_est || 0));
    const holds = rows.filter((r) => r.strategy === "hold");
    const premium = rows.filter((r) => r.strategy === "premium_position");
    return { increases, holds, premium };
  }, [rows]);

  function downloadCSV() {
    if (!rows.length) return;
    const header = [
      "sku","product_name","strategy","price_action","price_change_pct","units_ordered",
      "current_price","suggested_new_price","suggested_price_delta","gross_profit_unit",
      "gross_profit_total","revenue_impact_est","reason"
    ];
    const lines = [header.join(",")].concat(
      rows.map((r) => [
        r.sku,
        '"' + r.product_name.replaceAll('"','""') + '"',
        r.strategy,
        r.price_action,
        r.price_change_pct,
        r.units_ordered,
        r.current_price,
        r.suggested_new_price,
        r.suggested_price_delta,
        r.gross_profit_unit,
        r.gross_profit_total,
        r.revenue_impact_est,
        '"' + (r.reason || "").replaceAll('"','""') + '"'
      ].join(","))
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "recommendations.csv";
    a.click();
  }

  return (
    <div className="p-6 space-y-5">
      {/* Brand Hero */}
      <div className="rounded-2xl border bg-gradient-to-br from-gray-50 to-white p-6">
        <div className="grid md:grid-cols-3 gap-4 items-center">
          <div className="md:col-span-2">
            <div className="text-sm uppercase tracking-wide text-gray-500 mb-1">AlfredAI</div>
            <div className="text-xl md:text-2xl font-semibold leading-snug">
              Your all-in-one backend intelligence — a trusted agent that handles the work you’d normally do manually.
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Built for first-time entrepreneurs, AlfredAI analyzes sales, funnels, and inventory to recommend — and soon
              execute — smart pricing, marketing, and fulfillment moves. It learns your patterns, anticipates problems,
              and surfaces what matters, so you can focus on customers and growth.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-xs text-gray-500">Quick actions</div>
            <div className="flex gap-2">
              <button onClick={downloadCSV} className="px-3 py-2 border rounded-lg text-sm flex items-center gap-2">
                <Download size={16}/> Export CSV
              </button>
              <button
                onClick={() => fetchFromLambda(lambdaUrl)}
                className="px-3 py-2 border rounded-lg text-sm flex items-center gap-2"
                disabled={loading}
              >
                <RefreshCcw size={16}/> {loading ? "Loading..." : "Load Live"}
              </button>
            </div>
            <div className="text-[11px] text-gray-400">
              Next: one-click apply via secure dispatcher with audit & rollback.
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="rounded-2xl border p-4 grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className="col-span-2 flex gap-2">
          <input
            className="flex-1 px-3 py-2 border rounded-lg text-sm"
            placeholder="Lambda Function URL"
            value={lambdaUrl}
            onChange={(e) => setLambdaUrl(e.target.value)}
          />
          <button
            onClick={() => fetchFromLambda(lambdaUrl)}
            className="px-3 py-2 border rounded-lg text-sm flex items-center gap-2"
            disabled={!lambdaUrl || loading}
          >
            <LinkIcon size={16}/> {loading ? "Loading..." : "Load"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="flex-1 px-3 py-2 border rounded-lg text-sm"
            placeholder="Search SKU or name"
            value={search}
            onChange={(e)=>setSearch(e.target.value)}
          />
          <Filter className="h-4 w-4 text-gray-400"/>
        </div>
        <div className="flex gap-2">
          <select
            className="w-full px-3 py-2 border rounded-lg text-sm"
            value={strategyFilter}
            onChange={(e)=>setStrategyFilter(e.target.value)}
          >
            <option value="all">All strategies</option>
            <option value="hold">Hold</option>
            <option value="premium_position">Premium Position</option>
          </select>
          <select
            className="w-full px-3 py-2 border rounded-lg text-sm"
            value={priceActionFilter}
            onChange={(e)=>setPriceActionFilter(e.target.value)}
          >
            <option value="all">All price actions</option>
            <option value="none">None</option>
            <option value="increase">Increase</option>
            <option value="decrease">Decrease</option>
          </select>
        </div>
        <div className="flex gap-2 justify-end">
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={onUploadFile} />
          <button onClick={()=>fileRef.current?.click()} className="px-3 py-2 border rounded-lg text-sm flex items-center gap-2">
            <Upload size={16}/> Upload JSON
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KPI title="SKUs Analyzed" value={kpis.skuAnalyzed.toLocaleString()} icon={<Package size={18}/>}/>
        <KPI title="Hold" value={kpis.hold.toLocaleString()} icon={<ShieldCheck size={18}/>}/>
        <KPI title="Premium Position" value={kpis.premium.toLocaleString()} icon={<TrendingUp size={18}/>}/>
        <KPI title="Price Increases" value={kpis.increases.toLocaleString()} icon={<Settings2 size={18}/>}/>
        <KPI title="Est. Revenue Impact" value={formatMoney(kpis.estRevenue)} icon={<DollarSign size={18}/>}/>
        <KPI title="Est. Gross Profit" value={formatMoney(kpis.estGrossProfit)} icon={<DollarSign size={18}/>}/>
      </div>

      {/* Summary + Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-4">
          <div className="font-medium mb-2">Strategy Mix</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={strategyMix} dataKey="value" nameKey="name" label>
                  {strategyMix.map((_, i) => (<Cell key={`c-${i}`} />))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border p-4 xl:col-span-2">
          <div className="font-medium mb-2">Top 10 by Units Ordered</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topByUnits} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" />
                <YAxis dataKey="sku" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="units" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border p-4 xl:col-span-3">
          <div className="font-medium mb-2">AlfredAI Readout</div>
          <ul className="list-disc ml-5 space-y-1 text-sm">
            <li><b>Trusted support:</b> AlfredAI monitors your data continuously and proposes safe, high-impact actions first.</li>
            <li><b>{rows.filter(r=>r.price_action==='increase').length}</b> SKUs with price-increase potential; projected uplift {formatMoney(kpis.estRevenue)} based on recent order volume.</li>
            <li><b>{rows.filter(r=>r.strategy==='premium_position').length}</b> premium-position candidates with strong margins — consider ad boosts when inventory allows.</li>
            <li><b>{rows.filter(r=>r.strategy==='hold').length}</b> items on hold; AlfredAI will re-surface them when signals flip.</li>
          </ul>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b">
              {[
                "SKU","Product","Strategy","Price Action","Δ Price %","Units","Current Price","New Price",
                "Δ Price","GP / Unit","GP Total","Rev Impact","Reason"
              ].map((h) => (
                <th key={h} className="text-left px-3 py-2 font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.sku} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">{r.sku}</td>
                <td className="px-3 py-2 max-w-[420px]"><div className="truncate" title={r.product_name}>{r.product_name}</div></td>
                <td className="px-3 py-2"><span className="px-2 py-1 border rounded-full text-xs">{r.strategy}</span></td>
                <td className="px-3 py-2"><span className="px-2 py-1 border rounded-full text-xs">{r.price_action}</span></td>
                <td className="px-3 py-2">{formatPct(r.price_change_pct)}</td>
                <td className="px-3 py-2">{r.units_ordered?.toLocaleString?.()}</td>
                <td className="px-3 py-2">{formatMoney(r.current_price)}</td>
                <td className="px-3 py-2">{formatMoney(r.suggested_new_price)}</td>
                <td className="px-3 py-2">{formatMoney(r.suggested_price_delta)}</td>
                <td className="px-3 py-2">{formatMoney(r.gross_profit_unit)}</td>
                <td className="px-3 py-2">{formatMoney(r.gross_profit_total)}</td>
                <td className="px-3 py-2">{formatMoney(r.revenue_impact_est)}</td>
                <td className="px-3 py-2 text-gray-500">{r.reason}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={13} className="px-3 py-8 text-center text-gray-500">No rows — load from Lambda or upload JSON.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">Run: {payload?.run_id || "—"} • AlfredAI — your backend partner that’s always one step ahead.</p>
    </div>
  );
}

function KPI({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-4 flex items-center gap-3">
      <div className="p-2 rounded-xl bg-gray-50">{icon}</div>
      <div>
        <div className="text-sm text-gray-500">{title}</div>
        <div className="text-2xl font-semibold leading-6">{value}</div>
      </div>
    </div>
  );
}
