"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { SkeletonRows } from "@/components/admin/Skeleton";
import { Pager } from "@/components/admin/AdminUI";
import { PaymentDrawer, PAYMENT_STATUS, methodLine } from "@/components/admin/PaymentDrawer";
import { ExportButton } from "@/components/admin/ExportButton";
import { adminApi, qs } from "@/lib/adminApi";
import { aed, fmtDateTime } from "@/lib/format";
import { Kpi } from "@/components/admin/Stat";
import { usePaged } from "@/lib/usePaged";

// деньги без суффикса (« AED» добавляется в разметке); dec=true → 2 знака
const money = (n?: number | null, dec = false) => aed(n, { decimals: dec ? 2 : 0, suffix: false });

const PERIODS = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today", from: () => new Date(new Date().setHours(0, 0, 0, 0)) },
  { key: "7d", label: "7 days", from: () => new Date(Date.now() - 7 * 864e5) },
  { key: "30d", label: "30 days", from: () => new Date(Date.now() - 30 * 864e5) },
] as const;

const STATUS_FILTERS = [
  { key: "", label: "All" },
  { key: "succeeded", label: "Succeeded" },
  { key: "refunded", label: "Refunds" },
  { key: "pending", label: "Pending" },
  { key: "failed", label: "Failed" },
];

function Bar({ label, value, sub, max, tone = "#4A56E2" }: {
  label: string; value: number; sub?: string; max: number; tone?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span className="admin-meta admin-mono">{sub}</span>
      </div>
      <div style={{ height: 8, background: "#EFEAE0", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: tone, borderRadius: 6 }} />
      </div>
    </div>
  );
}

/* баннер состояния интеграции Stripe */
function ConfigBanner({ cfg }: { cfg: any }) {
  if (!cfg) return null;
  const mode: string = cfg.mode;
  const tone = mode === "live" ? { bg: "#E7F6EC", bd: "#16A34A", fg: "#15803D" }
    : mode === "test" ? { bg: "#EAEEFE", bd: "#4A56E2", fg: "#3A45C0" }
    : { bg: "#FFF7E5", bd: "#B45309", fg: "#92400E" };
  const title = mode === "live" ? "Stripe connected · live mode"
    : mode === "test" ? "Stripe connected · test mode"
    : "Stripe not connected · mock mode";
  return (
    <div style={{ background: tone.bg, border: `1px solid ${tone.bd}33`, borderLeft: `3px solid ${tone.bd}`,
                  borderRadius: 12, padding: "12px 16px", display: "flex", gap: 16, alignItems: "center",
                  flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 260 }}>
        <div style={{ fontWeight: 800, color: tone.fg }}>{title}</div>
        <div className="admin-meta" style={{ marginTop: 2 }}>
          {mode === "mock"
            ? "Payments are simulated: amounts, cards and fees are synthetic. Add keys to start receiving real data."
            : "Real Stripe payments. Card, fee and receipt are pulled from Stripe via webhook."}
        </div>
      </div>
      <div style={{ display: "flex", gap: 18, fontSize: 12.5 }}>
        <span>Webhook <strong style={{ color: cfg.webhookConfigured ? "#15803D" : "#B45309" }}>
          {cfg.webhookConfigured ? "configured ✓" : "not configured"}</strong></span>
        <span>Fee <strong>{cfg.feePolicy}</strong></span>
        <span>Currency <strong>{cfg.currency}</strong></span>
      </div>
      {mode === "mock" && (
        <div className="admin-mono" style={{ fontSize: 11, color: tone.fg, width: "100%",
                                             background: "#FFFFFF99", borderRadius: 8, padding: "8px 10px" }}>
          Setup: set <strong>STRIPE_SECRET_KEY</strong> and <strong>STRIPE_WEBHOOK_SECRET</strong> in the backend .env,
          install the <strong>stripe</strong> package, point the webhook at <strong>/api/payments/webhook</strong>.
        </div>
      )}
    </div>
  );
}

