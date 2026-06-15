"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/admin/AdminUI";
import { adminApi } from "@/lib/adminApi";
import { aed, fmtDateTime as fmtDT } from "@/lib/format";

/* ---------- форматтеры: тонкие обёртки над общими (lib/format) ---------- */
const money = (n?: number | null) => aed(n, { decimals: 2 });
const fmtDateTime = (s?: string | null) => fmtDT(s, { year: true });

export const PAYMENT_STATUS: Record<string, { label: string; cls: string }> = {
  succeeded: { label: "succeeded", cls: "accent" },
  refunded: { label: "refunded", cls: "warn" },
  pending: { label: "pending", cls: "" },
  failed: { label: "failed", cls: "danger" },
};

const BRAND_LABEL: Record<string, string> = {
  visa: "Visa", mastercard: "Mastercard", amex: "Amex", mada: "mada",
  discover: "Discover", unionpay: "UnionPay",
};
const METHOD_LABEL: Record<string, string> = {
  card: "Card", apple_pay: "Apple Pay", google_pay: "Google Pay", link: "Link",
};

export function methodLine(p: any): string {
  const brand = p.cardBrand ? (BRAND_LABEL[p.cardBrand] ?? p.cardBrand) : null;
  const tail = p.cardLast4 ? `•••• ${p.cardLast4}` : "";
  if (p.method && p.method !== "card") {
    const w = METHOD_LABEL[p.method] ?? p.method;
    return [w, [brand, tail].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
  }
  return [brand, tail].filter(Boolean).join(" ") || "Card";
}

const TIMELINE_LABEL: Record<string, string> = {
  created: "Payment created", paid: "Paid", refund: "Refund", dispute: "Dispute opened",
};

/* кликабельная ссылка в Stripe Dashboard для НЕ-mock идентификаторов */
function stripeLink(kind: "payments" | "customers", id?: string | null) {
  if (!id || id.includes("mock")) return null;
  return `https://dashboard.stripe.com/${kind}/${id}`;
}

function IdRow({ label, value, href }: { label: string; value?: string | null; href?: string | null }) {
  const toast = useToast();
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: "5px 0" }}>
      <span className="admin-meta">{label}</span>
      <span style={{ display: "inline-flex", gap: 8, alignItems: "center", minWidth: 0 }}>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="admin-mono"
             style={{ fontSize: 12, color: "#4A56E2", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 190 }}>
            {value} ↗
          </a>
        ) : (
          <span className="admin-mono" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 190 }}>{value}</span>
        )}
        <button className="admin-btn ghost sm" title="Copy" style={{ padding: "2px 7px" }}
                onClick={() => { navigator.clipboard?.writeText(value); toast("Copied"); }}>⧉</button>
      </span>
    </div>
  );
}

function Line({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0",
                  borderBottom: "1px dashed #ECE6DA" }}>
      <span className="admin-meta">{label}</span>
      <span style={{ fontWeight: strong ? 800 : 600, fontSize: strong ? 15 : 13.5 }}>{children}</span>
    </div>
  );
}

