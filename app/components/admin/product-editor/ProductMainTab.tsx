"use client";

import type { AdminDrink, DrinkCat } from "@/lib/adminApi";
import { MediaUpload } from "@/components/admin/MediaUpload";
import { NumInput } from "@/components/admin/NumInput";

export function ProductMainTab({ drink, cats, set, warn }: {
  drink: AdminDrink;
  cats: DrinkCat[];
  set: (patch: Partial<AdminDrink>) => void;
  warn: { borderColor: string; background: string };
}) {
  return (
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
  );
}
