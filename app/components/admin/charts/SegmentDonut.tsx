"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export type SegmentDonutDatum = {
  label: string;
  count: number;
  key: string;
};

export type SegmentDonutProps = {
  data: SegmentDonutDatum[];
};

/* Distinct palette anchored on the admin accent (#4A56E2) and warm-muted (#EFEAE0). */
const PALETTE = [
  "#4A56E2", // accent — champions
  "#22A06B", // green — loyal
  "#3BA7C4", // cyan — potential loyalist
  "#8B5CF6", // violet — new
  "#0EA5E9", // sky — promising
  "#F2A93B", // amber — need attention
  "#EF7C3B", // orange — at risk
  "#C77DD6", // mauve — hibernating
  "#E5484D", // red — lost
  "#A7AEC0", // grey — no purchase
];

function colorFor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

const INK = "#0E0E10";
const INK_SOFT = "#6B7280";
const MUTED = "#EFEAE0";

function fmtInt(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n || 0));
}

function DonutTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ payload: SegmentDonutDatum & { __color: string } }>;
  total: number;
}) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const share = total > 0 ? Math.round((d.count / total) * 100) : 0;
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E8E2D5",
        borderRadius: 10,
        padding: "8px 10px",
        boxShadow: "0 6px 20px rgba(14,14,16,0.08)",
        fontSize: 12.5,
        color: INK,
        lineHeight: 1.45,
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700 }}>
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 3,
            background: d.__color,
            display: "inline-block",
          }}
        />
        {d.label}
      </div>
      <div style={{ color: INK_SOFT, marginTop: 2 }}>
        {fmtInt(d.count)} · {share}%
      </div>
    </div>
  );
}

export function SegmentDonut(props: SegmentDonutProps) {
  const raw = Array.isArray(props.data) ? props.data : [];
  const data = raw
    .filter((d) => d && Number(d.count) > 0)
    .map((d, i) => ({
      label: d.label,
      key: d.key,
      count: Number(d.count) || 0,
      __color: colorFor(i),
    }));

  const total = data.reduce((acc, d) => acc + d.count, 0);

  if (!data.length || total <= 0) {
    return (
      <div
        style={{
          height: 240,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: INK_SOFT,
          fontSize: 13,
        }}>
        Нет данных
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
      <div style={{ position: "relative", width: 240, height: 240, flex: "0 0 auto" }}>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={66}
              outerRadius={96}
              paddingAngle={1.5}
              stroke="#FFFFFF"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.key} fill={d.__color} />
              ))}
            </Pie>
            <Tooltip
              content={<DonutTooltip total={total} />}
              cursor={false}
              wrapperStyle={{ outline: "none" }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center total overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: INK,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}>
            {fmtInt(total)}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: INK_SOFT,
              marginTop: 4,
              textTransform: "uppercase",
              letterSpacing: 0.6,
            }}>
            всего
          </div>
        </div>
      </div>

      {/* Legend with counts */}
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          flex: "1 1 180px",
          minWidth: 180,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}>
        {data.map((d) => {
          const share = total > 0 ? Math.round((d.count / total) * 100) : 0;
          return (
            <li
              key={d.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: INK,
              }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: d.__color,
                  flex: "0 0 auto",
                }}
              />
              <span
                style={{
                  flex: "1 1 auto",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                {d.label}
              </span>
              <span
                style={{
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 700,
                  color: INK,
                }}>
                {fmtInt(d.count)}
              </span>
              <span
                style={{
                  fontVariantNumeric: "tabular-nums",
                  color: INK_SOFT,
                  width: 38,
                  textAlign: "right",
                  background: MUTED,
                  borderRadius: 6,
                  padding: "1px 0",
                  fontSize: 11.5,
                }}>
                {share}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default SegmentDonut;
