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

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];


const PAY_PILL: Record<string, { label: string; cls: string }> = {
  paid: { label: "оплачен", cls: "accent" },
  pending: { label: "ожидание", cls: "" },
  failed: { label: "ошибка", cls: "danger" },
  refunded: { label: "возврат", cls: "danger" },
};

// человекочитаемые подписи RFM-сегментов (server-truth ключи)
const SEGMENT_LABEL: Record<string, string> = {
  champions: "Чемпионы",
  loyal: "Лояльные",
  potential_loyalist: "Потенциально лояльные",
  new_customers: "Новички",
  promising: "Перспективные",
  need_attention: "Требуют внимания",
  at_risk: "В зоне риска",
  hibernating: "Засыпающие",
  lost: "Потерянные",
  no_purchase: "Без покупок",
};
const SEGMENT_PILL: Record<string, string> = {
  champions: "accent", loyal: "accent", potential_loyalist: "accent",
  new_customers: "", promising: "",
  need_attention: "warn", at_risk: "warn", hibernating: "warn",
  lost: "danger", no_purchase: "",
};
const RISK_PILL: Record<string, { label: string; cls: string }> = {
  low: { label: "низкий риск", cls: "accent" },
  medium: { label: "средний риск", cls: "warn" },
  high: { label: "высокий риск", cls: "danger" },
};

