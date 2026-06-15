// Единые форматтеры админки: деньги (AED), даты, относительное время, проценты.
// Раньше эти функции дублировались в 5 страницах с мелкими расхождениями —
// здесь один источник правды с опциями, чтобы каждый вызов сохранял своё поведение.

/** Бэкенд отдаёт naive-UTC без таймзоны — дописываем Z, если её нет. */
const parseTs = (s: string) => new Date(/[Z+]/.test(s) ? s : s + "Z");

/** Дата+время, en-GB. По умолчанию без года; `{ year: true }` — с годом. */
export const fmtDateTime = (s?: string | null, opts?: { year?: boolean }) =>
  s ? parseTs(s).toLocaleString("en-GB", {
    day: "2-digit", month: "short",
    ...(opts?.year ? { year: "numeric" } : {}),
    hour: "2-digit", minute: "2-digit",
  }) : "—";

/** Только дата (день/месяц/год), en-GB. */
export const fmtDate = (s?: string | null) =>
  s ? parseTs(s).toLocaleDateString("en-GB",
    { day: "2-digit", month: "short", year: "numeric" }) : "—";

/**
 * Денежная сумма в AED.
 * `decimals` — число знаков (по умолчанию 0 = округление до целого).
 * `suffix` — добавлять « AED» (по умолчанию да; `false` — только число).
 * `null/undefined` → «—».
 */
export const aed = (n?: number | null, opts?: { decimals?: number; suffix?: boolean }) => {
  if (n == null) return "—";
  const d = opts?.decimals ?? 0;
  const s = Number(n).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
  return opts?.suffix === false ? s : `${s} AED`;
};

/** «today/yesterday/N days ago». `{ short: true }` — без « ago». */
export const recencyText = (d?: number | null, opts?: { short?: boolean }) =>
  d == null ? "—" : d === 0 ? "today" : d === 1 ? "yesterday"
    : `${d} days${opts?.short ? "" : " ago"}`;

/** Доля 0..1 → «NN%». */
export const pct = (n?: number | null) =>
  n == null ? "—" : `${Math.round((n ?? 0) * 100)}%`;
