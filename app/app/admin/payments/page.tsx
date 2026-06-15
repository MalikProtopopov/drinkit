"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Pager, useToast } from "@/components/admin/AdminUI";
import { PaymentDrawer, PAYMENT_STATUS, methodLine } from "@/components/admin/PaymentDrawer";
import { adminApi } from "@/lib/adminApi";
import { usePaged } from "@/lib/usePaged";

/* ---------- форматтеры ---------- */
const money = (n?: number | null, dec = false) =>
  n == null ? "—" : `${Number(n).toLocaleString("ru-RU", dec
    ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 })}`;
const fmtDateTime = (s?: string | null) =>
  s ? new Date(/[Z+]/.test(s) ? s : s + "Z").toLocaleString("ru-RU",
    { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

const PERIODS = [
  { key: "all", label: "Всё время" },
  { key: "today", label: "Сегодня", from: () => new Date(new Date().setHours(0, 0, 0, 0)) },
  { key: "7d", label: "7 дней", from: () => new Date(Date.now() - 7 * 864e5) },
  { key: "30d", label: "30 дней", from: () => new Date(Date.now() - 30 * 864e5) },
] as const;

const STATUS_FILTERS = [
  { key: "", label: "Все" },
  { key: "succeeded", label: "Успешные" },
  { key: "refunded", label: "Возвраты" },
  { key: "pending", label: "Ожидание" },
  { key: "failed", label: "Ошибки" },
];

function Kpi({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: string }) {
  return (
    <div className="kbju-cell">
      <div className="kbju-cell-label">{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, color: tone }}>{value}</div>
      {sub && <div className="admin-meta" style={{ marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

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
  const title = mode === "live" ? "Stripe подключён · боевой режим"
    : mode === "test" ? "Stripe подключён · тестовый режим"
    : "Stripe не подключён · режим mock";
  return (
    <div style={{ background: tone.bg, border: `1px solid ${tone.bd}33`, borderLeft: `3px solid ${tone.bd}`,
                  borderRadius: 12, padding: "12px 16px", display: "flex", gap: 16, alignItems: "center",
                  flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 260 }}>
        <div style={{ fontWeight: 800, color: tone.fg }}>{title}</div>
        <div className="admin-meta" style={{ marginTop: 2 }}>
          {mode === "mock"
            ? "Платежи симулируются: суммы, карты и комиссии — синтетические. Подключите ключи, чтобы пошли реальные данные."
            : "Реальные платежи Stripe. Карта, комиссия и чек подтягиваются из Stripe по webhook."}
        </div>
      </div>
      <div style={{ display: "flex", gap: 18, fontSize: 12.5 }}>
        <span>Webhook <strong style={{ color: cfg.webhookConfigured ? "#15803D" : "#B45309" }}>
          {cfg.webhookConfigured ? "настроен ✓" : "не настроен"}</strong></span>
        <span>Комиссия <strong>{cfg.feePolicy}</strong></span>
        <span>Валюта <strong>{cfg.currency}</strong></span>
      </div>
      {mode === "mock" && (
        <div className="admin-mono" style={{ fontSize: 11, color: tone.fg, width: "100%",
                                             background: "#FFFFFF99", borderRadius: 8, padding: "8px 10px" }}>
          Подключение: задайте <strong>STRIPE_SECRET_KEY</strong> и <strong>STRIPE_WEBHOOK_SECRET</strong> в .env бэкенда,
          установите пакет <strong>stripe</strong>, направьте webhook на <strong>/api/payments/webhook</strong>.
        </div>
      )}
    </div>
  );
}

function PaymentsInner() {
  const toast = useToast();
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
  const methodNames: Record<string, string> = { card: "Карта", apple_pay: "Apple Pay", google_pay: "Google Pay", link: "Link" };
  const statusNames: Record<string, string> = { succeeded: "Успешные", refunded: "Возвраты", pending: "Ожидание", failed: "Ошибки" };
  const statusTone: Record<string, string> = { succeeded: "#16A34A", refunded: "#B45309", pending: "#8A8F9C", failed: "#DC2626" };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <ConfigBanner cfg={cfg} />

      {/* период */}
      <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "#FFF", borderRadius: 999, width: "fit-content" }}>
        {PERIODS.map((p) => (
          <button key={p.key} className="admin-btn sm" onClick={() => setPeriod(p.key)}
                  style={period === p.key ? { background: "#4A56E2", color: "#FFF" } : { background: "transparent" }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* KPI */}
      {s && (
        <>
          <div className="admin-grid-4">
            <Kpi label="Оборот (списано)" value={`${money(s.gross)} AED`} sub={`${s.succeededCount + s.refundedCount} платеж.`} />
            <Kpi label="Чистыми" value={`${money(s.net)} AED`} sub="за вычетом комиссий и возвратов" tone="#15803D" />
            <Kpi label="Комиссии Stripe" value={`${money(s.fees, true)} AED`} sub={cfg?.feePolicy} tone="#B45309" />
            <Kpi label="Возвраты" value={`${money(s.refunds)} AED`} sub={`${s.refundedCount} возврат(ов)`} tone={s.refunds ? "#DC2626" : undefined} />
          </div>
          <div className="admin-grid-4">
            <Kpi label="Успешность" value={`${Math.round((s.successRate ?? 0) * 100)}%`} sub={`${s.failedCount} ошибок · ${s.pendingCount} в ожидании`} />
            <Kpi label="Средний чек" value={`${money(s.avg, true)} AED`} />
            <Kpi label="Всего платежей" value={s.count} />
            <Kpi label="Споры" value={s.disputedCount} sub="chargeback / dispute" tone={s.disputedCount ? "#DC2626" : undefined} />
          </div>

          {/* разбивки */}
          <div className="admin-grid-2">
            <div className="admin-panel">
              <div className="admin-panel-head"><div className="admin-panel-title">По статусам</div></div>
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
                <div className="admin-panel-title">По способу оплаты</div>
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
          <div className="admin-panel-title">Платежи</div>
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
              <option value="">Любой метод</option>
              <option value="card">Карта</option>
              <option value="apple_pay">Apple Pay</option>
              <option value="google_pay">Google Pay</option>
              <option value="link">Link</option>
            </select>
            <input className="admin-input" style={{ width: 230 }} value={qInput} placeholder="Поиск: № заказа, телефон, id, last4"
                   onChange={(e) => setQInput(e.target.value)} />
          </div>
        </div>
        <div className="admin-tablewrap"><table className="admin-table">
          <thead>
            <tr>
              <th>ID</th><th>Дата</th><th>Заказ</th><th>Клиент</th><th>Способ</th>
              <th style={{ textAlign: "right" }}>Сумма</th>
              <th style={{ textAlign: "right" }}>Комиссия</th>
              <th style={{ textAlign: "right" }}>Чистыми</th>
              <th>Статус</th><th>Риск</th>
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
                      <div className="admin-meta" style={{ fontSize: 10 }}>−{money(p.refunded, true)} возвр.</div>
                    )}
                  </td>
                  <td>
                    {p.disputeStatus
                      ? <span className="admin-pill danger" style={{ fontSize: 11 }}>спор</span>
                      : p.riskLevel && p.riskLevel !== "normal"
                        ? <span className="admin-pill warn" style={{ fontSize: 11 }}>{p.riskLevel}</span>
                        : <span className="admin-meta">·</span>}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: "center", padding: 40, color: "#5A6172" }}>
                {loading ? "Загрузка…" : "Платежей нет"}</td></tr>
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
    <AdminShell title="Платежи" crumbs={[{ label: "Платежи" }]}>
      <PaymentsInner />
    </AdminShell>
  );
}
