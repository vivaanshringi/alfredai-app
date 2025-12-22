import React, { useMemo, useRef, useState } from "react";
import {
  CloudLightning,
  Upload,
  Download,
  Table2,
  Search,
  ArrowRight,
  Settings,
  CheckCircle2,
} from "lucide-react";

type Recommendation = {
  sku: string;
  product_name: string;
  units_ordered: number;
  current_price: number;
  gross_profit_unit: number;
  strategy: string;
  price_action: string;
  price_change_pct: number;
  reason?: string;
};

type Payload = {
  run_id: string;
  sku_count: number;
  recommendations: Recommendation[];
};

const DEFAULT_LAMBDA_URL =
  "https://4dvjlg6lcxnsyitduj633oazcq0pviog.lambda-url.us-east-1.on.aws/";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}
function safeLower(s?: string) {
  return (s || "").toLowerCase();
}
function formatMoney(n = 0) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export default function AlfredAIApp() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [lambdaUrl, setLambdaUrl] = useState(DEFAULT_LAMBDA_URL);
  const [view, setView] = useState<"home" | "table">("home");
  const [searchQuery, setSearchQuery] = useState("");

  const fileRef = useRef<HTMLInputElement | null>(null);
  const rows = payload?.recommendations ?? [];

  async function runLambda() {
    setLoading(true);
    try {
      const res = await fetch(lambdaUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Payload;
      setPayload(data);
      setView("home");
    } catch (e: any) {
      alert("Failed to fetch Lambda output: " + (e?.message ?? "Unknown error"));
    } finally {
      setLoading(false);
    }
  }

  function uploadJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        setPayload(JSON.parse(String(reader.result)));
        setView("home");
      } catch {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  }

  function downloadCSV() {
    if (!rows.length) return;

    const header = [
      "sku",
      "product_name",
      "strategy",
      "price_action",
      "price_change_pct",
      "units_ordered",
      "current_price",
      "gross_profit_unit",
      "reason",
    ];

    const lines = [header.join(",")].concat(
      rows.map((r) =>
        [
          r.sku,
          `"${(r.product_name || "").replaceAll('"', '""')}"`,
          r.strategy,
          r.price_action,
          r.price_change_pct,
          r.units_ordered,
          r.current_price,
          r.gross_profit_unit,
          `"${(r.reason || "").replaceAll('"', '""')}"`,
        ].join(",")
      )
    );

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "alfred_recommendations.csv";
    a.click();
  }

  const filteredRows = useMemo(() => {
    const q = safeLower(searchQuery).trim();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        safeLower(r.sku).includes(q) ||
        safeLower(r.product_name).includes(q) ||
        safeLower(r.strategy).includes(q) ||
        safeLower(r.price_action).includes(q)
    );
  }, [rows, searchQuery]);

  const stats = useMemo(() => {
    const skuCount = payload?.sku_count ?? rows.length;
    const hold = rows.filter((r) => safeLower(r.strategy) === "hold").length;
    const premium = rows.filter((r) => safeLower(r.strategy).includes("premium"))
      .length;
    const inc = rows.filter((r) => safeLower(r.price_action) === "increase")
      .length;

    const estUplift = rows.reduce((acc, r) => {
      const units = r.units_ordered || 0;
      const price = r.current_price || 0;
      const change = r.price_change_pct || 0;
      return acc + units * price * change;
    }, 0);

    return { skuCount, hold, premium, inc, estUplift };
  }, [payload, rows]);

  return (
    <div className="min-h-screen w-full text-slate-100 bg-gradient-to-br from-[#06112A] via-[#071A3A] to-[#06112A]">
      <style>{`
        html, body, #root { height: 100%; width: 100%; }
        body { margin: 0 !important; display: block !important; background: #06112A !important; }
      `}</style>

      {/* Top bar */}
      <div className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-base font-semibold tracking-tight">AlfredAI</div>
            <div className="text-sm text-white/60">Pricing & inventory co-pilot</div>
          </div>

          <button
            onClick={downloadCSV}
            disabled={!rows.length}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm",
              "bg-white/10 hover:bg-white/15 ring-1 ring-white/12",
              "disabled:opacity-50"
            )}
          >
            <Download className="h-4 w-4" />
            Download CSV
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-10">
        {/* HERO: narrower / shorter */}
        <section className="mx-auto max-w-4xl rounded-3xl bg-white/[0.05] ring-1 ring-white/10 shadow-[0_25px_90px_rgba(0,0,0,0.55)] overflow-hidden">
          <div className="grid md:grid-cols-2 gap-8 p-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/10 px-3 py-1 text-xs text-white/70">
                <Settings className="h-3.5 w-3.5" />
                Operator-first pricing intelligence
              </div>

              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-[1.08]">
                Your pricing & inventory co-pilot
              </h1>

              <p className="text-white/65 leading-relaxed">
                Quick read on what to raise, hold, and push — so you spend more time
                executing and less time staring at dashboards.
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={runLambda}
                  disabled={loading}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium whitespace-nowrap",
                    "bg-gradient-to-r from-sky-500/90 via-indigo-500/90 to-fuchsia-500/90 hover:brightness-110",
                    "shadow-[0_16px_60px_rgba(56,189,248,0.22)]",
                    "disabled:opacity-60"
                  )}
                >
                  <CloudLightning className="h-4 w-4" />
                  {loading ? "Running…" : "Run live Lambda"}
                </button>

                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  accept="application/json"
                  onChange={uploadJSON}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium whitespace-nowrap",
                    "bg-white/10 hover:bg-white/15 ring-1 ring-white/12"
                  )}
                >
                  <Upload className="h-4 w-4" />
                  Upload JSON
                </button>
              </div>

              <div className="pt-2">
                <div className="text-xs text-white/55 mb-2">Lambda URL</div>
                <input
                  value={lambdaUrl}
                  onChange={(e) => setLambdaUrl(e.target.value)}
                  className="w-full rounded-xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm outline-none text-white/85"
                />
              </div>
            </div>

            {/* Hero image stays smaller */}
            <div className="flex items-center justify-center">
              <img
                src="/alfred-bg.png"
                alt="AlfredAI preview"
                className="w-full max-w-[320px] rounded-2xl border border-white/10 shadow-2xl"
              />
            </div>
          </div>
        </section>

        {/* 3-column card stack */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard
            img="/card-run.svg"
            title="Run live Lambda"
            desc="Pull the latest recommendations from your Lambda endpoint."
            action={
              <button
                onClick={runLambda}
                disabled={loading}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap",
                  "bg-white/10 hover:bg-white/15 ring-1 ring-white/12",
                  "disabled:opacity-50"
                )}
              >
                Run <ArrowRight className="h-4 w-4" />
              </button>
            }
          />

          <FeatureCard
            img="/card-upload.svg"
            title="Upload JSON"
            desc="Load a saved run result for demos or offline review."
            action={
              <button
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap",
                  "bg-white/10 hover:bg-white/15 ring-1 ring-white/12"
                )}
              >
                Choose file
              </button>
            }
          />

          <FeatureCard
            img="/card-export.svg"
            title="Download CSV"
            desc="Export outputs for ops reviews, experiments, and handoffs."
            action={
              <button
                onClick={downloadCSV}
                disabled={!rows.length}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap",
                  "bg-white/10 hover:bg-white/15 ring-1 ring-white/12",
                  "disabled:opacity-50"
                )}
              >
                Download
              </button>
            }
          />

          <FeatureCard
            img="/card-table.svg"
            title="View detailed SKU table"
            desc="Open the full table with search + scan."
            action={
              <button
                onClick={() => setView("table")}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap",
                  "bg-white/10 hover:bg-white/15 ring-1 ring-white/12"
                )}
              >
                Open table <ArrowRight className="h-4 w-4" />
              </button>
            }
          />

          <FeatureCard
            img="/card-settings.svg"
            title="Configure data source"
            desc="Saved settings for Lambda now. S3/webhook/API next."
            action={
              <div className="text-xs text-white/55">
                Coming next: presets, validation, and saved connections.
              </div>
            }
          />
        </section>

        {/* Results */}
        {view === "home" ? (
          <section className="grid lg:grid-cols-3 gap-5">
            <GlassCard className="lg:col-span-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-semibold text-white/90">Overview</div>
                  <div className="text-sm text-white/55">Quick read of what’s happening.</div>
                </div>

                <div className="w-full max-w-sm">
                  <div className="flex items-center gap-2 rounded-xl bg-white/5 ring-1 ring-white/10 px-3 py-2">
                    <Search className="h-4 w-4 text-white/45" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search SKU / product..."
                      className="w-full bg-transparent outline-none text-sm text-white/85 placeholder:text-white/35"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                <MiniStat label="SKUs analyzed" value={stats.skuCount} />
                <MiniStat label="Hold" value={stats.hold} />
                <MiniStat label="Premium" value={stats.premium} />
                <MiniStat label="Increases" value={stats.inc} />
              </div>

              <div className="mt-5 text-xs text-white/55">
                Est. revenue uplift:{" "}
                <span className="text-white/85 font-medium">{formatMoney(stats.estUplift)}</span>
              </div>

              <div className="mt-5 rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4">
                <div className="text-sm font-semibold text-white/85">Quick preview</div>
                <div className="mt-3 space-y-2">
                  {filteredRows.slice(0, 5).map((r) => (
                    <div
                      key={r.sku}
                      className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] ring-1 ring-white/10 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm text-white/90 font-mono">{r.sku}</div>
                        <div className="text-xs text-white/55 truncate">{r.product_name}</div>
                      </div>
                      <div className="text-xs text-white/60 whitespace-nowrap">
                        {r.strategy} · {r.price_action}
                      </div>
                    </div>
                  ))}
                  {!rows.length && (
                    <div className="text-sm text-white/55">
                      Run Lambda or upload JSON to see results.
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="text-base font-semibold text-white/90">AlfredAI summary</div>
              <ul className="mt-4 space-y-3 text-sm text-white/70">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-200/80" />
                  Keeps revenue, profit, and inventory in balance.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-200/80" />
                  Surfaces “easy wins” first (high units, positive margin).
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-200/80" />
                  Export-ready outputs for ops reviews and experiments.
                </li>
              </ul>
            </GlassCard>
          </section>
        ) : (
          <GlassCard>
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-white/90">Detailed SKU table</div>
                <div className="text-sm text-white/55">
                  Showing {filteredRows.length.toLocaleString()} of {rows.length.toLocaleString()}
                </div>
              </div>

              <button
                onClick={() => setView("home")}
                className="rounded-xl bg-white/10 hover:bg-white/15 ring-1 ring-white/12 px-4 py-2 text-sm whitespace-nowrap"
              >
                Back
              </button>
            </div>

            <div className="mt-4 overflow-x-auto rounded-2xl bg-white/[0.03] ring-1 ring-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.05] text-white/60">
                  <tr>
                    {["SKU", "Product", "Strategy", "Action", "Units", "Price"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => (
                    <tr
                      key={r.sku}
                      className="border-t border-white/10 hover:bg-white/[0.04]"
                    >
                      <td className="px-4 py-3 font-mono text-sky-200 whitespace-nowrap">
                        {r.sku}
                      </td>
                      <td className="px-4 py-3 max-w-[560px]">
                        <div className="truncate text-white/85" title={r.product_name}>
                          {r.product_name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white/70 whitespace-nowrap">{r.strategy}</td>
                      <td className="px-4 py-3 text-white/70 whitespace-nowrap">{r.price_action}</td>
                      <td className="px-4 py-3 text-white/70 whitespace-nowrap">
                        {(r.units_ordered || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-white/70 whitespace-nowrap">
                        {formatMoney(r.current_price || 0)}
                      </td>
                    </tr>
                  ))}

                  {!rows.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-white/55">
                        No data yet — run Lambda or upload JSON.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        )}

        <div className="pt-4 text-center text-xs text-white/45">
          AlfredAI · operator-first pricing intelligence
        </div>
      </main>
    </div>
  );
}

/* UI components */

function GlassCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl bg-white/[0.05] ring-1 ring-white/10 shadow-[0_20px_70px_rgba(0,0,0,0.45)] p-6 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function FeatureCard({
  img,
  title,
  desc,
  action,
}: {
  img: string;
  title: string;
  desc: string;
  action: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl bg-white/[0.05] ring-1 ring-white/10 shadow-[0_20px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl overflow-hidden">
      <div className="px-6 pt-6">
        <img src={img} alt="" className="h-20 w-auto opacity-95" />
      </div>
      <div className="px-6 pb-6 pt-3">
        <div className="text-base font-semibold text-white/90">{title}</div>
        <div className="mt-1 text-sm text-white/60">{desc}</div>
        <div className="mt-4">{action}</div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-4">
      <div className="text-xs text-white/55">{label}</div>
      <div className="mt-2 text-xl font-semibold text-white/90">{value.toLocaleString()}</div>
    </div>
  );
}
