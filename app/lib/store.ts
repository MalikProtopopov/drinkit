"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { outlets } from "./data";

export type CartAddon = {
  groupSlug: string;
  addonId: string;
  quantity: number;
};

export type CartItem = {
  lineId: string;
  productId: string;
  variantCode: string;
  quantity: number;
  customName?: string;
  addons: CartAddon[];
  // snapshot
  productName: string;
  productBg: string;
  unitPriceAed: number;
  // V2: серверные идентификаторы для POST /api/orders (PUB-G-05)
  drinkId?: number;
  drinkSlug?: string;
  serverAddons?: { addonId: number; portions: number }[];
  addonsLabel?: string;
};

export type Order = {
  id: string;
  number: number;
  createdAt: number;
  outletId: string;
  items: CartItem[];
  subtotalAed: number;
  vatAed: number;
  totalAed: number;
  status: OrderStatus;
  paymentMethod: "card" | "applepay" | "googlepay";
  carEmirate?: string;
  carPlate?: string;
  scheduledFor?: string;
  customerName?: string;
  arrived?: boolean;
};

export type OrderStatus =
  | "CREATED"
  | "PAID"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "PICKED_UP";

export type UserProfile = {
  phone?: string;
  name?: string;
  defaultCarPlate?: string;
  defaultEmirate?: string;
  preferredLocale: "ru" | "en" | "ar";
};

type AppState = {
  // onboarding
  onboardingSeen: boolean;
  setOnboardingSeen: () => void;

  // outlet
  selectedOutletId?: string;
  setOutlet: (id: string) => void;

  // user
  user: UserProfile;
  setUser: (u: Partial<UserProfile>) => void;
  logout: () => void;
  isAuthorized: () => boolean;

  // cart
  cart: CartItem[];
  addToCart: (i: Omit<CartItem, "lineId">) => void;
  updateQty: (lineId: string, delta: number) => void;
  removeItem: (lineId: string) => void;
  clearCart: () => void;

  // orders
  orders: Order[];
  createOrder: (o: Omit<Order, "id" | "number" | "createdAt" | "status">) => Order;
  updateOrderStatus: (id: string, status: OrderStatus) => void;
  markOrderArrived: (id: string) => void;
  getOrder: (id: string) => Order | undefined;
  nextOrderNumber: number;
};

const VAT_RATE = 0.05;

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      onboardingSeen: false,
      setOnboardingSeen: () => set({ onboardingSeen: true }),

      selectedOutletId: undefined,
      setOutlet: (id) => set({ selectedOutletId: id }),

      user: { preferredLocale: "ru" },
      setUser: (u) =>
        set((s) => ({ user: { ...s.user, ...u } })),
      logout: () => {
        if (typeof window !== "undefined") localStorage.removeItem("juicy-token");
        set({ user: { preferredLocale: "ru" }, orders: [] });
      },
      isAuthorized: () => !!get().user.phone,

      cart: [],
      addToCart: (item) =>
        set((s) => ({
          cart: [
            ...s.cart,
            { ...item, lineId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
          ],
        })),
      updateQty: (lineId, delta) =>
        set((s) => ({
          cart: s.cart
            .map((i) =>
              i.lineId === lineId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i
            )
            .filter((i) => i.quantity > 0),
        })),
      removeItem: (lineId) =>
        set((s) => ({ cart: s.cart.filter((i) => i.lineId !== lineId) })),
      clearCart: () => set({ cart: [] }),

      orders: [],
      nextOrderNumber: 1247,
      createOrder: (o) => {
        const number = get().nextOrderNumber;
        const order: Order = {
          ...o,
          id: `ord-${Date.now()}`,
          number,
          createdAt: Date.now(),
          status: "CREATED",
        };
        set((s) => ({
          orders: [order, ...s.orders],
          nextOrderNumber: s.nextOrderNumber + 1,
        }));
        return order;
      },
      updateOrderStatus: (id, status) =>
        set((s) => ({
          orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)),
        })),
      markOrderArrived: (id) =>
        set((s) => ({
          orders: s.orders.map((o) => (o.id === id ? { ...o, arrived: true } : o)),
        })),
      getOrder: (id) => get().orders.find((o) => o.id === id),
    }),
    {
      name: "juicy-mvp",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        onboardingSeen: s.onboardingSeen,
        selectedOutletId: s.selectedOutletId,
        user: s.user,
        cart: s.cart,
        orders: s.orders,
        nextOrderNumber: s.nextOrderNumber,
      }),
    }
  )
);

// helpers (outside hook)
export function getOutlet(id?: string) {
  return outlets.find((o) => o.id === id);
}

export function computeCartTotal(items: CartItem[]) {
  const subtotal = items.reduce(
    (acc, i) => acc + i.unitPriceAed * i.quantity,
    0
  );
  const vat = +(subtotal * VAT_RATE).toFixed(2);
  const total = +(subtotal + vat).toFixed(2);
  const count = items.reduce((acc, i) => acc + i.quantity, 0);
  return { subtotal, vat, total, count };
}

/**
 * Hook that subscribes to cart only and returns memo-stable totals.
 * Avoids infinite re-render that happens when selector returns a fresh object each call.
 */
export function useCartTotal() {
  const cart = useStore((s) => s.cart);
  return computeCartTotal(cart);
}