export function PaymentDrawer({ id, onClose, onChanged }: {
  id: number | null; onClose: () => void; onChanged: () => void;
}) {
  const toast = useToast();
  const [p, setP] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmt, setRefundAmt] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (id == null) return;
    setLoading(true);
    try { setP(await adminApi.payment(id)); }
    catch { setP(null); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    setP(null); setRefundOpen(false); setRefundAmt(""); setRefundReason("");
    load();
  }, [load]);

  useEffect(() => {
    if (id == null) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [id, onClose]);

  if (id == null) return null;

  const st = p ? (PAYMENT_STATUS[p.status] ?? { label: p.status, cls: "" }) : null;
  const remaining = p ? Math.max(0, Number((p.amount - (p.refunded || 0)).toFixed(2))) : 0;
  const refundable = p && (p.status === "succeeded" || p.status === "refunded") && remaining > 0;

  const doRefund = async () => {
    if (!p) return;
    const amt = refundAmt ? Number(refundAmt) : undefined;
    if (amt != null && (!(amt > 0) || amt > remaining)) { toast("Invalid refund amount", "warn"); return; }
    setBusy(true);
    try {
      await adminApi.refundPayment(p.id, { amount: amt, reason: refundReason || undefined });
      toast("Refund issued");
      setRefundOpen(false); setRefundAmt(""); setRefundReason("");
      await load(); onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Refund failed", "danger");
    } finally { setBusy(false); }
  };

  return (
    <>
      <div className="admin-drawer-backdrop" onClick={onClose} />
      <aside className="admin-drawer" style={{ width: 460, maxWidth: "94vw" }}>
        <div className="admin-drawer-head">
          <div>
            <div className="admin-panel-title">Payment #{id}</div>
            <div className="admin-meta">{p ? `Order #${p.orderNumber ?? "—"} · ${p.provider}` : "Stripe"}</div>
          </div>
          <button className="admin-btn ghost" onClick={onClose}>×</button>
        </div>

        <div className="admin-drawer-body" style={{ display: "grid", gap: 16 }}>
          {loading && <div className="admin-meta">Loading…</div>}
          {!loading && !p && <div className="admin-meta">Payment not found</div>}

          {p && (
            <>
              {/* сумма + статус */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800 }}>{money(p.amount)}</div>
                  <div className="admin-meta">{methodLine(p)} · {fmtDateTime(p.paidAt || p.createdAt)}</div>
                </div>
                {st && <span className={`admin-pill ${st.cls}`} style={{ fontWeight: 700 }}>{st.label}</span>}
              </div>

              {p.failureMessage && (
                <div className="admin-pill danger" style={{ display: "block", padding: "8px 12px" }}>
                  Declined: {p.failureMessage}{p.failureCode ? ` (${p.failureCode})` : ""}
                </div>
              )}

              {/* деньги */}
              <div className="admin-panel">
                <div className="admin-panel-head"><div className="admin-panel-title">Money</div>
                  {p.livemode === false && <span className="admin-pill" style={{ fontSize: 11 }}>test/mock</span>}
                </div>
                <div className="admin-panel-body">
                  <Line label="Amount">{money(p.amount)}</Line>
                  <Line label="Stripe fee">− {money(p.fee)}</Line>
                  {p.refunded > 0 && <Line label="Refunded">− {money(p.refunded)}</Line>}
                  <Line label="Net" strong>{money((p.net ?? (p.amount - (p.fee || 0))) - (p.refunded || 0))}</Line>
                </div>
              </div>

              {/* способ оплаты */}
              <div className="admin-panel">
                <div className="admin-panel-head"><div className="admin-panel-title">Payment method</div></div>
                <div className="admin-panel-body">
                  <Line label="Method">{methodLine(p)}</Line>
                  {p.cardFunding && <Line label="Card type">{p.cardFunding === "credit" ? "credit" : p.cardFunding === "debit" ? "debit" : p.cardFunding}</Line>}
                  {p.cardCountry && <Line label="Card country">{p.cardCountry}</Line>}
                  {p.cardExp && <Line label="Expiry">{p.cardExp}</Line>}
                  {(p.riskLevel || p.riskScore != null) && (
                    <Line label="Risk (Radar)">
                      <span className={`admin-pill ${p.riskLevel === "highest" ? "danger" : p.riskLevel === "elevated" ? "warn" : ""}`}>
                        {p.riskLevel ?? "—"}{p.riskScore != null ? ` · ${p.riskScore}` : ""}
                      </span>
                    </Line>
                  )}
                  {p.disputeStatus && <Line label="Dispute">
                    <span className="admin-pill danger">{p.disputeStatus}</span></Line>}
                </div>
              </div>

              {/* заказ + клиент */}
              {p.order && (
                <div className="admin-panel">
                  <div className="admin-panel-head">
                    <div className="admin-panel-title">Order #{p.order.number}</div>
                    <Link href={`/admin/orders/${p.orderId}`} className="admin-btn ghost sm">Open →</Link>
                  </div>
                  <div className="admin-panel-body">
                    {p.customerPhone && (
                      <div style={{ marginBottom: 8 }}>
                        <Link href={`/admin/customers/${p.userId}`} style={{ fontWeight: 700, color: "#0E0E10", textDecoration: "none" }}>
                          {p.customerName || "Customer"} <span className="admin-mono admin-meta">{p.customerPhone}</span> →
                        </Link>
                      </div>
                    )}
                    {(p.order.items ?? []).map((it: any, i: number) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                        <span>{it.quantity}× {it.name}</span>
                        <span className="admin-num">{money(it.unitPrice * it.quantity)}</span>
                      </div>
                    ))}
                    {p.order.couponDiscount > 0 && (
                      <div className="admin-meta" style={{ marginTop: 4 }}>Coupon discount: −{money(p.order.couponDiscount)}</div>
                    )}
                  </div>
                </div>
              )}

              {/* идентификаторы Stripe */}
              <div className="admin-panel">
                <div className="admin-panel-head"><div className="admin-panel-title">Stripe identifiers</div></div>
                <div className="admin-panel-body">
                  <IdRow label="Payment Intent" value={p.paymentIntentId} href={stripeLink("payments", p.paymentIntentId)} />
                  <IdRow label="Charge" value={p.chargeId} />
                  <IdRow label="Customer" value={p.customerId} href={stripeLink("customers", p.customerId)} />
                  <IdRow label="Checkout / ref" value={p.providerId} />
                  {p.receiptUrl && (
                    <div style={{ paddingTop: 6 }}>
                      <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="admin-btn ghost sm">Payment receipt ↗</a>
                    </div>
                  )}
                </div>
              </div>

              {/* таймлайн */}
              {(p.timeline ?? []).length > 0 && (
                <div className="admin-panel">
                  <div className="admin-panel-head"><div className="admin-panel-title">Payment history</div></div>
                  <div className="admin-panel-body" style={{ display: "grid", gap: 8 }}>
                    {p.timeline.map((e: any, i: number) => (
                      <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                        <span style={{ width: 6, height: 6, borderRadius: 6, background: "#4A56E2", marginTop: 5 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{TIMELINE_LABEL[e.type] ?? e.type}</div>
                          {e.note && <div className="admin-meta">{e.note}</div>}
                        </div>
                        <span className="admin-meta" style={{ whiteSpace: "nowrap" }}>{fmtDateTime(e.at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* действия */}
        {p && (
          <div className="admin-drawer-foot" style={{ display: "block" }}>
            {!refundOpen ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="admin-meta">{refundable ? `Available to refund: ${money(remaining)}` : "Refund unavailable"}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="admin-btn ghost" onClick={onClose}>Close</button>
                  {refundable && <button className="admin-btn danger" onClick={() => { setRefundOpen(true); setRefundAmt(String(remaining)); }}>Issue refund</button>}
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <div className="admin-field" style={{ flex: 1 }}>
                    <label className="admin-label">Refund amount</label>
                    <input className="admin-input mono" value={refundAmt} inputMode="decimal"
                           onChange={(e) => setRefundAmt(e.target.value.replace(/[^\d.]/g, ""))} />
                  </div>
                  <div className="admin-field" style={{ flex: 2 }}>
                    <label className="admin-label">Reason (optional)</label>
                    <input className="admin-input" value={refundReason} placeholder="duplicate charge / complaint…"
                           onChange={(e) => setRefundReason(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button className="admin-btn ghost" disabled={busy} onClick={() => setRefundOpen(false)}>Cancel</button>
                  <button className="admin-btn danger" disabled={busy} onClick={doRefund}>
                    {busy ? "Refunding…" : `Refund ${money(refundAmt ? Number(refundAmt) : remaining)}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