// краткая рекомендация по сегменту
const SEGMENT_NOTE: Record<string, string> = {
  champions: "Частый и недавний клиент — ядро лояльной базы. Удержание: ранний доступ к новинкам, бонусы за лояльность, реферальная программа.",
  loyal: "Стабильно заказывает. Поддержите частоту персональными предложениями на любимые напитки.",
  potential_loyalist: "Хорошая динамика — есть шанс перевести в лояльные. Программа лояльности, рекомендации к любимым позициям.",
  new_customers: "Недавно сделал первый заказ. Закрепите привычку: онбординг-серия, второй заказ со скидкой.",
  promising: "Заходил недавно, но заказов пока мало. Подтолкните выгодным предложением.",
  need_attention: "Был активен, но частота падает. Персональная скидка на любимую позицию, пока не ушёл.",
  at_risk: "Давно не заказывал при высокой прошлой ценности. Реактивация: возвратный промокод с дедлайном.",
  hibernating: "Засыпает — редкие заказы давно. Короткий опрос о причине + возвратный бонус.",
  lost: "Похоже, ушёл. Агрессивная реактивация или исключение из активных рассылок.",
  no_purchase: "Зарегистрирован, но ещё не заказывал. Подтолкните приветственным промокодом на первый заказ.",
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

  if (notFound) return <div className="admin-meta">Клиент не найден</div>;
  if (!c) return <div className="admin-meta">Загрузка…</div>;

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
      toast("Данные клиента сохранены");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      const human: Record<string, string> = {
        PHONE_TAKEN: "Этот телефон уже у другого клиента", PHONE_REQUIRED: "Укажите телефон",
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
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, alignItems: "start" }}>
        <CustomerForm key={rev} initial={initial} mode="edit" saving={saving}
                      onSubmit={save} onCancel={() => router.push("/admin/customers")} />

        <div className="admin-panel">
          <div className="admin-panel-head">
            <div className="admin-panel-title">Сводка</div>
            <span className={`admin-pill ${SEGMENT_PILL[segKey] ?? ""}`} style={{ fontWeight: 700 }}>{segLabel}</span>
          </div>
          <div className="admin-panel-body">
            {segNote && <p className="admin-meta" style={{ marginBottom: 12 }}>{segNote}</p>}
            <div className="kbju-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              <Kpi label="Потрачено" value={money(s.totalSpent ?? 0)} sub="LTV" />
              <Kpi label="Заказов" value={s.paidOrders ?? 0}
                   sub={s.refundedOrders ? `${s.refundedOrders} возврат(ов)` : "оплачено"} />
              <Kpi label="Средний чек" value={money(s.avgOrderValue ?? 0)} />
              <Kpi label="Частота" value={`${s.ordersPerMonth ?? 0}/мес`}
                   sub={s.avgDaysBetween ? `~${s.avgDaysBetween} дн.` : undefined} />
              <Kpi label="Последний" value={recencyText(s.recencyDays)} />
              <Kpi label="Оценки"
                   value={s.ratedOrders ? `${Math.round((s.satisfaction ?? 0) * 100)}%` : "—"}
                   sub={s.ratedOrders ? `👍${s.likes} · 👎${s.dislikes}` : "нет оценок"} />
            </div>
            {personaTags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                {personaTags.map((t) => <span key={t} className="admin-badge">{t}</span>)}
              </div>
            )}
            <div className="admin-meta" style={{ marginTop: 12, display: "flex", gap: 14, flexWrap: "wrap" }}>
              <span>Первый заказ: <strong>{fmtDate(s.firstOrderAt)}</strong></span>
              <span>Корзина: <strong>{s.avgBasket ?? 0}</strong> поз.</span>
              <span>Макс. чек: <strong>{money(s.biggestOrder ?? 0)}</strong></span>
              <span>Купоны: <strong>{s.couponsActive ?? 0}</strong> актив. / {s.couponsIssued ?? 0} всего</span>
              <span>Скидок получено: <strong>{money(s.discountTotal ?? 0)}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* строка 2: RFM / Отток / CLV */}
      {hasPurchases && (rfm || churn || clv) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, alignItems: "start" }}>
          <div className="admin-panel">
            <div className="admin-panel-head">
              <div className="admin-panel-title">RFM-профиль</div>
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
                    Сегмент: <strong>{SEGMENT_LABEL[rfm.segment] ?? rfm.segment}</strong>
                  </p>
                </>
              ) : <span className="admin-meta">—</span>}
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head">
              <div className="admin-panel-title">Риск оттока</div>
              {churn && (
                <span className={`admin-pill ${RISK_PILL[churn.risk]?.cls ?? ""}`} style={{ fontWeight: 700 }}>
                  {RISK_PILL[churn.risk]?.label ?? churn.risk}
                </span>
              )}
            </div>
            <div className="admin-panel-body">
              {churn ? (
                <div className="kbju-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <Kpi label="Вероятность" value={`${Math.round((churn.probability ?? 0) * 100)}%`} />
                  <Kpi label="След. заказ"
                       value={churn.expectedNextOrderInDays == null ? "—" : `~${churn.expectedNextOrderInDays} дн.`}
                       sub="ожидаемо" />
                  <Kpi label="Просрочка"
                       value={churn.daysOverdue == null ? "—" : `${churn.daysOverdue} дн.`}
                       sub={churn.daysOverdue && churn.daysOverdue > 0 ? "сверх обычного" : "в норме"} />
                  <Kpi label="Давность" value={recencyText(s.recencyDays)} />
                </div>
              ) : <span className="admin-meta">—</span>}
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head">
              <div className="admin-panel-title">CLV</div>
              <span className="admin-meta">прогноз {clv?.horizonMonths ?? 12} мес.</span>
            </div>
            <div className="admin-panel-body">
              {clv ? (
                <div className="kbju-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <Kpi label="Историческая" value={money(clv.historical ?? 0)} sub="фактический LTV" />
                  <Kpi label="Прогнозная" value={money(clv.predicted ?? 0)} sub="на 12 мес." />
                </div>
              ) : <span className="admin-meta">—</span>}
            </div>
          </div>
        </div>
      )}

      {/* строка 3: динамика по месяцам + heatmap дни×часы */}
      {hasPurchases && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
          <div className="admin-panel">
            <div className="admin-panel-head"><div className="admin-panel-title">Динамика за 12 мес.</div></div>
            <div className="admin-panel-body">
              <MonthlyTrendChart data={monthly} />
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head">
              <div className="admin-panel-title">Когда заказывает</div>
              {s.peakWeekday != null && (
                <span className="admin-meta">
                  пик — {WEEKDAYS[s.peakWeekday]}
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, alignItems: "start" }}>
          <div className="admin-panel">
            <div className="admin-panel-head"><div className="admin-panel-title">Любимые напитки</div></div>
            <div className="admin-panel-body">
              <HorizontalBars data={drinkBars} suffix=" шт" height={Math.max(160, drinkBars.length * 34 + 16)} />
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head"><div className="admin-panel-title">Любимые добавки</div></div>
            <div className="admin-panel-body">
              <HorizontalBars data={addonBars} suffix=" порц." color="#8E97F0"
                              height={Math.max(160, addonBars.length * 34 + 16)} />
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head"><div className="admin-panel-title">Объёмы</div></div>
            <div className="admin-panel-body">
              <SizeMixDonut data={sizeMix} />
            </div>
          </div>
        </div>
      )}

      {/* строка 5: время обслуживания + предпочтения по менеджерам */}
      {hasPurchases && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
          <div className="admin-panel">
            <div className="admin-panel-head">
              <div className="admin-panel-title">Время обслуживания</div>
              {svc.samples ? <span className="admin-meta">{svc.samples} замер(ов)</span> : null}
            </div>
            <div className="admin-panel-body">
              <ServiceTimeChart prepMin={svc.avgPrepMin ?? null}
                                pickupMin={svc.avgPickupMin ?? null}
                                totalMin={svc.avgTotalMin ?? null} />
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head"><div className="admin-panel-title">Кто обслуживал</div></div>
            <div className="admin-panel-body">
              <HorizontalBars data={mgrBars} suffix=" зак." color="#22A06B"
                              height={Math.max(160, mgrBars.length * 34 + 16)} />
            </div>
          </div>
        </div>
      )}

      {/* строка 6: история заказов */}
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">История заказов</div>
          <span className="admin-meta">{c.orders.length}</span>
        </div>
        {c.orders.length === 0 ? (
          <div className="admin-panel-body"><span className="admin-meta">Заказов пока нет</span></div>
        ) : (
          <div className="admin-tablewrap"><table className="admin-table">
            <thead>
              <tr><th>№</th><th>Дата и время</th><th>Состав</th><th>Сумма</th>
                  <th>Оплата</th><th>Статус</th><th>Оценка</th></tr>
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
                      {o.items.length > 3 && <div className="admin-meta">+{o.items.length - 3} ещё</div>}
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
          <div className="admin-mono admin-meta">#{c.id} · регистрация {fmtDate(c.createdAt)}</div>
        </div>
      </div>
    </div>
  );
}

export default function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AdminShell title="Клиент"
                crumbs={[{ label: "Клиенты", href: "/admin/customers" }, { label: `#${id}` }]}>
      <EditCustomerInner id={Number(id)} />
    </AdminShell>
  );
}
