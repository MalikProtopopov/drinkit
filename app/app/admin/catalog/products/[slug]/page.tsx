"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { Toggle, Modal, useToast } from "@/components/admin/AdminUI";
import { adminProductRows, adminAddonGroups, adminAddons, addonDoseLabel } from "@/lib/admin-mock";

type Tab = "main" | "media" | "variants" | "bindings" | "rules" | "outlets";

export default function ProductEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const toast = useToast();
  const product = adminProductRows.find((p) => p.slug === slug) ?? adminProductRows[0];

  const [tab, setTab] = useState<Tab>("main");
  const [visible, setVisible] = useState(product.visible);
  const [inStock, setInStock] = useState(product.inStock);
  const [dirty, setDirty] = useState(false);

  const onChange = () => setDirty(true);

  const save = () => {
    setDirty(false);
    toast(`Блюдо «${product.name}» сохранено`);
  };
  const cancel = () => {
    setDirty(false);
    toast("Изменения отменены", "info");
  };
  const duplicate = () => {
    toast(`Создан дубль «${product.name} (копия)»`);
    router.push("/admin/catalog/products");
  };

  return (
    <AdminShell
      title={product.name}
      crumbs={[
        { label: "Каталог" },
        { label: "Блюда", href: "/admin/catalog/products" },
        { label: product.name },
      ]}
      actions={
        <>
          <button className="admin-btn ghost" onClick={duplicate}>Дублировать</button>
          <button className="admin-btn" onClick={cancel} disabled={!dirty}>Отмена</button>
          <button className="admin-btn primary" onClick={save}>
            {dirty ? "● Сохранить" : "Сохранить"}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
        <span className="admin-mono admin-meta">{product.slug}</span>
        <span className="admin-meta">·</span>
        <span className="admin-meta">{product.category}</span>
        {product.badge && <span className="admin-pill accent">{product.badge}</span>}
        <div style={{ marginLeft: "auto", display: "flex", gap: 16 }}>
          <Toggle
            on={visible}
            onChange={(v) => { setVisible(v); onChange(); toast(v ? "Блюдо видно в меню" : "Блюдо скрыто из меню", "info"); }}
            label="Видимость"
          />
          <Toggle
            on={inStock}
            onChange={(v) => { setInStock(v); onChange(); toast(v ? "В наличии" : "Поставили на стоп", v ? "ok" : "warn"); }}
            label="В наличии"
          />
        </div>
      </div>

      <div className="admin-tabs">
        {(["main", "media", "variants", "bindings", "rules", "outlets"] as Tab[]).map((t) => (
          <button key={t} className="admin-tab" data-active={tab === t} onClick={() => setTab(t)}>
            {tabLabel(t)}
          </button>
        ))}
      </div>

      {tab === "main" && <MainTab onDirty={onChange} name={product.name} category={product.category} kcal={product.kcal} />}
      {tab === "media" && <MediaTab slug={product.slug} hasVideo={product.hasVideo} />}
      {tab === "variants" && <VariantsTab basePrice={product.basePriceAed} onDirty={onChange} />}
      {tab === "bindings" && <BindingsTab onDirty={onChange} />}
      {tab === "rules" && <RulesTab slug={product.slug} />}
      {tab === "outlets" && <OutletsTab onDirty={onChange} />}
    </AdminShell>
  );
}

function tabLabel(t: Tab) {
  return { main: "Основное", media: "Медиа", variants: "Варианты", bindings: "Допы", rules: "Правила", outlets: "Точки" }[t];
}

