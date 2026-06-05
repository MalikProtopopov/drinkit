"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { ApiProductCard, categoryBg } from "@/components/ApiProductCard";
import { DrinkArt } from "@/components/DrinkArt";
import { useCatalog } from "@/lib/useCatalog";

export default function HomePage() {
  // PUB-G-01: фото категории + активное название в переключателе; данные с бэкенда
  const router = useRouter();
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const { categories, drinks, loading, error } = useCatalog(activeCat);

  const currentCat = useMemo(
    () => categories.find((c) => c.id === activeCat) ?? categories[0],
    [categories, activeCat],
  );
  const featured = drinks[0];

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto pb-20">
        {/* HERO: фото активной категории */}
        <section className="relative" style={{ height: "52dvh", minHeight: 400 }}>
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: currentCat ? categoryBg(currentCat.id) : "#F4EEE4" }}
          >
            {currentCat?.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentCat.photoUrl} alt="" className="absolute inset-0 w-full h-full object-cover"
                   onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
            ) : null}
            <DrinkArt glass="tall" liquid="#F0A340" garnish="mint" size={220} />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-[42%] pointer-events-none"
               style={{ background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.45) 100%)" }} />

          {/* верхние чипы: лого + профиль */}
          <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-4 pt-safe py-3">
            <div className="flex items-center gap-2 bg-white/40 backdrop-blur-md rounded-full px-3.5 h-9">
              <span className="text-[14px] font-bold text-white">juicy</span>
            </div>
            <Link href="/profile"
                  className="w-9 h-9 rounded-full bg-white/40 backdrop-blur-md flex items-center justify-center text-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="4" />
                <path d="M3 21c0-4.5 4-7 9-7s9 2.5 9 7" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            </Link>
          </div>

          {/* название активной категории + featured */}
          {featured && (
            <button onClick={() => router.push(`/product/${featured.slug}`)}
                    className="absolute inset-x-0 bottom-20 text-center px-6 active:opacity-95 transition">
              <h1 className="hero-title text-[28px] leading-[1.05] text-white drop-shadow">
                {featured.name}
              </h1>
              <div className="text-body text-white/80 mt-1">подробнее</div>
            </button>
          )}

          {/* переключатель категорий с бэкенда */}
          <div className="absolute inset-x-0 bottom-0 pb-3">
            <div className="flex gap-6 overflow-x-auto no-scrollbar px-4">
              <button onClick={() => setActiveCat(null)}
                      className={`tab-text tab-text-on-media ${activeCat === null ? "active" : ""}`}>
                все
              </button>
              {categories.map((c) => (
                <button key={c.id} onClick={() => setActiveCat(c.id)}
                        className={`tab-text tab-text-on-media ${activeCat === c.id ? "active" : ""}`}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* грид напитков */}
        <div className="px-4 mt-6">
          <h2 className="text-h2 mb-3">{currentCat && activeCat !== null ? currentCat.name : "Напитки"}</h2>
          {error && (
            <div className="text-center muted py-12">
              Сервер недоступен.{" "}
              <button className="text-[var(--color-primary-500)] font-semibold"
                      onClick={() => location.reload()}>Повторить</button>
            </div>
          )}
          {loading && !error && (
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-3xl bg-[#F4F4F7] animate-pulse" style={{ aspectRatio: "1/1.1" }} />
              ))}
            </div>
          )}
          {!loading && !error && (
            <div className="grid grid-cols-2 gap-3">
              {drinks.map((d) => <ApiProductCard key={d.id} drink={d} />)}
              {drinks.length === 0 && (
                <div className="col-span-2 text-center muted py-12">В этой категории пока пусто</div>
              )}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
