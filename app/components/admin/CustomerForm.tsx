"use client";

import { useMemo, useState } from "react";
import { emirates } from "@/lib/data";
import { isPhoneComplete, maskName, maskPhoneUAE, maskPlate, normalizePhoneUAE } from "@/lib/masks";

export type CustomerDraft = {
  phone: string;       // отображается маской, на бэк уходит normalizePhoneUAE
  name: string;
  carPlate: string;
  emirate: string;
  locale: string;      // en | ar
};

const LOCALES: [string, string][] = [["en", "English"], ["ar", "العربية"]];

/** Общая форма создания/редактирования клиента (карточка как у добавки/сотрудника). */
export function CustomerForm({
  initial, mode, saving, onSubmit, onCancel,
}: {
  initial: CustomerDraft;
  mode: "create" | "edit";
  saving: boolean;
  onSubmit: (draft: CustomerDraft) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState<CustomerDraft>({ ...initial, phone: maskPhoneUAE(initial.phone) });
  const set = (patch: Partial<CustomerDraft>) => setD((x) => ({ ...x, ...patch }));

  const baseline = useMemo(() => JSON.stringify({ ...initial, phone: maskPhoneUAE(initial.phone) }), [initial]);
  const dirty = JSON.stringify(d) !== baseline;
  const phoneOk = isPhoneComplete(d.phone);
  const valid = phoneOk;
  const canSave = mode === "create" ? valid : (valid && dirty);

  const warn = { borderColor: "#B45309", background: "#FFF7E5" } as const;
  const initials = (d.name || "")
    .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  // в режиме редактирования «Отмена» откатывает несохранённые правки и остаётся на странице
  const reset = () => setD({ ...initial, phone: maskPhoneUAE(initial.phone) });

  return (
    <div className="admin-panel">
      <div className="admin-panel-head">
        <div className="admin-panel-title">{mode === "create" ? "New customer" : "Customer details"}</div>
        <span className="admin-meta">customer profile</span>
      </div>
      <div className="admin-panel-body">
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <div className="admin-user" style={{ width: 54, height: 54, fontSize: 18 }}>{initials || "👤"}</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{d.name.trim() || "No name"}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
              <span className="admin-mono admin-meta">{d.phone || "—"}</span>
              {d.emirate && <span className="admin-pill accent" style={{ fontWeight: 700 }}>{d.emirate}</span>}
            </div>
          </div>
        </div>

        <div className="admin-grid-2">
          <div className="admin-field">
            <label className="admin-label">Phone *</label>
            <input className="admin-input mono" value={d.phone} placeholder="+971 50 000 0000"
                   onChange={(e) => set({ phone: maskPhoneUAE(e.target.value) })}
                   style={d.phone && !phoneOk ? warn : undefined} />
            <span className="admin-meta">customer login; must be unique</span>
          </div>
          <div className="admin-field">
            <label className="admin-label">Name</label>
            <input className="admin-input" value={d.name} placeholder="John Smith"
                   onChange={(e) => set({ name: maskName(e.target.value) })} />
          </div>
        </div>

        <div className="admin-grid-2">
          <div className="admin-field">
            <label className="admin-label">Car plate</label>
            <input className="admin-input mono" value={d.carPlate} placeholder="A 82741"
                   onChange={(e) => set({ carPlate: maskPlate(e.target.value) })} />
          </div>
          <div className="admin-field">
            <label className="admin-label">Emirate</label>
            <select className="admin-select" value={d.emirate} onChange={(e) => set({ emirate: e.target.value })}>
              <option value="">— not set —</option>
              {emirates.map((em) => <option key={em} value={em}>{em}</option>)}
            </select>
          </div>
        </div>

        <div className="admin-field">
          <label className="admin-label">Interface language</label>
          <div style={{ display: "inline-flex", gap: 2, padding: 3, background: "#F5EFE7", borderRadius: 999 }}>
            {LOCALES.map(([code, label]) => (
              <button key={code} className="admin-btn sm" onClick={() => set({ locale: code })}
                      style={d.locale === code ? { background: "#4A56E2", color: "#FFF" } : { background: "transparent" }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center" }}>
          <button className="admin-btn primary" disabled={!canSave || saving}
                  onClick={() => onSubmit({ ...d, phone: normalizePhoneUAE(d.phone) })}>
            {saving ? "Saving…" : mode === "create" ? "Create customer" : "Save"}
          </button>
          <button className="admin-btn" disabled={saving || (mode === "edit" && !dirty)}
                  onClick={mode === "edit" ? reset : onCancel}>Cancel</button>
          {mode === "edit" && dirty && !saving && <span className="admin-meta">● unsaved changes</span>}
        </div>
      </div>
    </div>
  );
}