function MainTab({ name, category, kcal, onDirty }: { name: string; category: string; kcal: number; onDirty: () => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">Локализованные тексты</div>
        </div>
        <div className="admin-panel-body">
          <div className="admin-grid-2">
            <div className="admin-field">
              <label className="admin-label">Название (RU)</label>
              <input className="admin-input" defaultValue={name} onChange={onDirty} />
            </div>
            <div className="admin-field">
              <label className="admin-label">Название (EN)</label>
              <input className="admin-input" defaultValue={`${name} (en)`} onChange={onDirty} />
            </div>
          </div>
          <div className="admin-field">
            <label className="admin-label">Описание (RU)</label>
            <textarea className="admin-textarea" defaultValue="Свежевыжатый, без сахара. Подаём 0°C." onChange={onDirty} />
          </div>
          <div className="admin-grid-3">
            <div className="admin-field">
              <label className="admin-label">Категория</label>
              <select className="admin-select" defaultValue={category} onChange={onDirty}>
                <option>{category}</option>
              </select>
            </div>
            <div className="admin-field">
              <label className="admin-label">Бейдж</label>
              <select className="admin-select" defaultValue="" onChange={onDirty}>
                <option value="">—</option>
                <option>BESTSELLER</option>
                <option>NEW</option>
                <option>LIMITED</option>
                <option>SEASONAL</option>
              </select>
            </div>
            <div className="admin-field">
              <label className="admin-label">Время готовки, сек</label>
              <input className="admin-input mono" defaultValue="90" onChange={onDirty} />
            </div>
          </div>
          <div className="admin-field">
            <label className="admin-label">Теги</label>
            <input className="admin-input" defaultValue="vegan, gluten-free, no-sugar" onChange={onDirty} />
          </div>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">КБЖУ базы (размер M)</div>
          <span className="admin-meta">с допами пересчитывается</span>
        </div>
        <div className="admin-panel-body">
          <div className="kbju-grid">
            <div className="kbju-cell"><div className="kbju-cell-label">Ккал</div><div className="kbju-cell-value">{kcal}</div></div>
            <div className="kbju-cell"><div className="kbju-cell-label">Белки</div><div className="kbju-cell-value">2.1</div></div>
            <div className="kbju-cell"><div className="kbju-cell-label">Жиры</div><div className="kbju-cell-value">0.4</div></div>
            <div className="kbju-cell"><div className="kbju-cell-label">Углев.</div><div className="kbju-cell-value">42</div></div>
          </div>
          <div style={{ marginTop: 12 }} className="admin-grid-2">
            <div className="admin-field">
              <label className="admin-label">Сахар, г</label>
              <input className="admin-input mono" defaultValue="38" onChange={onDirty} />
            </div>
            <div className="admin-field">
              <label className="admin-label">Клетчатка, г</label>
              <input className="admin-input mono" defaultValue="1.2" onChange={onDirty} />
            </div>
          </div>
          <div className="admin-field">
            <label className="admin-label">Вес/объём базы, г</label>
            <input className="admin-input mono" defaultValue="300" onChange={onDirty} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MediaTab({ slug, hasVideo }: { slug: string; hasVideo: boolean }) {
  const toast = useToast();
  return (
    <div className="admin-grid-2">
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">Видео-петля</div>
          <span className="admin-meta">mp4 720×1280, ≤ 800 KB</span>
        </div>
        <div className="admin-panel-body">
          <div style={{ border: "2px dashed #D8D5C8", padding: 32, textAlign: "center", background: "#FAF8F0" }}>
            {hasVideo ? (
              <>
                <div className="admin-mono" style={{ fontSize: 12, color: "#5A6172", marginBottom: 8 }}>
                  cdn.juicy.ae/products/{slug}.mp4
                </div>
                <div className="admin-meta">5 s · H.264 baseline · 720×1280 · 612 KB</div>
                <button className="admin-btn sm" style={{ marginTop: 12 }} onClick={() => toast("Открыт диалог замены видео")}>Заменить</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 24, color: "#C8CAD0" }}>+</div>
                <div className="admin-meta" style={{ marginTop: 6 }}>Перетащите mp4 или нажмите</div>
                <button className="admin-btn sm" style={{ marginTop: 12 }} onClick={() => toast("Открыт файл-пикер")}>Выбрать файл</button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">Превью (постер первого кадра)</div>
          <span className="admin-pill warn">обязательно</span>
        </div>
        <div className="admin-panel-body">
          <div style={{ border: "1px solid #E4E1D6", background: "#0E0E10", height: 200, display: "grid", placeItems: "center", color: "#5A6172", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11 }}>
            poster.jpg · {slug}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="admin-btn sm" onClick={() => toast("Постер сгенерирован из первого кадра видео")}>Автогенерация из видео</button>
            <button className="admin-btn sm" onClick={() => toast("Открыт файл-пикер")}>Загрузить вручную</button>
          </div>
        </div>
      </div>

      <div className="admin-panel" style={{ gridColumn: "1 / -1" }}>
        <div className="admin-panel-head">
          <div className="admin-panel-title">Прозрачный PNG для каталога (опционально)</div>
          <span className="admin-meta">используется в карточках, поиске, истории заказов</span>
        </div>
        <div className="admin-panel-body" style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div className="admin-thumb" style={{ width: 80, height: 80, background: "#F0EDE0" }}>
            <span className="admin-mono" style={{ fontSize: 11, color: "#5A6172" }}>PNG</span>
          </div>
          <div>
            <div className="admin-meta">Не загружен. Без PNG используется постер.</div>
            <button className="admin-btn sm" style={{ marginTop: 8 }} onClick={() => toast("Открыт файл-пикер для PNG")}>Загрузить</button>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <div className="admin-field" style={{ margin: 0 }}>
              <label className="admin-label">Цвет фона (пока медиа грузится)</label>
              <input className="admin-input mono" defaultValue="#F4ECDE" style={{ width: 120 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type Variant = { id: string; code: string; volume: number; price: number; kcalMod: number; inStock: boolean };

function VariantsTab({ basePrice, onDirty }: { basePrice: number; onDirty: () => void }) {
  const toast = useToast();
  const [variants, setVariants] = useState<Variant[]>([
    { id: "v-s", code: "S", volume: 250, price: basePrice - 4, kcalMod: -30, inStock: true },
    { id: "v-m", code: "M", volume: 350, price: basePrice, kcalMod: 0, inStock: true },
    { id: "v-l", code: "L", volume: 500, price: basePrice + 6, kcalMod: 50, inStock: true },
  ]);

  const addVariant = () => {
    const code = String.fromCharCode(65 + variants.length); // A, B…
    setVariants((v) => [...v, { id: `v-${Date.now()}`, code, volume: 300, price: basePrice, kcalMod: 0, inStock: true }]);
    onDirty();
    toast("Добавлен новый вариант");
  };

  const remove = (id: string) => {
    setVariants((v) => v.filter((x) => x.id !== id));
    onDirty();
    toast("Вариант удалён", "info");
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-head">
        <div className="admin-panel-title">Варианты размеров</div>
        <button className="admin-btn sm" onClick={addVariant}>+ Добавить вариант</button>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Код</th><th>Название</th><th>Объём, мл</th><th>Цена, AED</th>
            <th>Δ Ккал</th><th>Δ Белки</th><th>Δ Жиры</th><th>Δ Углев.</th>
            <th>В наличии</th><th></th>
          </tr>
        </thead>
        <tbody>
          {variants.map((v) => (
            <tr key={v.id}>
              <td><span className="admin-pill accent">{v.code}</span></td>
              <td><input className="admin-input" defaultValue={`Размер ${v.code}`} style={{ width: 160 }} onChange={onDirty} /></td>
              <td><input className="admin-input mono" defaultValue={v.volume} style={{ width: 80 }} onChange={onDirty} /></td>
              <td><input className="admin-input mono" defaultValue={v.price.toFixed(2)} style={{ width: 80 }} onChange={onDirty} /></td>
              <td><input className="admin-input mono" defaultValue={v.kcalMod} style={{ width: 60 }} onChange={onDirty} /></td>
              <td><input className="admin-input mono" defaultValue="0" style={{ width: 60 }} onChange={onDirty} /></td>
              <td><input className="admin-input mono" defaultValue="0" style={{ width: 60 }} onChange={onDirty} /></td>
              <td><input className="admin-input mono" defaultValue="0" style={{ width: 60 }} onChange={onDirty} /></td>
              <td><Toggle defaultOn={v.inStock} onChange={onDirty} /></td>
              <td><button className="admin-btn ghost sm" style={{ color: "#A12822" }} onClick={() => remove(v.id)}>удалить</button></td>
            </tr>
          ))}
          {variants.length === 0 && (
            <tr><td colSpan={10} style={{ textAlign: "center", padding: 30, color: "#5A6172" }}>
              Нет вариантов. <button className="admin-btn sm" onClick={addVariant}>Добавить первый</button>
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

type Binding = { groupSlug: string; required: boolean; minTotal: number; maxTotal: number };
type Override = {
  addonId: string;
  priceOverride: number | null;
  free: boolean;
  doseOverride: number | null;
  minUnits: number;
  maxUnits: number;
  hidden: boolean;
};

function BindingsTab({ onDirty }: { onDirty: () => void }) {
  const toast = useToast();
  const [bindings, setBindings] = useState<Binding[]>([
    { groupSlug: "milk", required: true, minTotal: 1, maxTotal: 1 },
    { groupSlug: "syrups", required: false, minTotal: 0, maxTotal: 3 },
    { groupSlug: "shots", required: false, minTotal: 0, maxTotal: 4 },
    { groupSlug: "sugar-level", required: true, minTotal: 1, maxTotal: 1 },
  ]);
  const [overrides, setOverrides] = useState<Override[]>([
    { addonId: "milk-regular", priceOverride: 0, free: true, doseOverride: 200, minUnits: 1, maxUnits: 1, hidden: false },
    { addonId: "milk-oat", priceOverride: 0, free: true, doseOverride: 200, minUnits: 0, maxUnits: 1, hidden: false },
    { addonId: "shot-regular", priceOverride: null, free: false, doseOverride: null, minUnits: 0, maxUnits: 4, hidden: false },
    { addonId: "syrup-vanilla", priceOverride: 3, free: false, doseOverride: 15, minUnits: 0, maxUnits: 2, hidden: false },
  ]);

  const [addBindingOpen, setAddBindingOpen] = useState(false);
  const [addOverrideOpen, setAddOverrideOpen] = useState(false);
  const [pickGroupSlug, setPickGroupSlug] = useState("");
  const [pickAddonId, setPickAddonId] = useState("");

  const availableGroups = adminAddonGroups.filter((g) => !bindings.find((b) => b.groupSlug === g.slug));
  const availableAddons = adminAddons.filter((a) => !overrides.find((o) => o.addonId === a.id));

  const addBinding = () => {
    if (!pickGroupSlug) return;
    setBindings((b) => [...b, { groupSlug: pickGroupSlug, required: false, minTotal: 0, maxTotal: 1 }]);
    setPickGroupSlug("");
    setAddBindingOpen(false);
    onDirty();
    toast("Группа допов прикреплена");
  };
  const removeBinding = (slug: string) => {
    setBindings((b) => b.filter((x) => x.groupSlug !== slug));
    onDirty();
    toast("Группа отвязана", "info");
  };
  const addOverride = () => {
    if (!pickAddonId) return;
    const a = adminAddons.find((x) => x.id === pickAddonId);
    if (!a) return;
    setOverrides((o) => [
      ...o,
      { addonId: pickAddonId, priceOverride: null, free: false, doseOverride: null, minUnits: 0, maxUnits: 1, hidden: false },
    ]);
    setPickAddonId("");
    setAddOverrideOpen(false);
    onDirty();
    toast(`Override для «${a.name}» добавлен`);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16 }}>
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">Привязанные группы допов</div>
          <button className="admin-btn sm" onClick={() => setAddBindingOpen(true)} disabled={availableGroups.length === 0}>
            + Группу
          </button>
        </div>
        <table className="admin-table">
          <thead>
            <tr><th>Группа</th><th>Тип выбора</th><th>Required</th><th>Min</th><th>Max</th><th>Default</th><th></th></tr>
          </thead>
          <tbody>
            {bindings.map((b) => {
              const g = adminAddonGroups.find((x) => x.slug === b.groupSlug);
              return (
                <tr key={b.groupSlug}>
                  <td><strong>{g?.name}</strong></td>
                  <td>
                    <span className="admin-pill">
                      {g?.selectionType === "single" ? "одно" : g?.selectionType === "multi" ? "несколько" : "счётчик"}
                    </span>
                  </td>
                  <td><Toggle defaultOn={b.required} onChange={onDirty} /></td>
                  <td><input className="admin-input mono" defaultValue={b.minTotal} style={{ width: 50 }} onChange={onDirty} /></td>
                  <td><input className="admin-input mono" defaultValue={b.maxTotal} style={{ width: 50 }} onChange={onDirty} /></td>
                  <td><span className="admin-pill">{b.groupSlug === "milk" ? "обычное" : "—"}</span></td>
                  <td><button className="admin-btn ghost sm" onClick={() => removeBinding(b.groupSlug)}>×</button></td>
                </tr>
              );
            })}
            {bindings.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 30, color: "#5A6172" }}>
                Нет привязанных групп
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">Цена и доза допов в этом блюде</div>
          <span className="admin-meta">override базовых значений</span>
        </div>
        <div className="admin-panel-body">
          <p className="admin-meta" style={{ marginBottom: 10 }}>
            Пустое поле = использовать базовое значение из карточки допа.
            Истории вида «молоко в латте бесплатно и 200 ml», «макс 4 шота», «в раф-таро молока 150 ml».
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(160px, 1.6fr) repeat(4, minmax(70px, 1fr)) 80px", gap: 6, padding: "8px 0", borderBottom: "1.5px solid #E8E2D5" }}>
            <div className="admin-label">Доп</div>
            <div className="admin-label">Цена / unit, AED</div>
            <div className="admin-label">Доза в блюде</div>
            <div className="admin-label">Min units</div>
            <div className="admin-label">Max units</div>
            <div className="admin-label">Скрыть</div>
          </div>
          {overrides.map((o) => {
            const a = adminAddons.find((x) => x.id === o.addonId);
            if (!a) return null;
            const effPrice = o.free ? 0 : o.priceOverride ?? a.pricePerUnitAed;
            return (
              <div key={o.addonId} style={{ display: "grid", gridTemplateColumns: "minmax(160px, 1.6fr) repeat(4, minmax(70px, 1fr)) 80px", gap: 6, alignItems: "center", padding: "10px 0", borderBottom: "1px solid #EFEDE3" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</div>
                  <div className="admin-meta">
                    база: <span className="admin-num">{a.pricePerUnitAed} AED</span>
                    {" · "}<span className="admin-num">{addonDoseLabel(a)}</span>
                  </div>
                </div>
                <input
                  className="admin-input mono"
                  placeholder={String(a.pricePerUnitAed)}
                  defaultValue={o.free ? "0" : o.priceOverride !== null ? String(o.priceOverride) : ""}
                  onChange={onDirty}
                  style={effPrice !== a.pricePerUnitAed ? { borderColor: "#16A34A", background: "#DDEDE0" } : {}}
                />
                <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                  <input
                    className="admin-input mono"
                    placeholder={String(a.doseAmount)}
                    defaultValue={o.doseOverride !== null ? String(o.doseOverride) : ""}
                    onChange={onDirty}
                    style={o.doseOverride !== null && o.doseOverride !== a.doseAmount ? { borderColor: "#16A34A", background: "#DDEDE0" } : {}}
                  />
                  <span className="admin-meta" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{a.doseUnit}/{a.unit}</span>
                </div>
                <input className="admin-input mono" defaultValue={o.minUnits} onChange={onDirty} />
                <input className="admin-input mono" defaultValue={o.maxUnits} onChange={onDirty} />
                <Toggle defaultOn={o.hidden} onChange={onDirty} />
              </div>
            );
          })}
          {overrides.length === 0 && (
            <div style={{ textAlign: "center", padding: 20, color: "#5A6172" }}>
              Нет overrides. Базовые цены и дозы.
            </div>
          )}
          <button className="admin-btn sm" style={{ marginTop: 10 }} onClick={() => setAddOverrideOpen(true)} disabled={availableAddons.length === 0}>
            + Override
          </button>
          <div className="admin-meta" style={{ marginTop: 10 }}>
            <span style={{ background: "#DDEDE0", border: "1px solid #16A34A", padding: "1px 4px" }}>зелёная рамка</span>
            {" "}= значение перекрывает базу из карточки допа.
          </div>
        </div>
      </div>

      <Modal
        open={addBindingOpen}
        title="Привязать группу допов"
        onClose={() => setAddBindingOpen(false)}
        onSubmit={addBinding}
        submitDisabled={!pickGroupSlug}
        submitLabel="Прикрепить"
      >
        <div className="admin-field">
          <label className="admin-label">Группа</label>
          <select className="admin-select" value={pickGroupSlug} onChange={(e) => setPickGroupSlug(e.target.value)}>
            <option value="">— выбери —</option>
            {availableGroups.map((g) => (
              <option key={g.slug} value={g.slug}>{g.name} · {g.selectionType}</option>
            ))}
          </select>
        </div>
        <p className="admin-meta">
          После создания можно настроить required / min / max в строке таблицы.
        </p>
      </Modal>

      <Modal
        open={addOverrideOpen}
        title="Override для допа в этом блюде"
        onClose={() => setAddOverrideOpen(false)}
        onSubmit={addOverride}
        submitDisabled={!pickAddonId}
        submitLabel="Создать override"
      >
        <div className="admin-field">
          <label className="admin-label">Доп</label>
          <select className="admin-select" value={pickAddonId} onChange={(e) => setPickAddonId(e.target.value)}>
            <option value="">— выбери —</option>
            {availableAddons.map((a) => (
              <option key={a.id} value={a.id}>{a.name} · база {a.pricePerUnitAed} AED · {addonDoseLabel(a)}</option>
            ))}
          </select>
        </div>
      </Modal>
    </div>
  );
}

function RulesTab({ slug }: { slug: string }) {
  const toast = useToast();
  const [rules, setRules] = useState([
    { id: "r-3", when: "овсяное молоко", effect: "цена овсяного = 0 AED", note: "Овсяное в латте без доплаты", enabled: true },
    { id: "r-l1", when: "decaf шот", effect: "запрет: обычный шот", note: "Кофеин/без — взаимоисключение", enabled: true },
  ]);
  const [sandboxOpen, setSandboxOpen] = useState(false);

  return (
    <div className="admin-panel">
      <div className="admin-panel-head">
        <div className="admin-panel-title">Правила, действующие в этом блюде</div>
        <button
          className="admin-btn sm"
          onClick={() => {
            const id = `r-${Date.now()}`;
            setRules((r) => [...r, { id, when: "(новое условие)", effect: "(новый эффект)", note: "", enabled: false }]);
            toast("Добавлен черновик правила — настрой условие и эффект");
          }}
        >
          + Правило
        </button>
      </div>
      <div className="admin-panel-body">
        <p className="admin-meta" style={{ marginBottom: 12 }}>
          Глобальные правила тоже учитываются — открой{" "}
          <Link href="/admin/catalog/groups" style={{ color: "#0F1115", fontWeight: 600 }}>«Группы и правила»</Link>.
        </p>
        {rules.map((r) => (
          <div key={r.id} style={{ border: "1px solid #E4E1D6", padding: 12, marginBottom: 8, display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "center" }}>
            <div><div className="admin-label">Когда</div><div style={{ fontWeight: 600 }}>{r.when}</div></div>
            <div><div className="admin-label">→</div><div style={{ fontWeight: 600, color: "#16A34A" }}>{r.effect}</div></div>
            <div className="admin-meta">{r.note || "—"}</div>
            <div style={{ display: "flex", gap: 6 }}>
              <Toggle defaultOn={r.enabled} onChange={(on) => toast(on ? "Правило включено" : "Правило выключено", "info")} />
              <button
                className="admin-btn ghost sm"
                onClick={() => { setRules((arr) => arr.filter((x) => x.id !== r.id)); toast("Правило удалено", "info"); }}
              >
                ×
              </button>
            </div>
          </div>
        ))}
        {rules.length === 0 && (
          <div style={{ textAlign: "center", padding: 30, color: "#5A6172" }}>Правил пока нет</div>
        )}
        <div className="admin-divider" />
        <div style={{ background: "#FAF8F0", padding: 14, border: "1px solid #E4E1D6" }}>
          <div className="admin-panel-title" style={{ marginBottom: 8 }}>Песочница «что будет, если…»</div>
          <p className="admin-meta">
            Выбери допы — увидишь, что отдаст бэк через <span className="admin-mono">POST /products/{slug}/preview</span>.
          </p>
          <button className="admin-btn sm" style={{ marginTop: 8 }} onClick={() => setSandboxOpen(true)}>Открыть песочницу</button>
        </div>
      </div>

      <Modal
        open={sandboxOpen}
        title="Песочница preview"
        subtitle={slug}
        onClose={() => setSandboxOpen(false)}
        onSubmit={() => { toast("preview прогнан, результат в правой колонке"); }}
        submitLabel="Прогнать"
      >
        <div className="admin-field">
          <label className="admin-label">Выбранные допы (нажми, чтобы переключить)</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["овсяное молоко", "обычный шот", "decaf шот", "сироп ваниль", "имбирь"].map((t) => (
              <button key={t} className="admin-btn sm">{t}</button>
            ))}
          </div>
        </div>
        <pre style={{ background: "#0F1115", color: "#E8E6DE", padding: 12, fontSize: 12, lineHeight: 1.5, overflowX: "auto" }}>
{`POST /products/${slug}/preview
→ { allowedAddons: [...],
    forbiddenAddons: [
      { addonId: "milk-regular",
        by: "rule:r-1",
        message: "Нельзя комбинировать
                  два вида молока" }
    ],
    priceAed: "23.00",
    nutrition: { kcal: 185, ... } }`}
        </pre>
      </Modal>
    </div>
  );
}

function OutletsTab({ onDirty }: { onDirty: () => void }) {
  const toast = useToast();
  const outlets = ["Bay Avenue", "Dubai Mall", "Marina Walk", "City Walk"];
  return (
    <div className="admin-panel">
      <div className="admin-panel-head">
        <div className="admin-panel-title">В каких точках видно блюдо</div>
        <span className="admin-meta">переключатель «видимость» + «в наличии» per outlet</span>
      </div>
      <table className="admin-table">
        <thead>
          <tr><th>Точка</th><th>В меню</th><th>В наличии сейчас</th><th>Стоп-лист с</th><th>Действие</th></tr>
        </thead>
        <tbody>
          {outlets.map((name, i) => (
            <tr key={name}>
              <td><strong>{name}</strong></td>
              <td><Toggle defaultOn={i !== 3} onChange={(v) => { onDirty(); toast(`${name}: ${v ? "в меню" : "скрыто"}`, "info"); }} /></td>
              <td><Toggle defaultOn={i !== 2 && i !== 7} onChange={(v) => { onDirty(); toast(`${name}: ${v ? "в наличии" : "стоп"}`, v ? "ok" : "warn"); }} /></td>
              <td className="admin-meta">{i === 2 ? "13:00 · Sergey M." : "—"}</td>
              <td><button className="admin-btn ghost sm" onClick={() => toast(`Открыт журнал изменений для ${name}`)}>Журнал</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
