"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminApi } from "@/lib/adminApi";

const PERIODS = [
  { key: "all", label: "Всё время", from: undefined },
  { key: "today", label: "Сегодня", from: () => new Date(new Date().setHours(0, 0, 0, 0)) },
  { key: "7d", label: "7 дней", from: () => new Date(Date.now() - 7 * 864e5) },
  { key: "30d", label: "30 дней", from: () => new Date(Date.now() - 30 * 864e5) },
] as const;

function DashboardInner() {
  const [period, setPeriod] = useState<string>("all");
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const p = PERIODS.find((x) => x.key === period)!;
    const from = typeof p.from === "function" ? p.from().toISOString() : undefined;
    adminApi.dashboard(from).then(setData).catch(() => {});
  }, [period]);

  if (!data) return <div className="admin-meta">Загрузка…</div>;

  const peakHour = Object.entries(data.ordersByHour as Record<string, number>)
    .sort((a, b) => b[1] - a[1])[0];
  const maxHour = Math.max(1, ...Object.values(data.ordersByHour as Record<string, number>));

  return (
    <>
      {/* фильтр по периоду (ADM-S-10) */}
      <div className="admin-filter-row">
        <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "#FFF", borderRadius: 999 }}>
          {PERIODS.map((p) => (
            <button key={p.key} className="admin-btn sm" onClick={() => setPeriod(p.key)}
                    style={period === p.key ? { background: "#4A56E2", color: "#FFF" } : { background: "transparent" }}>
              {p.label}
            </button>
          ))}
        </div>
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
          <div className="admin-panel-head"><div className="admin-panel-title">Время заказов (пики)</div></div>
          <div className="admin-panel-body" style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 140 }}>
            {Object.entries(data.ordersByHour as Record<string, number>).map(([h, n]) => (
              <div key={h} title={`${h}:00 — ${n}`} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ height: `${(n / maxHour) * 100}px`, background: n ? "#4A56E2" : "#EFEDE3", borderRadius: 3 }} />
                {Number(h) % 6 === 0 && <div style={{ fontSize: 9, color: "#8A8F9C", marginTop: 2 }}>{h}</div>}
              </div>
            ))}
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head">
            <div className="admin-panel-title">Top revenue by product</div>
          </div>
          <table className="admin-table">
            <thead><tr><th>Напиток</th><th>Шт</th><th>Выручка</th></tr></thead>
            <tbody>
              {data.topProducts.map((p: any) => (
                <tr key={p.name}>
                  <td><strong>{p.name}</strong></td>
                  <td className="admin-num">{p.qty}</td>
                  <td className="admin-num">{p.revenue.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-panel" style={{ marginTop: 16 }}>
        <div className="admin-panel-head">
          <div className="admin-panel-title">Клиенты: кто, сколько раз, на какие суммы</div>
          <Link href="/admin/customers" className="admin-btn ghost sm">Все клиенты →</Link>
        </div>
        <table className="admin-table">
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
        </table>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="admin-stat">
      <div className="admin-stat-label">{label}</div>
      <div className="admin-stat-value">{value}</div>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <AdminShell title="Дашборд">
      <DashboardInner />
    </AdminShell>
  );
}
