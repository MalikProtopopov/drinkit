"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type MonthlyPoint = {
  month: string;
  orders: number;
  revenue: number;
};

type MonthlyTrendChartProps = {
  data: MonthlyPoint[];
};

const ACCENT = "#4A56E2";
const BAR = "#9AA0F0";
const MUTED = "#EFEAE0";
const AXIS = "#8A8F9C";

function fmtMonth(m: string): string {
  // "YYYY-MM" -> "MM.YY"
  if (typeof m !== "string") return "";
  const parts = m.split("-");
  if (parts.length < 2) return m;
  const [y, mo] = parts;
  return `${mo}.${y.slice(2)}`;
}

function fmtAed(v: number): string {
  const r = Math.round(Number(v) || 0);
  return `${r.toLocaleString("ru-RU")} AED`;
}

function TrendTooltip(props: any) {
  const { active, payload, label } = props;
  if (!active || !payload || !payload.length) return null;
  const row = (payload[0] && payload[0].payload) || {};
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${MUTED}`,
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 12,
        boxShadow: "0 4px 16px rgba(31,35,48,0.08)",
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontWeight: 600, color: "#1F2330", marginBottom: 4 }}>{fmtMonth(label)}</div>
      <div style={{ color: AXIS }}>
        Заказы: <span style={{ color: "#1F2330", fontWeight: 600 }}>{Math.round(row.orders || 0)}</span>
      </div>
      <div style={{ color: AXIS }}>
        Выручка: <span style={{ color: ACCENT, fontWeight: 600 }}>{fmtAed(row.revenue || 0)}</span>
      </div>
    </div>
  );
}

export function MonthlyTrendChart(props: MonthlyTrendChartProps) {
  const data = Array.isArray(props.data) ? props.data : [];

  const hasData = data.some((d) => (d.orders || 0) > 0 || (d.revenue || 0) > 0);

  if (!hasData) {
    return (
      <div
        style={{
          height: 220,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: AXIS,
          fontSize: 13,
        }}
      >
        нет данных
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
        <CartesianGrid stroke={MUTED} vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={fmtMonth}
          axisLine={false}
          tickLine={false}
          tick={{ fill: AXIS, fontSize: 11 }}
          interval="preserveStartEnd"
        />
        <YAxis
          yAxisId="orders"
          axisLine={false}
          tickLine={false}
          tick={{ fill: AXIS, fontSize: 11 }}
          allowDecimals={false}
          width={32}
        />
        <YAxis
          yAxisId="revenue"
          orientation="right"
          axisLine={false}
          tickLine={false}
          tick={{ fill: AXIS, fontSize: 11 }}
          tickFormatter={(v: number) => (Math.round(Number(v) || 0)).toLocaleString("ru-RU")}
          width={48}
        />
        <Tooltip content={<TrendTooltip />} cursor={{ fill: "rgba(154,160,240,0.12)" }} />
        <Bar
          yAxisId="orders"
          dataKey="orders"
          name="Заказы"
          fill={BAR}
          radius={[3, 3, 0, 0]}
          maxBarSize={28}
          isAnimationActive={false}
        />
        <Line
          yAxisId="revenue"
          type="monotone"
          dataKey="revenue"
          name="Выручка"
          stroke={ACCENT}
          strokeWidth={2}
          dot={{ r: 2.5, fill: ACCENT, strokeWidth: 0 }}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
