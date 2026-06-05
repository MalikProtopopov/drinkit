"use client";
import { useEffect, useMemo, useState, use } from "react";
import { useRouter } from "next/navigation";
import { api, type ApiAddon, type ApiDrink } from "@/lib/api";
import { useStore } from "@/lib/store";
import { BottomSheet } from "@/components/BottomSheet";
import { DrinkArt } from "@/components/DrinkArt";
import { StepperButton } from "@/components/StepperButton";
import { categoryBg } from "@/components/ApiProductCard";

type Sel = Record<number, number>; // addonId -> portions

export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const addToCart = useStore((s) => s.addToCart);
  const locale = useStore((s) => s.user.preferredLocale) === "ar" ? "ar" : "ru";

  const [drink, setDrink] = useState<ApiDrink | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sel, setSel] = useState<Sel>({});
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [showName, setShowName] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api.drink(slug, locale).then(setDrink).catch(() => setNotFound(true));
  }, [slug, locale]);

  // группировка добавок по категориям (PUB-G-02 AC3/AC4)
  const groups = useMemo(() => {
    const map = new Map<string, ApiAddon[]>();
    for (const a of drink?.addons ?? []) {
      if (!map.has(a.categoryName)) map.set(a.categoryName, []);
      map.get(a.categoryName)!.push(a);
    }
    return [...map.entries()].map(([name, items]) => ({ name, items }));
  }, [drink]);

  // live-пересчёт цены и КБЖУ (PUB-G-03; зеркало серверной формулы, сервер валидирует в preview)
  const totals = useMemo(() => {
    if (!drink) return { price: 0, kcal: 0, protein: 0, fat: 0, carbs: 0 };
    let price = drink.basePrice, kcal = drink.kcal,
        protein = drink.protein, fat = drink.fat, carbs = drink.carbs;
    for (const a of drink.addons) {
      const n = sel[a.addonId] ?? 0;
      if (!n) continue;
      const k = (n * a.portionAmount) / (a.defaultPortions * a.portionAmount); // отн. дефолта
      price += a.pricePerPortion * n;
      kcal += a.kcal * k; protein += a.protein * k; fat += a.fat * k; carbs += a.carbs * k;
    }
    return { price: +price.toFixed(2), kcal: Math.round(kcal),
             protein: +protein.toFixed(1), fat: +fat.toFixed(1), carbs: +carbs.toFixed(1) };
  }, [drink, sel]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  if (notFound) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="text-h2">Напиток недоступен</div>
        <button onClick={() => router.push("/home")} className="btn-pill btn-primary px-8">В меню</button>
      </div>
    );
  }
  if (!drink) {
    return <div className="flex-1 flex items-center justify-center muted">Загрузка…</div>;
  }

  const bg = categoryBg(drink.categoryId);

  const toggle = (a: ApiAddon, action: "toggle" | "inc" | "dec") => {
    setSel((prev) => {
      const cur = prev[a.addonId] ?? 0;
      const next = { ...prev };
      if (a.selectionType === "counter") {
        if (action === "inc" && cur < a.maxPortions) next[a.addonId] = cur + 1;
        else if (action === "dec") {
          if (cur <= 1) delete next[a.addonId];
          else next[a.addonId] = cur - 1;
        } else if (action === "toggle" && cur === 0) next[a.addonId] = Math.max(1, a.minPortions);
        return next;
      }
      // single: одна добавка в категории; multi: несколько по 1 порции (ADM-S-02 AC4)
      if (cur > 0) { delete next[a.addonId]; return next; }
      if (a.selectionType === "single") {
        for (const other of drink.addons)
          if (other.categoryId === a.categoryId) delete next[other.addonId];
      }
      next[a.addonId] = 1;
      return next;
    });
  };

  const groupCount = (items: ApiAddon[]) =>
    items.reduce((acc, a) => acc + (sel[a.addonId] ?? 0), 0);

  const handleAdd = async () => {
    const selections = Object.entries(sel).map(([id, portions]) => ({ addonId: +id, portions }));
    let price = totals.price;
    try {
      price = (await api.preview(drink.slug, selections, locale)).price; // серверная правда
    } catch {}
    const label = drink.addons
      .filter((a) => sel[a.addonId])
      .map((a) => `${a.name}${(sel[a.addonId] ?? 0) > 1 ? ` ×${sel[a.addonId]}` : ""}`)
      .join(" • ");
    addToCart({
      productId: String(drink.id), variantCode: "STD", quantity: 1,
      customName: customName || undefined,
      addons: [], productName: drink.name, productBg: bg, unitPriceAed: price,
      drinkId: drink.id, drinkSlug: drink.slug,
      serverAddons: selections, addonsLabel: label,
    });
    setToast("Добавлено в корзину");
    setTimeout(() => router.back(), 500);
  };

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: bg }}>
      {/* видео напитка в активном режиме (PUB-G-02 AC1) */}
      {drink.videoUrl ? (
        <video src={drink.videoUrl} muted loop playsInline autoPlay
               className="absolute inset-0 w-full h-full object-cover"
               onError={(e) => ((e.target as HTMLVideoElement).style.display = "none")} />
      ) : null}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <DrinkArt glass="tall" liquid="#F0A340" size={260} />
      </div>
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.18) 0%, transparent 14%, transparent 60%, rgba(0,0,0,0.25) 100%)" }} />

      {/* верх: имя + назад (PUB-G-02 AC2) */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 pt-safe py-3">
        <button onClick={() => setShowName(true)}
                className="text-h3 font-semibold px-3 max-w-[70%] truncate text-white drop-shadow">
          {customName || drink.name}
        </button>
        <button onClick={() => router.back()}
                className="w-10 h-10 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center text-white">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* КБЖУ live */}
      <div className="absolute top-[68px] inset-x-0 z-10 px-6 pt-safe">
        <div className="flex justify-between max-w-[340px] mx-auto">
          <Kbju value={totals.kcal} label="энергия" unit="ккал" />
          <Kbju value={totals.protein} label="белки" unit="г" />
          <Kbju value={totals.fat} label="жиры" unit="г" />
          <Kbju value={totals.carbs} label="углеводы" unit="г" />
        </div>
        <div className="flex justify-center mt-3">
          <button onClick={() => setShowDescription(true)}
                  className="inline-flex items-center gap-1 h-8 px-4 rounded-full text-caption font-medium text-white"
                  style={{ background: "rgba(0,0,0,0.30)", backdropFilter: "blur(8px)" }}>
            подробнее
          </button>
        </div>
      </div>

      {openCat && (
        <div className="absolute inset-0 z-20 animate-fadeIn" style={{ background: "rgba(0,0,0,0.18)" }}
             onClick={() => setOpenCat(null)} />
      )}

      {/* низ: попап добавок → чипы категорий → CTA */}
      <div className="absolute bottom-0 inset-x-0 z-30 pb-safe">
        {openCat && (
          <div className="pb-3 pt-1 overflow-x-auto no-scrollbar animate-popoverUp">
            <div className="flex gap-3 px-4 pr-5 items-stretch w-max">
              {groups.find((g) => g.name === openCat)?.items.map((a) => {
                const qty = sel[a.addonId] ?? 0;
                const selected = qty > 0;
                const isCounter = a.selectionType === "counter";
                return (
                  <div key={a.addonId}
                       className="flex-shrink-0 rounded-2xl overflow-hidden transition flex flex-col"
                       style={{ width: 132, height: 200,
                                background: selected ? "#FFF" : "rgba(255,255,255,0.22)",
                                backdropFilter: selected ? undefined : "blur(14px)" }}
                       onClick={() => !isCounter && toggle(a, "toggle")}>
                    <div className="flex-1 flex flex-col items-center justify-center px-3 pt-3">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
                           style={{ background: selected ? "#F2F2F4" : "rgba(255,255,255,0.3)" }}>
                        {a.name.slice(0, 1)}
                      </div>
                      <div className="text-[13px] font-medium text-center leading-[1.15] mt-2 px-1 line-clamp-2"
                           style={{ color: selected ? "#0E0E10" : "#fff" }}>
                        {a.name}
                      </div>
                      <div className="text-[11px] text-center mt-0.5"
                           style={{ color: selected ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.75)" }}>
                        {a.free ? "бесплатно" : `+${a.pricePerPortion} AED`} · {a.portionAmount}{a.unit === "ml" ? " мл" : " г"}
                      </div>
                    </div>
                    <div className="px-3 pb-3 pt-2" style={{ height: 56 }}>
                      {isCounter && qty > 0 ? (
                        <div className="flex items-center justify-between">
                          <StepperButton icon="minus" size={36}
                                         onClick={(e) => { e.stopPropagation(); toggle(a, "dec"); }} />
                          <span className="text-h3 font-semibold">{qty}</span>
                          <StepperButton icon="plus" size={36}
                                         onClick={(e) => { e.stopPropagation(); toggle(a, "inc"); }} />
                        </div>
                      ) : selected ? (
                        <div className="flex items-center justify-center h-9 rounded-full bg-[var(--color-primary-500)] text-white text-caption font-semibold">
                          выбрано
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggle(a, isCounter ? "inc" : "toggle"); }}
                          className="w-full h-9 rounded-full flex items-center justify-center"
                          style={{ background: "rgba(0,0,0,0.10)", color: "#fff" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {groups.length > 0 && (
          <div className="overflow-x-auto no-scrollbar pb-2 pt-2">
            <div className="flex gap-2 px-3 pr-4 items-stretch w-max">
              {groups.map((g) => {
                const count = groupCount(g.items);
                const isOpen = openCat === g.name;
                return (
                  <button key={g.name} onClick={() => setOpenCat(isOpen ? null : g.name)}
                          className="flex-shrink-0 rounded-2xl flex flex-col items-center justify-between active:scale-[0.97] transition px-2 py-2.5"
                          style={{ width: 86, height: 84,
                                   background: count > 0 || isOpen ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.30)",
                                   backdropFilter: "blur(14px)" }}>
                    <div className="relative">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-base"
                           style={{ background: "rgba(0,0,0,0.06)" }}>
                        {g.name.slice(0, 1)}
                      </div>
                      {count > 0 && (
                        <span className="absolute -top-1.5 -right-2 text-[11px] font-bold text-white rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center"
                              style={{ background: "var(--color-primary-500)" }}>
                          {count}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-medium text-center leading-[1.15] line-clamp-2"
                         style={{ color: count > 0 || isOpen ? "#0E0E10" : "#fff" }}>
                      {g.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="px-4 pt-1">
          <button onClick={handleAdd} className="btn-pill btn-primary w-full">
            В корзину · {totals.price} AED
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-white shadow-lg rounded-2xl px-4 py-3 z-50 text-body font-medium flex items-center gap-2 animate-fadeUp">
          <span className="w-6 h-6 rounded-full bg-[var(--color-success)] text-white flex items-center justify-center text-sm">✓</span>
          {toast}
        </div>
      )}

      <BottomSheet open={showName} onClose={() => setShowName(false)}>
        <div className="px-6 pb-safe pt-4">
          <div className="text-h3 font-semibold text-center mb-4">Назови напиток</div>
          <input value={customName} onChange={(e) => setCustomName(e.target.value.slice(0, 30))}
                 placeholder={drink.name} autoFocus
                 className="w-full h-14 px-5 rounded-2xl bg-[#F4F4F7] outline-none text-h3" />
          <button onClick={() => setShowName(false)} className="btn-pill btn-primary w-full mt-4">
            Готово
          </button>
          <div className="h-6" />
        </div>
      </BottomSheet>

      <BottomSheet open={showDescription} onClose={() => setShowDescription(false)}>
        <div className="px-6 pb-safe pt-2">
          <div className="text-h2 mb-4">{drink.name}</div>
          <div className="text-body muted leading-relaxed mb-6">{drink.description}</div>
        </div>
      </BottomSheet>
    </div>
  );
}

function Kbju({ value, label, unit }: { value: string | number; label: string; unit?: string }) {
  return (
    <div className="text-center text-white drop-shadow-sm">
      <div className="text-[18px] font-semibold leading-tight">
        {value}
        {unit && <span className="text-[12px] font-medium opacity-80"> {unit}</span>}
      </div>
      <div className="text-[11px] leading-tight mt-0.5 opacity-70">{label}</div>
    </div>
  );
}
