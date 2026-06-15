"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { useToast } from "@/components/admin/AdminUI";
import { CustomerForm, type CustomerDraft } from "@/components/admin/CustomerForm";
import { adminApi, ADMIN_STATUS_LABEL } from "@/lib/adminApi";
import { fmtDate, fmtDateTime, recencyText, aed as money } from "@/lib/format";
import { Kpi } from "@/components/admin/Stat";
import { MonthlyTrendChart } from "@/components/admin/charts/MonthlyTrendChart";
import { WeekdayHourHeatmap } from "@/components/admin/charts/WeekdayHourHeatmap";
import { ServiceTimeChart } from "@/components/admin/charts/ServiceTimeChart";
import { SizeMixDonut } from "@/components/admin/charts/SizeMixDonut";
import { HorizontalBars } from "@/components/admin/charts/HorizontalBars";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];


const PAY_PILL: Record<string, { label: string; cls: string }> = {
  paid: { label: "paid", cls: "accent" },
  pending: { label: "pending", cls: "" },
  failed: { label: "failed", cls: "danger" },
  refunded: { label: "refunded", cls: "danger" },
};

// человекочитаемые подписи RFM-сегментов (server-truth ключи)
const SEGMENT_LABEL: Record<string, string> = {
  champions: "Champions",
  loyal: "Loyal",
  potential_loyalist: "Potential loyalists",
  new_customers: "New customers",
  promising: "Promising",
  need_attention: "Need attention",
  at_risk: "At risk",
  hibernating: "Hibernating",
  lost: "Lost",
  no_purchase: "No purchase",
};
const SEGMENT_PILL: Record<string, string> = {
  champions: "accent", loyal: "accent", potential_loyalist: "accent",
  new_customers: "", promising: "",
  need_attention: "warn", at_risk: "warn", hibernating: "warn",
  lost: "danger", no_purchase: "",
};
const RISK_PILL: Record<string, { label: string; cls: string }> = {
  low: { label: "low risk", cls: "accent" },
  medium: { label: "medium risk", cls: "warn" },
  high: { label: "high risk", cls: "danger" },
};

// краткая рекомендация по сегменту
const SEGMENT_NOTE: Record<string, string> = {
  champions: "Frequent, recent customer — the core of your loyal base. Retain with early access to new items, loyalty perks and a referral program.",
  loyal: "Orders consistently. Keep the frequency up with personal offers on their favourite drinks.",
  potential_loyalist: "Good momentum — a real chance to convert to loyal. Try a loyalty program and recommendations for their favourite items.",
  new_customers: "Made a first order recently. Build the habit with an onboarding series and a discounted second order.",
  promising: "Visited recently but hasn't ordered much yet. Nudge with a good offer.",
  need_attention: "Was active but frequency is dropping. Send a personal discount on a favourite item before they leave.",
  at_risk: "Hasn't ordered in a while despite high past value. Reactivate with a win-back promo code on a deadline.",
  hibernating: "Hibernating — rare orders, long ago. Run a short survey on why, plus a win-back bonus.",
  lost: "Looks gone. Aggressive reactivation, or remove from active campaigns.",
  no_purchase: "Registered but hasn't ordered yet. Nudge with a welcome promo code for the first order.",
};


// одиночный RFM-балл (R/F/M) с цветовой заливкой 1..5
function RfmScore({ label, score }: { label: string; score: number }) {
  const pctFill = Math.max(0, Math.min(5, score || 0)) / 5;
  const bg = score >= 4 ? "#4A56E2" : score >= 3 ? "#8E97F0" : score >= 2 ? "#C2C7F6" : "#EFEAE0";
  const ink = score >= 3 ? "#FFFFFF" : "#3A3A44";
  return (
    <div style={{ textAlign: "center" }}>
      <div className="admin-meta" style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{
        width: 44, height: 44, borderRadius: 12, background: bg, color: ink,
        display: "grid", placeItems: "center", fontSize: 20, fontWeight: 800, margin: "0 auto",
        opacity: 0.4 + pctFill * 0.6,
      }}>{score || "—"}</div>
    </div>
  );
}

