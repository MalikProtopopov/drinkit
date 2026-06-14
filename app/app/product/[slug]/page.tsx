"use client";
import { useEffect, useMemo, useState, use } from "react";
import { useRouter } from "next/navigation";
import { api, type ApiAddon, type ApiDrink } from "@/lib/api";
import { useStore } from "@/lib/store";
import { BottomSheet } from "@/components/BottomSheet";
import { DrinkArt } from "@/components/DrinkArt";
import { StepperButton } from "@/components/StepperButton";
import { IconClose } from "@/components/icons";
import { Loader } from "@/components/Loader";
import { categoryBg } from "@/components/ApiProductCard";
import { useT } from "@/lib/i18n";

type Sel = Record<number, number>; // addonId -> portions

export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { t } = useT();
  const addToCart = useStore((s) => s.addToCart);
  const locale = useStore((s) => s.user.preferredLocale) === "ar" ? "ar" : "en";

  const [drink, setDrink] = useState<ApiDrink | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sizeId, setSizeId] = useState<number | null>(null);
  const [sel, setSel] = useState<Sel>({});
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [showName, setShowName] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api.drink(slug, locale).then((d) => {
      setDrink(d);
      // дефолтный размер — предвыбран (или первый)
      const def = d.sizes?.find((s) => s.isDefault) ?? d.sizes?.[0];
      setSizeId(def ? def.id : null);
    }).catch(() => setNotFound(true));
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

  const currentSize = useMemo(
    () => drink?.sizes?.find((s) => s.id === sizeId) ?? null,
    [drink, sizeId],
  );

  // тап по пилюле размера — переключение на следующий размер по кругу (референс JOOZ)
  const cycleSize = () => {
    const list = drink?.sizes ?? [];
    if (list.length < 2) return;
    const i = list.findIndex((s) => s.id === sizeId);
    setSizeId(list[(i + 1) % list.length].id);
  };

  // live-пересчёт цены и КБЖУ (PUB-G-03; зеркало серверной формулы, сервер валидирует в preview)
  // старт цены — выбранный размер (если есть), иначе базовая цена напитка
  const totals = useMemo(() => {
    if (!drink) return { price: 0, kcal: 0, protein: 0, fat: 0, carbs: 0 };
    let price = currentSize ? currentSize.price : drink.basePrice,
        kcal = drink.kcal,
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
  }, [drink, sel, currentSize]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  if (notFound) {
    return (
      <div className="jooz-page flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="font-black text-[23px]" style={{ color: "var(--jooz-ink)" }}>{t("Drink unavailable", "المشروب غير متوفر")}</div>
        <button onClick={() => router.push("/home")} className="jooz-cta px-10" style={{ width: "auto" }}>{t("To menu", "إلى القائمة")}</button>
      </div>
    );
  }
  if (!drink) {
    return (
      <div className="jooz-page flex-1 flex flex-col">
        <Loader label={t("Preparing the card…", "نُجهّز البطاقة…")} />
      </div>
    );
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
  const groupSum = (items: ApiAddon[]) =>
    items.reduce((acc, a) => acc + (sel[a.addonId] ?? 0) * a.pricePerPortion, 0);

  const handleAdd = async () => {
    const selections = Object.entries(sel).map(([id, portions]) => ({ addonId: +id, portions }));
    let price = totals.price;
    try {
      price = (await api.preview(drink.slug, selections, locale, sizeId ?? undefined)).price; // серверная правда
    } catch {}
    const label = drink.addons
      .filter((a) => sel[a.addonId])
      .map((a) => `${a.name}${(sel[a.addonId] ?? 0) > 1 ? ` ×${sel[a.addonId]}` : ""}`)
      .join(" • ");
    addToCart({
      productId: String(drink.id), variantCode: currentSize ? String(currentSize.id) : "STD", quantity: 1,
      customName: customName || undefined,
      addons: [], productName: drink.name, productBg: bg, unitPriceAed: price,
      drinkId: drink.id, drinkSlug: drink.slug, previewUrl: drink.previewUrl,
      serverAddons: selections, addonsLabel: label,
      sizeId: currentSize?.id, sizeLabel: currentSize?.label,
    });
    setToast(t("Added to cart", "أُضيف إلى السلة"));
    // после добавления ведём в корзину — там можно продолжить оформление
    setTimeout(() => router.push("/cart"), 500);
  };

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: bg }}>
      {/* медиа напитка (PUB-G-02 AC1) */}
      {drink.videoUrl ? (
        <video src={drink.videoUrl} muted loop playsInline autoPlay
               className="absolute inset-0 w-full h-full object-cover"
               onError={(e) => ((e.target as HTMLVideoElement).style.display = "none")} />
      ) : drink.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={drink.previewUrl} alt="" className="absolute inset-0 w-full h-full object-cover"
             onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <DrinkArt glass="tall" liquid="#F0A340" size={260} />
        </div>
      )}

      {/* тёплые градиенты сверху/снизу (читаемость текста, как в JOOZ) */}
      <div className="absolute top-0 inset-x-0 h-[300px] pointer-events-none"
           style={{ background: "linear-gradient(180deg, rgba(18,11,5,.72) 0%, rgba(18,11,5,0) 100%)" }} />
      <div className="absolute bottom-0 inset-x-0 h-[440px] pointer-events-none"
           style={{ background: "linear-gradient(180deg, rgba(118,64,18,0) 0%, rgba(118,64,18,.5) 42%, rgba(94,50,12,.93) 100%)" }} />

      {/* размытие при открытой категории */}
      {openCat && (
        <div className="absolute inset-0 z-10 animate-fadeIn"
             style={{ background: "rgba(28,17,7,.16)", backdropFilter: "blur(6px)" }}
             onClick={() => setOpenCat(null)} />
      )}

      {/* верх: имя + закрыть (PUB-G-02 AC2) — при открытой категории уезжает вверх и скрывается */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between gap-2 px-4 pt-safe py-3"
           style={{ transform: openCat ? "translateY(-110%)" : "translateY(0)",
                    opacity: openCat ? 0 : 1,
                    pointerEvents: openCat ? "none" : "auto",
                    transition: "transform .34s cubic-bezier(.3,1,.4,1), opacity .28s ease" }}>
        <div className="w-[54px] flex-none flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="JOOZ" className="h-4 w-auto"
               style={{ filter: "brightness(0) invert(1) drop-shadow(0 1px 4px rgba(0,0,0,.4))" }} />
        </div>
        <button onClick={() => setShowName(true)}
                className="flex-1 text-center font-extrabold text-[19px] leading-[1.12] text-white px-1 truncate drop-shadow">
          {customName || drink.name}
        </button>
        <button onClick={() => router.back()} aria-label={t("Close", "إغلاق")}
                className="w-[54px] h-[54px] flex-none rounded-full flex items-center justify-center text-white"
                style={{ background: "rgba(38,26,14,.46)", backdropFilter: "blur(10px)" }}>
          <IconClose size={20} />
        </button>
      </div>

      {/* КБЖУ live (PUB-G-03) — при открытой категории поднимается выше, освобождая место под чипы */}
      <div className="absolute top-[104px] inset-x-0 z-10 px-5"
           style={{ transform: openCat ? "translateY(-78px)" : "translateY(0)",
                    transition: "transform .34s cubic-bezier(.3,1,.4,1)" }}>
        <div className="flex justify-between max-w-[350px] mx-auto">
          <Kbju value={totals.kcal} label={t("energy", "الطاقة")} unit={t("kcal", "سعرة")} />
          <Kbju value={totals.protein} label={t("protein", "بروتين")} unit={t("g", "غ")} />
          <Kbju value={totals.fat} label={t("fat", "دهون")} unit={t("g", "غ")} />
          <Kbju value={totals.carbs} label={t("carbs", "كربوهيدرات")} unit={t("g", "غ")} />
        </div>
        {/* «Подробнее» показываем только если для текущей локали есть rich-описание */}
        {drink.richDescription && (
          <div className="flex justify-center mt-3">
            <button onClick={() => setShowDescription(true)}
                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[15px] font-bold text-white"
                    style={{ background: "rgba(38,26,14,.46)", backdropFilter: "blur(10px)" }}>
              {t("more", "المزيد")} <span className="text-[12px] opacity-90">⌄</span>
            </button>
          </div>
        )}
      </div>

      {/* низ: всплывающие добавки → чипы категорий → CTA */}
      <div className="absolute bottom-0 inset-x-0 z-20 pb-safe">
        {/* всплывшие опции выбранной категории (JOOZ raised cards) */}
        {openCat && (
          <div className="pb-3 pt-1 overflow-x-auto no-scrollbar animate-popoverUp">
            <div className="flex gap-3.5 px-4 pr-5 items-end w-max">
              {groups.find((g) => g.name === openCat)?.items.map((a) => {
                const qty = sel[a.addonId] ?? 0;
                const selected = qty > 0;
                const isCounter = a.selectionType === "counter";
                return selected ? (
                  <div key={a.addonId} className="flex-none rounded-[20px] bg-white flex flex-col items-center px-3 pt-3 pb-3"
                       style={{ width: 128, boxShadow: "0 22px 44px -16px rgba(0,0,0,.5)" }}>
                    <AddonGlyph addon={a} size={68} className="animate-pop" />
                    <div className="font-semibold text-[13.5px] text-center leading-[1.15] mt-1 flex items-center"
                         style={{ color: "var(--jooz-ink-2)", minHeight: 32 }}>{a.name}</div>
                    <div className="font-medium text-[12px] whitespace-nowrap mt-0.5 mb-2.5" style={{ color: "#9c9081" }}>
                      {a.free ? t("included", "مشمول") : `+${a.pricePerPortion} AED`}
                    </div>
                    {isCounter ? (
                      <div className="flex items-center gap-2">
                        <StepperButton icon="minus" size={36} onClick={() => toggle(a, "dec")} />
                        <span className="min-w-[26px] text-center font-bold text-[16px]" style={{ color: "var(--jooz-ink-2)" }}>{qty}</span>
                        <StepperButton icon="plus" size={36} onClick={() => toggle(a, "inc")} />
                      </div>
                    ) : (
                      <button onClick={() => toggle(a, "toggle")} aria-label={t("Remove", "إزالة")}
                              className="w-[38px] h-[38px] rounded-full flex items-center justify-center"
                              style={{ color: "var(--color-primary-500)" }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    )}
                  </div>
                ) : (
                  <button key={a.addonId} onClick={() => toggle(a, isCounter ? "inc" : "toggle")}
                          className="flex-none rounded-[20px] flex flex-col items-center px-3 pt-3 pb-3"
                          style={{ width: 128, background: "rgba(70,48,26,.5)", backdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,.14)" }}>
                    <AddonGlyph addon={a} size={58} />
                    <div className="font-semibold text-[13.5px] text-center leading-[1.15] mt-1.5 text-white flex items-center"
                         style={{ minHeight: 32 }}>{a.name}</div>
                    <div className="font-medium text-[12px] whitespace-nowrap mt-0.5 mb-2.5" style={{ color: "rgba(255,255,255,.7)" }}>
                      {a.free ? t("included", "مشمول") : `+${a.pricePerPortion} AED`}
                    </div>
                    <span className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-white"
                          style={{ background: "rgba(255,255,255,.16)" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* чипы категорий добавок (JOOZ) */}
        {groups.length > 0 && (
          <div className="overflow-x-auto no-scrollbar pb-3 pt-2">
            <div className="flex gap-3 px-4 pr-5 items-stretch w-max">
              {groups.map((g) => {
                const count = groupCount(g.items);
                const sum = groupSum(g.items);
                const isOpen = openCat === g.name;
                const first = g.items[0];
                return (
                  <button key={g.name} onClick={() => setOpenCat(isOpen ? null : g.name)}
                          className="flex-none rounded-[18px] flex flex-col items-center justify-center gap-1 px-2 active:scale-[0.97] transition"
                          style={{ width: 80, height: 100, background: "rgba(70,48,26,.5)", backdropFilter: "blur(12px)",
                                   boxShadow: isOpen ? "inset 0 0 0 2px #fff" : "none" }}>
                    <div className="relative flex items-center justify-center transition-transform duration-200"
                         style={{ height: 40, transform: isOpen ? "scale(1.12)" : "scale(1)" }}>
                      {first && <AddonGlyph addon={first} size={36} />}
                      {count > 0 && (
                        <span className="absolute -top-1 -right-2.5 min-w-[17px] h-[17px] px-1 rounded-full text-white text-[10.5px] font-bold flex items-center justify-center"
                              style={{ background: "var(--color-primary-500)" }}>{count}</span>
                      )}
                    </div>
                    <div className="text-[11px] font-medium text-white text-center leading-[1.08] line-clamp-2">{g.name}</div>
                    {sum > 0 ? (
                      <div className="text-[10.5px] font-semibold whitespace-nowrap" style={{ color: "rgba(255,255,255,.85)" }}>+{sum} AED</div>
                    ) : count > 0 ? (
                      <div className="text-[10.5px] font-semibold whitespace-nowrap" style={{ color: "rgba(255,255,255,.85)" }}>{count} {t("pcs", "قطعة")}</div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* размер + CTA в одну строку (как в референсе JOOZ): пилюля размера тапом
            циклит размеры и показывает только объём, цена — в кнопке «В корзину» */}
        <div className="px-4 pt-1 flex items-center gap-3">
          {/* объём: тап циклит размеры (если их несколько), иначе просто показываем объём */}
          {currentSize && (
            drink.sizes.length > 1 ? (
              <button onClick={cycleSize} aria-label={t("Size", "الحجم")}
                      className="flex-none h-[62px] px-5 rounded-full font-extrabold text-[17px] text-white flex items-center justify-center active:scale-[0.97] transition"
                      style={{ background: "rgba(38,26,14,.46)", backdropFilter: "blur(10px)" }}>
                {currentSize.label}
              </button>
            ) : (
              <div className="flex-none h-[62px] px-5 rounded-full font-extrabold text-[17px] text-white flex items-center justify-center"
                   style={{ background: "rgba(38,26,14,.46)", backdropFilter: "blur(10px)" }}>
                {currentSize.label}
              </div>
            )
          )}
          <button onClick={handleAdd} className="jooz-cta flex-1 min-w-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t("Add to cart", "أضف إلى السلة")} · {totals.price} AED
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-white shadow-lg rounded-2xl px-4 py-3 z-50 text-[15px] font-bold flex items-center gap-2 animate-fadeUp"
             style={{ color: "var(--jooz-ink)" }}>
          <span className="w-6 h-6 rounded-full text-white flex items-center justify-center text-sm"
                style={{ background: "var(--color-success)" }}>✓</span>
          {toast}
        </div>
      )}

      {/* «назови напиток» */}
      <BottomSheet open={showName} onClose={() => setShowName(false)}>
        <div className="px-6 pb-safe pt-2">
          <div className="font-black text-[23px] mb-4" style={{ color: "var(--jooz-ink)" }}>{t("Name your drink", "سمِّ مشروبك")}</div>
          <input value={customName} onChange={(e) => setCustomName(e.target.value.slice(0, 30))}
                 placeholder={drink.name} autoFocus
                 className="w-full h-14 px-5 rounded-2xl outline-none text-[17px] font-bold"
                 style={{ background: "#f7f8fa", border: "2px solid #eceef1", color: "var(--jooz-ink)" }} />
          <button onClick={() => setShowName(false)} className="jooz-cta mt-4">{t("Done", "تم")}</button>
          <div className="h-4" />
        </div>
      </BottomSheet>

      {/* детали напитка */}
      <BottomSheet open={showDescription} onClose={() => setShowDescription(false)}>
        <div className="px-7 pb-safe pt-2">
          <div className="font-black text-[27px] leading-[1.08] max-w-[280px]" style={{ color: "var(--jooz-ink)" }}>{drink.name}</div>
          {/* rich-описание из админки (санитизировано на бэке) */}
          {drink.richDescription && (
            <div className="rich-desc mt-3.5" dir={locale === "ar" ? "rtl" : "ltr"}
                 dangerouslySetInnerHTML={{ __html: drink.richDescription }} />
          )}
          <div className="font-black text-[21px] mt-7" style={{ color: "var(--jooz-ink)" }}>{t("nutrition facts", "القيمة الغذائية")}</div>
          <div className="grid grid-cols-4 gap-2 mt-3">
            {[[t("energy", "الطاقة"), `${totals.kcal} ${t("kcal", "سعرة")}`], [t("protein", "بروتين"), `${totals.protein} ${t("g", "غ")}`], [t("fat", "دهون"), `${totals.fat} ${t("g", "غ")}`], [t("carbs", "كربوهيدرات"), `${totals.carbs} ${t("g", "غ")}`]].map(([l, v]) => (
              <div key={l} className="rounded-2xl py-3 text-center" style={{ background: "#f3f4f7" }}>
                <div className="font-extrabold text-[15px]" style={{ color: "var(--jooz-ink)" }}>{v}</div>
                <div className="text-[12px] mt-0.5" style={{ color: "var(--jooz-muted)" }}>{l}</div>
              </div>
            ))}
          </div>
          <div className="h-6" />
        </div>
      </BottomSheet>
    </div>
  );
}

/** Иконка добавки: реальная картинка из API либо буквенный кружок-фолбэк. */
function AddonGlyph({ addon, size, className = "" }: { addon: ApiAddon; size: number; className?: string }) {
  if (addon.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={addon.imageUrl} alt="" className={`object-contain ${className}`}
           style={{ width: size, height: size, filter: "drop-shadow(0 6px 10px rgba(40,25,8,.3))" }} />
    );
  }
  return (
    <div className={`rounded-full flex items-center justify-center font-black ${className}`}
         style={{ width: size, height: size, fontSize: size * 0.4, background: "rgba(255,255,255,.85)", color: "var(--jooz-ink-2)" }}>
      {addon.name.slice(0, 1)}
    </div>
  );
}

function Kbju({ value, label, unit }: { value: string | number; label: string; unit?: string }) {
  return (
    <div className="text-center text-white flex-1">
      <div className="font-extrabold text-[19px] leading-tight">
        {value}
        {unit && <span className="text-[12.5px] font-bold opacity-80"> {unit}</span>}
      </div>
      <div className="text-[12.5px] leading-tight mt-0.5 font-semibold opacity-70">{label}</div>
    </div>
  );
}
