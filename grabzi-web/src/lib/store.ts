/** Эфемерное состояние: выбранная локация + черновик заказа (счётчики). Фронт-спека §1.5. */
"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type Draft = {
  locationId: number | null;
  items: Record<number, number>; // drinkId -> qty
  setLocation: (id: number) => void;
  setQty: (drinkId: number, qty: number) => void;
  /** Оставить в корзине только напитки, доступные на текущей точке (C1/X2). */
  pruneItems: (validIds: number[]) => void;
  totalDrinks: () => number;
  clear: () => void;
};

export const useOrderDraft = create<Draft>()(
  persist(
    (set, get) => ({
      locationId: null,
      items: {},
      setLocation: (id) => set({ locationId: id }),
      setQty: (drinkId, qty) =>
        set((s) => {
          const items = { ...s.items };
          if (qty <= 0) delete items[drinkId];
          else items[drinkId] = qty;
          return { items };
        }),
      pruneItems: (validIds) =>
        set((s) => {
          const valid = new Set(validIds);
          const items: Record<number, number> = {};
          for (const [id, q] of Object.entries(s.items)) {
            if (valid.has(Number(id))) items[Number(id)] = q;
          }
          return { items };
        }),
      totalDrinks: () => Object.values(get().items).reduce((a, b) => a + b, 0),
      clear: () => set({ items: {} }),
    }),
    {
      name: "grabzi-draft",
      version: 1,
      // WEB-13: миграция стейта между версиями схемы — не теряем корзину при bump version
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Partial<Draft>;
        if (version < 1) {
          return { ...s, items: (s.items && typeof s.items === "object") ? s.items : {} };
        }
        return s as Draft;
      },
    },
  ),
);
