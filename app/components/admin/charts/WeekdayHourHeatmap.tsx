"use client";

import * as React from "react";
// Recharts is part of the admin chart toolkit; this heatmap is rendered with a
// CSS grid (per spec), so the import is kept available but intentionally unused.
import "recharts";

const ACCENT = "#4A56E2"; // primary-500
const MUTED = "#EFEAE0"; // warm beige (zero value)

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const WEEKDAYS_FULL = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export interface WeekdayHourHeatmapProps {
  /** weekday(0=Mon..6=Sun) × hour(0..23) counts of paid orders */
  matrix: number[][];
}

/** Parse an "#rrggbb" string into [r,g,b]. */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

const MUTED_RGB = hexToRgb(MUTED);
const ACCENT_RGB = hexToRgb(ACCENT);

/** Interpolate from MUTED (t=0) to ACCENT (t=1). */
function cellColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(MUTED_RGB[0] + (ACCENT_RGB[0] - MUTED_RGB[0]) * clamped);
  const g = Math.round(MUTED_RGB[1] + (ACCENT_RGB[1] - MUTED_RGB[1]) * clamped);
  const b = Math.round(MUTED_RGB[2] + (ACCENT_RGB[2] - MUTED_RGB[2]) * clamped);
  return `rgb(${r}, ${g}, ${b})`;
}

export function WeekdayHourHeatmap(props: WeekdayHourHeatmapProps) {
  const { matrix } = props;

  const safeMatrix: number[][] = React.useMemo(() => {
    return Array.from({ length: 7 }, (_, d) =>
      Array.from({ length: 24 }, (_, h) => {
        const v = matrix?.[d]?.[h];
        return typeof v === "number" && Number.isFinite(v) ? v : 0;
      }),
    );
  }, [matrix]);

  const max = React.useMemo(() => {
    let m = 0;
    for (const row of safeMatrix) for (const v of row) if (v > m) m = v;
    return m;
  }, [safeMatrix]);

  const hourLabels = Array.from({ length: 24 }, (_, h) =>
    h % 6 === 0 ? `${h}:00` : "",
  );

  return (
    <div style={{ overflowX: "auto", width: "100%" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "34px repeat(24, minmax(14px, 1fr))",
          gap: 3,
          minWidth: 480,
        }}
      >
        {/* top-left spacer */}
        <div />
        {/* hour labels (every 6h) */}
        {hourLabels.map((label, h) => (
          <div
            key={`hl-${h}`}
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "#6B7280",
              textAlign: "left",
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
              lineHeight: "16px",
            }}
          >
            {label}
          </div>
        ))}

        {/* rows: weekday label + 24 cells */}
        {safeMatrix.map((row, d) => (
          <React.Fragment key={`row-${d}`}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#6B7280",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingRight: 6,
              }}
            >
              {WEEKDAYS[d]}
            </div>
            {row.map((v, h) => {
              const t = max > 0 ? v / max : 0;
              return (
                <div
                  key={`c-${d}-${h}`}
                  title={`${WEEKDAYS_FULL[d]} ${String(h).padStart(2, "0")}:00 — ${v}`}
                  style={{
                    aspectRatio: "1 / 1",
                    minHeight: 14,
                    borderRadius: 4,
                    background: cellColor(t),
                    cursor: "default",
                  }}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* legend */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 12,
          fontSize: 11,
          fontWeight: 600,
          color: "#6B7280",
        }}
      >
        <span>Less</span>
        <div
          style={{
            flex: "0 0 120px",
            height: 8,
            borderRadius: 999,
            background: `linear-gradient(90deg, ${MUTED} 0%, ${ACCENT} 100%)`,
          }}
        />
        <span>More</span>
        <span
          style={{
            marginLeft: "auto",
            fontVariantNumeric: "tabular-nums",
            color: "#0E0E10",
          }}
        >
          max {max}
        </span>
      </div>
    </div>
  );
}
