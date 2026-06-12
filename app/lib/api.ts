"use client";

// API-клиент Juicy V2. Бэкенд: backend/ (FastAPI), NEXT_PUBLIC_API_URL — адрес.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const WS_URL = API_URL.replace(/^http/, "ws");

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("juicy-token");
}
export function setToken(t: string | null) {
  if (t) localStorage.setItem("juicy-token", t);
  else localStorage.removeItem("juicy-token");
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const r = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!r.ok) {
    let detail = r.statusText;
    try {
      const body = await r.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {}
    throw new ApiError(r.status, detail);
  }
  return r.json();
}

// ---------- типы ----------
export type ApiCategory = { id: number; name: string; photoUrl?: string; videoUrl?: string };
export type ApiDrinkLite = {
  id: number; slug: string; name: string; previewUrl?: string; videoUrl?: string;
  basePrice: number; kcal: number; categoryId: number;
};
export type ApiAddon = {
  addonId: number; name: string; imageUrl?: string; categoryId: number; categoryName: string;
  selectionType: "single" | "multi" | "counter"; unit: string; free: boolean;
  pricePerPortion: number; minPortions: number; defaultPortions: number; maxPortions: number;
  portionAmount: number; kcal: number; protein: number; fat: number; carbs: number;
};
export type ApiDrink = ApiDrinkLite & {
  description: string; protein: number; fat: number; carbs: number; addons: ApiAddon[];
};
export type Selection = { addonId: number; portions: number };
export type ApiOrder = {
  id: number; number: number; status: string; paymentStatus: string;
  arrived: boolean;
  subtotal: number; couponDiscount: number; total: number; createdAt: string;
  rating: string | null; ratingPromptDue?: boolean;
  customerName?: string; phone?: string; carPlate?: string; emirate?: string;
  items: {
    id: number; drinkId: number; name: string; drinkName: string; unitPrice: number;
    quantity: number; paidByCoupon: boolean;
    addons: { name: string; portions: number; amount: number; unit: string; price: number }[];
  }[];
  events?: { type: string; status?: string; at: string }[];
};
export type ApiCoupon = {
  id: number; status: string; issuedAt: string; sourceOrderId: number;
  usedOrderId?: number; discountAmount?: number;
};
export type ApiUser = {
  id: number; phone: string; name?: string; carPlate?: string; emirate?: string; locale: string;
};

// ---------- каталог ----------
export const api = {
  categories: (locale = "ru") => req<ApiCategory[]>(`/api/categories?locale=${locale}`),
  drinks: (categoryId?: number, locale = "ru") =>
    req<ApiDrinkLite[]>(`/api/drinks?locale=${locale}${categoryId ? `&category=${categoryId}` : ""}`),
  drink: (slug: string, locale = "ru") => req<ApiDrink>(`/api/drinks/${slug}?locale=${locale}`),
  preview: (slug: string, selections: Selection[], locale = "ru") =>
    req<{ price: number; kcal: number; protein: number; fat: number; carbs: number }>(
      `/api/drinks/${slug}/preview?locale=${locale}`,
      { method: "POST", body: JSON.stringify({ selections }) }),

  // ---------- auth ----------
  requestCode: (phone: string) =>
    req<{ sent: boolean; otpRequired?: boolean; devCode?: string }>("/api/auth/request-code",
      { method: "POST", body: JSON.stringify({ phone }) }),
  verify: (phone: string, code = "", name?: string, locale?: string) =>
    req<{ token: string; user: ApiUser; created: boolean }>("/api/auth/verify",
      { method: "POST", body: JSON.stringify({ phone, code, name, locale }) }),
  me: () => req<ApiUser>("/api/auth/me"),
  updateMe: (patch: Partial<{ name: string; carPlate: string; emirate: string; locale: string }>) =>
    req<ApiUser>("/api/auth/me", { method: "PATCH", body: JSON.stringify(patch) }),

  // ---------- заказы ----------
  placeOrder: (body: {
    items: { drinkId: number; quantity: number; customName?: string; addons: Selection[] }[];
    customerName?: string; carPlate?: string; emirate?: string;
    couponId?: number; couponItemIndex?: number;
  }, locale = "ru") => req<ApiOrder>(`/api/orders?locale=${locale}`,
    { method: "POST", body: JSON.stringify(body) }),
  myOrders: () => req<ApiOrder[]>("/api/orders"),
  order: (id: number) => req<ApiOrder>(`/api/orders/${id}`),
  arrived: (id: number) => req<ApiOrder>(`/api/orders/${id}/arrived`, { method: "POST" }),
  rate: (id: number, rating: "like" | "dislike") =>
    req<{ ok: boolean; couponIssued: boolean; couponId?: number }>(
      `/api/orders/${id}/rate`, { method: "POST", body: JSON.stringify({ rating }) }),

  // ---------- оплата ----------
  checkout: (orderId: number) =>
    req<{ checkoutUrl: string; mock: boolean }>("/api/payments/checkout-session",
      { method: "POST", body: JSON.stringify({ orderId }) }),

  // ---------- купоны ----------
  coupons: () => req<ApiCoupon[]>("/api/coupons"),
};

export function orderWs(orderId: number): WebSocket {
  const t = getToken();
  const q = t ? `?token=${encodeURIComponent(t)}` : "";
  return new WebSocket(`${WS_URL}/ws/orders/${orderId}${q}`);
}

// Локализованные подписи единого статуса (§0.1) для клиента
export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "принят, ждёт бариста", color: "#4A56E2" },
  in_progress: { label: "готовим", color: "#F59E0B" },
  ready: { label: "готов — можно ехать", color: "#16A34A" },
  arrived: { label: "вы на месте, несём", color: "#16A34A" },
  completed: { label: "получен", color: "#9CA3AF" },
  refund: { label: "возврат", color: "#DC2626" },
};
