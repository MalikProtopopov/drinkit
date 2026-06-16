"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminApi, adminOrdersWs, qs } from "@/lib/adminApi";
import { useLiveReload } from "@/lib/useLiveReload";
import { ExportButton } from "@/components/admin/ExportButton";
import { OutletFilter } from "@/components/admin/OutletFilter";
import { Stat } from "@/components/admin/Stat";
import { HourlyOrdersChart } from "@/components/admin/charts/HourlyOrdersChart";
import { WeekdayHourHeatmap } from "@/components/admin/charts/WeekdayHourHeatmap";
import { SizeMixDonut } from "@/components/admin/charts/SizeMixDonut";
import { ServiceTimeChart } from "@/components/admin/charts/ServiceTimeChart";
import { HorizontalBars } from "@/components/admin/charts/HorizontalBars";

const PERIODS = [
  { key: "all", label: "All time", from: undefined },
  { key: "today", label: "Today", from: () => new Date(new Date().setHours(0, 0, 0, 0)) },
  { key: "7d", label: "7 days", from: () => new Date(Date.now() - 7 * 864e5) },
  { key: "30d", label: "30 days", from: () => new Date(Date.now() - 30 * 864e5) },
] as const;

function DashboardInner() {
  const router = useRouter();
  const [period, setPeriod] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [outlet, setOutlet] = useState<number | "all">("all");
  const [topExpanded, setTopExpanded] = useState(false);
  const [data, setData] = useState<any>(null);

  const load = useCallback(() => {
    let from: string | undefined;
    let to: string | undefined;
    if (period === "custom") {
      // свой период: даты «от/до» (включительно по дню), в локальном времени
      // A2: границы считаем в TZ точки (Dubai = UTC+4, без DST), а не в браузерной —
      // иначе выбранный день съезжает на ±4ч у пользователей в другом часовом поясе.
      from = customFrom ? new Date(`${customFrom}T00:00:00+04:00`).toISOString() : undefined;
      to = customTo ? new Date(`${customTo}T23:59:59.999+04:00`).toISOString() : undefined;
    } else {
      const p = PERIODS.find((x) => x.key === period)!;
      from = typeof p.from === "function" ? p.from().toISOString() : undefined;
    }
    adminApi.dashboard(from, to, outlet === "all" ? undefined : outlet).then(setData).catch(() => {});
  }, [period, customFrom, customTo, outlet]);
  useEffect(() => { load(); }, [load]);
  // realtime: метрики/аналитика обновляются по событиям заказов — без поллинга и кнопки «Обновить»
  useLiveReload({ connect: adminOrdersWs, onMessage: () => load(), onSync: () => load() });

  // выгрузка дашборда тем же периодом/точкой, что и на экране (сводка + метрики по дням)
  const exportPath = useMemo(() => {
    let from: string | undefined;
    let to: string | undefined;
    if (period === "custom") {
      // A2: границы считаем в TZ точки (Dubai = UTC+4, без DST), а не в браузерной —
      // иначе выбранный день съезжает на ±4ч у пользователей в другом часовом поясе.
      from = customFrom ? new Date(`${customFrom}T00:00:00+04:00`).toISOString() : undefined;
      to = customTo ? new Date(`${customTo}T23:59:59.999+04:00`).toISOString() : undefined;
    } else {
      const p = PERIODS.find((x) => x.key === period)!;
      from = typeof p.from === "function" ? p.from().toISOString() : undefined;
    }
    return `/api/admin/exports/dashboard.xlsx${qs({ from, to, outlet_id: outlet === "all" ? undefined : outlet })}`;
  }, [period, customFrom, customTo, outlet]);

  if (!data) return <div className="admin-meta">Loading…</div>;

  const peakHour = Object.entries(data.ordersByHour as Record<string, number>)
    .sort((a, b) => b[1] - a[1])[0];

  return (
    <>
      {/* фильтр по периоду (ADM-S-10): пресеты + свой период от/до */}
      <div className="admin-filter-row" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "#FFF", borderRadius: 999 }}>
          {PERIODS.map((p) => (
            <button key={p.key} className="admin-btn sm" onClick={() => setPeriod(p.key)}
                    style={period === p.key ? { background: "#4A56E2", color: "#FFF" } : { background: "transparent" }}>
              {p.label}
            </button>
          ))}
          <button className="admin-btn sm" onClick={() => setPeriod("custom")}
                  style={period === "custom" ? { background: "#4A56E2", color: "#FFF" } : { background: "transparent" }}>
            Custom range
          </button>
        </div>

        {period === "custom" && (
          <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            <span className="admin-meta">from</span>
            <input type="date" lang="en-GB" className="admin-input" value={customFrom} max={customTo || undefined}
                   onChange={(e) => setCustomFrom(e.target.value)} style={{ width: 160 }} />
            <span className="admin-meta">to</span>
            <input type="date" lang="en-GB" className="admin-input" value={customTo} min={customFrom || undefined}
                   onChange={(e) => setCustomTo(e.target.value)} style={{ width: 160 }} />
          </div>
        )}

        {/* фильтр по точке (сводно по всем или по одной — для сравнения) */}
        <OutletFilter value={outlet} onChange={setOutlet} />

        <div style={{ marginLeft: "auto" }}>
          <ExportButton path={exportPath} filename="dashboard.xlsx" label="Export dashboard" />
        </div>
      </div>

      <div className="admin-grid-4">
        <Stat label="Revenue, AED" value={data.revenue.toFixed(0)} delta={data.deltas?.revenue} />
        <Stat label="Sales (orders)" value={data.ordersCount} delta={data.deltas?.ordersCount} />
        <Stat label="Drinks sold" value={data.drinksSold} delta={data.deltas?.drinksSold} />
        <Stat label="Avg. order, AED" value={data.avgOrderValue.toFixed(2)} delta={data.deltas?.avgOrderValue} />
      </div>
      <div className="admin-grid-4" style={{ marginTop: 12 }}>
        <Stat label="Avg. drinks/order" value={data.avgDrinksPerOrder} />
        <Stat label="Peak hour" value={peakHour && Number(peakHour[1]) > 0 ? `${peakHour[0]}:00 (${peakHour[1]})` : "—"} />
        <Stat label="Customers with orders" value={data.topCustomers.length} />
        <Stat label="Top products" value={data.topProducts.length} />
      </div>

      <div className="admin-split" style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="admin-panel">
          <div className="admin-panel-head">
            <div className="admin-panel-title">Orders by hour</div>
            <span className="admin-meta">
              {peakHour && Number(peakHour[1]) > 0
                ? `peak ${String(peakHour[0]).padStart(2, "0")}:00 · ${peakHour[1]} orders`
                : "no data"}
            </span>
          </div>
          <div className="admin-panel-body">
            <HourlyOrdersChart byHour={data.ordersByHour as Record<string, number>} />
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head">
            <div className="admin-panel-title">Top revenue by product</div>
            <span className="admin-meta">{data.topProducts.length} items</span>
          </div>
          <div className="admin-tablewrap"><table className="admin-table">
            <thead><tr><th>Drink</th><th>Qty</th><th>Revenue</th></tr></thead>
            <tbody>
              {(topExpanded ? data.topProducts : data.topProducts.slice(0, 6)).map((p: any) => (
                <tr key={p.name} className={p.slug ? "admin-row-link" : undefined}
                    onClick={() => p.slug && router.push(`/admin/catalog/products/${p.slug}`)}
                    style={p.slug ? { cursor: "pointer" } : undefined}>
                  <td><strong>{p.name}</strong>{p.slug && <span className="admin-meta" style={{ marginLeft: 6 }}>→</span>}</td>
                  <td className="admin-num">{p.qty}</td>
                  <td className="admin-num">{p.revenue.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          {data.topProducts.length > 6 && (
            <div className="admin-panel-body" style={{ textAlign: "center" }}>
              <button className="admin-btn ghost sm" onClick={() => setTopExpanded((v) => !v)}>
                {topExpanded ? "Collapse list" : `Show all (${data.topProducts.length})`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* пиковые часы (день×час) + распределение размеров — бизнес-уровень */}
      <div className="admin-split" style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="admin-panel">
          <div className="admin-panel-head"><div className="admin-panel-title">Peak times (day × hour)</div></div>
          <div className="admin-panel-body"><WeekdayHourHeatmap matrix={data.weekdayHourMatrix} /></div>
        </div>
        <div className="admin-panel">
          <div className="admin-panel-head"><div className="admin-panel-title">Sizes</div></div>
          <div className="admin-panel-body"><SizeMixDonut data={data.sizeMix} /></div>
        </div>
      </div>

      {/* время обслуживания + популярные добавки (конструктор) */}
      <div className="admin-split" style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="admin-panel">
          <div className="admin-panel-head">
            <div className="admin-panel-title">Service time</div>
            <span className="admin-meta">{data.serviceTime?.samples ? `${data.serviceTime.samples} order(s)` : "no data"}</span>
          </div>
          <div className="admin-panel-body">
            <ServiceTimeChart prepMin={data.serviceTime?.prepMin ?? null}
                              pickupMin={data.serviceTime?.pickupMin ?? null}
                              totalMin={data.serviceTime?.totalMin ?? null} />
          </div>
        </div>
        <div className="admin-panel">
          <div className="admin-panel-head">
            <div className="admin-panel-title">Popular add-ons</div>
            <span className="admin-meta">avg {data.avgAddons} / drink</span>
          </div>
          <div className="admin-panel-body">
            {data.topAddons.length ? (
              <HorizontalBars data={data.topAddons.map((a: any) => ({ label: a.name, value: a.qty }))}
                              suffix=" servings" color="#8E97F0"
                              height={Math.max(160, data.topAddons.length * 34 + 16)} />
            ) : <span className="admin-meta">No add-on data yet</span>}
          </div>
        </div>
      </div>

      {/* аффинити: какие добавки берут вместе в одном напитке (market basket) */}
      <div className="admin-panel" style={{ marginTop: 16 }}>
        <div className="admin-panel-head">
          <div className="admin-panel-title">Add-ons ordered together</div>
          <span className="admin-meta">which add-ons pair up in one drink</span>
        </div>
        {data.affinity.length ? (
          <div className="admin-tablewrap"><table className="admin-table">
            <thead><tr><th>Add-on A</th><th>Add-on B</th><th>Together (drinks)</th></tr></thead>
            <tbody>
              {data.affinity.map((p: any, i: number) => (
                <tr key={i}><td><strong>{p.a}</strong></td><td><strong>{p.b}</strong></td>
                  <td className="admin-num">{p.count}</td></tr>
              ))}
            </tbody>
          </table></div>
        ) : <div className="admin-panel-body admin-meta">Not enough data yet — pairs appear once drinks share add-ons.</div>}
      </div>

      <div className="admin-panel" style={{ marginTop: 16 }}>
        <div className="admin-panel-head">
          <div className="admin-panel-title">Customers: who, how often, how much</div>
          <Link href="/admin/customers" className="admin-btn ghost sm">All customers →</Link>
        </div>
        <div className="admin-tablewrap"><table className="admin-table">
          <thead><tr><th>Customer</th><th>Phone</th><th>Orders</th><th>Amount</th><th>Last order</th></tr></thead>
          <tbody>
            {data.topCustomers.map((c: any) => (
              <tr key={c.userId}>
                <td><strong>{c.name ?? "—"}</strong></td>
                <td className="admin-mono admin-meta">{c.phone}</td>
                <td className="admin-num">{c.orders}</td>
                <td className="admin-num">{c.spent.toFixed(2)}</td>
                <td className="admin-meta">{c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleString("en-GB") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </>
  );
}


export default function AdminDashboard() {
  return (
    <AdminShell title="Dashboard">
      <DashboardInner />
    </AdminShell>
  );
}
