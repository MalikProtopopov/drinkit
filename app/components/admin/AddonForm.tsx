"use client";

import { useMemo, useState } from "react";
import { Toggle } from "@/components/admin/AdminUI";
import { MediaUpload } from "@/components/admin/MediaUpload";
import { NumInput } from "@/components/admin/NumInput";
import type { AddonCat, I18n, Unit } from "@/lib/adminApi";

export type AddonDraft = {
  name: I18n; imageUrl?: string | null; categoryId: number; unitId: number;
  kcalPer100: number; proteinPer100: number; fatPer100: number; carbsPer100: number;
  basePrice: number; isActive: boolean;
};

const catLabel = (c: AddonCat) => c.name.en ?? c.name.ru ?? "—";
const unitLabel = (u: Unit) => `${u.code} — ${u.name.en ?? u.name.ru ?? ""}`;

/** Общая форма создания/редактирования добавки (вкладка-карточка как у редактора напитка). */
export function AddonForm({
  cats, units, initial, mode, saving, onSubmit, onCancel,
}: {
  cats: AddonCat[]; units: Unit[]; initial: AddonDraft;
  mode: "create" | "edit"; saving: boolean;
  onSubmit: (draft: AddonDraft) => void; onCancel: () => void;
}) {
  const [d, setD] = useState<AddonDraft>(initial);
  const set = (patch: Partial<AddonDraft>) => setD((x) => ({ ...x, ...patch }));

  const baseline = useMemo(() => JSON.stringify(initial), [initial]);
  const dirty = JSON.stringify(d) !== baseline;
  const nameOk = (d.name.en ?? "").trim().length > 0;
  const valid = nameOk && !!d.categoryId && !!d.unitId && d.basePrice >= 0;
  const canSave = mode === "create" ? valid : (valid && dirty);

  const unitCode = units.find((u) => u.id === d.unitId)?.code ?? "ед.";
  const cat = cats.find((c) => c.id === d.categoryId);
  const warn = { borderColor: "#B45309", background: "#FFF7E5" } as const;

  return (
    <div className="admin-panel">
      <div className="admin-panel-head">
        <div className="admin-panel-title">{mode === "create" ? "Новая добавка" : "Карточка добавки"}</div>
        <span className="admin-meta">ингредиент конструктора напитка</span>
      </div>
      <div className="admin-panel-body">
        {/* живой предпросмотр «как в конструкторе» */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, overflow: "hidden", flexShrink: 0,
                        background: "#F2ECE2", display: "grid", placeItems: "center" }}>
            {d.imageUrl
              ? <img src={d.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 22 }}>🧃</span>}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{d.name.en?.trim() || "Без названия"}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
              {cat && <span className="admin-pill accent" style={{ fontWeight: 700 }}>{catLabel(cat)}</span>}
              <span className="admin-meta">{d.basePrice} AED · {d.kcalPer100} ккал/100 {unitCode}</span>
            </div>
          </div>
        </div>

        <div className="admin-grid-2">
          <div className="admin-field">
            <label className="admin-label">Название (EN) — основное на сайте *</label>
            <input className="admin-input" autoFocus value={d.name.en ?? ""}
                   onChange={(e) => set({ name: { ...d.name, en: e.target.value } })}
                   placeholder="Collagen" style={!nameOk ? warn : undefined} />
          </div>
          <div className="admin-field">
            <label className="admin-label">Название (AR)</label>
            <input className="admin-input" dir="rtl" value={d.name.ar ?? ""}
                   onChange={(e) => set({ name: { ...d.name, ar: e.target.value } })}
                   placeholder="نص عربي" />
          </div>
        </div>

        <div className="admin-field">
          <label className="admin-label">Картинка (иконка в конструкторе)</label>
          <MediaUpload accept="image" height={120} value={d.imageUrl ?? ""}
                       onChange={(url) => set({ imageUrl: url ?? "" })} />
        </div>

        <div className="admin-grid-2">
          <div className="admin-field">
            <label className="admin-label">Категория</label>
            <select className="admin-select" value={d.categoryId}
                    onChange={(e) => set({ categoryId: +e.target.value })}>
              {cats.map((c) => <option key={c.id} value={c.id}>{catLabel(c)}</option>)}
            </select>
            {cat && !cat.isActive && <span className="admin-meta" style={{ color: "#B45309" }}>
              категория скрыта — добавка не появится в конструкторе</span>}
          </div>
          <div className="admin-field">
            <label className="admin-label">Единица измерения порции</label>
            <select className="admin-select" value={d.unitId}
                    onChange={(e) => set({ unitId: +e.target.value })}>
              {units.map((u) => <option key={u.id} value={u.id}>{unitLabel(u)}</option>)}
            </select>
          </div>
        </div>

        <div className="admin-panel" style={{ marginBottom: 14 }}>
          <div className="admin-panel-head">
            <div className="admin-panel-title">Пищевая ценность на 100 {unitCode}</div>
            <span className="admin-meta">на сайте пересчитывается на объём порции в напитке</span>
          </div>
          <div className="admin-panel-body">
            <div className="kbju-grid">
              {([["kcalPer100", "Ккал"], ["proteinPer100", "Белки, г"],
                 ["fatPer100", "Жиры, г"], ["carbsPer100", "Углеводы, г"]] as const).map(([k, l]) => (
                <div className="kbju-cell" key={k}>
                  <div className="kbju-cell-label">{l}</div>
                  <NumInput value={d[k]} min={0} style={{ marginTop: 4 }}
                            onChange={(n) => set({ [k]: n } as Partial<AddonDraft>)} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="admin-grid-2">
          <div className="admin-field">
            <label className="admin-label">Цена за порцию, AED</label>
            <NumInput value={d.basePrice} min={0} onChange={(n) => set({ basePrice: n })} />
            <span className="admin-meta">базовая цена; в конкретном напитке её можно переопределить</span>
          </div>
          <div className="admin-field">
            <label className="admin-label">Доступность</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
              <Toggle on={d.isActive} onChange={(v) => set({ isActive: v })} />
              <span className="admin-meta">{d.isActive ? "видна в конструкторе" : "скрыта из конструктора"}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center" }}>
          <button className="admin-btn primary" disabled={!canSave || saving}
                  onClick={() => onSubmit(d)}>
            {saving ? "Сохранение…" : mode === "create" ? "Создать добавку" : "Сохранить"}
          </button>
          <button className="admin-btn" onClick={onCancel} disabled={saving}>Отмена</button>
          {mode === "edit" && dirty && !saving &&
            <span className="admin-meta">● есть несохранённые изменения</span>}
        </div>
      </div>
    </div>
  );
}
