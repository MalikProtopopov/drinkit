"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { ApiProductCard } from "@/components/ApiProductCard";
import { useCatalog } from "@/lib/useCatalog";

function MenuInner() {
  // PUB-G-01 AC4: фильтр по категории — query-параметр, состояние шарится ссылкой
  const router = useRouter();
  const search = useSearchParams();
  const catParam = Number(search.get("category"));
  const activeCat = search.get("category") && Number.isInteger(catParam) ? catParam : null;
  const setActiveCat = (id: number | null) =>
    router.replace(id === null ? "/menu" : `/menu?category=${id}`, { scroll: false });
  const { categories, drinks, loading, error } = useCatalog(activeCat);

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Меню" showCart />

      <div className="sticky top-16 bg-white z-10 pt-2 pb-1 border-b border-[var(--color-border)]/40">
        <div className="flex gap-5 overflow-x-auto no-scrollbar px-4">
          <button
            onClick={() => setActiveCat(null)}
            className={`tab-text ${activeCat === null ? "active" : ""}`}
          >
            всё
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`tab-text ${activeCat === c.id ? "active" : ""}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {error && (
          <div className="text-center muted py-12">
            Не удалось загрузить меню.{" "}
            <button className="text-[var(--color-primary-500)] font-semibold"
                    onClick={() => location.reload()}>
              Повторить
            </button>
          </div>
        )}
        {loading && !error && (
          <div className="grid grid-cols-2 gap-3 mt-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-3xl bg-[#F4F4F7] animate-pulse"
                   style={{ aspectRatio: "1/1.1" }} />
            ))}
          </div>
        )}
        {!loading && !error && (
          <div className="grid grid-cols-2 gap-3 mt-6">
            {drinks.map((d) => <ApiProductCard key={d.id} drink={d} />)}
            {drinks.length === 0 && (
              <div className="col-span-2 text-center muted py-12">В этой категории пока пусто</div>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

export default function MenuPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <MenuInner />
    </Suspense>
  );
}
