"use client";
import { useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { categoryBg } from "@/components/ApiProductCard";
import { DrinkArt } from "@/components/DrinkArt";
import { ProfileSheet } from "@/components/ProfileSheet";
import { IconBag, IconUser } from "@/components/icons";
import { useCatalog } from "@/lib/useCatalog";
import { useCartTotal } from "@/lib/store";
import { useT } from "@/lib/i18n";
import type { ApiDrinkLite } from "@/lib/api";

function HomeInner({ initialProfileOpen = false }: { initialProfileOpen?: boolean }) {
  // PUB-G-01: фото категории + активное название; AC4 — фильтр в query-параметре
  const { t } = useT();
  const router = useRouter();
  const search = useSearchParams();
  // AC4 — фильтр по slug категории в query-параметре (?category=fresh)
  const activeCat = search.get("category") || null;
  const setActiveCat = (slug: string | null) =>
    router.replace(slug === null ? "/home" : `/home?category=${encodeURIComponent(slug)}`, { scroll: false });
  const { categories, drinks, loading, error } = useCatalog(activeCat);

  const cartCount = useCartTotal().count;

  // профиль-шторка: открывается по аватарке (а также при заходе на /profile)
  const [profileOpen, setProfileOpen] = useState(initialProfileOpen);
  const closeProfile = () => {
    if (initialProfileOpen) router.replace("/home");
    else setProfileOpen(false);
  };

  const currentCat = useMemo(
    () => categories.find((c) => c.slug === activeCat) ?? categories[0],
    [categories, activeCat],
  );
  const featured = drinks[0];

  return (
    <div className="jooz-page absolute inset-0 flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto pb-24 no-scrollbar">
        {/* ======== HERO: featured-напиток активной категории ======== */}
        <section className="relative" style={{ height: "62dvh", minHeight: 460 }}>
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: currentCat ? categoryBg(currentCat.id) : "#EDEFF3" }}
          >
            {/* пока грузится каталог — мягкий skeleton вместо нарисованного сока */}
            {loading && <div className="absolute inset-0 skeleton" style={{ borderRadius: 0 }} />}
            {!loading && !featured?.videoUrl && !featured?.previewUrl && (
              <DrinkArt glass="tall" liquid="#F0A340" garnish="mint" size={240} />
            )}
            {featured?.videoUrl ? (
              <video key={featured.id} src={featured.videoUrl} poster={featured.previewUrl}
                     muted loop playsInline autoPlay
                     className="absolute inset-0 w-full h-full object-cover"
                     onError={(e) => ((e.target as HTMLVideoElement).style.display = "none")} />
            ) : featured?.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={featured.previewUrl} alt="" className="absolute inset-0 w-full h-full object-cover"
                   onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
            ) : null}
          </div>

          {/* верхняя «дымка» под белый статус-текст и нижний переход в фон страницы */}
          <div className="absolute inset-x-0 top-0 h-32 pointer-events-none"
               style={{ background: "linear-gradient(180deg, rgba(26,15,5,.6) 0%, rgba(26,15,5,.18) 55%, rgba(26,15,5,0) 100%)" }} />
          <div className="absolute inset-x-0 bottom-0 h-[46%] pointer-events-none"
               style={{ background: "linear-gradient(180deg, rgba(236,238,241,0) 0%, rgba(236,238,241,.7) 62%, var(--jooz-bg) 100%)" }} />

          {/* кликабельная область видео — начинается ПОД шапкой (без мисклика по лого/иконкам) */}
          {featured && (
            <button onClick={() => router.push(`/product/${featured.slug}`)}
                    aria-label={t(`Open ${featured.name}`, `افتح ${featured.name}`)}
                    className="absolute inset-x-0 bottom-0 z-[5]"
                    style={{ top: "calc(env(safe-area-inset-top, 0px) + 64px)" }} />
          )}

          {/* лого + профиль */}
          <div className="absolute top-0 inset-x-0 z-20 flex items-start justify-between px-5 pt-safe pb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="JOOZ" className="h-[26px] w-auto mt-0.5"
                 style={{ filter: "brightness(0) invert(1) drop-shadow(0 1px 3px rgba(0,0,0,.6)) drop-shadow(0 3px 12px rgba(0,0,0,.45))" }} />
            <div className="flex items-center gap-2.5">
              {/* корзина: видно количество позиций и быстрый переход к оформлению */}
              <Link href="/cart" aria-label={t("Cart", "السلة")}
                    className="relative w-11 h-11 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-[#c2b6a3] shadow-md">
                <IconBag size={21} />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[19px] h-[19px] px-1 rounded-full text-white text-[11px] font-bold flex items-center justify-center"
                        style={{ background: "var(--color-primary-500)" }}>{cartCount}</span>
                )}
              </Link>
              <button onClick={() => setProfileOpen(true)} aria-label={t("Profile", "الملف الشخصي")}
                      className="w-11 h-11 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-[#c2b6a3] shadow-md">
                <IconUser size={22} />
              </button>
            </div>
          </div>

          {/* featured-напиток */}
          {featured && (
            <button onClick={() => router.push(`/product/${featured.slug}`)}
                    className="absolute inset-x-0 bottom-4 px-6 z-10 text-center active:opacity-90 transition">
              <div className="font-black leading-[1.06] tracking-tight"
                   style={{ color: "var(--jooz-ink)", fontSize: 27 }}>
                {featured.name}
              </div>
              <div className="mt-1.5 font-extrabold text-[17px]" style={{ color: "#3a3e47" }}>
                {featured.basePrice} AED
              </div>
            </button>
          )}
        </section>

        {/* ======== табы категорий: липнут к верху при скролле (шапка-переключатель) ======== */}
        <div className="sticky top-0 z-20"
             style={{ background: "var(--jooz-bg)", boxShadow: "0 10px 16px -14px rgba(40,25,8,.25)" }}>
          <div className="flex gap-5 overflow-x-auto no-scrollbar px-6 pt-2.5 pb-2.5">
            <button onClick={() => setActiveCat(null)}
                    className={`jooz-tab ${activeCat === null ? "active" : ""}`}>{t("all", "الكل")}</button>
            {categories.map((c) => (
              <button key={c.id} onClick={() => setActiveCat(c.slug)}
                      className={`jooz-tab ${activeCat === c.slug ? "active" : ""}`}>{c.name}</button>
            ))}
          </div>
        </div>

        {/* ======== грид напитков ======== */}
        <div className="px-4 pt-4">
          <div className="font-black px-1.5 pb-3.5" style={{ color: "var(--jooz-ink)", fontSize: 23 }}>
            {currentCat && activeCat !== null ? currentCat.name : t("Drinks", "المشروبات")}
          </div>

          {error && (
            <div className="text-center py-12" style={{ color: "var(--jooz-muted)" }}>
              {t("Server unavailable.", "الخادم غير متاح.")}{" "}
              <button className="font-bold" style={{ color: "var(--color-primary-500)" }}
                      onClick={() => location.reload()}>{t("Retry", "إعادة المحاولة")}</button>
            </div>
          )}

          {loading && !error && (
            <div className="grid grid-cols-2 gap-3.5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton" style={{ borderRadius: 22, aspectRatio: "1/1.32" }} />
              ))}
            </div>
          )}

          {!loading && !error && (
            <div className="grid grid-cols-2 gap-3.5">
              {drinks.map((d) => <JoozCard key={d.id} drink={d} onOpen={() => router.push(`/product/${d.slug}`)} />)}
              {drinks.length === 0 && (
                <div className="col-span-2 text-center py-12" style={{ color: "var(--jooz-muted)" }}>
                  {t("This category is empty for now", "هذه الفئة فارغة حاليًا")}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ProfileSheet open={profileOpen} onClose={closeProfile} />
    </div>
  );
}

/** Карточка напитка JOOZ: белая, скруглённая, фото + название + цена + стрелка. */
function JoozCard({ drink, onOpen }: { drink: ApiDrinkLite; onOpen: () => void }) {
  const hasMedia = Boolean(drink.videoUrl || drink.previewUrl);
  return (
    <button onClick={onOpen} className="jooz-card overflow-hidden text-left active:scale-[0.985] transition">
      <div className="relative w-full" style={{ height: 158, background: categoryBg(drink.categoryId) }}>
        {!hasMedia && (
          <div className="absolute inset-0 flex items-end justify-center pointer-events-none">
            <DrinkArt glass="tall" liquid="#F0A340" size={132} showShadow={false} />
          </div>
        )}
        {drink.videoUrl ? (
          <video src={drink.videoUrl} poster={drink.previewUrl} muted loop playsInline autoPlay preload="metadata"
                 className="absolute inset-0 w-full h-full object-cover"
                 onError={(e) => ((e.target as HTMLVideoElement).style.display = "none")} />
        ) : drink.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={drink.previewUrl} alt="" className="absolute inset-0 w-full h-full object-cover"
               onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
        ) : null}
      </div>
      <div className="px-3.5 pt-3 pb-3.5">
        <div className="font-extrabold leading-[1.15] line-clamp-2"
             style={{ color: "var(--jooz-ink)", fontSize: 15, minHeight: 35 }}>
          {drink.name}
        </div>
        <div className="flex items-center justify-between mt-2.5">
          <span className="font-extrabold whitespace-nowrap" style={{ color: "var(--jooz-ink)", fontSize: 15 }}>
            {drink.basePrice} AED
          </span>
          <span className="jooz-arrow">→</span>
        </div>
      </div>
    </button>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="jooz-page absolute inset-0" />}>
      <HomeInner />
    </Suspense>
  );
}

/** Главная с заранее открытой шторкой профиля — используется маршрутом /profile. */
export function HomeWithProfile() {
  return (
    <Suspense fallback={<div className="jooz-page absolute inset-0" />}>
      <HomeInner initialProfileOpen />
    </Suspense>
  );
}
