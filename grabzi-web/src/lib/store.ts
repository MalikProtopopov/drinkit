/** Эфемерное состояние: выбранная локация + черновик заказа (счётчики). Фронт-спека §1.5. */
"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type Draft = {
  locationId: number | null;
  items: Record<number, number>; // drinkId -> qty
  setLocation: (id: number) => void;
  setQty: (drinkId: number, qty: number) => void;
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
      totalDrinks: () => Object.values(get().items).reduce((a, b) => a + b, 0),
      clear: () => set({ items: {} }),
    }),
    { name: "grabzi-draft", version: 1 },
  ),
);
