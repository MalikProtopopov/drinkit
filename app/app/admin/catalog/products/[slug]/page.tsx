"use client";

import { Fragment, use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { Toggle, useToast } from "@/components/admin/AdminUI";
import { catalogApi, DESC_LOCALES, type AddonCat, type AdminAddon, type AdminDrink, type Binding, type DrinkCat, type DrinkSize, type Unit } from "@/lib/adminApi";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { MediaUpload } from "@/components/admin/MediaUpload";
import { NumInput } from "@/components/admin/NumInput";

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
  const pickDefaultSize = (idx: number) =>
    setSizes((arr) => arr.map((s, i) => ({ ...s, isDefault: i === idx })));
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

  // строка таблицы напиток×добавка — общая для всех групп
  const bindingRow = (a: AdminAddon) => {
    const b = bindings.find((x) => x.addonId === a.id);
    return (
      <tr key={a.id} style={b ? undefined : { opacity: 0.5 }}>
        <td>
          <Toggle defaultOn={bound.has(a.id)}
                  onChange={(v) => setBindings((arr) => v
                    ? [...arr, { addonId: a.id, priceOverride: null, minPortions: 0,
                                 defaultPortions: 1, maxPortions: 3, portionAmount: 30,
                                 selectionTypeOverride: null }]
                    : arr.filter((x) => x.addonId !== a.id))} />
        </td>
        <td>
          <strong>{addonName(a.id)}</strong>
          <div className="admin-meta">base price {addonBasePrice(a.id)} AED</div>
        </td>
        {b ? (
          <>
            <td>
              <input className="admin-input mono" style={{ width: 90 }} placeholder="free"
                     value={b.priceOverride ?? ""}
                     onChange={(e) => setBindings((arr) => arr.map((x) => x.addonId === a.id
                       ? { ...x, priceOverride: e.target.value === "" ? null : +e.target.value } : x))} />
            </td>
            {(["minPortions", "defaultPortions", "maxPortions"] as const).map((k) => (
              <td key={k}>
                <NumInput value={b[k]} min={0} style={{ width: 64 }}
                          onChange={(n) => setBindings((arr) => arr.map((x) => x.addonId === a.id
                            ? { ...x, [k]: n } : x))} />
              </td>
            ))}
            <td>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <NumInput value={b.portionAmount} min={0} style={{ width: 64 }}
                          onChange={(n) => setBindings((arr) => arr.map((x) => x.addonId === a.id
                            ? { ...x, portionAmount: n } : x))} />
                <span className="admin-meta">{addonUnit(a.id) || "—"}</span>
              </span>
            </td>
          </>
        ) : (
          <td colSpan={5} className="admin-meta">not available in this drink</td>
        )}
      </tr>
    );
  };
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
        <div className="admin-split" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
          <div className="admin-panel">
            <div className="admin-panel-head">
              <div className="admin-panel-title">Texts and media</div>
              <span className="admin-meta">on the site: English and Arabic</span>
            </div>
            <div className="admin-panel-body">
              <div className="admin-grid-2">
                <div className="admin-field">
                  <label className="admin-label">Name (EN) — primary on the site</label>
                  <input className="admin-input" value={drink.name.en ?? ""} placeholder="no translation"
                         style={!drink.name.en ? warn : undefined}
                         onChange={(e) => set({ name: { ...drink.name, en: e.target.value } })} />
                </div>
                <div className="admin-field">
                  <label className="admin-label">Name (AR)</label>
                  <input className="admin-input" dir="rtl" value={drink.name.ar ?? ""} placeholder="نص عربي"
                         style={!drink.name.ar ? warn : undefined}
                         onChange={(e) => set({ name: { ...drink.name, ar: e.target.value } })} />
                </div>
              </div>
              <div className="admin-grid-2">
                <div className="admin-field">
                  <label className="admin-label">Short description (EN)</label>
                  <textarea className="admin-textarea" value={drink.description.en ?? ""}
                            onChange={(e) => set({ description: { ...drink.description, en: e.target.value } })} />
                </div>
                <div className="admin-field">
                  <label className="admin-label">Short description (AR)</label>
                  <textarea className="admin-textarea" dir="rtl" value={drink.description.ar ?? ""}
                            onChange={(e) => set({ description: { ...drink.description, ar: e.target.value } })} />
                </div>
              </div>
              <div className="admin-grid-2">
                <div className="admin-field">
                  <label className="admin-label">Category</label>
                  <select className="admin-select" value={drink.categoryId}
                          onChange={(e) => set({ categoryId: +e.target.value })}>
                    {cats.map((c) => <option key={c.id} value={c.id}>{c.name.en ?? c.name.ru}</option>)}
                  </select>
                </div>
                <div className="admin-field">
                  <label className="admin-label">Base price (= default size), AED</label>
                  <NumInput value={drink.basePrice} min={0} onChange={(n) => set({ basePrice: n })} />
                  <span className="admin-meta">synced with the “default” size price on the “Sizes” tab</span>
                </div>
              </div>
              <div className="admin-grid-2">
                <div className="admin-field">
                  <label className="admin-label">Preview (image)</label>
                  <MediaUpload accept="image" value={drink.previewUrl}
                               onChange={(url) => set({ previewUrl: url })} />
                </div>
                <div className="admin-field">
                  <label className="admin-label">Video for the site</label>
                  <MediaUpload accept="video" value={drink.videoUrl}
                               onChange={(url) => set({ videoUrl: url })} />
                </div>
              </div>
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head">
              <div className="admin-panel-title">Nutrition of the base drink</div>
            </div>
            <div className="admin-panel-body">
              <div className="admin-grid-2">
                {([["kcal", "Kcal", "kcal"], ["protein", "Protein", "g"],
                   ["fat", "Fat", "g"], ["carbs", "Carbs", "g"]] as const).map(([k, l, u]) => (
                  <div className="admin-field" key={k}>
                    <label className="admin-label">{l}, {u}</label>
                    <NumInput value={drink[k]} min={0}
                              onChange={(n) => set({ [k]: n } as Partial<AdminDrink>)} />
                  </div>
                ))}
              </div>
              <p className="admin-meta" style={{ marginTop: 8 }}>
                Per 1 serving (default size). Recalculated on the site when add-ons are selected.
              </p>
            </div>
          </div>
        </div>
      )}

      {tab === "sizes" && (
        <div className="admin-panel">
          <div className="admin-panel-head">
            <div className="admin-panel-title">Drink sizes</div>
            <span className="admin-meta">volume and own price; the “default” price goes to the storefront card</span>
          </div>
          <div className="admin-tablewrap"><table className="admin-table">
            <thead>
              <tr>
                <th>Default</th><th>Volume</th><th>Unit</th><th>Price, AED</th><th>Active</th><th></th>
              </tr>
            </thead>
            <tbody>
              {sizes.map((s, i) => (
                <tr key={i}>
                  <td>
                    <input type="radio" name="default-size" checked={s.isDefault}
                           disabled={!s.isActive} onChange={() => pickDefaultSize(i)} />
                  </td>
                  <td>
                    <NumInput value={s.volume} min={0} style={{ width: 90 }}
                              onChange={(n) => setSizes((arr) => arr.map((x, j) => j === i
                                ? { ...x, volume: n } : x))} />
                  </td>
                  <td>
                    <select className="admin-select" style={{ width: 80 }} value={s.unit}
                            onChange={(e) => setSizes((arr) => arr.map((x, j) => j === i
                              ? { ...x, unit: e.target.value } : x))}>
                      <option value="ml">ml</option>
                      <option value="l">l</option>
                      <option value="g">g</option>
                    </select>
                  </td>
                  <td>
                    <NumInput value={s.price} min={0} style={{ width: 100 }}
                              onChange={(n) => setSizes((arr) => arr.map((x, j) => j === i
                                ? { ...x, price: n } : x))} />
                  </td>
                  <td>
                    <Toggle defaultOn={s.isActive}
                            onChange={(v) => setSizes((arr) => {
                              const next = arr.map((x, j) => j === i ? { ...x, isActive: v } : x);
                              if (!v && next[i].isDefault) {
                                const firstActive = next.findIndex((x) => x.isActive);
                                return next.map((x, j) => ({ ...x, isDefault: j === firstActive }));
                              }
                              return next;
                            })} />
                  </td>
                  <td>
                    <button className="admin-btn sm" onClick={() => removeSize(i)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <div className="admin-panel-body">
            <button className="admin-btn" onClick={addSize}>+ Add size</button>
            <p className="admin-meta" style={{ marginTop: 8 }}>
              The size price is the drink cost WITHOUT add-ons; add-ons are charged on top.
              There must be at least one active size and exactly one “default”.
            </p>
          </div>
        </div>
      )}

      {tab === "desc" && (
        <div className="admin-split" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
          <div className="admin-panel">
            <div className="admin-panel-head">
              <div className="admin-panel-title">Extended description</div>
              <span className="admin-meta">the “More” sheet; separate for each locale</span>
            </div>
            <div className="admin-panel-body">
              {/* выбор языка описания — галочка у языков, где описание уже есть */}
              <div className="admin-field">
                <label className="admin-label">Description language</label>
                <div style={{ display: "inline-flex", gap: 2, padding: 3, background: "#F5EFE7", borderRadius: 999 }}>
                  {DESC_LOCALES.map((l) => (
                    <button key={l.code} className="admin-btn sm" onClick={() => switchDescLocale(l.code)}
                            style={descLocale === l.code ? { background: "#4A56E2", color: "#FFF" } : { background: "transparent" }}>
                      {l.label}{descLocalesFilled.has(l.code) ? " ✓" : ""}
                    </button>
                  ))}
                </div>
                {/* понятный статус именно выбранного языка + что это значит для сайта */}
                <span className="admin-meta">
                  {descLocalesFilled.has(descLocale)
                    ? "✓ A description has been added for this language — the “More” button is shown on the site."
                    : "There is no description for this language yet — the “More” button stays hidden on the site until you add and save one."}
                </span>
              </div>

              <RichTextEditor key={`${descLocale}-${descRev}`} initialHtml={descDraft}
                              dir={descLocale === "ar" ? "rtl" : "ltr"}
                              onChange={setDescDraft} />

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="admin-btn primary" onClick={saveDesc}>Save description</button>
                {descLocalesFilled.has(descLocale) && (
                  <button className="admin-btn" onClick={deleteDesc}>Delete</button>
                )}
              </div>
              <p className="admin-meta" style={{ marginTop: 8 }}>
                If there is no description for a locale, the “More” button is hidden on the site in that locale.
              </p>
            </div>
          </div>

          {/* предпросмотр «как в шторке» */}
          <div className="admin-panel">
            <div className="admin-panel-head">
              <div className="admin-panel-title">Sheet preview</div>
              <span className="admin-meta">{DESC_LOCALES.find((l) => l.code === descLocale)?.label}</span>
            </div>
            <div className="admin-panel-body">
              <div style={{ background: "#fff", border: "1px solid #ECE6DC", borderRadius: 20, padding: 18 }}>
                <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 8 }}>{drink.name.en || drink.name.ru || drink.slug}</div>
                {descDraft && descDraft.replace(/<[^>]*>/g, "").trim() ? (
                  <div className="rich-desc" dir={descLocale === "ar" ? "rtl" : "ltr"}
                       dangerouslySetInnerHTML={{ __html: descDraft }} />
                ) : (
                  <div className="admin-meta">Empty — the “More” button is hidden on the site for this locale.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "bindings" && (() => {
        // активные добавки, сгруппированные по своей категории; поиск по названию
        const q = addonQuery.trim().toLowerCase();
        const active = addons.filter((a) => a.isActive);
        const matches = (a: AdminAddon) => !q
          || addonName(a.id).toLowerCase().includes(q) || (a.name.ar ?? "").includes(addonQuery.trim());
        const groups = addonCats.map((c) => ({ cat: c as AddonCat | null,
          items: active.filter((a) => a.categoryId === c.id && matches(a)) }));
        const orphan = active.filter((a) => !addonCats.some((c) => c.id === a.categoryId) && matches(a));
        if (orphan.length) groups.push({ cat: null, items: orphan });
        const visible = groups.filter((g) => g.items.length > 0);
        return (
          <div className="admin-panel">
            <div className="admin-panel-head">
              <div className="admin-panel-title">Available add-ons</div>
              <span className="admin-meta">{bound.size} of {active.length} enabled · empty price = free</span>
            </div>
            <div className="admin-panel-body" style={{ paddingBottom: 8 }}>
              <input className="admin-input" placeholder="Search add-on…" value={addonQuery}
                     onChange={(e) => setAddonQuery(e.target.value)} style={{ maxWidth: 280 }} />
            </div>
            <div className="admin-tablewrap"><table className="admin-table">
              <thead>
                <tr>
                  <th>Available</th><th>Add-on</th><th>Price in this drink, AED</th>
                  <th>Min</th><th>Default</th><th>Max</th><th>Portion size</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((g) => (
                  <Fragment key={g.cat ? g.cat.id : "orphan"}>
                    <tr style={{ background: "#F2ECE2" }}>
                      <td colSpan={7} style={{ fontWeight: 800 }}>
                        {g.cat ? addonCatName(g.cat) : "No category"}
                        <span className="admin-meta" style={{ marginLeft: 8, fontWeight: 500 }}>
                          {g.items.filter((a) => bound.has(a.id)).length}/{g.items.length} enabled
                        </span>
                      </td>
                    </tr>
                    {g.items.map(bindingRow)}
                  </Fragment>
                ))}
                {visible.length === 0 && (
                  <tr><td colSpan={7} className="admin-meta" style={{ padding: 16 }}>Nothing found</td></tr>
                )}
              </tbody>
            </table></div>
            <div className="admin-panel-body">
              <p className="admin-meta">
                Limits: 0 ≤ min ≤ default ≤ max (validated on the backend). Portion size is grams/ml
                per portion; nutrition on the site is recalculated to this amount.
              </p>
            </div>
          </div>
        );
      })()}
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
