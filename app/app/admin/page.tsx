"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminApi } from "@/lib/adminApi";
import { Stat } from "@/components/admin/Stat";
import { HourlyOrdersChart } from "@/components/admin/charts/HourlyOrdersChart";

const PERIODS = [
  { key: "all", label: "Всё время", from: undefined },
  { key: "today", label: "Сегодня", from: () => new Date(new Date().setHours(0, 0, 0, 0)) },
  { key: "7d", label: "7 дней", from: () => new Date(Date.now() - 7 * 864e5) },
  { key: "30d", label: "30 дней", from: () => new Date(Date.now() - 30 * 864e5) },
] as const;

function DashboardInner() {
  const router = useRouter();
  const [period, setPeriod] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [topExpanded, setTopExpanded] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let from: string | undefined;
    let to: string | undefined;
    if (period === "custom") {
      // свой период: даты «от/до» (включительно по дню), в локальном времени
      from = customFrom ? new Date(`${customFrom}T00:00:00`).toISOString() : undefined;
      to = customTo ? new Date(`${customTo}T23:59:59`).toISOString() : undefined;
    } else {
      const p = PERIODS.find((x) => x.key === period)!;
      from = typeof p.from === "function" ? p.from().toISOString() : undefined;
    }
    adminApi.dashboard(from, to).then(setData).catch(() => {});
  }, [period, customFrom, customTo]);

  if (!data) return <div className="admin-meta">Загрузка…</div>;

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
            Свой период
          </button>
        </div>

        {period === "custom" && (
          <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            <span className="admin-meta">от</span>
            <input type="date" className="admin-input" value={customFrom} max={customTo || undefined}
                   onChange={(e) => setCustomFrom(e.target.value)} style={{ width: 160 }} />
            <span className="admin-meta">до</span>
            <input type="date" className="admin-input" value={customTo} min={customFrom || undefined}
                   onChange={(e) => setCustomTo(e.target.value)} style={{ width: 160 }} />
          </div>
        )}
      </div>

      <div className="admin-grid-4">
        <Stat label="Выручка, AED" value={data.revenue.toFixed(0)} />
        <Stat label="Продаж (чеков)" value={data.ordersCount} />
        <Stat label="Напитков продано" value={data.drinksSold} />
        <Stat label="Средний чек, AED" value={data.avgOrderValue.toFixed(2)} />
      </div>
      <div className="admin-grid-4" style={{ marginTop: 12 }}>
        <Stat label="Напитков в чеке (среднее)" value={data.avgDrinksPerOrder} />
        <Stat label="Пиковый час" value={peakHour ? `${peakHour[0]}:00 (${peakHour[1]})` : "—"} />
        <Stat label="Клиентов с заказами" value={data.topCustomers.length} />
        <Stat label="Топ-продуктов" value={data.topProducts.length} />
      </div>

      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="admin-panel">
          <div className="admin-panel-head">
            <div className="admin-panel-title">Время заказов по часам</div>
            <span className="admin-meta">
              {peakHour && Number(peakHour[1]) > 0
                ? `пик ${String(peakHour[0]).padStart(2, "0")}:00 · ${peakHour[1]} зак.`
                : "нет данных"}
            </span>
          </div>
          <div className="admin-panel-body">
            <HourlyOrdersChart byHour={data.ordersByHour as Record<string, number>} />
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head">
            <div className="admin-panel-title">Top revenue by product</div>
            <span className="admin-meta">{data.topProducts.length} поз.</span>
          </div>
          <div className="admin-tablewrap"><table className="admin-table">
            <thead><tr><th>Напиток</th><th>Шт</th><th>Выручка</th></tr></thead>
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
                {topExpanded ? "Свернуть список" : `Раскрыть список (${data.topProducts.length})`}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="admin-panel" style={{ marginTop: 16 }}>
        <div className="admin-panel-head">
          <div className="admin-panel-title">Клиенты: кто, сколько раз, на какие суммы</div>
          <Link href="/admin/customers" className="admin-btn ghost sm">Все клиенты →</Link>
        </div>
        <div className="admin-tablewrap"><table className="admin-table">
          <thead><tr><th>Клиент</th><th>Телефон</th><th>Заказов</th><th>Сумма</th><th>Последний заказ</th></tr></thead>
          <tbody>
            {data.topCustomers.map((c: any) => (
              <tr key={c.userId}>
                <td><strong>{c.name ?? "—"}</strong></td>
                <td className="admin-mono admin-meta">{c.phone}</td>
                <td className="admin-num">{c.orders}</td>
                <td className="admin-num">{c.spent.toFixed(2)}</td>
                <td className="admin-meta">{c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleString("ru-RU") : "—"}</td>
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
    <AdminShell title="Дашборд">
      <DashboardInner />
    </AdminShell>
  );
}
