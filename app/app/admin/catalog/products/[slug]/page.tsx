"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { Toggle, useToast } from "@/components/admin/AdminUI";
import { catalogApi, DESC_LOCALES, type AdminAddon, type AdminDrink, type Binding, type DrinkCat, type DrinkSize } from "@/lib/adminApi";
import { RichTextEditor } from "@/components/admin/RichTextEditor";

/** ADM-S-05: редактор напитка — поля, статус, и промежуточная таблица напиток×добавка:
 *  цена в этом напитке (пусто = бесплатно), мин/дефолт/макс порций, объём порции,
 *  override типа выбора. */
function Editor({ slug }: { slug: string }) {
  const router = useRouter();
  const toast = useToast();
  const [drink, setDrink] = useState<AdminDrink | null>(null);
  const [cats, setCats] = useState<DrinkCat[]>([]);
  const [addons, setAddons] = useState<AdminAddon[]>([]);
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [sizes, setSizes] = useState<DrinkSize[]>([]);
  const [tab, setTab] = useState<"main" | "sizes" | "desc" | "bindings">("main");
  // rich-описания по локалям: текущая выбранная локаль + черновик HTML
  const [descLocale, setDescLocale] = useState<string>("ru");
  const [descDraft, setDescDraft] = useState<string>("");
  const [descRev, setDescRev] = useState(0); // ремонтирует редактор при смене локали/загрузке

  const load = useCallback(async () => {
    const [drinks, cs, as_] = await Promise.all([
      catalogApi.drinks(), catalogApi.drinkCategories(), catalogApi.addons(),
    ]);
    const d = drinks.find((x) => x.slug === slug);
    if (!d) { router.replace("/admin/catalog/products"); return; }
    setDrink(d); setBindings(d.bindings); setSizes(d.sizes); setCats(cs); setAddons(as_);
    setDescDraft(d.descriptions.find((x) => x.locale === descLocale)?.body ?? "");
    setDescRev((r) => r + 1);
  }, [slug, router, descLocale]);
  useEffect(() => { load().catch(() => {}); }, [load]);

  if (!drink) return <div className="admin-meta">Загрузка…</div>;

  const set = (patch: Partial<AdminDrink>) => setDrink({ ...drink, ...patch });

  const saveMain = async () => {
    try {
      await catalogApi.updateDrink(drink.id, drink);
      toast("Напиток сохранён");
    } catch (e) { toast(e instanceof Error ? e.message : "Ошибка", "warn"); }
  };

  const saveBindings = async () => {
    // валидация до запроса — иначе бэк ответит 422 PORTIONS_RANGE_INVALID
    const bad = bindings.find((b) => !(0 <= b.minPortions && b.minPortions <= b.defaultPortions
      && b.defaultPortions <= b.maxPortions && b.portionAmount > 0));
    if (bad) {
      toast(`«${addonName(bad.addonId)}»: нужно 0 ≤ мин ≤ дефолт ≤ макс и объём порции > 0`, "warn");
      return;
    }
    try {
      const d = await catalogApi.setBindings(drink.id, bindings);
      setDrink(d); setBindings(d.bindings);
      toast("Доступные добавки сохранены");
    } catch (e) { toast(e instanceof Error ? e.message : "Ошибка", "warn"); }
  };

  const saveSizes = async () => {
    const active = sizes.filter((s) => s.isActive);
    if (active.length === 0) { toast("Нужен хотя бы один активный размер", "warn"); return; }
    if (sizes.some((s) => s.volume <= 0 || s.price < 0)) {
      toast("Объём должен быть > 0, цена — ≥ 0", "warn"); return;
    }
    if (active.filter((s) => s.isDefault).length > 1) {
      toast("Размер по умолчанию может быть только один", "warn"); return;
    }
    try {
      const d = await catalogApi.setSizes(drink.id, sizes);
      setDrink(d); setSizes(d.sizes); set({ basePrice: d.basePrice });
      toast("Размеры сохранены");
    } catch (e) { toast(e instanceof Error ? e.message : "Ошибка", "warn"); }
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
      toast(kept ? "Описание сохранено" : "Пустое описание — запись удалена");
    } catch (e) { toast(e instanceof Error ? e.message : "Ошибка", "warn"); }
  };
  const deleteDesc = async () => {
    try {
      const d = await catalogApi.deleteDescription(drink.id, descLocale);
      setDrink(d); setDescDraft(""); setDescRev((r) => r + 1);
      toast("Описание удалено");
    } catch (e) { toast(e instanceof Error ? e.message : "Ошибка", "warn"); }
  };
  const descLocalesFilled = new Set(drink.descriptions.map((x) => x.locale));

  const bound = new Set(bindings.map((b) => b.addonId));
  const addonName = (id: number) => addons.find((a) => a.id === id)?.name.ru ?? `#${id}`;
  const addonBasePrice = (id: number) => addons.find((a) => a.id === id)?.basePrice ?? 0;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
        <span className="admin-mono admin-meta">{drink.slug}</span>
        <span className="admin-meta">·</span>
        {/* статус: черновик / опубликован / скрыт (видимость на сайте) */}
        <div style={{ display: "inline-flex", gap: 2, padding: 3, background: "#F5EFE7", borderRadius: 999 }}>
          {([["draft", "черновик"], ["published", "опубликован"], ["hidden", "скрыт"]] as const).map(([v, l]) => (
            <button key={v} className="admin-btn sm" onClick={() => set({ status: v })}
                    style={drink.status === v ? { background: "#4A56E2", color: "#FFF" } : { background: "transparent" }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {tab !== "desc" && (
            <button className="admin-btn primary"
                    onClick={tab === "main" ? saveMain : tab === "sizes" ? saveSizes : saveBindings}>
              Сохранить
            </button>
          )}
        </div>
      </div>

      <div className="admin-tabs">
        <button className="admin-tab" data-active={tab === "main"} onClick={() => setTab("main")}>Основное</button>
        <button className="admin-tab" data-active={tab === "sizes"} onClick={() => setTab("sizes")}>
          Размеры ({sizes.length})
        </button>
        <button className="admin-tab" data-active={tab === "desc"} onClick={() => setTab("desc")}>
          Описание ({drink.descriptions.length})
        </button>
        <button className="admin-tab" data-active={tab === "bindings"} onClick={() => setTab("bindings")}>
          Доступные добавки ({bindings.length})
        </button>
      </div>

      {tab === "main" && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
          <div className="admin-panel">
            <div className="admin-panel-head"><div className="admin-panel-title">Тексты и медиа</div></div>
            <div className="admin-panel-body">
              <div className="admin-grid-2">
                <div className="admin-field">
                  <label className="admin-label">Название (RU)</label>
                  <input className="admin-input" value={drink.name.ru ?? ""}
                         onChange={(e) => set({ name: { ...drink.name, ru: e.target.value } })} />
                </div>
                <div className="admin-field">
                  <label className="admin-label">Название (AR)</label>
                  <input className="admin-input" dir="rtl" value={drink.name.ar ?? ""}
                         onChange={(e) => set({ name: { ...drink.name, ar: e.target.value } })} />
                </div>
              </div>
              <div className="admin-field">
                <label className="admin-label">Описание (RU)</label>
                <textarea className="admin-textarea" value={drink.description.ru ?? ""}
                          onChange={(e) => set({ description: { ...drink.description, ru: e.target.value } })} />
              </div>
              <div className="admin-grid-2">
                <div className="admin-field">
                  <label className="admin-label">Категория</label>
                  <select className="admin-select" value={drink.categoryId}
                          onChange={(e) => set({ categoryId: +e.target.value })}>
                    {cats.map((c) => <option key={c.id} value={c.id}>{c.name.ru}</option>)}
                  </select>
                </div>
                <div className="admin-field">
                  <label className="admin-label">Цена базы (= размер по умолчанию), AED</label>
                  <input className="admin-input mono" type="number" value={drink.basePrice}
                         onChange={(e) => set({ basePrice: +e.target.value || 0 })} />
                  <span className="admin-meta">синхронизируется с ценой размера «по умолчанию» во вкладке «Размеры»</span>
                </div>
              </div>
              <div className="admin-grid-2">
                <div className="admin-field">
                  <label className="admin-label">Превью (URL)</label>
                  <input className="admin-input mono" value={drink.previewUrl ?? ""}
                         onChange={(e) => set({ previewUrl: e.target.value || null })} />
                </div>
                <div className="admin-field">
                  <label className="admin-label">Видео для сайта (URL)</label>
                  <input className="admin-input mono" value={drink.videoUrl ?? ""}
                         onChange={(e) => set({ videoUrl: e.target.value || null })} />
                </div>
              </div>
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-head">
              <div className="admin-panel-title">КБЖУ базы</div>
              <span className="admin-meta">с добавками пересчитывается</span>
            </div>
            <div className="admin-panel-body">
              <div className="kbju-grid">
                {([["kcal", "Ккал"], ["protein", "Белки"], ["fat", "Жиры"], ["carbs", "Углев."]] as const)
                  .map(([k, l]) => (
                  <div className="kbju-cell" key={k}>
                    <div className="kbju-cell-label">{l}</div>
                    <input className="admin-input mono" type="number" value={drink[k]}
                           onChange={(e) => set({ [k]: +e.target.value || 0 } as Partial<AdminDrink>)}
                           style={{ marginTop: 4 }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "sizes" && (
        <div className="admin-panel">
          <div className="admin-panel-head">
            <div className="admin-panel-title">Размеры напитка</div>
            <span className="admin-meta">объём и своя цена; цена «по умолчанию» идёт в карточку витрины</span>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>По умолч.</th><th>Объём</th><th>Ед.</th><th>Цена, AED</th><th>Активен</th><th></th>
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
                    <input className="admin-input mono" style={{ width: 90 }} type="number" value={s.volume}
                           onChange={(e) => setSizes((arr) => arr.map((x, j) => j === i
                             ? { ...x, volume: +e.target.value || 0 } : x))} />
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
                    <input className="admin-input mono" style={{ width: 100 }} type="number" value={s.price}
                           onChange={(e) => setSizes((arr) => arr.map((x, j) => j === i
                             ? { ...x, price: +e.target.value || 0 } : x))} />
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
                    <button className="admin-btn sm" onClick={() => removeSize(i)}>Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="admin-panel-body">
            <button className="admin-btn" onClick={addSize}>+ Добавить размер</button>
            <p className="admin-meta" style={{ marginTop: 8 }}>
              Цена размера — это стоимость напитка БЕЗ добавок; добавки считаются сверху.
              Должен быть хотя бы один активный размер и ровно один «по умолчанию».
            </p>
          </div>
        </div>
      )}

      {tab === "desc" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
          <div className="admin-panel">
            <div className="admin-panel-head">
              <div className="admin-panel-title">Дополнительное описание</div>
              <span className="admin-meta">шторка «Подробнее»; своё для каждой локали</span>
            </div>
            <div className="admin-panel-body">
              {/* выбор локали — отмечаем, где описание уже заполнено */}
              <div className="admin-field">
                <label className="admin-label">Локализация</label>
                <div style={{ display: "inline-flex", gap: 2, padding: 3, background: "#F5EFE7", borderRadius: 999 }}>
                  {DESC_LOCALES.map((l) => (
                    <button key={l.code} className="admin-btn sm" onClick={() => switchDescLocale(l.code)}
                            style={descLocale === l.code ? { background: "#4A56E2", color: "#FFF" } : { background: "transparent" }}>
                      {l.label}{descLocalesFilled.has(l.code) ? " ●" : ""}
                    </button>
                  ))}
                </div>
                <span className="admin-meta">● — описание для локали заполнено</span>
              </div>

              <RichTextEditor key={`${descLocale}-${descRev}`} initialHtml={descDraft}
                              dir={descLocale === "ar" ? "rtl" : "ltr"}
                              onChange={setDescDraft} />

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="admin-btn primary" onClick={saveDesc}>Сохранить описание</button>
                {descLocalesFilled.has(descLocale) && (
                  <button className="admin-btn" onClick={deleteDesc}>Удалить</button>
                )}
              </div>
              <p className="admin-meta" style={{ marginTop: 8 }}>
                Если для локали нет описания, на сайте в этой локали кнопка «Подробнее» скрывается.
              </p>
            </div>
          </div>

          {/* предпросмотр «как в шторке» */}
          <div className="admin-panel">
            <div className="admin-panel-head">
              <div className="admin-panel-title">Предпросмотр шторки</div>
              <span className="admin-meta">{DESC_LOCALES.find((l) => l.code === descLocale)?.label}</span>
            </div>
            <div className="admin-panel-body">
              <div style={{ background: "#fff", border: "1px solid #ECE6DC", borderRadius: 20, padding: 18 }}>
                <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 8 }}>{drink.name.ru || drink.slug}</div>
                {descDraft && descDraft.replace(/<[^>]*>/g, "").trim() ? (
                  <div className="rich-desc" dir={descLocale === "ar" ? "rtl" : "ltr"}
                       dangerouslySetInnerHTML={{ __html: descDraft }} />
                ) : (
                  <div className="admin-meta">Пусто — кнопка «Подробнее» на сайте скрыта для этой локали.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "bindings" && (
        <div className="admin-panel">
          <div className="admin-panel-head">
            <div className="admin-panel-title">Промежуточная таблица напиток×добавка</div>
            <span className="admin-meta">пустая цена = бесплатно, включена в стоимость напитка</span>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Доступна</th><th>Добавка</th><th>Цена в этом напитке, AED</th>
                <th>Мин</th><th>Дефолт</th><th>Макс</th><th>Объём порции</th>
              </tr>
            </thead>
            <tbody>
              {addons.filter((a) => a.isActive).map((a) => {
                const b = bindings.find((x) => x.addonId === a.id);
                return (
                  <tr key={a.id}>
                    <td>
                      {/* отметка «доступно в этом напитке» (ADM-S-05 AC2) */}
                      <Toggle defaultOn={bound.has(a.id)}
                              onChange={(v) => setBindings((arr) => v
                                ? [...arr, { addonId: a.id, priceOverride: null, minPortions: 0,
                                             defaultPortions: 1, maxPortions: 3, portionAmount: 30,
                                             selectionTypeOverride: null }]
                                : arr.filter((x) => x.addonId !== a.id))} />
                    </td>
                    <td>
                      <strong>{addonName(a.id)}</strong>
                      <div className="admin-meta">базовая цена {addonBasePrice(a.id)} AED</div>
                    </td>
                    {b ? (
                      <>
                        <td>
                          <input className="admin-input mono" style={{ width: 90 }}
                                 placeholder="бесплатно"
                                 value={b.priceOverride ?? ""}
                                 onChange={(e) => setBindings((arr) => arr.map((x) => x.addonId === a.id
                                   ? { ...x, priceOverride: e.target.value === "" ? null : +e.target.value }
                                   : x))} />
                        </td>
                        {(["minPortions", "defaultPortions", "maxPortions", "portionAmount"] as const).map((k) => (
                          <td key={k}>
                            <input className="admin-input mono" style={{ width: 64 }} type="number"
                                   value={b[k]}
                                   onChange={(e) => setBindings((arr) => arr.map((x) => x.addonId === a.id
                                     ? { ...x, [k]: +e.target.value || 0 } : x))} />
                          </td>
                        ))}
                      </>
                    ) : (
                      <td colSpan={5} className="admin-meta">не доступна в этом напитке</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="admin-panel-body">
            <p className="admin-meta">
              Лимиты: 0 ≤ мин ≤ дефолт ≤ макс (валидируется на бэке). Объём порции — грамм/мл
              на одну порцию; КБЖУ на сайте пересчитывается на этот объём.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default function ProductEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return (
    <AdminShell title="Редактор напитка"
                crumbs={[{ label: "Каталог" }, { label: "Напитки", href: "/admin/catalog/products" },
                         { label: slug }]}>
      <Editor slug={slug} />
    </AdminShell>
  );
}
