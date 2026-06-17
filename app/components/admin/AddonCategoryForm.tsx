"use client";

import { useMemo, useState } from "react";
import { Toggle } from "@/components/admin/AdminUI";
import { MediaUpload } from "@/components/admin/MediaUpload";
import type { I18n } from "@/lib/adminApi";

export type AddonCatDraft = {
  name: I18n; iconUrl?: string | null; isActive: boolean;
  selectionType: "single" | "multi" | "counter";
};

const SEL_LABEL = { single: "single", multi: "multiple", counter: "counter" } as const;
const SEL_HINT = {
  single: "one add-on in the category, 1 portion",
  multi: "several add-ons, 1 portion each",
  counter: "portions within the limits set in the drink",
} as const;

/** Общая форма создания/редактирования категории добавок (ADM-S-02). Имена — EN/AR (админка на EN). */
export function AddonCategoryForm({
  initial, mode, saving, onSubmit, onCancel,
}: {
  initial: AddonCatDraft; mode: "create" | "edit"; saving: boolean;
  onSubmit: (draft: AddonCatDraft) => void; onCancel: () => void;
}) {
  const [d, setD] = useState<AddonCatDraft>(initial);
  const set = (patch: Partial<AddonCatDraft>) => setD((x) => ({ ...x, ...patch }));

  const baseline = useMemo(() => JSON.stringify(initial), [initial]);
  const dirty = JSON.stringify(d) !== baseline;
  const nameOk = (d.name.en ?? "").trim().length > 0;
  const canSave = mode === "create" ? nameOk : (nameOk && dirty);
  const warn = { borderColor: "#B45309", background: "#FFF7E5" } as const;

  return (
    <div className="admin-panel">
      <div className="admin-panel-head">
        <div className="admin-panel-title">{mode === "create" ? "New add-on category" : "Add-on category"}</div>
        <span className="admin-meta">on the site: English and Arabic</span>
      </div>
      <div className="admin-panel-body">
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, overflow: "hidden", flexShrink: 0,
                        background: "#F2ECE2", display: "grid", placeItems: "center" }}>
            {d.iconUrl
              ? <img src={d.iconUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 22 }}>🏷️</span>}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{d.name.en?.trim() || "Untitled"}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
              <span className="admin-pill accent" style={{ fontWeight: 700 }}>{SEL_LABEL[d.selectionType]}</span>
              <span className="admin-meta">{d.isActive ? "active" : "hidden"}</span>
            </div>
          </div>
        </div>

        <div className="admin-grid-2">
          <div className="admin-field">
            <label className="admin-label">Name (EN) — primary on the site *</label>
            <input className="admin-input" autoFocus value={d.name.en ?? ""}
                   onChange={(e) => set({ name: { ...d.name, en: e.target.value } })}
                   placeholder="Boosters" style={!nameOk ? warn : undefined} />
          </div>
          <div className="admin-field">
            <label className="admin-label">Name (AR)</label>
            <input className="admin-input" dir="rtl" value={d.name.ar ?? ""}
                   onChange={(e) => set({ name: { ...d.name, ar: e.target.value } })}
                   placeholder="نص عربي" />
          </div>
        </div>

        <div className="admin-field">
          <label className="admin-label">Category icon</label>
          <MediaUpload accept="image" height={120} value={d.iconUrl ?? ""}
                       onChange={(url) => set({ iconUrl: url ?? "" })} />
        </div>

        <div className="admin-field">
          <label className="admin-label">Selection type</label>
          <div style={{ display: "flex", gap: 6 }}>
            {(["single", "multi", "counter"] as const).map((s) => (
              <button key={s} className={`admin-btn ${d.selectionType === s ? "primary" : ""}`}
                      onClick={() => set({ selectionType: s })}>
                {SEL_LABEL[s]}
              </button>
            ))}
          </div>
          <span className="admin-meta" style={{ marginTop: 6 }}>
            {SEL_HINT[d.selectionType]} — default for all drinks, can be overridden per drink.
          </span>
        </div>

        <div className="admin-field">
          <label className="admin-label">Availability</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
            <Toggle on={d.isActive} onChange={(v) => set({ isActive: v })} />
            <span className="admin-meta">{d.isActive ? "shown on the drink page" : "hidden from the drink page"}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center" }}>
          <button className="admin-btn primary" disabled={!canSave || saving} onClick={() => onSubmit(d)}>
            {saving ? "Saving…" : mode === "create" ? "Create category" : "Save"}
          </button>
          <button className="admin-btn" onClick={onCancel} disabled={saving}>Cancel</button>
          {mode === "edit" && dirty && !saving && <span className="admin-meta">● unsaved changes</span>}
        </div>
      </div>
    </div>
  );
}
