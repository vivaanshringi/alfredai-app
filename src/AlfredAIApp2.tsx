import React, { useMemo, useRef, useState } from "react";
import {
  Upload,
  Download,
  Search,
  ArrowRight,
  CheckCircle2,
  PlayCircle,
  X,
  Wand2,
  Scale,
  TrendingUp,
  Package,
  BadgeDollarSign,
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

/**
 * Placeholder for your “agent executes the actions” endpoint.
 * When you have it, set this to your API Gateway/Lambda URL.
 */
const AGENT_EXECUTE_URL = ""; // e.g. "https://your-agent-executor.lambda-url...."

type Mode = "balanced" | "profit" | "inventory" | "revenue";

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
  const [lambdaUrl] = useState(DEFAULT_LAMBDA_URL);

  const [view, setView] = useState<"home" | "table">("home");
  const [searchQuery, setSearchQuery] = useState("");

  const [mode, setMode] = useState<Mode>("balanced");

  const [agentExecuting, setAgentExecuting] = useState(false);
  const [agentResultMsg, setAgentResultMsg] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const rows = payload?.recommendations ?? [];

  // Run Agent -> calls Lambda in background, sends selected "mode" as query param
  async function runAgent() {
    setLoading(true);
    setAgentResultMsg(null);
    try {
      const url = new URL(lambdaUrl);
      url.searchParams.set("mode", mode); // GET-safe

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as Payload;
      setPayload(data);
      setView("home");
    } catch (e: any) {
      alert("Failed to fetch agent output: " + (e?.message ?? "Unknown error"));
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
    const dec = rows.filter((r) => safeLower(r.price_action) === "decrease")
      .length;

    const estUplift = rows.reduce((acc, r) => {
      const units = r.units_ordered || 0;
      const price = r.current_price || 0;
      const change = r.price_change_pct || 0;
      return acc + units * price * change;
    }, 0);

    return { skuCount, hold, premium, inc, dec, estUplift };
  }, [payload, rows]);

  // Execute actions (placeholder until backend exists)
  async function executeWithAgent() {
    if (!rows.length) return;

    setAgentExecuting(true);
    setAgentResultMsg(null);

    try {
      const actionPlan = rows
        .filter((r) => safeLower(r.price_action) !== "hold")
        .slice(0, 50)
        .map((r) => ({
          sku: r.sku,
          price_action: r.price_action,
          price_change_pct: r.price_change_pct,
          strategy: r.strategy,
        }));

      if (!AGENT_EXECUTE_URL) {
        await new Promise((resolve) => setTimeout(resolve, 900));
        setAgentResultMsg(
          `Queued ${actionPlan.length} action(s) for "${modeLabel(
            mode
          )}". (UI simulated — wire AGENT_EXECUTE_URL to execute for real.)`
        );
        return;
      }

      const res = await fetch(AGENT_EXECUTE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_id: payload?.run_id ?? null,
          mode,
          actions: actionPlan,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const out = await res.json();
      setAgentResultMsg(
        out?.message ?? `Agent executed ${actionPlan.length} action(s) successfully.`
      );
    } catch (e: any) {
      alert("Agent execution failed: " + (e?.message ?? "Unknown error"));
    } finally {
      setAgentExecuting(false);
    }
  }

  const canExecute = rows.length > 0;

  return (
    <div className="min-h-screen w-full text-slate-100 bg-gradient-to-br from-[#06112A] via-[#071A3A] to-[#06112A]">
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

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {/* Centerframe image FIRST */}
        <section className="mx-auto max-w-5xl">
          <img
            src="/alfred-centerframe.svg"
            alt="AlfredAI centerframe"
            className="w-full rounded-[28px] shadow-[0_24px_90px_rgba(0,0,0,0.55)] ring-1 ring-white/10"
          />
        </section>

        {/* Strategy selector: one row segmented control */}
        <section className="mx-auto max-w-5xl">
          <GlassCard>
            <div className="flex flex-col items-center text-center gap-2">

              <div>
                <div className="text-base font-semibold text-white/90">Strategy</div>
                <div className="text-sm text-white/55">
                  Choose how Alfred prioritizes actions.
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="w-full overflow-x-auto">
                  <div className="inline-flex min-w-full lg:min-w-0 gap-2 rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-2">
                    <ModePill
                      active={mode === "balanced"}
                      title="Balanced"
                      icon={<Scale className="h-4 w-4" />}
                      onClick={() => setMode("balanced")}
                    />
                    <ModePill
                      active={mode === "profit"}
                      title="Profit Maxing"
                      icon={<BadgeDollarSign className="h-4 w-4" />}
                      onClick={() => setMode("profit")}
                    />
                    <ModePill
                      active={mode === "inventory"}
                      title="Inventory clean up"
                      icon={<Package className="h-4 w-4" />}
                      onClick={() => setMode("inventory")}
                    />
                    <ModePill
                      active={mode === "revenue"}
                      title="Revenue Maxing"
                      icon={<TrendingUp className="h-4 w-4" />}
                      onClick={() => setMode("revenue")}
                    />
                  </div>
                </div>

                <div className="text-sm text-white/60 lg:text-right lg:min-w-[260px]">
                  Selected:{" "}
                  <span className="text-white/85 font-medium">{modeLabel(mode)}</span>
                  <div className="text-xs text-white/45 mt-1">
                    Impacts how Alfred prioritizes actions
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* Cards */}
        <section className="mx-auto max-w-5xl">
          <div className="cardsGrid" style={{ display: "grid", gap: 18 }}>
            <FeatureCard
              img="/card-run.svg"
              title="Run Agent"
              desc={`Run Alfred in “${modeLabel(mode)}” mode.`}
              action={
                <button
                  onClick={runAgent}
                  disabled={loading}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap",
                    "bg-white/10 hover:bg-white/15 ring-1 ring-white/12",
                    "disabled:opacity-50"
                  )}
                >
                  <PlayCircle className="h-4 w-4" />
                  {loading ? "Running…" : "Run Agent"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              }
            />

            <FeatureCard
              img="/card-upload.svg"
              title="Upload JSON"
              desc="Load a saved run result for demos or offline review."
              action={
                <>
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
                      "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap",
                      "bg-white/10 hover:bg-white/15 ring-1 ring-white/12"
                    )}
                  >
                    <Upload className="h-4 w-4" />
                    Choose file
                  </button>
                </>
              }
            />

            <FeatureCard
              img="/card-export.svg"
              title="Download CSV"
              desc="Export outputs for ops reviews and handoffs."
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
                  <Download className="h-4 w-4" />
                  Download
                </button>
              }
            />

            <FeatureCard
              img="/card-table.svg"
              title="SKU Table"
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
              title="Guardrails"
              desc="Cap max price change, minimum margin, and inventory bounds."
              action={<div className="text-xs text-white/55">Next: policy editor</div>}
            />

            <FeatureCard
              img="/card-table.svg"
              title="Automation"
              desc="Let Alfred execute approved actions end-to-end."
              action={
                <button
                  onClick={executeWithAgent}
                  disabled={!canExecute || agentExecuting}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap",
                    "bg-emerald-500/90 hover:bg-emerald-500 text-emerald-950",
                    "shadow-[0_14px_55px_rgba(16,185,129,0.18)]",
                    "disabled:opacity-50"
                  )}
                >
                  <Wand2 className="h-4 w-4" />
                  {agentExecuting ? "Executing…" : "Execute"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              }
            />
          </div>

          <style>{`
            .cardsGrid { grid-template-columns: repeat(1, minmax(0, 1fr)); }
            @media (min-width: 768px) {
              .cardsGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            }
            @media (min-width: 1024px) {
              .cardsGrid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            }
          `}</style>
        </section>

        {/* Results */}
        {view === "home" ? (
          <section className="mx-auto max-w-5xl grid lg:grid-cols-3 gap-6">
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

              <div className="mt-5 grid gap-3 sm:grid-cols-5">
                <MiniStat label="SKUs analyzed" value={stats.skuCount} />
                <MiniStat label="Hold" value={stats.hold} />
                <MiniStat label="Premium" value={stats.premium} />
                <MiniStat label="Increase" value={stats.inc} />
                <MiniStat label="Decrease" value={stats.dec} />
              </div>

              <div className="mt-5 text-xs text-white/55">
                Est. revenue uplift:{" "}
                <span className="text-white/85 font-medium">{formatMoney(stats.estUplift)}</span>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="text-base font-semibold text-white/90">Next step</div>
              <div className="mt-2 text-sm text-white/70">
                Run the agent, review the plan, then execute approved actions.
              </div>

              <button
                onClick={executeWithAgent}
                disabled={!canExecute || agentExecuting}
                className={cn(
                  "mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold whitespace-nowrap",
                  "bg-emerald-500/90 hover:bg-emerald-500 text-emerald-950",
                  "shadow-[0_14px_55px_rgba(16,185,129,0.18)]",
                  "disabled:opacity-50"
                )}
              >
                <Wand2 className="h-4 w-4" />
                {agentExecuting ? "Executing…" : "Execute with Alfred Agent"}
              </button>

              {agentResultMsg && (
                <div className="mt-3 rounded-2xl bg-white/[0.04] ring-1 ring-white/10 px-4 py-3 text-sm text-white/75">
                  {agentResultMsg}
                </div>
              )}

              <ul className="mt-5 space-y-3 text-sm text-white/70">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-200/80" />
                  Apply price changes with guardrails
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-200/80" />
                  Place replenishment orders where suggested
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-200/80" />
                  Produce an audit log for approvals and rollbacks
                </li>
              </ul>
            </GlassCard>
          </section>
        ) : (
          <GlassCard className="mx-auto max-w-5xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-white/90">Detailed SKU table</div>
                <div className="text-sm text-white/55">
                  Showing {filteredRows.length.toLocaleString()} of {rows.length.toLocaleString()}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setView("home")}
                  className="rounded-xl bg-white/10 hover:bg-white/15 ring-1 ring-white/12 px-4 py-2 text-sm whitespace-nowrap"
                >
                  Close
                </button>
                <button
                  onClick={() => setView("home")}
                  className="inline-flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/15 ring-1 ring-white/12 p-2"
                  aria-label="Close table"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
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
                        No data yet — run the agent or upload JSON.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        )}

        <div className="pt-2 text-center text-xs text-white/45">
          AlfredAI · operator-first pricing intelligence
        </div>
      </main>
    </div>
  );
}

