import type { CSSProperties } from "react";
import type { Location } from "./api";
import { DEFAULT_TZ } from "./hours";

// единый порог «мало осталось» (раньше расходился: 15 в бейдже vs 20 в карточке)
const LOW_STOCK = 20;
const SELLING_FAST = 60;

/** Время в TZ точки (C2): время открытия/закрытия — в часовом поясе точки, не браузера. */
export function fmtTime(iso: string | null | undefined, tz: string = DEFAULT_TZ): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  } catch { return null; }
}

/** Короткий бейдж рантайм-статуса точки (для /info и строк переключателя точек). */
export function statusBadge(loc: Location): [label: string, cls: string] {
  const tz = loc.timezone ?? DEFAULT_TZ;
  if (loc.status === "paused") return ["Paused", "badge--paused"];
  if (loc.status === "closed" || loc.status === "inactive") {
    const t = fmtTime(loc.nextOpenAt, tz);
    return [t ? `Closed · opens ${t}` : "Closed", "badge--closed"];
  }
  if (loc.isSoldOut) return ["Sold out", "badge--out"];
  if (loc.remaining !== null && loc.remaining <= LOW_STOCK) return [`${loc.remaining} left`, "badge--low"];
  return ["Open now", "badge--open"];
}

/** Подробный статус для брендовой карточки .loc: сообщение + можно ли заказывать + распродано.
 *  Копирайт в духе заказчика, но на реальном статусе бэкенда. Общий для /locations и /order. */
export function statusInfo(loc: Location): { msg: string; orderable: boolean; soldOut: boolean } {
  const tz = loc.timezone ?? DEFAULT_TZ;
  if (loc.status === "paused") return { msg: "Paused — not taking orders", orderable: false, soldOut: false };
  if (loc.status === "closed" || loc.status === "inactive") {
    const t = fmtTime(loc.nextOpenAt, tz);
    return { msg: t ? `Closed — opens ${t}` : "Closed now", orderable: false, soldOut: false };
  }
  if (loc.isSoldOut || loc.remaining === 0) {
    const t = fmtTime(loc.nextOpenAt, tz);
    return { msg: t ? `Sold out — back at ${t}` : "Sold out — back tomorrow", orderable: false, soldOut: true };
  }
  // флаг бэка acceptingOrders — авторитетный гейт приёма заказов (WEB-2): учитываем явно
  if (!loc.acceptingOrders) return { msg: "Paused — not taking orders", orderable: false, soldOut: false };
  if (loc.remaining !== null && loc.remaining <= LOW_STOCK) return { msg: "Almost gone — hurry!", orderable: true, soldOut: false };
  if (loc.remaining !== null && loc.remaining <= SELLING_FAST) return { msg: "Selling fast today", orderable: true, soldOut: false };
  return { msg: "Plenty left — pull up", orderable: true, soldOut: false };
}

/** Цветовые темы карточки точки (терракота / синий / олива) — задаются CSS-переменными инлайн. */
const LOC_THEMES: Record<string, string>[] = [
  { "--accent": "#c44429", "--fill": "#c44429", "--bar-bg": "rgba(196,68,41,.14)", "--bar-line": "rgba(196,68,41,.28)", "--glow": "rgba(196,68,41,.5)" },
  { "--accent": "#3f7d9c", "--fill": "#7bb0cb", "--bar-bg": "rgba(93,148,176,.16)", "--bar-line": "rgba(93,148,176,.30)", "--glow": "rgba(93,148,176,.55)" },
  { "--accent": "#7f8f3f", "--fill": "#b5bd62", "--bar-bg": "rgba(169,194,104,.20)", "--bar-line": "rgba(169,194,104,.34)", "--glow": "rgba(150,170,90,.50)" },
];

/** Тема точки по её индексу в списке — одинаковая на /locations и /order. */
export function themeFor(index: number): CSSProperties {
  const n = LOC_THEMES.length;
  return LOC_THEMES[((index % n) + n) % n] as CSSProperties;
}
