/** Часы работы точки — общий код для /locations и /order.
 *  ВАЖНО (семантика бэкенда): ключи дней — строки "0".."6" (Mon=0, = local.weekday());
 *  пустой объект hours {} = расписание не задано = работает КРУГЛОСУТОЧНО (не «закрыто»). */
export const DAY_LABEL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const; // index 0 = Mon
export type Interval = { open: string; close: string };
export type WeekHours = Record<string, Interval[]>;

/** Пустое/незаданное расписание — точка открыта всегда. */
export function isAlwaysOpen(wh: WeekHours | null | undefined): boolean {
  return !wh || Object.keys(wh).length === 0;
}

export function fmtIvs(ivs: Interval[] | undefined): string {
  if (!ivs || ivs.length === 0) return "Closed";
  return ivs.map((i) => `${i.open}–${i.close}`).join(", ");
}

/** Индекс сегодняшнего дня в нумерации бэкенда (Mon=0). JS Sun=0 → (+6)%7. */
export function todayIdx(): number {
  return (new Date().getDay() + 6) % 7;
}

/** Человекочитаемые часы на сегодня: круглосуточная точка → «Open 24 hours». */
export function todayHours(wh: WeekHours | null | undefined): string {
  if (isAlwaysOpen(wh)) return "Open 24 hours";
  return fmtIvs(wh![String(todayIdx())]);
}

/** Неделя, сгруппированная по одинаковым часам: «Mon–Sat 05:30–22:00». 24/7 → одна строка. */
export function weeklyHours(wh: WeekHours | null | undefined): { range: string; hours: string }[] {
  if (isAlwaysOpen(wh)) return [{ range: "Every day", hours: "Open 24 hours" }];
  const out: { range: string; hours: string }[] = [];
  let i = 0;
  while (i < 7) {
    const h = fmtIvs(wh![String(i)]);
    let j = i;
    while (j + 1 < 7 && fmtIvs(wh![String(j + 1)]) === h) j++;
    const range = i === j ? DAY_LABEL[i] : `${DAY_LABEL[i]}–${DAY_LABEL[j]}`;
    out.push({ range, hours: h });
    i = j + 1;
  }
  return out;
}