/* Components */

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
    <div className="rounded-3xl bg-white/[0.05] ring-1 ring-white/10 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl overflow-hidden h-full flex flex-col">
      <div className="px-6 pt-6">
        <img src={img} alt="" className="h-16 w-auto opacity-95" />
      </div>
      <div className="px-6 pb-6 pt-3 flex-1 flex flex-col">
        <div className="text-base font-semibold text-white/90">{title}</div>
        <div className="mt-1 text-sm text-white/60 flex-1">{desc}</div>
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

function ModePill({
  active,
  title,
  icon,
  onClick,
}: {
  active: boolean;
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all",
        "ring-1 backdrop-blur-sm",
        active
          ? "bg-gradient-to-r from-sky-500/40 via-indigo-500/35 to-fuchsia-500/35 ring-sky-400/40 shadow-[0_12px_40px_rgba(56,189,248,0.25)] text-white"
          : "bg-white/[0.06] ring-white/15 text-white/80 hover:bg-white/[0.10] hover:text-white"
      )}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-lg p-1.5 ring-1",
          active ? "bg-white/15 ring-white/30" : "bg-white/10 ring-white/15"
        )}
      >
        {icon}
      </span>
      {title}
    </button>
  );
}

function modeLabel(m: Mode) {
  switch (m) {
    case "balanced":
      return "Balanced approach";
    case "profit":
      return "Profit Maxing";
    case "inventory":
      return "Inventory clean up";
    case "revenue":
      return "Revenue Maxing";
  }
}