function PaymentsInner() {
  const [period, setPeriod] = useState<string>("all");
  const [status, setStatus] = useState<string>("");
  const [method, setMethod] = useState<string>("");
  const [qInput, setQInput] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const [cfg, setCfg] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [selected, setSelected] = useState<number | null>(null);

  // период → from/to
  const range = useMemo(() => {
    const p = PERIODS.find((x) => x.key === period);
    const from = p && "from" in p && typeof p.from === "function" ? p.from().toISOString() : undefined;
    return { from, to: undefined as string | undefined };
  }, [period]);

  // дебаунс поиска
  useEffect(() => { const t = setTimeout(() => setQ(qInput.trim()), 300); return () => clearTimeout(t); }, [qInput]);

  useEffect(() => { adminApi.paymentsConfig().then(setCfg).catch(() => {}); }, []);

  const loadSummary = useCallback(() => {
    adminApi.paymentsSummary(range.from, range.to).then(setSummary).catch(() => {});
  }, [range.from, range.to]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  const fetcher = useCallback(
    (p: { limit: number; offset: number }) =>
      adminApi.paymentsPaged({ ...p, status: status || undefined, method: method || undefined,
        q: q || undefined, from: range.from, to: range.to }),
    [status, method, q, range.from, range.to]);
  const { items: rows, total, limit, offset, loading, setOffset, setLimit, reload } =
    usePaged<any>(fetcher, [status, method, q, range.from, range.to], 20);

  const onChanged = () => { reload(); loadSummary(); };

  const s = summary;
  const statusMax = s ? Math.max(1, ...Object.values(s.byStatus ?? {}).map((x: any) => x.count)) : 1;
  const methodMax = s ? Math.max(1, ...Object.values(s.byMethod ?? {}).map((x: any) => x.count)) : 1;
  const methodNames: Record<string, string> = { card: "Card", apple_pay: "Apple Pay", google_pay: "Google Pay", link: "Link" };
  const statusNames: Record<string, string> = { succeeded: "Succeeded", refunded: "Refunds", pending: "Pending", failed: "Failed" };
  const statusTone: Record<string, string> = { succeeded: "#16A34A", refunded: "#B45309", pending: "#8A8F9C", failed: "#DC2626" };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <ConfigBanner cfg={cfg} />

      {/* период + выгрузка */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "#FFF", borderRadius: 999, width: "fit-content" }}>
          {PERIODS.map((p) => (
            <button key={p.key} className="admin-btn sm" onClick={() => setPeriod(p.key)}
                    style={period === p.key ? { background: "#4A56E2", color: "#FFF" } : { background: "transparent" }}>
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto" }}>
          <ExportButton
            path={`/api/admin/exports/payments.xlsx${qs({ status: status || undefined, method: method || undefined, from: range.from, to: range.to })}`}
            filename="payments.xlsx" label="Export payments" />
        </div>
      </div>

      {/* KPI */}
      {s && (
        <>
          <div className="admin-grid-4">
            <Kpi label="Gross (charged)" value={`${money(s.gross)} AED`} sub={`${s.succeededCount + s.refundedCount} payments`} />
            <Kpi label="Net" value={`${money(s.net)} AED`} sub="after fees and refunds" tone="#15803D" />
            <Kpi label="Stripe fees" value={`${money(s.fees, true)} AED`} sub={cfg?.feePolicy} tone="#B45309" />
            <Kpi label="Refunds" value={`${money(s.refunds)} AED`} sub={`${s.refundedCount} refund(s)`} tone={s.refunds ? "#DC2626" : undefined} />
          </div>
          <div className="admin-grid-4">
            <Kpi label="Success rate" value={`${Math.round((s.successRate ?? 0) * 100)}%`} sub={`${s.failedCount} failed · ${s.pendingCount} pending`} />
            <Kpi label="Avg. order" value={`${money(s.avg, true)} AED`} />
            <Kpi label="Total payments" value={s.count} />
            <Kpi label="Disputes" value={s.disputedCount} sub="chargeback / dispute" tone={s.disputedCount ? "#DC2626" : undefined} />
          </div>

          {/* разбивки */}
          <div className="admin-grid-2">
            <div className="admin-panel">
              <div className="admin-panel-head"><div className="admin-panel-title">By status</div></div>
              <div className="admin-panel-body">
                {Object.entries(s.byStatus ?? {}).length === 0 ? <span className="admin-meta">—</span> :
                  Object.entries(s.byStatus ?? {}).map(([k, v]: any) => (
                    <Bar key={k} label={statusNames[k] ?? k} value={v.count} max={statusMax}
                         tone={statusTone[k] ?? "#4A56E2"} sub={`${v.count} · ${money(v.amount)} AED`} />
                  ))}
              </div>
            </div>
            <div className="admin-panel">
              <div className="admin-panel-head">
                <div className="admin-panel-title">By payment method</div>
                <span className="admin-meta">
                  {Object.entries(s.byBrand ?? {}).map(([b, c]: any) => `${b} ${c}`).join(" · ")}
                </span>
              </div>
              <div className="admin-panel-body">
                {Object.entries(s.byMethod ?? {}).length === 0 ? <span className="admin-meta">—</span> :
                  Object.entries(s.byMethod ?? {}).map(([k, v]: any) => (
                    <Bar key={k} label={methodNames[k] ?? k} value={v.count} max={methodMax}
                         sub={`${v.count} · ${money(v.amount)} AED`} />
                  ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* таблица */}
      <div className="admin-panel">
        <div className="admin-panel-head" style={{ gap: 12, flexWrap: "wrap" }}>
          <div className="admin-panel-title">Payments</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginLeft: "auto" }}>
            <div style={{ display: "inline-flex", gap: 2, padding: 3, background: "#F5EFE7", borderRadius: 999 }}>
              {STATUS_FILTERS.map((f) => (
                <button key={f.key} className="admin-btn sm" onClick={() => setStatus(f.key)}
                        style={status === f.key ? { background: "#4A56E2", color: "#FFF" } : { background: "transparent" }}>
                  {f.label}
                </button>
              ))}
            </div>
            <select className="admin-select" style={{ width: "auto" }} value={method}
                    onChange={(e) => setMethod(e.target.value)}>
              <option value="">Any method</option>
              <option value="card">Card</option>
              <option value="apple_pay">Apple Pay</option>
              <option value="google_pay">Google Pay</option>
              <option value="link">Link</option>
            </select>
            <input className="admin-input" style={{ width: 230 }} value={qInput} placeholder="Search: order #, phone, id, last4"
                   onChange={(e) => setQInput(e.target.value)} />
          </div>
        </div>
        <div className="admin-tablewrap"><table className="admin-table">
          <thead>
            <tr>
              <th>ID</th><th>Date</th><th>Order</th><th>Customer</th><th>Method</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th style={{ textAlign: "right" }}>Fee</th>
              <th style={{ textAlign: "right" }}>Net</th>
              <th>Status</th><th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const st = PAYMENT_STATUS[p.status] ?? { label: p.status, cls: "" };
              return (
                <tr key={p.id} className="admin-row-link" style={{ cursor: "pointer" }} onClick={() => setSelected(p.id)}>
                  <td className="admin-num admin-mono">{p.id}</td>
                  <td className="admin-meta">{fmtDateTime(p.paidAt || p.createdAt)}</td>
                  <td><strong>#{p.orderNumber ?? "—"}</strong></td>
                  <td>
                    <div style={{ fontSize: 13 }}>{p.customerName || "—"}</div>
                    <div className="admin-mono admin-meta">{p.customerPhone}</div>
                  </td>
                  <td style={{ fontSize: 12.5 }}>{methodLine(p)}</td>
                  <td className="admin-num">{money(p.amount, true)} {p.currency}</td>
                  <td className="admin-num admin-meta">{money(p.fee, true)}</td>
                  <td className="admin-num">{money((p.net ?? (p.amount - (p.fee || 0))) - (p.refunded || 0), true)}</td>
                  <td>
                    <span className={`admin-pill ${st.cls}`}>{st.label}</span>
                    {p.refunded > 0 && p.status !== "refunded" && (
                      <div className="admin-meta" style={{ fontSize: 10 }}>−{money(p.refunded, true)} refunded</div>
                    )}
                  </td>
                  <td>
                    {p.disputeStatus
                      ? <span className="admin-pill danger" style={{ fontSize: 11 }}>dispute</span>
                      : p.riskLevel && p.riskLevel !== "normal"
                        ? <span className="admin-pill warn" style={{ fontSize: 11 }}>{p.riskLevel}</span>
                        : <span className="admin-meta">·</span>}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (loading
              ? <SkeletonRows rows={8} cols={10} />
              : <tr><td colSpan={10} style={{ textAlign: "center", padding: 40, color: "#5A6172" }}>No payments</td></tr>
            )}
          </tbody>
        </table></div>
        <Pager total={total} limit={limit} offset={offset} loading={loading} onOffset={setOffset} onLimit={setLimit} />
      </div>

      <PaymentDrawer id={selected} onClose={() => setSelected(null)} onChanged={onChanged} />
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <AdminShell title="Payments" crumbs={[{ label: "Payments" }]}>
      <PaymentsInner />
    </AdminShell>
  );
}
