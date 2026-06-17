"use client";
import { useEffect, useMemo, useState } from "react";
import { api, type ApiAddon, type ApiDrink, type ApiSize } from "@/lib/api";

type Sel = Record<number, number>; // addonId -> portions

// загрузка напитка по slug + локали; возвращает напиток, флаг 404 и сеттер размера по умолчанию
export function useProductData(slug: string, locale: string) {
  const [drink, setDrink] = useState<ApiDrink | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sizeId, setSizeId] = useState<number | null>(null);

  useEffect(() => {
    api.drink(slug, locale).then((d) => {
      setDrink(d);
      // дефолтный размер — предвыбран (или первый)
      const def = d.sizes?.find((s) => s.isDefault) ?? d.sizes?.[0];
      setSizeId(def ? def.id : null);
    }).catch(() => setNotFound(true));
  }, [slug, locale]);

  return { drink, notFound, sizeId, setSizeId };
}

// группировка добавок по категориям (PUB-G-02 AC3/AC4)
export function useAddonGroups(drink: ApiDrink | null) {
  return useMemo(() => {
    const map = new Map<string, ApiAddon[]>();
    for (const a of drink?.addons ?? []) {
      if (!map.has(a.categoryName)) map.set(a.categoryName, []);
      map.get(a.categoryName)!.push(a);
    }
    return [...map.entries()].map(([name, items]) => ({ name, items }));
  }, [drink]);
}

// объём размера в базовых единицах per-100 (мл/г); л → мл (зеркало drink_calc.size_amount)
function sizeAmount(s: ApiSize | null): number | null {
  if (!s) return null;
  return s.unit === "l" ? s.volume * 1000 : s.volume;
}

// live-пересчёт цены и КБЖУ (PUB-G-03; зеркало серверной формулы, сервер валидирует в preview)
// старт цены — выбранный размер (если есть), иначе базовая цена напитка
// КБЖУ базы масштабируются по объёму выбранного размера (значения хранятся на 100 мл/г)
export function usePriceAndNutrition(
  drink: ApiDrink | null,
  selections: Sel,
  currentSize: ApiSize | null,
) {
  return useMemo(() => {
    if (!drink) return { price: 0, kcal: 0, protein: 0, fat: 0, carbs: 0 };
    const amt = sizeAmount(currentSize);
    const sf = amt ? amt / 100 : 1; // коэффициент per-100 → размер
    let price = currentSize ? currentSize.price : drink.basePrice,
        kcal = drink.kcalPer100 * sf,
        protein = drink.proteinPer100 * sf, fat = drink.fatPer100 * sf, carbs = drink.carbsPer100 * sf;
    for (const a of drink.addons) {
      const n = selections[a.addonId] ?? 0;
      if (!n) continue;
      const k = (n * a.portionAmount) / (a.defaultPortions * a.portionAmount); // отн. дефолта
      price += a.pricePerPortion * n;
      kcal += a.kcal * k; protein += a.protein * k; fat += a.fat * k; carbs += a.carbs * k;
    }
    return { price: +price.toFixed(2), kcal: Math.round(kcal),
             protein: +protein.toFixed(1), fat: +fat.toFixed(1), carbs: +carbs.toFixed(1) };
  }, [drink, selections, currentSize]);
}
