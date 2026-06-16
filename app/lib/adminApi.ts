"use client";
import { API_URL, WS_URL } from "./api";

// Отдельный токен персонала (staff JWT) — не пересекается с клиентским
export function getStaffToken() {
  return typeof window === "undefined" ? null : localStorage.getItem("juicy-staff-token");
}
export function setStaffToken(t: string | null) {
  if (t) localStorage.setItem("juicy-staff-token", t);
  else localStorage.removeItem("juicy-staff-token");
}

/** K3/X4/X8: токен протух/учётка отключена → чистим токен и уводим на логин (не оставляем
 *  «протухшую» страницу). Защита от цикла: на самой странице логина не редиректим. */
function handle401() {
  if (typeof window === "undefined") return;
  setStaffToken(null);
  if (!window.location.pathname.startsWith("/admin/login")) {
    window.location.href = "/admin/login";
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(getStaffToken() ? { Authorization: `Bearer ${getStaffToken()}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!r.ok) {
    if (r.status === 401) handle401();
    let d = r.statusText;
    try { d = (await r.json()).detail ?? d; } catch {}
    throw Object.assign(new Error(typeof d === "string" ? d : JSON.stringify(d)), { status: r.status });
  }
  return r.json();
}

// списочный запрос с пагинацией: тело — массив, общее число записей в X-Total-Count
export type Paged<T> = { items: T[]; total: number };
async function reqList<T>(path: string): Promise<Paged<T>> {
  const r = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(getStaffToken() ? { Authorization: `Bearer ${getStaffToken()}` } : {}),
    },
  });
  if (!r.ok) {
    if (r.status === 401) handle401();
    let d = r.statusText;
    try { d = (await r.json()).detail ?? d; } catch {}
    throw Object.assign(new Error(typeof d === "string" ? d : JSON.stringify(d)), { status: r.status });
  }
  const items = (await r.json()) as T[];
  const total = Number(r.headers.get("X-Total-Count") ?? items.length);
  return { items, total: Number.isFinite(total) ? total : items.length };
}

// сборка query c limit/offset (+ доп. параметры)
function pageQuery(p: { limit: number; offset: number } & Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  }
  return q.toString();
}

// сборка query из произвольных параметров (пустые/none — пропускаем); с ведущим "?"
export function qs(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

// Скачивание выгрузки (.xlsx): авторизованный fetch → blob → клик по скрытой <a download>.
// Имя файла берём из Content-Disposition (датированное на бэке), иначе — fallback.
export async function downloadExport(path: string, fallbackName: string): Promise<void> {
  const r = await fetch(`${API_URL}${path}`, {
    headers: { ...(getStaffToken() ? { Authorization: `Bearer ${getStaffToken()}` } : {}) },
  });
  if (!r.ok) {
    let d = r.statusText;
    try { d = (await r.json()).detail ?? d; } catch {}
    throw Object.assign(new Error(typeof d === "string" ? d : JSON.stringify(d)), { status: r.status });
  }
  const blob = await r.blob();
  const cd = r.headers.get("Content-Disposition") || "";
  const m = cd.match(/filename="?([^"]+)"?/);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = m?.[1] || fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type Staff = { id: number; email: string; name: string; role: string;
  phone?: string | null; note?: string | null; disabled: boolean;
  outletIds?: number[] };  // точки сотрудника (REQ-2/7)
export type ScreenRow = { orderId: number; number: number; name: string };
export type AdminOrder = {
  id: number; number: number; status: string; paymentStatus: string;
  arrived: boolean;
  outletId?: number | null; outlet?: { id: number; name: string; address?: string | null } | null;
  customerName?: string; phone: string; carPlate: string; emirate?: string;
  subtotal: number; couponDiscount: number; total: number;
  managerId?: number; rating?: string | null; createdAt: string;
  items: { id: number; name: string; customName?: string | null; drinkName: string; drinkNameEn: string;
           sizeLabel?: string | null; previewUrl?: string | null; drinkSlug?: string | null;
           quantity: number; unitPrice: number; paidByCoupon: boolean;
           addons: { name: string; nameEn: string; portions: number; amount: number; unit: string; price: number }[] }[];
  events?: { type: string; status?: string; byStaffId?: number; byStaffName?: string;
             byUserId?: number; note?: string; at: string }[];
};

export const adminApi = {
  login: (email: string, password: string) =>
    req<{ token: string; staff: Staff }>("/api/staff/login",
      { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => req<Staff>("/api/staff/me"),
  managers: () => req<Staff[]>("/api/staff/managers"),
  createManager: (b: { email: string; password: string; name: string; role?: string;
    phone?: string | null; note?: string | null; outletIds?: number[] }) =>
    req<Staff>("/api/staff/managers", { method: "POST", body: JSON.stringify(b) }),
  updateManager: (id: number, b: Partial<{ name: string; email: string; role: string;
    phone: string | null; note: string | null; disabled: boolean; password: string;
    outletIds: number[] }>) =>
    req<Staff>(`/api/staff/managers/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  deleteManager: (id: number) => req(`/api/staff/managers/${id}`, { method: "DELETE" }),

  orders: (q: { active?: boolean; managerId?: number; unassigned?: boolean; outletId?: number } = {}) => {
    const p = new URLSearchParams();
    if (q.active !== undefined) p.set("active", String(q.active));
    if (q.managerId !== undefined) p.set("manager_id", String(q.managerId));
    if (q.unassigned) p.set("unassigned", "true");
    if (q.outletId !== undefined) p.set("outlet_id", String(q.outletId));
    return req<AdminOrder[]>(`/api/admin/orders?${p}`);
  },
  // пагинированные варианты списков (limit/offset + X-Total-Count)
  ordersPaged: (p: { limit: number; offset: number; active?: boolean; managerId?: number;
    unassigned?: boolean; outletId?: number }) =>
    reqList<AdminOrder>(`/api/admin/orders?${pageQuery({
      limit: p.limit, offset: p.offset,
      active: p.active, manager_id: p.managerId, unassigned: p.unassigned ? "true" : undefined,
      outlet_id: p.outletId,
    })}`),
  customersPaged: (p: { limit: number; offset: number; sort?: string; dir?: "asc" | "desc" }) =>
    reqList<any>(`/api/admin/customers?${pageQuery(p)}`),
  paymentsPaged: (p: { limit: number; offset: number; status?: string; method?: string;
                       q?: string; from?: string; to?: string }) =>
    reqList<any>(`/api/admin/payments?${pageQuery(p)}`),
  managersPaged: (p: { limit: number; offset: number }) =>
    reqList<Staff>(`/api/staff/managers?${pageQuery(p)}`),
  order: (id: number) => req<AdminOrder>(`/api/admin/orders/${id}`),
  take: (id: number) => req<AdminOrder>(`/api/admin/orders/${id}/take`, { method: "POST" }),
  setStatus: (id: number, status: "ready" | "completed", note?: string) =>
    req<AdminOrder>(`/api/admin/orders/${id}/status`,
      { method: "POST", body: JSON.stringify({ status, note }) }),
  // ADM-M-06: причина возврата обязательна (бэк требует reason)
  refund: (id: number, reason: string) =>
    req<AdminOrder>(`/api/admin/orders/${id}/refund`,
      { method: "POST", body: JSON.stringify({ reason }) }),

  createCustomer: (b: { phone: string; name?: string; carPlate?: string; emirate?: string; locale?: string }) =>
    req<any>("/api/admin/customers", { method: "POST", body: JSON.stringify(b) }),
  updateCustomer: (id: number, b: { name?: string; carPlate?: string; emirate?: string; locale?: string; phone?: string }) =>
    req(`/api/admin/customers/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  customer: (id: number) => req<any>(`/api/admin/customers/${id}`),
  audience: (outletId?: number) =>
    req<any>(`/api/admin/audience${outletId ? `?outlet_id=${outletId}` : ""}`),
  managerStats: (id: number, days = 62) =>
    req<ManagerStats>(`/api/staff/managers/${id}/stats?days=${days}`),
  meStats: (days = 62) => req<ManagerStats>(`/api/staff/me/stats?days=${days}`),
  payment: (id: number) => req<any>(`/api/admin/payments/${id}`),
  paymentsConfig: () => req<any>("/api/admin/payments/config"),
  paymentsSummary: (from?: string, to?: string) => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return req<any>(`/api/admin/payments/summary?${p}`);
  },
  refundPayment: (id: number, b: { amount?: number; reason?: string } = {}) =>
    req<any>(`/api/admin/payments/${id}/refund`, { method: "POST", body: JSON.stringify(b) }),
  screenBoard: () => req<{ ready: ScreenRow[]; preparing: ScreenRow[] }>("/api/screen/board"),
  dashboard: (from?: string, to?: string, outletId?: number) => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (outletId) p.set("outlet_id", String(outletId));
    return req<any>(`/api/admin/dashboard?${p}`);
  },
};

export type ManagerStats = {
  ordersHandled: number; ordersToday: number; activeDays: number;
  windowDays: number; tz: string; perDay: Record<string, number>;
};

// ---------- каталог (ADM-S-01..05) ----------
export type I18n = { ru?: string; en?: string; ar?: string };
export type DrinkCat = { id: number; slug: string; name: I18n; photoUrl?: string | null; videoUrl?: string | null;
                         isActive: boolean; sort: number };
export type Unit = { id: number; code: string; name: I18n };
export type AddonCat = { id: number; name: I18n; iconUrl?: string | null; isActive: boolean;
                         selectionType: "single" | "multi" | "counter" };
export type AdminAddon = { id: number; name: I18n; imageUrl?: string | null; categoryId: number;
  unitId: number; kcalPer100: number; proteinPer100: number; fatPer100: number; carbsPer100: number;
  basePrice: number; isActive: boolean };
export type Binding = { id?: number; addonId: number; priceOverride: number | null;
  minPortions: number; defaultPortions: number; maxPortions: number; portionAmount: number;
  selectionTypeOverride: string | null };
export type DrinkSize = { id?: number; volume: number; unit: string; price: number;
  isDefault: boolean; isActive: boolean; sort: number };
export type DrinkDescription = { locale: string; body: string };
// локали для rich-описаний (совпадают с DESC_LOCALES на бэке)
// локали rich-описаний = локали сайта (русский убран, он не показывается на сайте)
export const DESC_LOCALES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ar", label: "العربية" },
];
export type AdminDrink = { id: number; slug: string; name: I18n; description: I18n; status: string;
  previewUrl?: string | null; videoUrl?: string | null; basePrice: number;
  kcal: number; protein: number; fat: number; carbs: number; categoryId: number;
  bindings: Binding[]; sizes: DrinkSize[]; descriptions: DrinkDescription[] };

export const catalogApi = {
  drinkCategories: () => req<DrinkCat[]>("/api/admin/catalog/drink-categories"),
  createDrinkCategory: (b: Partial<DrinkCat>) =>
    req<DrinkCat>("/api/admin/catalog/drink-categories", { method: "POST", body: JSON.stringify(b) }),
  updateDrinkCategory: (id: number, b: Partial<DrinkCat>) =>
    req<DrinkCat>(`/api/admin/catalog/drink-categories/${id}`, { method: "PATCH", body: JSON.stringify(b) }),

  units: () => req<Unit[]>("/api/admin/catalog/units"),
  createUnit: (b: { code: string; name: I18n }) =>
    req<Unit>("/api/admin/catalog/units", { method: "POST", body: JSON.stringify(b) }),

  addonCategories: () => req<AddonCat[]>("/api/admin/catalog/addon-categories"),
  createAddonCategory: (b: Partial<AddonCat>) =>
    req<AddonCat>("/api/admin/catalog/addon-categories", { method: "POST", body: JSON.stringify(b) }),
  updateAddonCategory: (id: number, b: Partial<AddonCat>) =>
    req<AddonCat>(`/api/admin/catalog/addon-categories/${id}`, { method: "PATCH", body: JSON.stringify(b) }),

  addons: () => req<AdminAddon[]>("/api/admin/catalog/addons"),
  createAddon: (b: Partial<AdminAddon>) =>
    req<AdminAddon>("/api/admin/catalog/addons", { method: "POST", body: JSON.stringify(b) }),
  updateAddon: (id: number, b: Partial<AdminAddon>) =>
    req<AdminAddon>(`/api/admin/catalog/addons/${id}`, { method: "PATCH", body: JSON.stringify(b) }),

  drinks: () => req<AdminDrink[]>("/api/admin/catalog/drinks"),
  drinksPaged: (p: { limit: number; offset: number }) =>
    reqList<AdminDrink>(`/api/admin/catalog/drinks?${pageQuery(p)}`),
  addonsPaged: (p: { limit: number; offset: number }) =>
    reqList<AdminAddon>(`/api/admin/catalog/addons?${pageQuery(p)}`),
  createDrink: (b: Partial<AdminDrink>) =>
    req<AdminDrink>("/api/admin/catalog/drinks", { method: "POST", body: JSON.stringify(b) }),
  updateDrink: (id: number, b: Partial<AdminDrink>) =>
    req<AdminDrink>(`/api/admin/catalog/drinks/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  setBindings: (drinkId: number, bindings: Binding[]) =>
    req<AdminDrink>(`/api/admin/catalog/drinks/${drinkId}/bindings`,
      { method: "PUT", body: JSON.stringify(bindings) }),
  setSizes: (drinkId: number, sizes: DrinkSize[]) =>
    req<AdminDrink>(`/api/admin/catalog/drinks/${drinkId}/sizes`,
      { method: "PUT", body: JSON.stringify(sizes) }),
  // загрузка медиа (картинка/видео) — multipart; Content-Type ставит браузер сам
  uploadMedia: async (file: File): Promise<{ url: string; kind: "image" | "video" }> => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch(`${API_URL}/api/admin/catalog/upload`, {
      method: "POST",
      headers: { ...(getStaffToken() ? { Authorization: `Bearer ${getStaffToken()}` } : {}) },
      body: fd,
    });
    if (!r.ok) {
      let d = r.statusText;
      try { d = (await r.json()).detail ?? d; } catch {}
      throw new Error(typeof d === "string" ? d : JSON.stringify(d));
    }
    return r.json();
  },
  // upsert описания в локали (создание/редактирование); пустое тело удаляет запись
  saveDescription: (drinkId: number, locale: string, body: string) =>
    req<AdminDrink>(`/api/admin/catalog/drinks/${drinkId}/descriptions/${locale}`,
      { method: "PUT", body: JSON.stringify({ body }) }),
  deleteDescription: (drinkId: number, locale: string) =>
    req<AdminDrink>(`/api/admin/catalog/drinks/${drinkId}/descriptions/${locale}`,
      { method: "DELETE" }),
};

// ---------- локации (REQ-1..5/7) ----------
export type OutletHours = Record<string, { open: string; close: string }[]>;  // "0".."6" → интервалы
export type OutletManager = { id: number; name: string; email: string; role: string;
  isPrimary: boolean; disabled: boolean };
export type OutletStatus = "open" | "paused" | "closed" | "inactive";
export type OutletStatusReason = "open" | "closed" | "paused_manual" | "paused_limit" | "inactive";
export type AdminOutlet = {
  id: number; slug: string; name: I18n;
  isActive: boolean; acceptingOrders: boolean; autoPaused: boolean;
  address?: string | null; emirate?: string | null; phone?: string | null; email?: string | null;
  lat?: number | null; lng?: number | null; timezone: string; hours: OutletHours;
  dailyDrinkLimit: number | null; sort: number;
  status: OutletStatus; statusReason: OutletStatusReason;
  opensAt?: string | null; closesAt?: string | null; resetsAt?: string | null;
  drinksToday: number; limitRemaining: number | null;
  createdAt?: string | null; updatedAt?: string | null;
  managers?: OutletManager[];
};
export type OutletEventRow = { id: number; type: string; byStaffId?: number | null;
  byStaffName?: string | null; note?: string | null; meta: Record<string, unknown>; at?: string | null };
export type OutletStopList = { drinks: number[]; categories: number[]; addons: number[] };
export type OutletPriority = { drinkId: number; sort: number; pinned: boolean };

export const outletApi = {
  list: (active?: boolean) =>
    req<AdminOutlet[]>(`/api/admin/outlets${active === undefined ? "" : `?active=${active}`}`),
  listPaged: (p: { limit: number; offset: number; active?: boolean }) =>
    reqList<AdminOutlet>(`/api/admin/outlets?${pageQuery(p)}`),
  get: (id: number) => req<AdminOutlet>(`/api/admin/outlets/${id}`),
  create: (b: Partial<AdminOutlet> & { name: I18n }, force = false) =>
    req<AdminOutlet>(`/api/admin/outlets${force ? "?force=true" : ""}`,
      { method: "POST", body: JSON.stringify(b) }),
  update: (id: number, b: Partial<AdminOutlet>) =>
    req<AdminOutlet>(`/api/admin/outlets/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  activate: (id: number, force = false) =>
    req<AdminOutlet>(`/api/admin/outlets/${id}/activate${force ? "?force=true" : ""}`, { method: "POST" }),
  deactivate: (id: number) =>
    req<AdminOutlet>(`/api/admin/outlets/${id}/deactivate`, { method: "POST" }),
  events: (id: number) => req<OutletEventRow[]>(`/api/admin/outlets/${id}/events`),
  stopList: (id: number) => req<OutletStopList>(`/api/admin/outlets/${id}/stop-list`),
  setStopList: (id: number, b: OutletStopList) =>
    req<OutletStopList>(`/api/admin/outlets/${id}/stop-list`, { method: "PUT", body: JSON.stringify(b) }),
  toggleStop: (id: number, entityType: "drink" | "drink_category" | "addon", entityId: number) =>
    req<{ stopped: boolean }>(`/api/admin/outlets/${id}/stop-list/toggle`,
      { method: "POST", body: JSON.stringify({ entityType, entityId }) }),
  priorities: (id: number) => req<OutletPriority[]>(`/api/admin/outlets/${id}/drink-priorities`),
  setPriorities: (id: number, rows: OutletPriority[]) =>
    req<OutletPriority[]>(`/api/admin/outlets/${id}/drink-priorities`,
      { method: "PUT", body: JSON.stringify(rows) }),
  attachStaff: (id: number, staffId: number, isPrimary = false) =>
    req<AdminOutlet>(`/api/admin/outlets/${id}/staff`,
      { method: "POST", body: JSON.stringify({ staffId, isPrimary }) }),
  detachStaff: (id: number, staffId: number) =>
    req<AdminOutlet>(`/api/admin/outlets/${id}/staff/${staffId}`, { method: "DELETE" }),
};

export function adminOrdersWs(): WebSocket {
  const t = getStaffToken();
  const q = t ? `?token=${encodeURIComponent(t)}` : "";
  return new WebSocket(`${WS_URL}/ws/admin/orders${q}`);
}

export const ADMIN_STATUS_LABEL: Record<string, string> = {
  new: "new", in_progress: "in progress", ready: "ready, waiting",
  completed: "completed", refund: "refund",
};
