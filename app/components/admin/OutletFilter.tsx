"use client";

import { useEffect, useState } from "react";
import { outletApi, type AdminOutlet } from "@/lib/adminApi";

const oName = (o: AdminOutlet) => o.name.en || o.name.ru || o.slug;

/**
 * Фильтр по точкам для супер-админа: «Все точки» + каждая точка.
 * value === "all" — сводно по всем точкам. Использует .admin-select (своя стрелка с отступом).
 * Прячется, если точек нет; при одной точке остаётся (показывает, что можно будет сравнивать).
 */
export function OutletFilter({ value, onChange }: {
  value: number | "all";
  onChange: (v: number | "all") => void;
}) {
  const [outlets, setOutlets] = useState<AdminOutlet[]>([]);
  useEffect(() => { outletApi.list().then(setOutlets).catch(() => {}); }, []);

  if (outlets.length === 0) return null;
  return (
    <select className="admin-select" value={String(value)}
            onChange={(e) => onChange(e.target.value === "all" ? "all" : Number(e.target.value))}>
      <option value="all">All outlets</option>
      {outlets.map((o) => <option key={o.id} value={o.id}>{oName(o)}</option>)}
    </select>
  );
}
