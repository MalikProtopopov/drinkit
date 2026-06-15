"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { ConfirmDialog, useToast } from "@/components/admin/AdminUI";
import { adminApi, adminOrdersWs, ADMIN_STATUS_LABEL, type AdminOrder } from "@/lib/adminApi";
import { useLiveReload } from "@/lib/useLiveReload";

const CHAIN = ["new", "in_progress", "ready", "completed"];
const STEP_SHORT: Record<string, string> = {
  new: "New", in_progress: "In progress", ready: "Ready", completed: "Handed over",
};

// timestamps ÑÑÐ°Ð½ÑÑÑÑ ÐºÐ°Ðº Ð½Ð°Ð¸Ð²Ð½ÑÐ¹ UTC â ÑÑÐ°ÐºÑÑÐµÐ¼ ÐºÐ°Ðº UTC Ð´Ð»Ñ ÐºÐ¾ÑÑÐµÐºÑÐ½Ð¾Ð³Ð¾ Ð²ÑÐµÐ¼ÐµÐ½Ð¸/ÑÐ°Ð¹Ð¼ÐµÑÐ°
const parseTs = (s: string) => new Date(/[Z+]/.test(s) ? s : s + "Z");
const fmtDateTime = (s: string) =>
  parseTs(s).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function eventLabel(type: string, status?: string | null): string {
  switch (type) {
    case "created": return "Order created";
    case "paid": return "Payment received";
    case "coupon_applied": return "Coupon applied";
    case "rated": return "Customer rating";
    case "refund": return "Refund issued";
    case "arrived": return "Customer arrived at outlet";
    case "status_change": return ADMIN_STATUS_LABEL[status ?? ""] ?? status ?? type;
    default: return type;
  }
}

