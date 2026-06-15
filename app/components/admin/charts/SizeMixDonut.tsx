"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

type SizeMixDatum = { size: string; qty: number; share: number };

export function SizeMixDonut({ data }: { data: SizeMixDatum[] }) {
  // Accent #4A56E2 anchors the palette; muted #EFEAE0 fills any extra slices.
  const PALETTE = ["#4A56E2", "#7B84EC", "#A6ABF2", "#C9CCF7", "#E3E4FB", "#EFEAE0"];
  const rows = (data || []).filter((d) => d && d.qty > 0);
  const totalQty = rows.reduce((s, d) => s + d.qty, 0);

  const colorFor = (i: number) => PALETTE[i % PALETTE.length];
  const pct = (d: SizeMixDatum) =>
    typeof d.share === "number"
      ? Math.round(d.share * 100)
      : totalQty
        ? Math.round((d.qty / totalQty) * 100)
        : 0;

  if (rows.length === 0) {
    return (
      <div
        style={{
          height: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#9A938A",
          fontSize: 13,
        }}
      >
        No data
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={rows}
            dataKey="qty"
            nameKey="size"
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={80}
            paddingAngle={2}
            stroke="none"
          >
            {rows.map((d, i) => (
              <Cell key={d.size} fill={colorFor(i)} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: unknown, name: unknown, entry: any) => {
              const p = entry && entry.payload ? pct(entry.payload) : 0;
              return [`${value} (${p}%)`, String(name ?? "")] as [string, string];
            }}
            contentStyle={{
              border: "1px solid #EFEAE0",
              borderRadius: 10,
              fontSize: 12,
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      <ul
        style={{
          listStyle: "none",
          margin: "8px 0 0",
          padding: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: "6px 16px",
        }}
      >
        {rows.map((d, i) => (
          <li
            key={d.size}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 3,
                background: colorFor(i),
                flex: "0 0 auto",
              }}
            />
            <span style={{ fontWeight: 600 }}>{d.size}</span>
            <span style={{ color: "#9A938A" }}>
              {d.qty} · {pct(d)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
