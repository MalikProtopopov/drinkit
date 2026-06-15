"use client";

import {
  Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis,
} from "recharts";

const ACCENT = "#4A56E2";
const PEAK = "#2A43C2";

/** Почасовое распределение заказов (0–23). Пиковый час подсвечен, значения подписаны. */
export function HourlyOrdersChart({ byHour }: { byHour: Record<string, number> }) {
  const data = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: byHour?.[String(h)] ?? 0 }));
  const total = data.reduce((s, d) => s + d.orders, 0);
  const peak = total > 0 ? data.reduce((a, b) => (b.orders > a.orders ? b : a)).hour : -1;

  if (total === 0) {
    return (
      <div className="admin-meta" style={{ height: 190, display: "grid", placeItems: "center" }}>
        Нет заказов за период
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart data={data} margin={{ top: 18, right: 6, left: 6, bottom: 0 }} barCategoryGap="18%">
        <XAxis
          dataKey="hour" interval={0} ticks={[0, 3, 6, 9, 12, 15, 18, 21]}
          tickLine={false} axisLine={{ stroke: "#E7E4D9" }}
          tickFormatter={(h) => `${String(h).padStart(2, "0")}`}
          tick={{ fontSize: 11, fill: "#8A8F9C" }}
        />
        <Tooltip
          cursor={{ fill: "rgba(74,86,226,0.07)" }}
          labelFormatter={(h) => `${String(h).padStart(2, "0")}:00`}
          formatter={(v: unknown) => [`${v}`, "Заказов"] as [string, string]}
          contentStyle={{ borderRadius: 10, border: "1px solid #E8E2D5", fontSize: 12, padding: "6px 10px" }}
        />
        <Bar dataKey="orders" radius={[4, 4, 0, 0]} maxBarSize={26}>
          <LabelList
            dataKey="orders" position="top"
            formatter={(v: unknown) => (v ? String(v) : "")}
            style={{ fontSize: 10, fontWeight: 700, fill: "#5A6172" }}
          />
          {data.map((d) => (
            <Cell key={d.hour} fill={d.hour === peak ? PEAK : ACCENT} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
