/** Типобезопасный API-клиент GRABZI (фронт-спека §1): zod на границе ответов. */
import { z } from "zod";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  code: string;
  status: number;
  meta: Record<string, unknown>;
  constructor(status: number, code: string, meta: Record<string, unknown> = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.meta = meta;
  }
}

function token(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("grabzi_token");
}

export async function apiFetch<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  init?: RequestInit & { auth?: boolean },
): Promise<z.infer<S>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const t = token();
  if (t && init?.auth !== false) headers["Authorization"] = `Bearer ${t}`;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers: { ...headers, ...init?.headers } });
  } catch {
    throw new ApiError(0, "NETWORK");
  }
  if (!res.ok) {
    let code = `HTTP_${res.status}`;
    let meta: Record<string, unknown> = {};
    try {
      const body = await res.json();
      const d = body?.detail;
      if (typeof d === "string") code = d;
      else if (d && typeof d === "object") { code = d.code ?? code; meta = d; }
    } catch { /* ignore */ }
    throw new ApiError(res.status, code, meta);
  }
  return schema.parse(await res.json());
}

// ---- схемы ----
export const StockState = z.enum(["open", "paused", "closed", "inactive"]);

export const LocationSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional().default(""),
  address: z.string().nullable(),
  workingHours: z.record(z.any()).optional().default({}),
  dailyDrinkLimit: z.number().nullable(),
  soldToday: z.number(),
  remaining: z.number().nullable(),
  isSoldOut: z.boolean(),
  isOpen: z.boolean(),
  status: StockState,
  nextOpenAt: z.string().nullable(),
  acceptingOrders: z.boolean(),
  imageUrl: z.string().nullable(),
});
export type Location = z.infer<typeof LocationSchema>;

export const DrinkSchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  previewUrl: z.string().nullable(),
  basePrice: z.number(),
  categoryId: z.number().nullable(),
  soldOut: z.boolean().optional().default(false),
});
export type Drink = z.infer<typeof DrinkSchema>;

export const CategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  photoUrl: z.string().nullable(),
});
export type Category = z.infer<typeof CategorySchema>;

export const OrderSchema = z.object({
  id: z.number(),
  number: z.number(),
  status: z.string(),
  paymentStatus: z.string(),
  arrived: z.boolean().optional(),
  total: z.number(),
});

const VerifySchema = z.object({
  token: z.string(),
  user: z.object({ id: z.number(), name: z.string().nullable(), phone: z.string() }),
  created: z.boolean().optional(),
});

const CheckoutSchema = z.object({ checkoutUrl: z.string(), mock: z.boolean() });

export type OrderItemInput = { drinkId: number; quantity: number };

// ---- эндпоинты ----
export const api = {
  locations: () => apiFetch("/api/locations?locale=en", z.array(LocationSchema), { auth: false, cache: "no-store" }),
  location: (id: number) => apiFetch(`/api/locations/${id}?locale=en`, LocationSchema, { auth: false }),
  categories: () => apiFetch("/api/categories?locale=en", z.array(CategorySchema), { auth: false }),
  drinks: (locationId?: number) =>
    apiFetch(
      `/api/drinks?locale=en${locationId ? `&location_id=${locationId}` : ""}`,
      z.array(DrinkSchema),
      { auth: false },
    ),

  /** Авто-логин по телефону без OTP (план §4.7): code пустой. Сохраняет токен. */
  async login(phone: string, name?: string) {
    const res = await apiFetch("/api/auth/verify", VerifySchema, {
      method: "POST",
      body: JSON.stringify({ phone, code: "", name, locale: "en" }),
      auth: false,
    });
    if (typeof window !== "undefined") window.localStorage.setItem("grabzi_token", res.token);
    return res;
  },

  createOrder: (body: { locationId: number; items: OrderItemInput[]; carPlate: string; customerName?: string }) =>
    apiFetch("/api/orders?locale=en", OrderSchema, { method: "POST", body: JSON.stringify(body) }),

  checkout: (orderId: number) =>
    apiFetch("/api/payments/checkout-session", CheckoutSchema, {
      method: "POST",
      body: JSON.stringify({ orderId }),
    }),

  order: (id: number) => apiFetch(`/api/orders/${id}`, OrderSchema, { cache: "no-store" }),
};