function EditCustomerInner({ id }: { id: number }) {
  const router = useRouter();
  const toast = useToast();
  const [c, setC] = useState<any | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rev, setRev] = useState(0);

  const load = useCallback(async () => {
    try { setC(await adminApi.customer(id)); }
    catch { setNotFound(true); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (notFound) return <div className="admin-meta">Customer not found</div>;
  if (!c) return <div className="admin-meta">Loading…</div>;

  const s = c.stats ?? {};
  const rfm = s.rfm ?? null;
  const churn = s.churn ?? null;
  const clv = s.clv ?? null;
  const segKey: string = rfm?.segment ?? (s.paidOrders ? "loyal" : "no_purchase");
  const segLabel = SEGMENT_LABEL[segKey] ?? segKey;
  const segNote = SEGMENT_NOTE[segKey] ?? "";
  const personaTags: string[] = Array.isArray(s.personaTags) ? s.personaTags : [];

  const initial: CustomerDraft = {
    phone: c.phone ?? "", name: c.name ?? "", carPlate: c.carPlate ?? "",
    emirate: c.emirate ?? "", locale: c.locale === "ar" ? "ar" : "en",
  };

  const save = async (d: CustomerDraft) => {
    setSaving(true);
    try {
      await adminApi.updateCustomer(id, d);
      await load(); setRev((r) => r + 1);
      toast("Customer details saved");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      const human: Record<string, string> = {
        PHONE_TAKEN: "This phone already belongs to another customer", PHONE_REQUIRED: "Enter a phone number",
      };
      toast(human[msg] ?? msg, "warn");
    } finally { setSaving(false); }
  };

  const hasPurchases = (s.paidOrders ?? 0) > 0;

  // источники данных для графиков
  const monthly = Array.isArray(s.monthly) ? s.monthly : [];
  const heatmap = Array.isArray(s.heatmap) ? s.heatmap : [];
  const svc = s.serviceTimes ?? {};
  const sizeMix = Array.isArray(s.sizeMix) ? s.sizeMix : [];
  const managerAffinity: any[] = Array.isArray(s.managerAffinity) ? s.managerAffinity : [];
  const topDrinks: any[] = Array.isArray(s.topDrinks) ? s.topDrinks : [];
  const topAddons: any[] = Array.isArray(s.topAddons) ? s.topAddons : [];

  const drinkBars = topDrinks.map((d: any) => ({ label: d.name, value: d.qty }));
  const addonBars = topAddons.map((a: any) => ({ label: a.name, value: a.qty }));
  const mgrBars = managerAffinity.map((m: any) => ({ label: m.name, value: m.orders }));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* строка 1: карточка клиента + сводка с сегментом и KPI */}
      <div className="admin-split" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, alignItems: "start" }}>
        <CustomerForm key={rev} initial={initial} mode="edit" saving={saving}
                      onSubmit={save} onCancel={() => router.push("/admin/customers")} />

        <div className="admin-panel">
          <div className="admin-panel-head">
            <div className="admin-panel-title">Summary</div>
            <span className={`admin-pill ${SEGMENT_PILL[segKey] ?? ""}`} style={{ fontWeight: 700 }}>{segLabel}</span>
          </div>
          <div className="admin-panel-body">
            {segNote && <p className="admin-meta" style={{ marginBottom: 12 }}>{segNote}</p>}
            <div className="kbju-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              <Kpi label="Spent" value={money(s.totalSpent ?? 0)} sub="LTV" />
              <Kpi label="Orders" value={s.paidOrders ?? 0}
                   sub={s.refundedOrders ? `${s.refundedOrders} refund(s)` : "paid"} />
              <Kpi label="Avg. order" value={money(s.avgOrderValue ?? 0)} />
              <Kpi label="Frequency" value={`${s.ordersPerMonth ?? 0}/mo`}
                   sub={s.avgDaysBetween ? `~${s.avgDaysBetween} d` : undefined} />
              <Kpi label="Last order" value={recencyText(s.recencyDays)} />
              <Kpi label="Ratings"
                   value={s.ratedOrders ? `${Math.round((s.satisfaction ?? 0) * 100)}%` : "—"}
                   sub={s.ratedOrders ? `👍${s.likes} · 👎${s.dislikes}` : "no ratings"} />
            </div>
            {personaTags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                {personaTags.map((t) => <span key={t} className="admin-badge">{t}</span>)}
              </div>
            )}
            <div className="admin-meta" style={{ marginTop: 12, display: "flex", gap: 14, flexWrap: "wrap" }}>
              <span>First order: <strong>{fmtDate(s.firstOrderAt)}</strong></span>
              <span>Basket: <strong>{s.avgBasket ?? 0}</strong> items</span>
              <span>Largest order: <strong>{money(s.biggestOrder ?? 0)}</strong></span>
              <span>Coupons: <strong>{s.couponsActive ?? 0}</strong> active / {s.couponsIssued ?? 0} total</span>
              <span>Discounts received: <strong>{money(s.discountTotal ?? 0)}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* строка 2: RFM / Отток / CLV */}
      {hasPurchases && (rfm || churn || clv) && (
        <div className="admin-split" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, alignItems: "start" }}>
          <div className="admin-panel">
            <div className="admin-panel-head">
              <div className="admin-panel-title">RFM profile</div>
              {rfm?.score && <span className="admin-mono admin-meta">{rfm.score}</span>}
            </div>
            <div className="admin-panel-body">
              {rfm ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 12 }}>
                    <RfmScore label="Recency" score={rfm.r} />
                    <RfmScore label="Frequency" score={rfm.f} />
                    <RfmScore label="Monetary" score={rfm.m} />
                  </div>
                  <p className="admin-meta">
                    Segment: <strong>{SEGMENT_LABEL[rfm.segment] ?? rfm.segment}</strong>
                  </p>
                </>
              ) : <span className="admin-meta">—</span>}
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head">
              <div className="admin-panel-title">Churn risk</div>
              {churn && (
                <span className={`admin-pill ${RISK_PILL[churn.risk]?.cls ?? ""}`} style={{ fontWeight: 700 }}>
                  {RISK_PILL[churn.risk]?.label ?? churn.risk}
                </span>
              )}
            </div>
            <div className="admin-panel-body">
              {churn ? (
                <div className="kbju-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <Kpi label="Probability" value={`${Math.round((churn.probability ?? 0) * 100)}%`} />
                  <Kpi label="Next order"
                       value={churn.expectedNextOrderInDays == null ? "—" : `~${churn.expectedNextOrderInDays} d`}
                       sub="expected" />
                  <Kpi label="Overdue"
                       value={churn.daysOverdue == null ? "—" : `${churn.daysOverdue} d`}
                       sub={churn.daysOverdue && churn.daysOverdue > 0 ? "past usual" : "on track"} />
                  <Kpi label="Recency" value={recencyText(s.recencyDays)} />
                </div>
              ) : <span className="admin-meta">—</span>}
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head">
              <div className="admin-panel-title">CLV</div>
              <span className="admin-meta">{clv?.horizonMonths ?? 12}-mo forecast</span>
            </div>
            <div className="admin-panel-body">
              {clv ? (
                <div className="kbju-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <Kpi label="Historical" value={money(clv.historical ?? 0)} sub="actual LTV" />
                  <Kpi label="Predicted" value={money(clv.predicted ?? 0)} sub="next 12 mo" />
                </div>
              ) : <span className="admin-meta">—</span>}
            </div>
          </div>
        </div>
      )}

      {/* строка 3: динамика по месяцам + heatmap дни×часы */}
      {hasPurchases && (
        <div className="admin-split" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
          <div className="admin-panel">
            <div className="admin-panel-head"><div className="admin-panel-title">12-month trend</div></div>
            <div className="admin-panel-body">
              <MonthlyTrendChart data={monthly} />
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head">
              <div className="admin-panel-title">When they order</div>
              {s.peakWeekday != null && (
                <span className="admin-meta">
                  peak — {WEEKDAYS[s.peakWeekday]}
                  {s.peakHour != null ? ` ${String(s.peakHour).padStart(2, "0")}:00` : ""}
                </span>
              )}
            </div>
            <div className="admin-panel-body">
              <WeekdayHourHeatmap matrix={heatmap} />
            </div>
          </div>
        </div>
      )}

      {/* строка 4: топ напитков / добавок / объёмы */}
      {hasPurchases && (
        <div className="admin-split" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, alignItems: "start" }}>
          <div className="admin-panel">
            <div className="admin-panel-head"><div className="admin-panel-title">Favourite drinks</div></div>
            <div className="admin-panel-body">
              <HorizontalBars data={drinkBars} suffix=" pcs" height={Math.max(160, drinkBars.length * 34 + 16)} />
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head"><div className="admin-panel-title">Favourite add-ons</div></div>
            <div className="admin-panel-body">
              <HorizontalBars data={addonBars} suffix=" servings" color="#8E97F0"
                              height={Math.max(160, addonBars.length * 34 + 16)} />
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head"><div className="admin-panel-title">Sizes</div></div>
            <div className="admin-panel-body">
              <SizeMixDonut data={sizeMix} />
            </div>
          </div>
        </div>
      )}

      {/* строка 5: время обслуживания + предпочтения по менеджерам */}
      {hasPurchases && (
        <div className="admin-split" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
          <div className="admin-panel">
            <div className="admin-panel-head">
              <div className="admin-panel-title">Service time</div>
              {svc.samples ? <span className="admin-meta">{svc.samples} sample(s)</span> : null}
            </div>
            <div className="admin-panel-body">
              <ServiceTimeChart prepMin={svc.avgPrepMin ?? null}
                                pickupMin={svc.avgPickupMin ?? null}
                                totalMin={svc.avgTotalMin ?? null} />
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head"><div className="admin-panel-title">Who served</div></div>
            <div className="admin-panel-body">
              <HorizontalBars data={mgrBars} suffix=" orders" color="#22A06B"
                              height={Math.max(160, mgrBars.length * 34 + 16)} />
            </div>
          </div>
        </div>
      )}

      {/* строка 6: история заказов */}
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">Order history</div>
          <span className="admin-meta">{c.orders.length}</span>
        </div>
        {c.orders.length === 0 ? (
          <div className="admin-panel-body"><span className="admin-meta">No orders yet</span></div>
        ) : (
          <div className="admin-tablewrap"><table className="admin-table">
            <thead>
              <tr><th>#</th><th>Date & time</th><th>Items</th><th>Amount</th>
                  <th>Payment</th><th>Status</th><th>Rating</th></tr>
            </thead>
            <tbody>
              {c.orders.map((o: any) => {
                const pay = PAY_PILL[o.paymentStatus] ?? { label: o.paymentStatus, cls: "" };
                return (
                  <tr key={o.id} className="admin-row-link" style={{ cursor: "pointer" }}
                      onClick={() => router.push(`/admin/orders/${o.id}`)}>
                    <td><strong>#{o.number}</strong></td>
                    <td className="admin-meta">{fmtDateTime(o.createdAt)}</td>
                    <td style={{ fontSize: 12.5, maxWidth: 280 }}>
                      {o.items.slice(0, 3).map((it: any, i: number) => (
                        <div key={i}>{it.quantity}× {it.drinkNameEn ?? it.name}</div>
                      ))}
                      {o.items.length > 3 && <div className="admin-meta">+{o.items.length - 3} more</div>}
                    </td>
                    <td className="admin-num">{o.total.toFixed(2)}</td>
                    <td><span className={`admin-pill ${pay.cls}`}>{pay.label}</span></td>
                    <td><span className={`admin-badge ${o.status}`}>{ADMIN_STATUS_LABEL[o.status] ?? o.status}</span></td>
                    <td>{o.rating === "like" ? "👍" : o.rating === "dislike" ? "👎" : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
        <div className="admin-panel-body">
          <div className="admin-mono admin-meta">#{c.id} · registered {fmtDate(c.createdAt)}</div>
        </div>
      </div>
    </div>
  );
}

export default function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AdminShell title="Customer"
                crumbs={[{ label: "Customers", href: "/admin/customers" }, { label: `#${id}` }]}>
      <EditCustomerInner id={Number(id)} />
    </AdminShell>
  );
}
