import type { AdminOutlet, I18n, OutletEventRow } from "@/lib/adminApi";

export type Tab = "main" | "hours" | "staff" | "menu" | "audit";

export const TAB_LABEL: Record<Tab, string> = {
  main: "General", hours: "Schedule", staff: "Staff", menu: "Outlet menu", audit: "History",
};

// keys "0".."6" = Пн..Вс
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const ROLE_LABEL: Record<string, string> = { super_admin: "Super admin", manager: "Manager", screen: "Pickup screen" };
export const oName = (n: I18n) => n.en ?? n.ru ?? n.ar ?? "—";
export const fmt = (s?: string | null) =>
  s ? new Date(/[Z+]/.test(s) ? s : s + "Z").toLocaleString("en-GB",
    { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
// время в таймзоне точки (а не браузера) — для «откроется/сбросится»
export const fmtTz = (iso: string | null | undefined, tz: string, withDay = false) =>
  iso ? new Date(iso).toLocaleString("en-GB", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", ...(withDay ? { weekday: "short" } : {}) }) : "";

// частые таймзоны (вместо свободного ввода — защита от опечаток, ломающих расчёт статуса)
export const TIMEZONES = ["Asia/Dubai", "Asia/Riyadh", "Asia/Qatar", "Asia/Kuwait", "Asia/Muscat",
  "Asia/Bahrain", "Europe/Moscow", "UTC"];

// человекочитаемые названия событий аудита
export const EVENT_LABEL: Record<string, string> = {
  activated: "Outlet enabled", deactivated: "Outlet disabled",
  paused: "Paused", resumed: "Resumed",
  hours_changed: "Schedule changed", limit_changed: "Daily limit changed",
  limit_reached: "Daily limit reached",
  staff_attached: "Staff attached", staff_detached: "Staff detached",
  stop_added: "Added to stop list", stop_removed: "Removed from stop list",
};

// описание дня расписания
export const describeDay = (iv?: { open: string; close: string }[]) =>
  !iv || iv.length === 0 ? "day off"
  : iv.length === 1 && iv[0].open === "00:00" && iv[0].close === "24:00" ? "24/7"
  : iv.map((x) => `${x.open}–${x.close}`).join(", ");

export const ERR_HUMAN: Record<string, string> = {
  OUTLET_HOURS_INVALID: "Invalid hours: closing time must be later than opening time",
  LAST_ACTIVE_OUTLET: "Can't disable the last active outlet",
  MULTIPLE_ACTIVE_NOT_SUPPORTED: "An active outlet already exists — multiple active outlets aren't supported",
  STAFF_NEEDS_OUTLET: "The staff member would have 0 outlets — attach them to another one first",
};

export const STATUS_TONE: Record<AdminOutlet["status"], { bg: string; fg: string; dot: string; label: string }> = {
  open: { bg: "#EAF6EE", fg: "#15803D", dot: "🟢", label: "Open" },
  paused: { bg: "#FDF4E3", fg: "#B45309", dot: "🟡", label: "Paused" },
  closed: { bg: "#F1F2F5", fg: "#5A6172", dot: "⚪", label: "Closed" },
  inactive: { bg: "#FCEBEA", fg: "#A12822", dot: "🔴", label: "Disabled" },
};

// «было → стало» / суть события из meta
export function eventDetail(ev: OutletEventRow): string {
  const m = (ev.meta ?? {}) as Record<string, unknown>;
  if (ev.type === "limit_changed") return `${m.old ?? "no limit"} → ${m.new ?? "no limit"}`;
  if (ev.type === "limit_reached") return `${m.counted ?? "?"} of ${m.limit ?? "?"}`;
  if (ev.type === "stop_added" || ev.type === "stop_removed") {
    const parts: string[] = [];
    const cnt = (k: string, label: string) => {
      const v = m[k]; if (Array.isArray(v) && v.length) parts.push(`${label} ×${v.length}`);
    };
    cnt("drink", "drinks"); cnt("drink_category", "categories"); cnt("addon", "add-ons");
    return parts.join(" · ") || (ev.note ?? "");
  }
  if (ev.type === "hours_changed") return "schedule updated";
  return ev.note ?? "";
}
