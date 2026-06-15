"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type HorizontalBarsDatum = {
  label: string;
  value: number;
};

export type HorizontalBarsProps = {
  data: HorizontalBarsDatum[];
  suffix?: string;
  color?: string;
  height?: number;
};

const ACCENT = "#4A56E2";
const MUTED = "#EFEAE0";
const INK = "#0E0E10";
const INK_SOFT = "#6B7280";
const RULE = "#E8E2D5";

function fmt(value: number, suffix?: string): string {
  const n = Number.isFinite(value) ? Math.round(value) : 0;
  const s = n.toLocaleString("ru-RU");
  return suffix ? `${s}${suffix}` : s;
}

function HBTooltip({
  active,
  payload,
  suffix,
}: {
  active?: boolean;
  payload?: Array<{ payload: HorizontalBarsDatum }>;
  suffix?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${RULE}`,
        borderRadius: 10,
        padding: "8px 10px",
        boxShadow: "0 6px 20px rgba(14,14,16,0.06), 0 1px 2px rgba(14,14,16,0.04)",
        fontSize: 12,
        lineHeight: 1.3,
      }}
    >
      <div style={{ color: INK_SOFT, marginBottom: 2 }}>{d.label}</div>
      <div style={{ color: INK, fontWeight: 600 }}>{fmt(d.value, suffix)}</div>
    </div>
  );
}

export function HorizontalBars(props: HorizontalBarsProps) {
  const { data, suffix, color = ACCENT, height = 240 } = props;
  const rows = Array.isArray(data) ? data : [];

  if (rows.length === 0) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: INK_SOFT,
          fontSize: 13,
        }}
      >
        Нет данных
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        layout="vertical"
        data={rows}
        margin={{ top: 4, right: 48, bottom: 4, left: 8 }}
        barCategoryGap="28%"
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={120}
          tickLine={false}
          axisLine={false}
          tick={{ fill: INK_SOFT, fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: MUTED, opacity: 0.5 }}
          content={<HBTooltip suffix={suffix} />}
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} background={{ fill: MUTED, radius: 6 }}>
          {rows.map((_, i) => (
            <Cell key={i} fill={color} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            formatter={(v: unknown) => fmt(typeof v === "number" ? v : Number(v) || 0, suffix)}
            style={{ fill: INK, fontSize: 12, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
