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
  customerName?: string; phone: string; carPlate: string; emirate?: string;
  subtotal: number; couponDiscount: number; total: number;
  managerId?: number; rating?: string | null; createdAt: string;
  items: { id: number; name: string; drinkName: string; quantity: number; unitPrice: number;
           paidByCoupon: boolean;
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

export function adminOrdersWs(): WebSocket {
  return new WebSocket(`${WS_URL}/ws/admin/orders`);
}

export const ADMIN_STATUS_LABEL: Record<string, string> = {
  new: "новый", in_progress: "в работе", ready: "готов, ждёт клиента",
  arrived: "клиент ожидает получения", completed: "передан", refund: "возврат",
};
