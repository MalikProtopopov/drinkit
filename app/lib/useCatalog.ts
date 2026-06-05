"use client";
import { useEffect, useState } from "react";
import { api, type ApiCategory, type ApiDrinkLite } from "./api";
import { useStore } from "./store";

/** Каталог с бэкенда (PUB-G-01): категории + напитки, фильтр по категории. */
export function useCatalog(categoryId?: number | null) {
  const locale = useStore((s) => s.user.preferredLocale) === "ar" ? "ar" : "ru";
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [drinks, setDrinks] = useState<ApiDrinkLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    api.categories(locale)
      .then((c) => live && setCategories(c))
      .catch(() => live && setError(true));
    return () => { live = false; };
  }, [locale]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    api.drinks(categoryId ?? undefined, locale)
      .then((d) => { if (live) { setDrinks(d); setError(false); } })
      .catch(() => live && setError(true))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [categoryId, locale]);

  return { categories, drinks, loading, error };
}
