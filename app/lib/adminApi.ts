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
    let d = r.statusText;
    try { d = (await r.json()).detail ?? d; } catch {}
    throw Object.assign(new Error(typeof d === "string" ? d : JSON.stringify(d)), { status: r.status });
  }
  return r.json();
}

export type Staff = { id: number; email: string; name: string; role: string; disabled: boolean };
export type AdminOrder = {
  id: number; number: number; status: string; paymentStatus: string;
  arrived: boolean;
  customerName?: string; phone: string; carPlate: string; emirate?: string;
  subtotal: number; couponDiscount: number; total: number;
  managerId?: number; rating?: string | null; createdAt: string;
  items: { id: number; name: string; drinkName: string; sizeLabel?: string | null;
           quantity: number; unitPrice: number; paidByCoupon: boolean;
           addons: { name: string; portions: number; amount: number; unit: string }[] }[];
  events?: { type: string; status?: string; byStaffId?: number; byUserId?: number;
             note?: string; at: string }[];
};

export const adminApi = {
  login: (email: string, password: string) =>
    req<{ token: string; staff: Staff }>("/api/staff/login",
      { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => req<Staff>("/api/staff/me"),
  managers: () => req<Staff[]>("/api/staff/managers"),
  createManager: (b: { email: string; password: string; name: string; role?: string }) =>
    req<Staff>("/api/staff/managers", { method: "POST", body: JSON.stringify(b) }),
  deleteManager: (id: number) => req(`/api/staff/managers/${id}`, { method: "DELETE" }),

  orders: (q: { active?: boolean; managerId?: number; unassigned?: boolean } = {}) => {
    const p = new URLSearchParams();
    if (q.active !== undefined) p.set("active", String(q.active));
    if (q.managerId !== undefined) p.set("manager_id", String(q.managerId));
    if (q.unassigned) p.set("unassigned", "true");
    return req<AdminOrder[]>(`/api/admin/orders?${p}`);
  },
  order: (id: number) => req<AdminOrder>(`/api/admin/orders/${id}`),
  take: (id: number) => req<AdminOrder>(`/api/admin/orders/${id}/take`, { method: "POST" }),
  setStatus: (id: number, status: "ready" | "completed", note?: string) =>
    req<AdminOrder>(`/api/admin/orders/${id}/status`,
      { method: "POST", body: JSON.stringify({ status, note }) }),
  refund: (id: number, note?: string) =>
    req<AdminOrder>(`/api/admin/orders/${id}/refund`,
      { method: "POST", body: JSON.stringify({ status: "refund", note }) }),

  customers: () => req<any[]>("/api/admin/customers"),
  updateCustomer: (id: number, b: { name?: string; carPlate?: string; emirate?: string }) =>
    req(`/api/admin/customers/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  customer: (id: number) => req<any>(`/api/admin/customers/${id}`),
  payments: () => req<any[]>("/api/admin/payments"),
  coupons: () => req<any[]>("/api/admin/coupons"),
  voidCoupon: (id: number) => req(`/api/admin/coupons/${id}/void`, { method: "POST" }),
  dashboard: (from?: string, to?: string) => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return req<any>(`/api/admin/dashboard?${p}`);
  },
};

// ---------- каталог (ADM-S-01..05) ----------
export type I18n = { ru?: string; ar?: string };
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
export const DESC_LOCALES: { code: string; label: string }[] = [
  { code: "ru", label: "Русский" },
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
  // upsert описания в локали (создание/редактирование); пустое тело удаляет запись
  saveDescription: (drinkId: number, locale: string, body: string) =>
    req<AdminDrink>(`/api/admin/catalog/drinks/${drinkId}/descriptions/${locale}`,
      { method: "PUT", body: JSON.stringify({ body }) }),
  deleteDescription: (drinkId: number, locale: string) =>
    req<AdminDrink>(`/api/admin/catalog/drinks/${drinkId}/descriptions/${locale}`,
      { method: "DELETE" }),
};

export function adminOrdersWs(): WebSocket {
  const t = getStaffToken();
  const q = t ? `?token=${encodeURIComponent(t)}` : "";
  return new WebSocket(`${WS_URL}/ws/admin/orders${q}`);
}

export const ADMIN_STATUS_LABEL: Record<string, string> = {
  new: "новый", in_progress: "в работе", ready: "готов, ждёт клиента",
  completed: "передан", refund: "возврат",
};
