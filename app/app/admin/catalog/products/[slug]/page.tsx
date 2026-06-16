"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { useToast } from "@/components/admin/AdminUI";
import { catalogApi, type AddonCat, type AdminAddon, type AdminDrink, type Binding, type DrinkCat, type DrinkSize, type Unit } from "@/lib/adminApi";
import { ProductMainTab } from "@/components/admin/product-editor/ProductMainTab";
import { ProductSizesTab } from "@/components/admin/product-editor/ProductSizesTab";
import { ProductDescriptionTab } from "@/components/admin/product-editor/ProductDescriptionTab";
import { ProductBindingsTab } from "@/components/admin/product-editor/ProductBindingsTab";

/** ADM-S-05: редактор напитка — поля, статус, и промежуточная таблица напиток×добавка:
 *  цена в этом напитке (пусто = бесплатно), мин/дефолт/макс порций, объём порции,
 *  override типа выбора. */
function Editor({ slug }: { slug: string }) {
  const router = useRouter();
  const toast = useToast();
  const [drink, setDrink] = useState<AdminDrink | null>(null);
  const [cats, setCats] = useState<DrinkCat[]>([]);
  const [addons, setAddons] = useState<AdminAddon[]>([]);
  const [addonCats, setAddonCats] = useState<AddonCat[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [sizes, setSizes] = useState<DrinkSize[]>([]);
  const [tab, setTab] = useState<"main" | "sizes" | "desc" | "bindings">("main");
  // rich-описания по локалям: текущая выбранная локаль + черновик HTML
  const [descLocale, setDescLocale] = useState<string>("en");
  const [descDraft, setDescDraft] = useState<string>("");
  const [descRev, setDescRev] = useState(0); // ремонтирует редактор при смене локали/загрузке
  const [addonQuery, setAddonQuery] = useState(""); // фильтр по вкладке «Доступные добавки»
  const baselineRef = useRef<string>(""); // снимок «основного» для индикатора несохранённого

  // подпись полей вкладки «Основное» (для отслеживания несохранённых изменений)
  const mainSig = (d: AdminDrink) => JSON.stringify([
    d.name, d.description, d.status, d.previewUrl, d.videoUrl,
    d.basePrice, d.kcal, d.protein, d.fat, d.carbs, d.categoryId,
  ]);

  const load = useCallback(async () => {
    const [drinks, cs, as_, acs, us] = await Promise.all([
      catalogApi.drinks(), catalogApi.drinkCategories(), catalogApi.addons(),
      catalogApi.addonCategories(), catalogApi.units(),
    ]);
    const d = drinks.find((x) => x.slug === slug);
    if (!d) { router.replace("/admin/catalog/products"); return; }
    setDrink(d); setBindings(d.bindings); setSizes(d.sizes); setCats(cs); setAddons(as_);
    setAddonCats(acs); setUnits(us);
    baselineRef.current = mainSig(d);
    setDescDraft(d.descriptions.find((x) => x.locale === descLocale)?.body ?? "");
    setDescRev((r) => r + 1);
  }, [slug, router, descLocale]);
  useEffect(() => { load().catch(() => {}); }, [load]);

  if (!drink) return <div className="admin-meta">Loading…</div>;

  const set = (patch: Partial<AdminDrink>) => setDrink({ ...drink, ...patch });
  const dirtyMain = mainSig(drink) !== baselineRef.current;

  const saveMain = async () => {
    try {
      const d = await catalogApi.updateDrink(drink.id, drink);
      setDrink(d); baselineRef.current = mainSig(d);
      toast("Drink saved");
    } catch (e) { toast(e instanceof Error ? e.message : "Error", "warn"); }
  };

  const saveBindings = async () => {
    // валидация до запроса — иначе бэк ответит 422 PORTIONS_RANGE_INVALID
    const bad = bindings.find((b) => !(0 <= b.minPortions && b.minPortions <= b.defaultPortions
      && b.defaultPortions <= b.maxPortions && b.portionAmount > 0));
    if (bad) {
      toast(`“${addonName(bad.addonId)}”: requires 0 ≤ min ≤ default ≤ max and portion size > 0`, "warn");
      return;
    }
    try {
      const d = await catalogApi.setBindings(drink.id, bindings);
      setDrink(d); setBindings(d.bindings);
      toast("Available add-ons saved");
    } catch (e) { toast(e instanceof Error ? e.message : "Error", "warn"); }
  };

  const saveSizes = async () => {
    const active = sizes.filter((s) => s.isActive);
    if (active.length === 0) { toast("At least one active size is required", "warn"); return; }
    if (sizes.some((s) => s.volume <= 0 || s.price < 0)) {
      toast("Volume must be > 0, price ≥ 0", "warn"); return;
    }
    if (active.filter((s) => s.isDefault).length > 1) {
      toast("There can be only one default size", "warn"); return;
    }
    try {
      const d = await catalogApi.setSizes(drink.id, sizes);
      setDrink(d); setSizes(d.sizes); set({ basePrice: d.basePrice });
      toast("Sizes saved");
    } catch (e) { toast(e instanceof Error ? e.message : "Error", "warn"); }
  };

  // единственный дефолт: выбор одного размера снимает флаг с остальных
  const pickDefaultSize = (idx: number) => {
    setSizes((arr) => arr.map((s, i) => ({ ...s, isDefault: i === idx })));
    // CAT2: базовая цена синхронизируется с выбранным размером сразу в UI
    // (бэк делает то же при сохранении) — поле «Base price» больше не отстаёт до Save.
    const price = sizes[idx]?.price;
    if (price !== undefined) set({ basePrice: price });
  };
  const addSize = () =>
    setSizes((arr) => [...arr, { volume: 0, unit: "ml", price: drink.basePrice,
      isDefault: arr.length === 0, isActive: true, sort: arr.length }]);
  const removeSize = (idx: number) =>
    setSizes((arr) => {
      const next = arr.filter((_, i) => i !== idx);
      if (next.length && !next.some((s) => s.isDefault && s.isActive))
        next[0] = { ...next[0], isDefault: true };
      return next;
    });

  // ---- rich-описания по локалям ----
  const switchDescLocale = (loc: string) => {
    setDescLocale(loc);
    setDescDraft(drink.descriptions.find((x) => x.locale === loc)?.body ?? "");
    setDescRev((r) => r + 1);
  };
  const saveDesc = async () => {
    try {
      const d = await catalogApi.saveDescription(drink.id, descLocale, descDraft);
      setDrink(d);
      const kept = d.descriptions.some((x) => x.locale === descLocale);
      setDescDraft(d.descriptions.find((x) => x.locale === descLocale)?.body ?? "");
      setDescRev((r) => r + 1);
      toast(kept ? "Description saved" : "Empty description — entry deleted");
    } catch (e) { toast(e instanceof Error ? e.message : "Error", "warn"); }
  };
  const deleteDesc = async () => {
    try {
      const d = await catalogApi.deleteDescription(drink.id, descLocale);
      setDrink(d); setDescDraft(""); setDescRev((r) => r + 1);
      toast("Description deleted");
    } catch (e) { toast(e instanceof Error ? e.message : "Error", "warn"); }
  };
  const descLocalesFilled = new Set(drink.descriptions.map((x) => x.locale));

  const bound = new Set(bindings.map((b) => b.addonId));
  const addonName = (id: number) => { const a = addons.find((x) => x.id === id); return a?.name.en ?? a?.name.ru ?? `#${id}`; };
  const addonBasePrice = (id: number) => addons.find((a) => a.id === id)?.basePrice ?? 0;
  const addonUnit = (id: number) => {
    const a = addons.find((x) => x.id === id);
    return units.find((u) => u.id === a?.unitId)?.code ?? "";
  };
  const addonCatName = (c: AddonCat) => c.name.en ?? c.name.ru ?? "—";

  // подсветка непереведённого поля
  const warn = { borderColor: "#B45309", background: "#FFF7E5" } as const;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
        <span className="admin-mono admin-meta">{drink.slug}</span>
        <span className="admin-meta">·</span>
        {/* статус: черновик / опубликован / скрыт (видимость на сайте) */}
        <div style={{ display: "inline-flex", gap: 2, padding: 3, background: "#F5EFE7", borderRadius: 999 }}>
          {([["draft", "draft"], ["published", "published"], ["hidden", "hidden"]] as const).map(([v, l]) => (
            <button key={v} className="admin-btn sm" onClick={() => set({ status: v })}
                    style={drink.status === v ? { background: "#4A56E2", color: "#FFF" } : { background: "transparent" }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          {tab === "main" && dirtyMain && (
            <span className="admin-meta" style={{ color: "#B45309", fontWeight: 600 }}>● unsaved changes</span>
          )}
          {tab === "desc" && <span className="admin-meta">description is saved with the button on this tab</span>}
          {tab !== "desc" && (
            <button className="admin-btn primary"
                    onClick={tab === "main" ? saveMain : tab === "sizes" ? saveSizes : saveBindings}>
              {tab === "main" ? "Save main" : tab === "sizes" ? "Save sizes" : "Save add-ons"}
            </button>
          )}
        </div>
      </div>

      <div className="admin-tabs">
        <button className="admin-tab" data-active={tab === "main"} onClick={() => setTab("main")}>Main</button>
        <button className="admin-tab" data-active={tab === "sizes"} onClick={() => setTab("sizes")}>
          Sizes ({sizes.length})
        </button>
        <button className="admin-tab" data-active={tab === "desc"} onClick={() => setTab("desc")}>
          Description ({drink.descriptions.filter((d) => d.locale !== "ru").length})
        </button>
        <button className="admin-tab" data-active={tab === "bindings"} onClick={() => setTab("bindings")}>
          Available add-ons ({bindings.length})
        </button>
      </div>

      {tab === "main" && (
        <ProductMainTab drink={drink} cats={cats} set={set} warn={warn} />
      )}

      {tab === "sizes" && (
        <ProductSizesTab sizes={sizes} setSizes={setSizes} pickDefaultSize={pickDefaultSize}
                         addSize={addSize} removeSize={removeSize} />
      )}

      {tab === "desc" && (
        <ProductDescriptionTab drink={drink} descLocale={descLocale} descDraft={descDraft}
                               descRev={descRev} descLocalesFilled={descLocalesFilled}
                               switchDescLocale={switchDescLocale} setDescDraft={setDescDraft}
                               saveDesc={saveDesc} deleteDesc={deleteDesc} />
      )}

      {tab === "bindings" && (
        <ProductBindingsTab addons={addons} addonCats={addonCats} addonQuery={addonQuery}
                            setAddonQuery={setAddonQuery} bindings={bindings} setBindings={setBindings}
                            bound={bound} addonName={addonName} addonBasePrice={addonBasePrice}
                            addonUnit={addonUnit} addonCatName={addonCatName} />
      )}
    </>
  );
}

export default function ProductEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return (
    <AdminShell title="Drink editor"
                crumbs={[{ label: "Catalog" }, { label: "Drinks", href: "/admin/catalog/products" },
                         { label: slug }]}>
      <Editor slug={slug} />
    </AdminShell>
  );
}
