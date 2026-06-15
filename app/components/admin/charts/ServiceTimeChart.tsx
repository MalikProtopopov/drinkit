"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";

type ServiceTimeChartProps = {
  prepMin: number | null;
  pickupMin: number | null;
  totalMin: number | null;
};

const ACCENT = "#4A56E2";
const MUTED = "#EFEAE0";
const AXIS = "#8A8F9C";

function fmtMin(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const r = Math.round(v * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1)} мин`;
}

export function ServiceTimeChart(props: ServiceTimeChartProps) {
  const { prepMin, pickupMin, totalMin } = props;

  const rows = [
    { key: "prep", label: "Готовка", value: prepMin, color: ACCENT },
    { key: "pickup", label: "Выдача", value: pickupMin, color: "#8E97F0" },
    { key: "total", label: "Всего", value: totalMin, color: "#C2C7F6" },
  ];

  const hasData = rows.some((r) => r.value !== null && r.value !== undefined && !Number.isNaN(r.value));

  if (!hasData) {
    return (
      <div
        style={{
          height: 160,
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

  const data = rows.map((r) => ({
    name: r.label,
    value: r.value === null || r.value === undefined || Number.isNaN(r.value) ? 0 : r.value,
    raw: r.value,
    color: r.color,
  }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 8 }} barCategoryGap={10}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={64}
          axisLine={false}
          tickLine={false}
          tick={{ fill: AXIS, fontSize: 12 }}
        />
        <Bar dataKey="value" radius={[3, 3, 3, 3]} background={{ fill: MUTED, radius: 3 }} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
          <LabelList
            dataKey="raw"
            position="right"
            formatter={(v: string | number | boolean | null | undefined) =>
              fmtMin(typeof v === "number" ? v : null)
            }
            style={{ fill: "#1F2330", fontSize: 12, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
