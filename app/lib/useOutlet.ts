"use client";

import { useEffect, useState } from "react";
import { api, type ApiOutlet } from "./api";
import { useT } from "./i18n";

// Единственное место, где публичный сайт узнаёт текущую точку: адрес, рабочие часы и openNow.
// На публичном сайте переключателя точек нет (D4) — берём первую активную точку из API.
// Бэкенд сам резолвит единственную активную точку при создании заказа.
export function useOutlet() {
  const { locale } = useT();
  const [outlet, setOutlet] = useState<ApiOutlet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.outlets(locale)
      .then((list) => { if (alive) setOutlet(list[0] ?? null); })
      .catch(() => { if (alive) setOutlet(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [locale]);

  return { outlet, loading };
}

// Короткая подпись сегодняшних часов: "07:00–22:30", "24/7" или локализованное «Закрыто».
export function todayHoursLabel(outlet: ApiOutlet | null, closedLabel: string): string {
  if (!outlet) return "";
  if (!outlet.openNow && outlet.status !== "open") return closedLabel;
  const iv = outlet.todayHours;
  if (!iv || iv.length === 0) return "";
  if (iv.length === 1 && iv[0].open === "00:00" && iv[0].close === "24:00") return "24/7";
  return `${iv[0].open}–${iv[iv.length - 1].close}`;
}
