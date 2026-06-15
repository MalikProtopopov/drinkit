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

// timestamps хранятся как наивный UTC — трактуем как UTC для корректного времени/таймера
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

// «ждёт N мин» — живой счётчик с цветовой эскалацией (зелёный → янтарь → красный)
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
    const t = setInterval(() => setNow(Date.now()), 30_000); // живой таймер ожидания
    return () => clearInterval(t);
  }, []);
  // realtime этого заказа: смены статуса/прибытие приходят сразу; авто-reconnect
  useLiveReload({
    connect: adminOrdersWs,
    onMessage: (m) => { if ((m as { orderId?: number }).orderId === id) load(); },
    onSync: () => load(),
    pollMs: 30000,
  });

  if (!order) return <div className="admin-meta">Loading…</div>;

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
    order.status === "new" ? { label: "Take →", run: () => adminApi.take(order.id), ok: "Taken" }
    : order.status === "in_progress" ? { label: "Ready, awaiting pickup →", run: () => adminApi.setStatus(order.id, "ready"), ok: "Ready — waiting for customer" }
    : order.status === "ready" ? { label: "Handed over to customer ✓", run: () => adminApi.setStatus(order.id, "completed"), ok: "Handed over to customer" }
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* summary-бар: номер, время оформления, ЖИВОЙ таймер ожидания, статус */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>Order #{order.number}</div>
        {order.createdAt && <span className="admin-meta">placed {fmtDateTime(order.createdAt)}</span>}
        {isActive && <WaitBadge minutes={waitMin} />}
        <span style={{ flex: 1 }} />
        <span className={`admin-badge ${order.status}`}>{ADMIN_STATUS_LABEL[order.status]}</span>
      </div>

      {/* приоритетный баннер: клиент уже на месте */}
      {order.arrived && isActive && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 14,
                      background: "#FFF7E5", border: "1.5px solid #F0C36B", fontWeight: 600 }}>
          <span style={{ fontSize: 22 }}>🚗</span>
          <div>
            Customer has arrived — car <strong>{order.emirate} {order.carPlate}</strong>.
            {order.status !== "ready" && <span style={{ color: "#B45309" }}> Order is still being prepared — priority!</span>}
          </div>
        </div>
      )}

      <div className="admin-split" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, alignItems: "start" }}>
        {/* ЛЕВО: что готовить */}
        <div className="admin-panel">
          <div className="admin-panel-head">
            <div className="admin-panel-title">To prepare · {order.items.length} items / {drinksTotal} pcs</div>
          </div>

          {order.items.map((it) => (
            <div key={it.id} style={{ display: "flex", gap: 14, padding: "16px 20px",
                                      borderTop: "1px solid var(--a-rule)" }}>
              <ItemThumb url={it.previewUrl} name={it.drinkNameEn} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 16 }}>{it.customName || it.drinkNameEn}</strong>
                  {it.sizeLabel && <span className="admin-pill">{it.sizeLabel}</span>}
                  <span className="admin-pill" style={{ background: "#EFE6F0", color: "#4A56E2", fontWeight: 700 }}>×{it.quantity}</span>
                  {it.paidByCoupon && <span className="admin-pill accent">via coupon</span>}
                </div>
                {it.customName && (
                  <div className="admin-meta" style={{ marginTop: 2 }}>
                    Name from customer · base drink: <strong>{it.drinkNameEn}</strong>
                  </div>
                )}

                <div style={{ marginTop: 10 }}>
                  {it.addons.length === 0 ? (
                    <span className="admin-meta">No add-ons — base recipe</span>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div className="admin-meta" style={{ fontWeight: 700, marginBottom: 2 }}>Add-ons:</div>
                      {it.addons.map((a, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13.5 }}>
                          <span>
                            <strong style={{ fontWeight: 600 }}>{a.nameEn}</strong>
                            {a.portions > 1 && <span> ×{a.portions}</span>}
                            <span className="admin-meta"> · {a.amount}{unit(a.unit)}</span>
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
              Total {order.couponDiscount > 0 && <span className="admin-meta">(coupon −{order.couponDiscount.toFixed(0)})</span>}
            </div>
            <div className="admin-num" style={{ fontWeight: 800, fontSize: 18 }}>{order.total.toFixed(2)} AED</div>
          </div>

          {/* снимок заказа (оригинал, в локали клиента) — для проверки суперадмином */}
          <details style={{ borderTop: "1px solid var(--a-rule)" }}>
            <summary style={{ cursor: "pointer", padding: "12px 20px", fontWeight: 600, fontSize: 13, color: "var(--a-ink-soft)" }}>
              Order snapshot (original, as the customer saw it) — for review
            </summary>
            <div style={{ padding: "0 20px 16px" }}>
              <div className="admin-meta" style={{ marginBottom: 8 }}>
                Captured at payment time in the customer’s locale. The working names above are current (EN).
              </div>
              {order.items.map((it) => (
                <div key={it.id} style={{ padding: "8px 0", borderTop: "1px dashed var(--a-rule)", fontSize: 13 }}>
                  <div>
                    <strong>{it.name}</strong>
                    {it.sizeLabel && <span className="admin-meta"> · {it.sizeLabel}</span>}
                    <span className="admin-meta"> · ×{it.quantity}</span>
                    {it.customName && <span className="admin-meta"> · base: {it.drinkName}</span>}
                  </div>
                  {it.addons.length > 0 && (
                    <div className="admin-meta" style={{ marginTop: 2 }} dir="auto">
                      {it.addons.map((a) =>
                        `${a.name}${a.portions > 1 ? ` ×${a.portions}` : ""} (${a.amount}${unit(a.unit)})`
                      ).join(" · ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>
        </div>

        {/* ПРАВО: действие + клиент + оплата */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="admin-panel">
            <div className="admin-panel-head"><div className="admin-panel-title">Order processing</div></div>
            <div className="admin-panel-body">
              <div style={{ display: "flex", gap: 0, marginBottom: 16 }}>
                {CHAIN.map((s, i) => {
                  const done = order.status !== "refund" && i < idx;
                  const cur = i === idx;
                  // коннектор: пройденные сегменты — светло-синие; переход к текущему статусу —
                  // градиент светло-синий → ярко-синий (плавный); будущие — серые
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
                        {done ? "✓" : i + 1}
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

          {/* клиент и выдача */}
          <div className="admin-panel">
            <div className="admin-panel-head"><div className="admin-panel-title">Customer & pickup</div></div>
            <div className="admin-panel-body">
              {/* номер машины — крупно, это ключ к выдаче */}
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
                <div style={{ fontWeight: 600 }}>{order.customerName ?? "—"}</div></div>
              <div className="admin-field"><label className="admin-label">Phone</label>
                <a href={`tel:${order.phone}`} className="admin-mono"
                   style={{ color: "var(--a-accent)", textDecoration: "none", fontWeight: 600 }}>
                  {order.phone} <span style={{ fontSize: 12 }}>· call</span>
                </a></div>
              {order.rating && (
                <div className="admin-field"><label className="admin-label">Customer rating</label>
                  <div style={{ fontSize: 22 }}>{order.rating === "like" ? "👍" : "👎"}</div></div>
              )}
            </div>
          </div>

          {/* оплата */}
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

          {/* история статусов — вертикальная лента с кружками и подписями */}
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
                        {h.note && <span className="admin-meta"> · {h.note}</span>}
                      </div>
                      <div className="admin-timeline-meta">
                        {h.at ? fmtDateTime(h.at) : "—"} ·{" "}
                        {h.byStaffId ? (
                          <Link href={`/admin/staff/${h.byStaffId}`}
                                style={{ color: "var(--a-accent)", fontWeight: 600, textDecoration: "none" }}>
                            {h.byStaffName ?? `staff member #${h.byStaffId}`} →
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
        message="The status will change to “refund” and the payment will be marked refunded. The customer will see the refund on the order page."
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
