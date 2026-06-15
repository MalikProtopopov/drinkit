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
export function Stat({ label, value, sub }: {
  label: string; value: ReactNode; sub?: string;
}) {
  return (
    <div className="admin-stat">
      <div className="admin-stat-label">{label}</div>
      <div className="admin-stat-value">{value}</div>
      {sub && <div className="admin-meta" style={{ marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