// Â«Ð¶Ð´ÑÑ N Ð¼Ð¸Ð½Â» â Ð¶Ð¸Ð²Ð¾Ð¹ ÑÑÑÑÑÐ¸Ðº Ñ ÑÐ²ÐµÑÐ¾Ð²Ð¾Ð¹ ÑÑÐºÐ°Ð»Ð°ÑÐ¸ÐµÐ¹ (Ð·ÐµÐ»ÑÐ½ÑÐ¹ â ÑÐ½ÑÐ°ÑÑ â ÐºÑÐ°ÑÐ½ÑÐ¹)
function WaitBadge({ minutes }: { minutes: number }) {
  const c = minutes >= 15
    ? { bg: "#FCEAEA", fg: "#DC2626" }
    : minutes >= 5
      ? { bg: "#FDF3DB", fg: "#B45309" }
      : { bg: "#DDEDE0", fg: "#166534" };
  const label = minutes < 1 ? "just now" : minutes < 60 ? `waiting ${minutes} min`
    : `waiting ${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  return (
    <span style={{ background: c.bg, color: c.fg, fontWeight: 700, fontSize: 13,
                   padding: "4px 12px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.fg }} />
      {label}
    </span>
  );
}

function ItemThumb({ url, name }: { url?: string | null; name: string }) {
  const [err, setErr] = useState(false);
  if (url && !err) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" onError={() => setErr(true)}
                style={{ width: 72, height: 72, borderRadius: 14, objectFit: "cover", flex: "none" }} />;
  }
  return (
    <div style={{ width: 72, height: 72, borderRadius: 14, flex: "none", display: "grid", placeItems: "center",
                  background: "var(--a-accent-soft)", color: "var(--a-accent)", fontWeight: 800, fontSize: 24 }}>
      {(name || "?").trim()[0]?.toUpperCase()}
    </div>
  );
}

function Detail({ id }: { id: number }) {
  const toast = useToast();
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [confirmRefund, setConfirmRefund] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(() => {
    adminApi.order(id).then(setOrder).catch(() => {});
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000); // Ð¶Ð¸Ð²Ð¾Ð¹ ÑÐ°Ð¹Ð¼ÐµÑ Ð¾Ð¶Ð¸Ð´Ð°Ð½Ð¸Ñ
    return () => clearInterval(t);
  }, []);
  // realtime ÑÑÐ¾Ð³Ð¾ Ð·Ð°ÐºÐ°Ð·Ð°: ÑÐ¼ÐµÐ½Ñ ÑÑÐ°ÑÑÑÐ°/Ð¿ÑÐ¸Ð±ÑÑÐ¸Ðµ Ð¿ÑÐ¸ÑÐ¾Ð´ÑÑ ÑÑÐ°Ð·Ñ; Ð°Ð²ÑÐ¾-reconnect
  useLiveReload({
    connect: adminOrdersWs,
    onMessage: (m) => { if ((m as { orderId?: number }).orderId === id) load(); },
    onSync: () => load(),
    pollMs: 30000,
  });

  if (!order) return <div className="admin-meta">Loadingâ¦</div>;

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); load(); toast(ok); }
    catch (e) { toast(e instanceof Error ? e.message : "Error", "warn"); }
  };

  const idx = CHAIN.indexOf(order.status);
  const isActive = order.status !== "completed" && order.status !== "refund";
  const drinksTotal = order.items.reduce((s, it) => s + it.quantity, 0);
  const waitMin = order.createdAt ? Math.max(0, Math.floor((now - parseTs(order.createdAt).getTime()) / 60000)) : 0;
  const unit = (u: string) => (u === "ml" ? " ml" : u === "pcs" ? " pcs" : " g");

  const nextAction =
    order.status === "new" ? { label: "Take â", run: () => adminApi.take(order.id), ok: "Taken" }
    : order.status === "in_progress" ? { label: "Ready, awaiting pickup â", run: () => adminApi.setStatus(order.id, "ready"), ok: "Ready â waiting for customer" }
    : order.status === "ready" ? { label: "Handed over to customer â", run: () => adminApi.setStatus(order.id, "completed"), ok: "Handed over to customer" }
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* summary-Ð±Ð°Ñ: Ð½Ð¾Ð¼ÐµÑ, Ð²ÑÐµÐ¼Ñ Ð¾ÑÐ¾ÑÐ¼Ð»ÐµÐ½Ð¸Ñ, ÐÐÐÐÐ ÑÐ°Ð¹Ð¼ÐµÑ Ð¾Ð¶Ð¸Ð´Ð°Ð½Ð¸Ñ, ÑÑÐ°ÑÑÑ */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>Order #{order.number}</div>
        {order.createdAt && <span className="admin-meta">placed {fmtDateTime(order.createdAt)}</span>}
        {isActive && <WaitBadge minutes={waitMin} />}
        <span style={{ flex: 1 }} />
        <span className={`admin-badge ${order.status}`}>{ADMIN_STATUS_LABEL[order.status]}</span>
      </div>

      {/* Ð¿ÑÐ¸Ð¾ÑÐ¸ÑÐµÑÐ½ÑÐ¹ Ð±Ð°Ð½Ð½ÐµÑ: ÐºÐ»Ð¸ÐµÐ½Ñ ÑÐ¶Ðµ Ð½Ð° Ð¼ÐµÑÑÐµ */}
      {order.arrived && isActive && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 14,
                      background: "#FFF7E5", border: "1.5px solid #F0C36B", fontWeight: 600 }}>
          <span style={{ fontSize: 22 }}>ð</span>
          <div>
            Customer has arrived â car <strong>{order.emirate} {order.carPlate}</strong>.
            {order.status !== "ready" && <span style={{ color: "#B45309" }}> Order is still being prepared â priority!</span>}
          </div>
        </div>
      )}

      <div className="admin-split" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, alignItems: "start" }}>
        {/* ÐÐÐÐ: ÑÑÐ¾ Ð³Ð¾ÑÐ¾Ð²Ð¸ÑÑ */}
        <div className="admin-panel">
          <div className="admin-panel-head">
            <div className="admin-panel-title">To prepare Â· {order.items.length} items / {drinksTotal} pcs</div>
          </div>

          {order.items.map((it) => (
            <div key={it.id} style={{ display: "flex", gap: 14, padding: "16px 20px",
                                      borderTop: "1px solid var(--a-rule)" }}>
              <ItemThumb url={it.previewUrl} name={it.drinkNameEn} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 16 }}>{it.customName || it.drinkNameEn}</strong>
                  {it.sizeLabel && <span className="admin-pill">{it.sizeLabel}</span>}
                  <span className="admin-pill" style={{ background: "#EFE6F0", color: "#4A56E2", fontWeight: 700 }}>Ã{it.quantity}</span>
                  {it.paidByCoupon && <span className="admin-pill accent">via coupon</span>}
                </div>
                {it.customName && (
                  <div className="admin-meta" style={{ marginTop: 2 }}>
                    Name from customer Â· base drink: <strong>{it.drinkNameEn}</strong>
                  </div>
                )}

                <div style={{ marginTop: 10 }}>
                  {it.addons.length === 0 ? (
                    <span className="admin-meta">No add-ons â base recipe</span>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div className="admin-meta" style={{ fontWeight: 700, marginBottom: 2 }}>Add-ons:</div>
                      {it.addons.map((a, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13.5 }}>
                          <span>
                            <strong style={{ fontWeight: 600 }}>{a.nameEn}</strong>
                            {a.portions > 1 && <span> Ã{a.portions}</span>}
                            <span className="admin-meta"> Â· {a.amount}{unit(a.unit)}</span>
                          </span>
                          <span className="admin-meta" style={{ whiteSpace: "nowrap" }}>
                            {a.price > 0 ? `+${(a.price * a.portions).toFixed(0)} AED` : "included"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="admin-num" style={{ fontWeight: 800, fontSize: 15, whiteSpace: "nowrap" }}>
                {(it.unitPrice * it.quantity).toFixed(2)}
              </div>
            </div>
          ))}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "16px 20px", borderTop: "1px solid var(--a-rule)", background: "#FAF6F0" }}>
            <div style={{ fontWeight: 700 }}>
              Total {order.couponDiscount > 0 && <span className="admin-meta">(coupon â{order.couponDiscount.toFixed(0)})</span>}
            </div>
            <div className="admin-num" style={{ fontWeight: 800, fontSize: 18 }}>{order.total.toFixed(2)} AED</div>
          </div>

          {/* ÑÐ½Ð¸Ð¼Ð¾Ðº Ð·Ð°ÐºÐ°Ð·Ð° (Ð¾ÑÐ¸Ð³Ð¸Ð½Ð°Ð», Ð² Ð»Ð¾ÐºÐ°Ð»Ð¸ ÐºÐ»Ð¸ÐµÐ½ÑÐ°) â Ð´Ð»Ñ Ð¿ÑÐ¾Ð²ÐµÑÐºÐ¸ ÑÑÐ¿ÐµÑÐ°Ð´Ð¼Ð¸Ð½Ð¾Ð¼ */}
          <details style={{ borderTop: "1px solid var(--a-rule)" }}>
            <summary style={{ cursor: "pointer", padding: "12px 20px", fontWeight: 600, fontSize: 13, color: "var(--a-ink-soft)" }}>
              Order snapshot (original, as the customer saw it) â for review
            </summary>
            <div style={{ padding: "0 20px 16px" }}>
              <div className="admin-meta" style={{ marginBottom: 8 }}>
                Captured at payment time in the customer’s locale. The working names above are current (EN).
              </div>
              {order.items.map((it) => (
                <div key={it.id} style={{ padding: "8px 0", borderTop: "1px dashed var(--a-rule)", fontSize: 13 }}>
                  <div>
                    <strong>{it.name}</strong>
                    {it.sizeLabel && <span className="admin-meta"> Â· {it.sizeLabel}</span>}
                    <span className="admin-meta"> Â· Ã{it.quantity}</span>
                    {it.customName && <span className="admin-meta"> Â· base: {it.drinkName}</span>}
                  </div>
                  {it.addons.length > 0 && (
                    <div className="admin-meta" style={{ marginTop: 2 }} dir="auto">
                      {it.addons.map((a) =>
                        `${a.name}${a.portions > 1 ? ` Ã${a.portions}` : ""} (${a.amount}${unit(a.unit)})`
                      ).join(" Â· ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>
        </div>

        {/* ÐÐ ÐÐÐ: Ð´ÐµÐ¹ÑÑÐ²Ð¸Ðµ + ÐºÐ»Ð¸ÐµÐ½Ñ + Ð¾Ð¿Ð»Ð°ÑÐ° */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="admin-panel">
            <div className="admin-panel-head"><div className="admin-panel-title">Order processing</div></div>
            <div className="admin-panel-body">
              <div style={{ display: "flex", gap: 0, marginBottom: 16 }}>
                {CHAIN.map((s, i) => {
                  const done = order.status !== "refund" && i < idx;
                  const cur = i === idx;
                  // ÐºÐ¾Ð½Ð½ÐµÐºÑÐ¾Ñ: Ð¿ÑÐ¾Ð¹Ð´ÐµÐ½Ð½ÑÐµ ÑÐµÐ³Ð¼ÐµÐ½ÑÑ â ÑÐ²ÐµÑÐ»Ð¾-ÑÐ¸Ð½Ð¸Ðµ; Ð¿ÐµÑÐµÑÐ¾Ð´ Ðº ÑÐµÐºÑÑÐµÐ¼Ñ ÑÑÐ°ÑÑÑÑ â
                  // Ð³ÑÐ°Ð´Ð¸ÐµÐ½Ñ ÑÐ²ÐµÑÐ»Ð¾-ÑÐ¸Ð½Ð¸Ð¹ â ÑÑÐºÐ¾-ÑÐ¸Ð½Ð¸Ð¹ (Ð¿Ð»Ð°Ð²Ð½ÑÐ¹); Ð±ÑÐ´ÑÑÐ¸Ðµ â ÑÐµÑÑÐµ
                  const lineBg = i < idx - 1 ? "#C7CCF7"
                    : i === idx - 1 ? "linear-gradient(90deg, #C7CCF7, #4A56E2)"
                    : "#E8E2D5";
                  return (
                    <div key={s} style={{ flex: 1, textAlign: "center", position: "relative" }}>
                      {i < CHAIN.length - 1 && (
                        <div style={{ position: "absolute", top: 11, left: "50%", width: "100%", height: 2,
                                      background: lineBg }} />
                      )}
                      <div style={{ width: 24, height: 24, borderRadius: "50%", margin: "0 auto",
                                    display: "grid", placeItems: "center", position: "relative", zIndex: 1,
                                    fontSize: 12, fontWeight: 700,
                                    background: cur ? "#4A56E2" : done ? "#E5E8FB" : "#F1F1F3",
                                    color: cur ? "#FFF" : done ? "#4A56E2" : "#9CA3AF",
                                    boxShadow: cur ? "0 0 0 4px rgba(74,86,226,0.15)" : "none" }}>
                        {done ? "â" : i + 1}
                      </div>
                      <div style={{ fontSize: 11, marginTop: 5, color: cur ? "#0E0E10" : "#9CA3AF",
                                    fontWeight: cur ? 700 : 500, whiteSpace: "nowrap" }}>{STEP_SHORT[s]}</div>
                    </div>
                  );
                })}
              </div>

              {order.status === "refund" && (
                <div className="admin-pill danger" style={{ width: "100%", justifyContent: "center", padding: 10 }}>
                  Refund issued
                </div>
              )}
              {nextAction && (
                <button className="admin-btn primary" style={{ width: "100%", justifyContent: "center", padding: 12, fontSize: 14.5 }}
                        onClick={() => act(nextAction.run, nextAction.ok)}>
                  {nextAction.label}
                </button>
              )}
              {order.status === "completed" && (
                <>
                  <input className="admin-input" placeholder="Refund reason (required)"
                         value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
                  <button className="admin-btn danger" style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
                          disabled={!refundReason.trim()} onClick={() => setConfirmRefund(true)}>
                    Issue refund
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ÐºÐ»Ð¸ÐµÐ½Ñ Ð¸ Ð²ÑÐ´Ð°ÑÐ° */}
          <div className="admin-panel">
            <div className="admin-panel-head"><div className="admin-panel-title">Customer & pickup</div></div>
            <div className="admin-panel-body">
              {/* Ð½Ð¾Ð¼ÐµÑ Ð¼Ð°ÑÐ¸Ð½Ñ â ÐºÑÑÐ¿Ð½Ð¾, ÑÑÐ¾ ÐºÐ»ÑÑ Ðº Ð²ÑÐ´Ð°ÑÐµ */}
              <label className="admin-label">Car for pickup</label>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 12, marginTop: 4, marginBottom: 14,
                            background: "#fcfcfa", border: "2.5px solid #15171c", borderRadius: 12, padding: "8px 16px" }}>
                <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.05 }}>
                  <span style={{ fontSize: 10, fontWeight: 900, color: "#c0392b" }}>{order.emirate || "Dubai"}</span>
                  <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 1, color: "#15171c" }}>U.A.E</span>
                </div>
                <div style={{ width: 1.5, height: 30, background: "#dcdcd6" }} />
                <div style={{ fontSize: 26, fontWeight: 900, color: "#15171c", letterSpacing: 1.5 }}>{order.carPlate}</div>
              </div>

              <div className="admin-field"><label className="admin-label">Name</label>
                <div style={{ fontWeight: 600 }}>{order.customerName ?? "â"}</div></div>
              <div className="admin-field"><label className="admin-label">Phone</label>
                <a href={`tel:${order.phone}`} className="admin-mono"
                   style={{ color: "var(--a-accent)", textDecoration: "none", fontWeight: 600 }}>
                  {order.phone} <span style={{ fontSize: 12 }}>Â· call</span>
                </a></div>
              {order.rating && (
                <div className="admin-field"><label className="admin-label">Customer rating</label>
                  <div style={{ fontSize: 22 }}>{order.rating === "like" ? "ð" : "ð"}</div></div>
              )}
            </div>
          </div>

          {/* Ð¾Ð¿Ð»Ð°ÑÐ° */}
          <div className="admin-panel">
            <div className="admin-panel-head"><div className="admin-panel-title">Payment</div></div>
            <div className="admin-panel-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="admin-label">Status</div>
                <span className="admin-pill" style={order.paymentStatus === "paid"
                  ? { background: "#DDEDE0", color: "#166534", fontWeight: 700 }
                  : { background: "#FDF3DB", color: "#B45309", fontWeight: 700 }}>
                  {order.paymentStatus === "paid" ? "paid" : order.paymentStatus}
                </span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="admin-label">Amount</div>
                <div className="admin-num" style={{ fontWeight: 800, fontSize: 18 }}>{order.total.toFixed(2)} AED</div>
              </div>
            </div>
          </div>

          {/* Ð¸ÑÑÐ¾ÑÐ¸Ñ ÑÑÐ°ÑÑÑÐ¾Ð² â Ð²ÐµÑÑÐ¸ÐºÐ°Ð»ÑÐ½Ð°Ñ Ð»ÐµÐ½ÑÐ° Ñ ÐºÑÑÐ¶ÐºÐ°Ð¼Ð¸ Ð¸ Ð¿Ð¾Ð´Ð¿Ð¸ÑÑÐ¼Ð¸ */}
          <div className="admin-panel">
            <div className="admin-panel-head"><div className="admin-panel-title">Status history</div></div>
            <div className="admin-panel-body">
              <div className="admin-timeline">
                {(order.events ?? []).map((h, i, arr) => (
                  <div key={i} className="admin-timeline-row">
                    <div className={`admin-timeline-dot ${i === arr.length - 1 ? "current" : "done"}`} />
                    <div>
                      <div className="admin-timeline-text">
                        <strong>{eventLabel(h.type, h.status)}</strong>
                        {h.note && <span className="admin-meta"> Â· {h.note}</span>}
                      </div>
                      <div className="admin-timeline-meta">
                        {h.at ? fmtDateTime(h.at) : "â"} Â·{" "}
                        {h.byStaffId ? (
                          <Link href={`/admin/staff/${h.byStaffId}`}
                                style={{ color: "var(--a-accent)", fontWeight: 600, textDecoration: "none" }}>
                            {h.byStaffName ?? `staff member #${h.byStaffId}`} â
                          </Link>
                        ) : h.byUserId ? "customer" : "system"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmRefund}
        title={`Refund order #${order.number}?`}
        message="The status will change to ârefundâ and the payment will be marked refunded. The customer will see the refund on the order page."
        confirmLabel="Issue refund"
        danger
        onCancel={() => setConfirmRefund(false)}
        onConfirm={() => {
          setConfirmRefund(false);
          act(() => adminApi.refund(order.id, refundReason.trim()), "Refund issued");
        }}
      />
    </div>
  );
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AdminShell title={`Order`} crumbs={[{ label: "Orders", href: "/admin/orders" }, { label: `#${id}` }]}>
      <Detail id={Number(id)} />
    </AdminShell>
  );
}
