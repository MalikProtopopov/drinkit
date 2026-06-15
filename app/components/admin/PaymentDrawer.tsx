"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/admin/AdminUI";
import { adminApi } from "@/lib/adminApi";

/* ---------- форматтеры ---------- */
const money = (n?: number | null) =>
  n == null ? "—" : `${Number(n).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`;
const fmtDateTime = (s?: string | null) =>
  s ? new Date(/[Z+]/.test(s) ? s : s + "Z").toLocaleString("ru-RU",
    { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export const PAYMENT_STATUS: Record<string, { label: string; cls: string }> = {
  succeeded: { label: "успешно", cls: "accent" },
  refunded: { label: "возврат", cls: "warn" },
  pending: { label: "ожидание", cls: "" },
  failed: { label: "ошибка", cls: "danger" },
};

const BRAND_LABEL: Record<string, string> = {
  visa: "Visa", mastercard: "Mastercard", amex: "Amex", mada: "mada",
  discover: "Discover", unionpay: "UnionPay",
};
const METHOD_LABEL: Record<string, string> = {
  card: "Карта", apple_pay: "Apple Pay", google_pay: "Google Pay", link: "Link",
};

export function methodLine(p: any): string {
  const brand = p.cardBrand ? (BRAND_LABEL[p.cardBrand] ?? p.cardBrand) : null;
  const tail = p.cardLast4 ? `•••• ${p.cardLast4}` : "";
  if (p.method && p.method !== "card") {
    const w = METHOD_LABEL[p.method] ?? p.method;
    return [w, [brand, tail].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
  }
  return [brand, tail].filter(Boolean).join(" ") || "Карта";
}

const TIMELINE_LABEL: Record<string, string> = {
  created: "Платёж создан", paid: "Оплачен", refund: "Возврат", dispute: "Спор открыт",
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
        <button className="admin-btn ghost sm" title="Копировать" style={{ padding: "2px 7px" }}
                onClick={() => { navigator.clipboard?.writeText(value); toast("Скопировано"); }}>⧉</button>
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
    if (amt != null && (!(amt > 0) || amt > remaining)) { toast("Некорректная сумма возврата", "warn"); return; }
    setBusy(true);
    try {
      await adminApi.refundPayment(p.id, { amount: amt, reason: refundReason || undefined });
      toast("Возврат оформлен");
      setRefundOpen(false); setRefundAmt(""); setRefundReason("");
      await load(); onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ошибка возврата", "danger");
    } finally { setBusy(false); }
  };

  return (
    <>
      <div className="admin-drawer-backdrop" onClick={onClose} />
      <aside className="admin-drawer" style={{ width: 460, maxWidth: "94vw" }}>
        <div className="admin-drawer-head">
          <div>
            <div className="admin-panel-title">Платёж #{id}</div>
            <div className="admin-meta">{p ? `Заказ #${p.orderNumber ?? "—"} · ${p.provider}` : "Stripe"}</div>
          </div>
          <button className="admin-btn ghost" onClick={onClose}>×</button>
        </div>

        <div className="admin-drawer-body" style={{ display: "grid", gap: 16 }}>
          {loading && <div className="admin-meta">Загрузка…</div>}
          {!loading && !p && <div className="admin-meta">Платёж не найден</div>}

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
                  Отказ: {p.failureMessage}{p.failureCode ? ` (${p.failureCode})` : ""}
                </div>
              )}

              {/* деньги */}
              <div className="admin-panel">
                <div className="admin-panel-head"><div className="admin-panel-title">Деньги</div>
                  {p.livemode === false && <span className="admin-pill" style={{ fontSize: 11 }}>test/mock</span>}
                </div>
                <div className="admin-panel-body">
                  <Line label="Сумма">{money(p.amount)}</Line>
                  <Line label="Комиссия Stripe">− {money(p.fee)}</Line>
                  {p.refunded > 0 && <Line label="Возвращено">− {money(p.refunded)}</Line>}
                  <Line label="Чистыми" strong>{money((p.net ?? (p.amount - (p.fee || 0))) - (p.refunded || 0))}</Line>
                </div>
              </div>

              {/* способ оплаты */}
              <div className="admin-panel">
                <div className="admin-panel-head"><div className="admin-panel-title">Способ оплаты</div></div>
                <div className="admin-panel-body">
                  <Line label="Метод">{methodLine(p)}</Line>
                  {p.cardFunding && <Line label="Тип карты">{p.cardFunding === "credit" ? "кредитная" : p.cardFunding === "debit" ? "дебетовая" : p.cardFunding}</Line>}
                  {p.cardCountry && <Line label="Страна карты">{p.cardCountry}</Line>}
                  {p.cardExp && <Line label="Срок действия">{p.cardExp}</Line>}
                  {(p.riskLevel || p.riskScore != null) && (
                    <Line label="Риск (Radar)">
                      <span className={`admin-pill ${p.riskLevel === "highest" ? "danger" : p.riskLevel === "elevated" ? "warn" : ""}`}>
                        {p.riskLevel ?? "—"}{p.riskScore != null ? ` · ${p.riskScore}` : ""}
                      </span>
                    </Line>
                  )}
                  {p.disputeStatus && <Line label="Спор">
                    <span className="admin-pill danger">{p.disputeStatus}</span></Line>}
                </div>
              </div>

              {/* заказ + клиент */}
              {p.order && (
                <div className="admin-panel">
                  <div className="admin-panel-head">
                    <div className="admin-panel-title">Заказ #{p.order.number}</div>
                    <Link href={`/admin/orders/${p.orderId}`} className="admin-btn ghost sm">Открыть →</Link>
                  </div>
                  <div className="admin-panel-body">
                    {p.customerPhone && (
                      <div style={{ marginBottom: 8 }}>
                        <Link href={`/admin/customers/${p.userId}`} style={{ fontWeight: 700, color: "#0E0E10", textDecoration: "none" }}>
                          {p.customerName || "Клиент"} <span className="admin-mono admin-meta">{p.customerPhone}</span> →
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
                      <div className="admin-meta" style={{ marginTop: 4 }}>Скидка по купону: −{money(p.order.couponDiscount)}</div>
                    )}
                  </div>
                </div>
              )}

              {/* идентификаторы Stripe */}
              <div className="admin-panel">
                <div className="admin-panel-head"><div className="admin-panel-title">Идентификаторы Stripe</div></div>
                <div className="admin-panel-body">
                  <IdRow label="Payment Intent" value={p.paymentIntentId} href={stripeLink("payments", p.paymentIntentId)} />
                  <IdRow label="Charge" value={p.chargeId} />
                  <IdRow label="Customer" value={p.customerId} href={stripeLink("customers", p.customerId)} />
                  <IdRow label="Checkout / ref" value={p.providerId} />
                  {p.receiptUrl && (
                    <div style={{ paddingTop: 6 }}>
                      <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="admin-btn ghost sm">Чек об оплате ↗</a>
                    </div>
                  )}
                </div>
              </div>

              {/* таймлайн */}
              {(p.timeline ?? []).length > 0 && (
                <div className="admin-panel">
                  <div className="admin-panel-head"><div className="admin-panel-title">История платежа</div></div>
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
                <span className="admin-meta">{refundable ? `Доступно к возврату: ${money(remaining)}` : "Возврат недоступен"}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="admin-btn ghost" onClick={onClose}>Закрыть</button>
                  {refundable && <button className="admin-btn danger" onClick={() => { setRefundOpen(true); setRefundAmt(String(remaining)); }}>Оформить возврат</button>}
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <div className="admin-field" style={{ flex: 1 }}>
                    <label className="admin-label">Сумма возврата</label>
                    <input className="admin-input mono" value={refundAmt} inputMode="decimal"
                           onChange={(e) => setRefundAmt(e.target.value.replace(/[^\d.]/g, ""))} />
                  </div>
                  <div className="admin-field" style={{ flex: 2 }}>
                    <label className="admin-label">Причина (необязательно)</label>
                    <input className="admin-input" value={refundReason} placeholder="дубль оплаты / жалоба…"
                           onChange={(e) => setRefundReason(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button className="admin-btn ghost" disabled={busy} onClick={() => setRefundOpen(false)}>Отмена</button>
                  <button className="admin-btn danger" disabled={busy} onClick={doRefund}>
                    {busy ? "Возврат…" : `Вернуть ${money(refundAmt ? Number(refundAmt) : remaining)}`}
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
