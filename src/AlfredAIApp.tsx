// AlfredAIApp.tsx — Redesigned
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
  Sparkles,
  BarChart3,
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

const AGENT_EXECUTE_URL = "";

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

  async function runAgent() {
    setLoading(true);
    setAgentResultMsg(null);
    try {
      const url = new URL(lambdaUrl);
      url.searchParams.set("mode", mode);
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
    const header = ["sku","product_name","strategy","price_action","price_change_pct","units_ordered","current_price","gross_profit_unit","reason"];
    const lines = [header.join(",")].concat(
      rows.map((r) =>
        [r.sku,`"${(r.product_name || "").replaceAll('"', '""')}"`,r.strategy,r.price_action,r.price_change_pct,r.units_ordered,r.current_price,r.gross_profit_unit,`"${(r.reason || "").replaceAll('"', '""')}"`].join(",")
      )
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
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
      (r) => safeLower(r.sku).includes(q) || safeLower(r.product_name).includes(q) || safeLower(r.strategy).includes(q) || safeLower(r.price_action).includes(q)
    );
  }, [rows, searchQuery]);

  const stats = useMemo(() => {
    const skuCount = payload?.sku_count ?? rows.length;
    const hold = rows.filter((r) => safeLower(r.strategy) === "hold").length;
    const premium = rows.filter((r) => safeLower(r.strategy).includes("premium")).length;
    const inc = rows.filter((r) => safeLower(r.price_action) === "increase").length;
    const dec = rows.filter((r) => safeLower(r.price_action) === "decrease").length;
    const estUplift = rows.reduce((acc, r) => {
      return acc + (r.units_ordered || 0) * (r.current_price || 0) * (r.price_change_pct || 0);
    }, 0);
    return { skuCount, hold, premium, inc, dec, estUplift };
  }, [payload, rows]);

  async function executeWithAgent() {
    if (!rows.length) return;
    setAgentExecuting(true);
    setAgentResultMsg(null);
    try {
      const actionPlan = rows.filter((r) => safeLower(r.price_action) !== "hold").slice(0, 50).map((r) => ({ sku: r.sku, price_action: r.price_action, price_change_pct: r.price_change_pct, strategy: r.strategy }));
      if (!AGENT_EXECUTE_URL) {
        await new Promise((resolve) => setTimeout(resolve, 900));
        setAgentResultMsg(`Queued ${actionPlan.length} action(s) for "${modeLabel(mode)}". (UI simulated — wire AGENT_EXECUTE_URL to execute for real.)`);
        return;
      }
      const res = await fetch(AGENT_EXECUTE_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ run_id: payload?.run_id ?? null, mode, actions: actionPlan }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const out = await res.json();
      setAgentResultMsg(out?.message ?? `Agent executed ${actionPlan.length} action(s) successfully.`);
    } catch (e: any) {
      alert("Agent execution failed: " + (e?.message ?? "Unknown error"));
    } finally {
      setAgentExecuting(false);
    }
  }

  const canExecute = rows.length > 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        :root {
          --bg-deep:     #04090F;
          --bg-mid:      #07111E;
          --bg-surface:  #0B1929;
          --accent-gold: #E8B96F;
          --accent-blue: #4B9FFF;
          --accent-teal: #2DD4BF;
          --accent-rose: #F87171;
          --glass-bg:    rgba(255,255,255,0.035);
          --glass-ring:  rgba(255,255,255,0.08);
          --text-hi:     rgba(255,255,255,0.92);
          --text-mid:    rgba(255,255,255,0.60);
          --text-lo:     rgba(255,255,255,0.35);
          --font-display: 'Syne', sans-serif;
          --font-body:    'DM Sans', sans-serif;
          --font-mono:    'DM Mono', monospace;
        }

        body, #root { margin: 0; padding: 0; }

        .alfred-root {
          min-height: 100vh;
          width: 100%;
          background-color: var(--bg-deep);
          background-image:
            radial-gradient(ellipse 80% 40% at 50% -10%, rgba(75,159,255,0.12) 0%, transparent 70%),
            radial-gradient(ellipse 50% 30% at 90% 80%, rgba(45,212,191,0.07) 0%, transparent 60%),
            radial-gradient(ellipse 40% 20% at 10% 60%, rgba(232,185,111,0.05) 0%, transparent 60%);
          color: var(--text-hi);
          font-family: var(--font-body);
        }

        /* ── Topbar ── */
        .topbar {
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(4,9,15,0.85);
          backdrop-filter: blur(20px);
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .topbar-inner {
          max-width: 1152px;
          margin: 0 auto;
          padding: 0 24px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .wordmark {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .wordmark-icon {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          background: linear-gradient(135deg, var(--accent-blue), var(--accent-teal));
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 20px rgba(75,159,255,0.35);
        }
        .wordmark-name {
          font-family: var(--font-display);
          font-size: 17px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--text-hi);
        }
        .wordmark-tag {
          font-size: 11px;
          font-weight: 400;
          color: var(--text-lo);
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-top: 1px;
        }
        .topbar-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        /* ── Buttons ── */
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          font-family: var(--font-body);
          cursor: pointer;
          border: none;
          outline: none;
          transition: all 0.18s ease;
          white-space: nowrap;
        }
        .btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-ghost {
          background: rgba(255,255,255,0.06);
          color: var(--text-mid);
          box-shadow: inset 0 0 0 1px var(--glass-ring);
        }
        .btn-ghost:hover:not(:disabled) {
          background: rgba(255,255,255,0.10);
          color: var(--text-hi);
        }
        .btn-primary {
          background: linear-gradient(135deg, var(--accent-blue), #3b82f6);
          color: #fff;
          box-shadow: 0 8px 32px rgba(75,159,255,0.28);
        }
        .btn-primary:hover:not(:disabled) {
          box-shadow: 0 10px 40px rgba(75,159,255,0.42);
          transform: translateY(-1px);
        }
        .btn-execute {
          background: linear-gradient(135deg, #10b981, #059669);
          color: #fff;
          box-shadow: 0 8px 32px rgba(16,185,129,0.22);
          font-weight: 600;
        }
        .btn-execute:hover:not(:disabled) {
          box-shadow: 0 10px 40px rgba(16,185,129,0.36);
          transform: translateY(-1px);
        }

        /* ── Main layout ── */
        .main {
          max-width: 1152px;
          margin: 0 auto;
          padding: 36px 24px;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        /* ── Centerframe ── */
        .centerframe {
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 32px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.07);
        }
        .centerframe img { display: block; width: 100%; }

        /* ── Glass card ── */
        .glass {
          background: var(--glass-bg);
          border-radius: 20px;
          box-shadow: inset 0 0 0 1px var(--glass-ring), 0 24px 64px rgba(0,0,0,0.4);
          backdrop-filter: blur(24px);
          padding: 24px;
        }

        /* ── Section header ── */
        .section-title {
          font-family: var(--font-display);
          font-size: 15px;
          font-weight: 600;
          color: var(--text-hi);
          letter-spacing: -0.01em;
        }
        .section-sub {
          font-size: 12.5px;
          color: var(--text-lo);
          margin-top: 3px;
        }

        /* ── Strategy pills ── */
        .strategy-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-top: 18px;
        }
        @media (min-width: 640px) {
          .strategy-grid { grid-template-columns: repeat(4, 1fr); }
        }

        .mode-pill {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          border-radius: 14px;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
          text-align: left;
          font-family: var(--font-body);
        }
        .mode-pill-icon {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .mode-pill-label {
          font-size: 13px;
          font-weight: 600;
          line-height: 1.2;
        }
        .mode-pill-sub {
          font-size: 11px;
          margin-top: 1px;
          line-height: 1.3;
        }
        .mode-pill-inactive {
          background: rgba(255,255,255,0.04);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.07);
          color: var(--text-mid);
        }
        .mode-pill-inactive:hover { background: rgba(255,255,255,0.08); }
        .mode-pill-inactive .mode-pill-icon { background: rgba(255,255,255,0.07); }
        .mode-pill-inactive .mode-pill-sub { color: var(--text-lo); }

        .mode-pill-balanced {
          background: linear-gradient(135deg, rgba(75,159,255,0.18), rgba(99,102,241,0.14));
          box-shadow: inset 0 0 0 1px rgba(75,159,255,0.25), 0 8px 32px rgba(75,159,255,0.10);
          color: var(--text-hi);
        }
        .mode-pill-balanced .mode-pill-icon { background: rgba(75,159,255,0.20); color: var(--accent-blue); }
        .mode-pill-balanced .mode-pill-sub { color: rgba(147,197,253,0.8); }

        .mode-pill-profit {
          background: linear-gradient(135deg, rgba(232,185,111,0.18), rgba(245,158,11,0.12));
          box-shadow: inset 0 0 0 1px rgba(232,185,111,0.28), 0 8px 32px rgba(232,185,111,0.09);
          color: var(--text-hi);
        }
        .mode-pill-profit .mode-pill-icon { background: rgba(232,185,111,0.20); color: var(--accent-gold); }
        .mode-pill-profit .mode-pill-sub { color: rgba(253,230,138,0.75); }

        .mode-pill-inventory {
          background: linear-gradient(135deg, rgba(45,212,191,0.15), rgba(20,184,166,0.10));
          box-shadow: inset 0 0 0 1px rgba(45,212,191,0.22), 0 8px 32px rgba(45,212,191,0.08);
          color: var(--text-hi);
        }
        .mode-pill-inventory .mode-pill-icon { background: rgba(45,212,191,0.18); color: var(--accent-teal); }
        .mode-pill-inventory .mode-pill-sub { color: rgba(153,246,228,0.75); }

        .mode-pill-revenue {
          background: linear-gradient(135deg, rgba(248,113,113,0.15), rgba(239,68,68,0.10));
          box-shadow: inset 0 0 0 1px rgba(248,113,113,0.22), 0 8px 32px rgba(248,113,113,0.08);
          color: var(--text-hi);
        }
        .mode-pill-revenue .mode-pill-icon { background: rgba(248,113,113,0.18); color: var(--accent-rose); }
        .mode-pill-revenue .mode-pill-sub { color: rgba(252,165,165,0.75); }

        /* ── Cards grid ── */
        .cards-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media (min-width: 640px) {
          .cards-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (min-width: 1024px) {
          .cards-grid { grid-template-columns: repeat(3, 1fr); }
        }

        .feature-card {
          background: var(--glass-bg);
          border-radius: 18px;
          box-shadow: inset 0 0 0 1px var(--glass-ring), 0 16px 48px rgba(0,0,0,0.35);
          backdrop-filter: blur(20px);
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: box-shadow 0.2s ease, transform 0.2s ease;
        }
        .feature-card:hover {
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12), 0 20px 60px rgba(0,0,0,0.5);
          transform: translateY(-2px);
        }
        .feature-card-icon {
          width: 40px;
          height: 40px;
          border-radius: 11px;
          background: rgba(255,255,255,0.06);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.10);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .feature-card img {
          height: 40px;
          width: auto;
          opacity: 0.9;
        }
        .feature-card-title {
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 600;
          color: var(--text-hi);
        }
        .feature-card-desc {
          font-size: 12.5px;
          color: var(--text-mid);
          line-height: 1.55;
          flex: 1;
        }

        /* ── Results section ── */
        .results-layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }
        @media (min-width: 1024px) {
          .results-layout { grid-template-columns: 1fr 340px; }
        }

        /* ── MiniStats ── */
        .stats-row {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-top: 18px;
        }
        @media (min-width: 480px) {
          .stats-row { grid-template-columns: repeat(3, 1fr); }
        }
        @media (min-width: 768px) {
          .stats-row { grid-template-columns: repeat(5, 1fr); }
        }
        .mini-stat {
          background: rgba(255,255,255,0.03);
          border-radius: 14px;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.07);
          padding: 14px 16px;
        }
        .mini-stat-label {
          font-size: 10.5px;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--text-lo);
          font-weight: 500;
        }
        .mini-stat-value {
          margin-top: 8px;
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 700;
          color: var(--text-hi);
          line-height: 1;
        }

        /* ── Search ── */
        .search-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          border-radius: 11px;
          background: rgba(255,255,255,0.05);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.09);
          padding: 9px 13px;
          margin-top: 18px;
        }
        .search-wrap input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-size: 13px;
          font-family: var(--font-body);
          color: var(--text-hi);
        }
        .search-wrap input::placeholder { color: var(--text-lo); }

        /* ── Uplift strip ── */
        .uplift-strip {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 18px;
          padding: 13px 16px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(45,212,191,0.10), rgba(75,159,255,0.08));
          box-shadow: inset 0 0 0 1px rgba(45,212,191,0.18);
          font-size: 13px;
          color: var(--text-mid);
        }
        .uplift-value {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 16px;
          color: var(--accent-teal);
        }

        /* ── Next step card ── */
        .checklist {
          list-style: none;
          margin: 18px 0 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 11px;
        }
        .checklist li {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          font-size: 13px;
          color: var(--text-mid);
          line-height: 1.5;
        }
        .checklist-dot {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 1.5px solid var(--accent-teal);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .checklist-dot svg { width: 9px; height: 9px; }

        .agent-result {
          margin-top: 14px;
          border-radius: 12px;
          background: rgba(255,255,255,0.04);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
          padding: 13px 16px;
          font-size: 12.5px;
          color: var(--text-mid);
          line-height: 1.55;
        }

        /* ── SKU Table ── */
        .table-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .table-wrap {
          margin-top: 18px;
          overflow-x: auto;
          border-radius: 14px;
          background: rgba(255,255,255,0.02);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.07);
        }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        thead tr { background: rgba(255,255,255,0.04); }
        th {
          text-align: left;
          padding: 12px 16px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--text-lo);
          white-space: nowrap;
          font-family: var(--font-body);
        }
        tbody tr {
          border-top: 1px solid rgba(255,255,255,0.05);
          transition: background 0.12s;
        }
        tbody tr:hover { background: rgba(255,255,255,0.035); }
        td { padding: 12px 16px; color: var(--text-mid); white-space: nowrap; }
        .td-sku {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--accent-blue);
        }
        .td-product { max-width: 320px; }
        .td-product-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--text-hi);
          font-size: 13px;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 9px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          font-family: var(--font-body);
        }
        .badge-increase { background: rgba(16,185,129,0.15); color: #6ee7b7; box-shadow: inset 0 0 0 1px rgba(16,185,129,0.25); }
        .badge-decrease { background: rgba(248,113,113,0.15); color: #fca5a5; box-shadow: inset 0 0 0 1px rgba(248,113,113,0.25); }
        .badge-hold { background: rgba(255,255,255,0.06); color: var(--text-lo); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.10); }

        /* ── Founder ── */
        .founder-section {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0;
          align-items: center;
        }
        @media (min-width: 768px) {
          .founder-section { grid-template-columns: auto 1fr; gap: 36px; }
        }
        .founder-avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-teal) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-display);
          font-size: 28px;
          font-weight: 700;
          color: #fff;
          flex-shrink: 0;
          box-shadow: 0 0 0 3px rgba(75,159,255,0.20), 0 12px 40px rgba(75,159,255,0.20);
          margin-bottom: 20px;
        }
        @media (min-width: 768px) { .founder-avatar { margin-bottom: 0; } }
        .founder-eyebrow {
          font-size: 10.5px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--accent-blue);
          margin-bottom: 8px;
        }
        .founder-name {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 700;
          color: var(--text-hi);
          letter-spacing: -0.02em;
          line-height: 1.15;
        }
        .founder-title {
          font-size: 12.5px;
          color: var(--accent-teal);
          font-weight: 500;
          margin-top: 4px;
        }
        .founder-bio {
          margin-top: 14px;
          font-size: 14px;
          line-height: 1.72;
          color: var(--text-mid);
          max-width: 560px;
        }
        .founder-bio strong {
          color: var(--text-hi);
          font-weight: 500;
        }
        .founder-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 18px;
        }
        .founder-tag {
          font-size: 11.5px;
          font-weight: 500;
          color: var(--text-lo);
          background: rgba(255,255,255,0.05);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.09);
          border-radius: 6px;
          padding: 4px 11px;
          letter-spacing: 0.02em;
        }

        /* ── Footer ── */
        .footer {
          text-align: center;
          font-size: 11.5px;
          color: var(--text-lo);
          padding: 16px 0 32px;
          letter-spacing: 0.04em;
        }
        .footer span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .footer-dot {
          width: 3px; height: 3px;
          border-radius: 50%;
          background: rgba(255,255,255,0.2);
          display: inline-block;
        }

        /* ── Divider ── */
        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
          margin: 4px 0;
        }

        /* ── Hero panel ── */
        .hero-panel { }

        /* ── Hero Run Agent button ── */
        .btn-run-hero {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 18px 22px;
          border-radius: 16px;
          border: none;
          cursor: pointer;
          font-family: var(--font-body);
          background: linear-gradient(135deg, rgba(75,159,255,0.22) 0%, rgba(99,102,241,0.18) 50%, rgba(45,212,191,0.14) 100%);
          box-shadow:
            inset 0 0 0 1px rgba(75,159,255,0.35),
            0 12px 48px rgba(75,159,255,0.18),
            0 2px 8px rgba(0,0,0,0.3);
          transition: all 0.22s ease;
          text-align: left;
          position: relative;
          overflow: hidden;
        }
        .btn-run-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(75,159,255,0.10), transparent 60%);
          opacity: 0;
          transition: opacity 0.22s;
        }
        .btn-run-hero:hover:not(:disabled)::before { opacity: 1; }
        .btn-run-hero:hover:not(:disabled) {
          box-shadow:
            inset 0 0 0 1px rgba(75,159,255,0.5),
            0 16px 64px rgba(75,159,255,0.28),
            0 2px 8px rgba(0,0,0,0.4);
          transform: translateY(-1px);
        }
        .btn-run-hero:active:not(:disabled) { transform: translateY(0); }
        .btn-run-hero:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-run-hero-icon {
          width: 48px;
          height: 48px;
          border-radius: 13px;
          background: linear-gradient(135deg, var(--accent-blue), #6366f1);
          box-shadow: 0 6px 24px rgba(75,159,255,0.40);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          flex-shrink: 0;
        }
        .btn-run-hero-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .btn-run-hero-label {
          font-family: var(--font-display);
          font-size: 17px;
          font-weight: 700;
          color: var(--text-hi);
          letter-spacing: -0.02em;
          line-height: 1.2;
        }
        .btn-run-hero-sub {
          font-size: 12.5px;
          color: rgba(147,197,253,0.80);
          font-weight: 400;
        }

        /* ── Loading pulse ── */
        @keyframes pulse-glow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        .loading-pulse { animation: pulse-glow 1.4s ease-in-out infinite; }
      `}</style>

      <div className="alfred-root">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-inner">
            <div className="wordmark">
              <div className="wordmark-icon">
                <Sparkles style={{ width: 16, height: 16, color: "#fff" }} />
              </div>
              <div>
                <div className="wordmark-name">AlfredAI</div>
                <div className="wordmark-tag">Pricing Co-pilot</div>
              </div>
            </div>
            <div className="topbar-actions">
              {payload && (
                <span style={{ fontSize: 12, color: "var(--text-lo)", fontFamily: "var(--font-mono)" }}>
                  run · {payload.run_id?.slice(0, 8)}
                </span>
              )}
              <button onClick={downloadCSV} disabled={!rows.length} className="btn btn-ghost">
                <Download style={{ width: 14, height: 14 }} />
                Export CSV
              </button>
            </div>
          </div>
        </header>

        <main className="main">

          {/* ── Hero: Strategy + Run Agent ── */}
          <div className="glass hero-panel">
            {/* Strategy pills */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div className="section-title">Optimization Strategy</div>
                <div className="section-sub">Choose how Alfred weighs its decisions across your catalog.</div>
              </div>
            </div>
            <div className="strategy-grid">
              <ModePill2
                active={mode === "balanced"}
                variant="balanced"
                title="Balanced"
                subtitle="All signals weighted"
                icon={<Scale style={{ width: 16, height: 16 }} />}
                onClick={() => setMode("balanced")}
              />
              <ModePill2
                active={mode === "profit"}
                variant="profit"
                title="Profit Maxing"
                subtitle="Margin first"
                icon={<BadgeDollarSign style={{ width: 16, height: 16 }} />}
                onClick={() => setMode("profit")}
              />
              <ModePill2
                active={mode === "inventory"}
                variant="inventory"
                title="Inventory Clearance"
                subtitle="Move excess stock"
                icon={<Package style={{ width: 16, height: 16 }} />}
                onClick={() => setMode("inventory")}
              />
              <ModePill2
                active={mode === "revenue"}
                variant="revenue"
                title="Revenue Maxing"
                subtitle="Top-line growth"
                icon={<TrendingUp style={{ width: 16, height: 16 }} />}
                onClick={() => setMode("revenue")}
              />
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)", margin: "24px 0" }} />

            {/* Hero Run Agent button */}
            <button
              onClick={runAgent}
              disabled={loading}
              className={cn("btn-run-hero", loading && "loading-pulse")}
            >
              <span className="btn-run-hero-icon">
                <PlayCircle style={{ width: 22, height: 22 }} />
              </span>
              <span className="btn-run-hero-text">
                <span className="btn-run-hero-label">{loading ? "Alfred is thinking…" : "Run Agent"}</span>
                <span className="btn-run-hero-sub">
                  {loading ? "Analyzing your catalog" : `Analyze catalog · ${modeLabel(mode)}`}
                </span>
              </span>
              {!loading && <ArrowRight style={{ width: 18, height: 18, marginLeft: "auto", opacity: 0.6 }} />}
            </button>
          </div>

          {/* Results */}
          {view === "home" ? (
            <div className="results-layout">
              {/* Overview */}
              <div className="glass">
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <div className="section-title">Overview</div>
                    <div className="section-sub">What Alfred found in your catalog.</div>
                  </div>
                </div>

                <div className="search-wrap">
                  <Search style={{ width: 14, height: 14, color: "var(--text-lo)", flexShrink: 0 }} />
                  <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search SKU or product name…" />
                </div>

                <div className="stats-row">
                  <MiniStat2 label="SKUs analyzed" value={stats.skuCount.toLocaleString()} />
                  <MiniStat2 label="Hold" value={stats.hold.toLocaleString()} />
                  <MiniStat2 label="Premium" value={stats.premium.toLocaleString()} />
                  <MiniStat2 label="Increase" value={stats.inc.toLocaleString()} />
                  <MiniStat2 label="Decrease" value={stats.dec.toLocaleString()} />
                </div>

                {rows.length > 0 && (
                  <div className="uplift-strip">
                    <TrendingUp style={{ width: 15, height: 15, color: "var(--accent-teal)", flexShrink: 0 }} />
                    <span>Est. revenue uplift</span>
                    <span className="uplift-value">{formatMoney(stats.estUplift)}</span>
                  </div>
                )}

                {rows.length === 0 && (
                  <div style={{ marginTop: 24, textAlign: "center", padding: "28px 0", color: "var(--text-lo)", fontSize: 13 }}>
                    Run the agent or upload JSON to see results.
                  </div>
                )}
              </div>

              {/* Next step */}
              <div className="glass" style={{ display: "flex", flexDirection: "column" }}>
                <div className="section-title">Next Step</div>
                <div className="section-sub" style={{ marginTop: 4 }}>Review the plan, then execute approved actions.</div>

                <div style={{ marginTop: 20 }}>
                  <button
                    onClick={executeWithAgent}
                    disabled={!canExecute || agentExecuting}
                    className={cn("btn btn-execute", agentExecuting && "loading-pulse")}
                    style={{ width: "100%", justifyContent: "center", padding: "13px 20px", fontSize: 14, borderRadius: 12 }}
                  >
                    <Wand2 style={{ width: 16, height: 16 }} />
                    {agentExecuting ? "Executing…" : "Execute with Alfred Agent"}
                  </button>
                </div>

                {agentResultMsg && <div className="agent-result">{agentResultMsg}</div>}

                <ul className="checklist" style={{ marginTop: 20, flex: 1 }}>
                  {[
                    "Apply price changes with guardrails",
                    "Place replenishment orders where suggested",
                    "Produce an audit log for approvals and rollbacks",
                  ].map((item) => (
                    <li key={item}>
                      <div className="checklist-dot">
                        <CheckCircle2 style={{ width: 9, height: 9, color: "var(--accent-teal)" }} />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            /* Table view */
            <div className="glass">
              <div className="table-header">
                <div>
                  <div className="section-title">Detailed SKU Table</div>
                  <div className="section-sub">
                    Showing {filteredRows.length.toLocaleString()} of {rows.length.toLocaleString()} SKUs
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div className="search-wrap" style={{ margin: 0, minWidth: 220 }}>
                    <Search style={{ width: 13, height: 13, color: "var(--text-lo)", flexShrink: 0 }} />
                    <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search…" />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-lo)", display: "flex", padding: 0 }}>
                        <X style={{ width: 13, height: 13 }} />
                      </button>
                    )}
                  </div>
                  <button onClick={() => setView("home")} className="btn btn-ghost">
                    <X style={{ width: 14, height: 14 }} />
                    Close
                  </button>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {["SKU", "Product", "Strategy", "Action", "Units", "Price"].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r) => {
                      const action = safeLower(r.price_action);
                      return (
                        <tr key={r.sku}>
                          <td className="td-sku">{r.sku}</td>
                          <td className="td-product">
                            <div className="td-product-name" title={r.product_name}>{r.product_name}</div>
                          </td>
                          <td style={{ color: "var(--text-mid)" }}>{r.strategy}</td>
                          <td>
                            <span className={cn("badge", action === "increase" ? "badge-increase" : action === "decrease" ? "badge-decrease" : "badge-hold")}>
                              {r.price_action}
                            </span>
                          </td>
                          <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{(r.units_ordered || 0).toLocaleString()}</td>
                          <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{formatMoney(r.current_price || 0)}</td>
                        </tr>
                      );
                    })}
                    {!rows.length && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "40px 16px", color: "var(--text-lo)" }}>
                          No data yet — run the agent or upload JSON.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Centerframe — inline SVG dashboard illustration */}
          <div className="centerframe">
            <AlfredDashboardIllustration />
          </div>

          {/* Feature cards */}
          <div className="cards-grid">
            <FeatureCard2
              icon={<Upload style={{ width: 18, height: 18, color: "var(--accent-teal)" }} />}
              title="Upload JSON"
              desc="Load a saved run result for demos or offline review without re-running the agent."
              action={
                <>
                  <input ref={fileRef} type="file" hidden accept="application/json" onChange={uploadJSON} />
                  <button onClick={() => fileRef.current?.click()} className="btn btn-ghost">
                    <Upload style={{ width: 14, height: 14 }} />
                    Choose file
                  </button>
                </>
              }
            />
            <FeatureCard2
              icon={<Download style={{ width: 18, height: 18, color: "var(--accent-gold)" }} />}
              title="Download CSV"
              desc="Export the full recommendation set for ops reviews, approvals, and handoffs."
              action={
                <button onClick={downloadCSV} disabled={!rows.length} className="btn btn-ghost">
                  <Download style={{ width: 14, height: 14 }} />
                  Download
                </button>
              }
            />
            <FeatureCard2
              icon={<BarChart3 style={{ width: 18, height: 18, color: "var(--accent-blue)" }} />}
              title="SKU Table"
              desc="Open the full filterable table to scan individual recommendations."
              action={
                <button onClick={() => setView("table")} className="btn btn-ghost">
                  Open table <ArrowRight style={{ width: 13, height: 13 }} />
                </button>
              }
            />
            <FeatureCard2
              icon={<Scale style={{ width: 18, height: 18, color: "var(--text-lo)" }} />}
              title="Guardrails"
              desc="Cap max price change, minimum margin, and inventory bounds."
              action={
                <span style={{ fontSize: 12, color: "var(--text-lo)", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "inline-block" }} />
                  Policy editor — coming soon
                </span>
              }
            />
            <FeatureCard2
              icon={<Wand2 style={{ width: 18, height: 18, color: "#6ee7b7" }} />}
              title="Automation"
              desc="Let Alfred execute approved actions end-to-end against your catalog."
              action={
                <button onClick={executeWithAgent} disabled={!canExecute || agentExecuting} className={cn("btn btn-execute", agentExecuting && "loading-pulse")}>
                  <Wand2 style={{ width: 14, height: 14 }} />
                  {agentExecuting ? "Executing…" : "Execute"}
                </button>
              }
            />
          </div>

          {/* Founder */}
          <div className="glass">
            <div className="founder-section">
              <div className="founder-avatar">VS</div>
              <div>
                <div className="founder-eyebrow">Founder</div>
                <div className="founder-name">Vivaan Shringi</div>
                <div className="founder-title">Founder &amp; CEO, AlfredAI</div>
                <p className="founder-bio">
                  Vivaan is a <strong>second-time entrepreneur</strong> with a conviction that great software should make operators feel superhuman.
                  Before AlfredAI, he built and ran his own e-commerce business as a college freshman — navigating pricing decisions,
                  inventory headaches, and margin trade-offs firsthand. That experience left him with a clear mission:{" "}
                  <strong>give every operator the intelligence of a seasoned pricing team, on demand.</strong>
                </p>
                <div className="founder-tags">
                  <span className="founder-tag">2× Founder</span>
                  <span className="founder-tag">E-commerce operator</span>
                  <span className="founder-tag">Pricing &amp; inventory</span>
                  <span className="founder-tag">AI-native tooling</span>
                </div>
              </div>
            </div>
          </div>

          <div className="footer">
            <span>
              AlfredAI
              <span className="footer-dot" />
              operator-first pricing intelligence
            </span>
          </div>
        </main>
      </div>
    </>
  );
}

/* ── Sub-components ── */

function ModePill2({
  active,
  variant,
  title,
  subtitle,
  icon,
  onClick,
}: {
  active: boolean;
  variant: Mode;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn("mode-pill", active ? `mode-pill-${variant}` : "mode-pill-inactive")}
      style={{ width: "100%" }}
    >
      <div className="mode-pill-icon">{icon}</div>
      <div>
        <div className="mode-pill-label">{title}</div>
        <div className="mode-pill-sub">{subtitle}</div>
      </div>
    </button>
  );
}

function FeatureCard2({
  icon,
  title,
  desc,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  action: React.ReactNode;
}) {
  return (
    <div className="feature-card">
      <div className="feature-card-icon">{icon}</div>
      <div>
        <div className="feature-card-title">{title}</div>
        <div className="feature-card-desc">{desc}</div>
      </div>
      <div style={{ marginTop: "auto" }}>{action}</div>
    </div>
  );
}

function MiniStat2({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini-stat">
      <div className="mini-stat-label">{label}</div>
      <div className="mini-stat-value">{value}</div>
    </div>
  );
}

function modeLabel(m: Mode) {
  switch (m) {
    case "balanced":   return "Balanced approach";
    case "profit":     return "Profit Maxing";
    case "inventory":  return "Inventory clean up";
    case "revenue":    return "Revenue Maxing";
  }
}

/* ── AlfredDashboardIllustration ── */
/* A bespoke dark-mode dashboard hero: bar chart, stat cards, SKU table rows,
   and an AI "thinking" pulse — all pure SVG, no external images needed. */
function AlfredDashboardIllustration() {
  return (
    <svg
      width="100%"
      viewBox="0 0 1100 460"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", borderRadius: 20 }}
    >
      <defs>
        {/* Background gradient */}
        <linearGradient id="cf-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#04090F" />
          <stop offset="100%" stopColor="#071525" />
        </linearGradient>
        {/* Bar gradients */}
        <linearGradient id="bar-blue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4B9FFF" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="bar-teal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2DD4BF" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#0D9488" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="bar-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8B96F" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#D97706" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="bar-rose" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F87171" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#DC2626" stopOpacity="0.55" />
        </linearGradient>
        {/* Uplift line gradient */}
        <linearGradient id="line-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2DD4BF" stopOpacity="0.2" />
          <stop offset="50%" stopColor="#2DD4BF" stopOpacity="1" />
          <stop offset="100%" stopColor="#4B9FFF" stopOpacity="0.4" />
        </linearGradient>
        {/* Glow for pulse dot */}
        <radialGradient id="pulse-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#4B9FFF" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#4B9FFF" stopOpacity="0" />
        </radialGradient>
        <style>{`
          @keyframes cf-pulse { 0%,100%{opacity:0.25;r:6} 50%{opacity:1;r:8} }
          @keyframes cf-scan  { 0%{transform:translateY(0)}  100%{transform:translateY(220px)} }
          @keyframes cf-fade  { 0%,100%{opacity:0.35} 50%{opacity:0.9} }
          .cf-pulse { animation: cf-pulse 2s ease-in-out infinite; }
          .cf-scan  { animation: cf-scan  3.5s linear infinite; }
          .cf-fade  { animation: cf-fade  2.8s ease-in-out infinite; }
        `}</style>
      </defs>

      {/* ── Background ── */}
      <rect width="1100" height="460" fill="url(#cf-bg)" />

      {/* Subtle grid lines */}
      {[80,140,200,260,320].map((y) => (
        <line key={y} x1="40" y1={y} x2="1060" y2={y}
          stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      ))}

      {/* ── LEFT PANEL: Bar chart ── */}
      {/* Panel bg */}
      <rect x="40" y="30" width="420" height="400" rx="16"
        fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />

      {/* Panel title */}
      <text x="64" y="62" fill="rgba(255,255,255,0.85)"
        fontFamily="'Syne', sans-serif" fontSize="13" fontWeight="600">Revenue uplift by strategy</text>
      <text x="64" y="78" fill="rgba(255,255,255,0.35)"
        fontFamily="'DM Sans', sans-serif" fontSize="11">Projected change vs. baseline</text>

      {/* Axis labels */}
      {["$0", "$12k", "$24k", "$36k", "$48k"].map((label, i) => (
        <text key={label} x="62" y={320 - i * 56}
          fill="rgba(255,255,255,0.28)" fontFamily="'DM Mono', monospace" fontSize="10"
          textAnchor="end">{label}</text>
      ))}

      {/* Bars — Balanced, Profit, Inventory, Revenue */}
      {[
        { x: 100, h: 168, fill: "url(#bar-blue)",  label: "Balanced",  val: "+$34k" },
        { x: 200, h: 224, fill: "url(#bar-gold)",  label: "Profit",    val: "+$48k" },
        { x: 300, h: 112, fill: "url(#bar-teal)",  label: "Inventory", val: "+$22k" },
        { x: 380, h: 196, fill: "url(#bar-rose)",  label: "Revenue",   val: "+$41k" },
      ].map(({ x, h, fill, label, val }) => (
        <g key={label}>
          {/* Bar body */}
          <rect x={x} y={328 - h} width="56" height={h} rx="6" fill={fill} />
          {/* Top glow cap */}
          <rect x={x} y={328 - h} width="56" height="4" rx="3" fill="rgba(255,255,255,0.3)" />
          {/* Value label */}
          <text x={x + 28} y={320 - h} fill="rgba(255,255,255,0.7)"
            fontFamily="'DM Mono', monospace" fontSize="10" textAnchor="middle">{val}</text>
          {/* X axis label */}
          <text x={x + 28} y="350" fill="rgba(255,255,255,0.4)"
            fontFamily="'DM Sans', sans-serif" fontSize="10" textAnchor="middle">{label}</text>
        </g>
      ))}

      {/* Trend line overlay */}
      <polyline
        points="128,160 228,104 328,216 408,128"
        fill="none" stroke="url(#line-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="4 3"
      />
      {[{cx:128,cy:160},{cx:228,cy:104},{cx:328,cy:216},{cx:408,cy:128}].map(({cx,cy},i) => (
        <circle key={i} cx={cx} cy={cy} r="4" fill="#2DD4BF" stroke="#071525" strokeWidth="2" />
      ))}

      {/* ── MIDDLE PANEL: Stat cards + AI pulse ── */}
      <rect x="480" y="30" width="290" height="400" rx="16"
        fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />

      <text x="504" y="62" fill="rgba(255,255,255,0.85)"
        fontFamily="'Syne', sans-serif" fontSize="13" fontWeight="600">Catalog snapshot</text>

      {/* Stat cards */}
      {[
        { y: 82,  color: "#4B9FFF", label: "SKUs analyzed", value: "1,842" },
        { y: 152, color: "#2DD4BF", label: "Est. uplift",   value: "+$48.2k" },
        { y: 222, color: "#E8B96F", label: "Actions ready", value: "312" },
        { y: 292, color: "#F87171", label: "Hold signals",  value: "94" },
      ].map(({ y, color, label, value }) => (
        <g key={label}>
          <rect x="504" y={y} width="242" height="58" rx="10"
            fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
          {/* Color accent bar */}
          <rect x="504" y={y} width="4" height="58" rx="2" fill={color} opacity="0.7" />
          <text x="522" y={y + 22} fill="rgba(255,255,255,0.45)"
            fontFamily="'DM Sans', sans-serif" fontSize="10">{label}</text>
          <text x="522" y={y + 44} fill="rgba(255,255,255,0.92)"
            fontFamily="'Syne', sans-serif" fontSize="20" fontWeight="700">{value}</text>
        </g>
      ))}

      {/* AI thinking pulse */}
      <g transform="translate(625,390)">
        <circle cx="0" cy="0" r="22" fill="rgba(75,159,255,0.08)" />
        <circle cx="0" cy="0" r="16" fill="rgba(75,159,255,0.12)" />
        <circle className="cf-pulse" cx="0" cy="0" r="7" fill="#4B9FFF" />
        <text x="30" y="5" fill="rgba(255,255,255,0.45)"
          fontFamily="'DM Sans', sans-serif" fontSize="10">Alfred thinking…</text>
      </g>

      {/* ── RIGHT PANEL: SKU table rows ── */}
      <rect x="788" y="30" width="272" height="400" rx="16"
        fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />

      <text x="812" y="62" fill="rgba(255,255,255,0.85)"
        fontFamily="'Syne', sans-serif" fontSize="13" fontWeight="600">Live recommendations</text>

      {/* Table header */}
      <rect x="788" y="74" width="272" height="26" rx="0"
        fill="rgba(255,255,255,0.04)" />
      {["SKU","Action","Price"].map((h, i) => (
        <text key={h} x={[812, 892, 1020][i]} y="91" fill="rgba(255,255,255,0.3)"
          fontFamily="'DM Sans', sans-serif" fontSize="9" fontWeight="600"
          textAnchor={i === 2 ? "end" : "start"}
          style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</text>
      ))}

      {/* Table rows */}
      {[
        { sku: "B07XJ8HJP", action: "↑ Increase", actionColor: "#6ee7b7", price: "$34.99",  y: 100 },
        { sku: "A01KZ2MNR", action: "↓ Decrease", actionColor: "#fca5a5", price: "$19.49",  y: 130 },
        { sku: "C09FP4LQW", action: "→ Hold",     actionColor: "#888",    price: "$82.00",  y: 160 },
        { sku: "D03RX7TYV", action: "↑ Increase", actionColor: "#6ee7b7", price: "$54.95",  y: 190 },
        { sku: "E11SW9NPK", action: "↓ Decrease", actionColor: "#fca5a5", price: "$12.00",  y: 220 },
        { sku: "F05BM6QZA", action: "↑ Increase", actionColor: "#6ee7b7", price: "$128.50", y: 250 },
        { sku: "G08VC3HYT", action: "→ Hold",     actionColor: "#888",    price: "$47.25",  y: 280 },
        { sku: "H14JD1EXN", action: "↑ Increase", actionColor: "#6ee7b7", price: "$65.00",  y: 310 },
        { sku: "I02XP8KRM", action: "↓ Decrease", actionColor: "#fca5a5", price: "$8.99",   y: 340 },
        { sku: "J07QT5ZVL", action: "↑ Increase", actionColor: "#6ee7b7", price: "$39.99",  y: 370 },
      ].map(({ sku, action, actionColor, price, y }, i) => (
        <g key={sku}>
          {/* Row separator */}
          {i > 0 && <line x1="800" y1={y} x2="1050" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />}
          {/* Hover-like bg on alternating rows */}
          {i % 2 === 0 && <rect x="789" y={y} width="271" height="30" fill="rgba(255,255,255,0.015)" />}
          <text x="812" y={y + 19} fill="rgba(75,159,255,0.85)"
            fontFamily="'DM Mono', monospace" fontSize="10">{sku}</text>
          <text x="892" y={y + 19} fill={actionColor}
            fontFamily="'DM Sans', monospace" fontSize="10" fontWeight="600">{action}</text>
          <text x="1050" y={y + 19} fill="rgba(255,255,255,0.7)"
            fontFamily="'DM Mono', monospace" fontSize="10" textAnchor="end">{price}</text>
        </g>
      ))}

      {/* Scanning line animation */}
      <g clipPath="none" style={{ overflow: "hidden" }}>
        <line className="cf-scan" x1="788" y1="100" x2="1060" y2="100"
          stroke="rgba(75,159,255,0.15)" strokeWidth="20" />
      </g>

      {/* ── Bottom status bar ── */}
      <rect x="40" y="440" width="1020" height="1" fill="rgba(255,255,255,0.06)" />
      <circle cx="60" cy="450" r="4" fill="#2DD4BF" className="cf-fade" />
      <text x="72" y="454" fill="rgba(255,255,255,0.4)"
        fontFamily="'DM Sans', sans-serif" fontSize="10">AlfredAI · run_a3f9b2 · 1,842 SKUs · Balanced mode</text>
      <text x="1050" y="454" fill="rgba(255,255,255,0.25)"
        fontFamily="'DM Mono', monospace" fontSize="10" textAnchor="end">v2.4.1</text>
    </svg>
  );
}
