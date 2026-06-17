"use client";

/** Шиммер-скелетоны для состояний загрузки в админке (вместо текста «Loading…»). */

export function Skeleton({ w = "100%", h = 14, r = 8, style }: {
  w?: number | string; h?: number | string; r?: number; style?: React.CSSProperties;
}) {
  return <span className="skel" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

/** Скелетон таблицы: шапка + строки × колонки (внутри admin-panel). */
export function TableSkeleton({ rows = 6, cols = 4, head = true }: {
  rows?: number; cols?: number; head?: boolean;
}) {
  return (
    <div className="admin-panel">
      {head && (
        <div className="admin-panel-head">
          <Skeleton w={160} h={16} />
          <Skeleton w={96} h={28} r={999} />
        </div>
      )}
      <div className="admin-panel-body">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: `1.6fr ${"1fr ".repeat(Math.max(1, cols - 1))}`,
                                 gap: 14, alignItems: "center", padding: "10px 0",
                                 borderTop: i ? "1px solid #F0EBE2" : "none" }}>
            {Array.from({ length: cols }).map((__, c) => (
              <Skeleton key={c} h={14} w={c === 0 ? "70%" : "50%"} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Скелетон карточки-панели с «графиком». */
export function PanelSkeleton({ height = 220, title = true }: { height?: number; title?: boolean }) {
  return (
    <div className="admin-panel">
      {title && (
        <div className="admin-panel-head">
          <Skeleton w={180} h={16} />
          <Skeleton w={80} h={12} />
        </div>
      )}
      <div className="admin-panel-body">
        <Skeleton w="100%" h={height} r={12} />
      </div>
    </div>
  );
}

/** Скелетон строк ВНУТРИ существующей таблицы (<tbody>): rows × cols ячеек-шиммеров. */
export function SkeletonRows({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c}><Skeleton h={14} w={c === 0 ? "70%" : "45%"} /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Скелетон строки статистик (карточки KPI). */
export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="admin-grid-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="admin-panel" style={{ padding: 16 }}>
          <Skeleton w={90} h={12} />
          <Skeleton w={70} h={26} style={{ marginTop: 10 }} />
        </div>
      ))}
    </div>
  );
}
