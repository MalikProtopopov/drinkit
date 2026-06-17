"use client";

import { useMemo, useState } from "react";
import type { I18n } from "@/lib/adminApi";

export type UnitDraft = { code: string; name: I18n };

/** Общая форма создания/редактирования единицы измерения (ADM-S-04). Имена — EN/AR. */
export function UnitForm({
  initial, mode, saving, onSubmit, onCancel,
}: {
  initial: UnitDraft; mode: "create" | "edit"; saving: boolean;
  onSubmit: (draft: UnitDraft) => void; onCancel: () => void;
}) {
  const [d, setD] = useState<UnitDraft>(initial);
  const set = (patch: Partial<UnitDraft>) => setD((x) => ({ ...x, ...patch }));

  const baseline = useMemo(() => JSON.stringify(initial), [initial]);
  const dirty = JSON.stringify(d) !== baseline;
  const codeOk = d.code.trim().length > 0;
  const nameOk = (d.name.en ?? "").trim().length > 0;
  const valid = codeOk && nameOk;
  const canSave = mode === "create" ? valid : (valid && dirty);
  const warn = { borderColor: "#B45309", background: "#FFF7E5" } as const;

  return (
    <div className="admin-panel">
      <div className="admin-panel-head">
        <div className="admin-panel-title">{mode === "create" ? "New unit" : "Unit"}</div>
        <span className="admin-meta">measurement unit for add-on portions</span>
      </div>
      <div className="admin-panel-body">
        <div className="admin-grid-2">
          <div className="admin-field">
            <label className="admin-label">Code (Latin) *</label>
            <input className="admin-input mono" autoFocus value={d.code}
                   onChange={(e) => set({ code: e.target.value })}
                   placeholder="g · ml · pcs" style={!codeOk ? warn : undefined} />
          </div>
          <div className="admin-field">
            <label className="admin-label">Name (EN) — primary on the site *</label>
            <input className="admin-input" value={d.name.en ?? ""}
                   onChange={(e) => set({ name: { ...d.name, en: e.target.value } })}
                   placeholder="grams" style={!nameOk ? warn : undefined} />
          </div>
          <div className="admin-field">
            <label className="admin-label">Name (AR)</label>
            <input className="admin-input" dir="rtl" value={d.name.ar ?? ""}
                   onChange={(e) => set({ name: { ...d.name, ar: e.target.value } })}
                   placeholder="غرام" />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center" }}>
          <button className="admin-btn primary" disabled={!canSave || saving} onClick={() => onSubmit(d)}>
            {saving ? "Saving…" : mode === "create" ? "Add unit" : "Save"}
          </button>
          <button className="admin-btn" onClick={onCancel} disabled={saving}>Cancel</button>
          {mode === "edit" && dirty && !saving && <span className="admin-meta">● unsaved changes</span>}
        </div>
      </div>
    </div>
  );
}
