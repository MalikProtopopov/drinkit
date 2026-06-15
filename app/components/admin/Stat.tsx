import type { ReactNode } from "react";

/**
 * KPI-ячейка (стиль kbju-cell): крупное значение + подпись + опц. вспом. текст.
 * `tone` — цвет значения. Раньше дублировалась в customers/[id] и payments.
 */
export function Kpi({ label, value, sub, tone }: {
  label: string; value: ReactNode; sub?: string; tone?: string;
}) {
  return (
    <div className="kbju-cell">
      <div className="kbju-cell-label">{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, color: tone }}>{value}</div>
      {sub && <div className="admin-meta" style={{ marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/**
 * Стат-карточка (стиль admin-stat): значение + подпись + опц. вспом. текст.
 * Раньше дублировалась в audience и дашборде.
 */
export function Stat({ label, value, sub, delta }: {
  label: string; value: ReactNode; sub?: string;
  delta?: number | null;  // % к прошлому периоду (▲/▼); null/undefined — не показываем
}) {
  const hasDelta = delta !== undefined && delta !== null;
  const up = (delta ?? 0) >= 0;
  return (
    <div className="admin-stat">
      <div className="admin-stat-label">{label}</div>
      <div className="admin-stat-value">{value}</div>
      {hasDelta && (
        <div className="admin-stat-trend" style={{ color: up ? "#16A34A" : "#DC2626" }}>
          {up ? "▲" : "▼"} {Math.abs(delta as number).toFixed(1)}% vs prev.
        </div>
      )}
      {sub && <div className="admin-meta" style={{ marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
