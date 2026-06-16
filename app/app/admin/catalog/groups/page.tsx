"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Modal, Toggle, useToast } from "@/components/admin/AdminUI";
import { MediaUpload } from "@/components/admin/MediaUpload";
import { catalogApi, type AddonCat, type Unit } from "@/lib/adminApi";

const SEL_LABEL = { single: "single", multi: "multiple", counter: "counter" } as const;

/** ADM-S-02: категории добавок (тип выбора на уровне категории) + ADM-S-04: единицы. */
function Inner() {
  const toast = useToast();
  const [cats, setCats] = useState<AddonCat[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [catOpen, setCatOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [nameRu, setNameRu] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [selType, setSelType] = useState<AddonCat["selectionType"]>("counter");
  const [unitCode, setUnitCode] = useState("");
  const [unitName, setUnitName] = useState("");
  const [unitNameAr, setUnitNameAr] = useState("");

  const load = useCallback(() => {
    catalogApi.addonCategories().then(setCats).catch(() => {});
    catalogApi.units().then(setUnits).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">Add-on categories</div>
          <button className="admin-btn sm" onClick={() => setCatOpen(true)}>+ Category</button>
        </div>
        <p className="admin-meta" style={{ padding: "0 16px 8px" }}>
          The selection type is set here (default for all drinks) and can be overridden
          per drink — the “Add-ons” tab in the drink editor.
        </p>
        <div className="admin-tablewrap"><table className="admin-table">
          <thead>
            <tr><th>Name</th><th>Selection type</th><th>Active</th></tr>
          </thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c.id} className={!c.isActive ? "muted" : ""}>
                <td>
                  <strong>{c.name.ru ?? c.name.en ?? "—"}</strong>{" "}
                  {c.name.ar ? <span className="admin-meta">{c.name.ar}</span>
                             : <span className="admin-pill warn">no AR</span>}
                </td>
                <td>
                  <div style={{ display: "inline-flex", gap: 2, padding: 3, background: "#F5EFE7", borderRadius: 999 }}>
                    {(["single", "multi", "counter"] as const).map((s) => (
                      <button key={s} className="admin-btn sm"
                        onClick={() => catalogApi.updateAddonCategory(c.id, { ...c, selectionType: s })
                          .then(() => { load(); toast(`Selection type → ${SEL_LABEL[s]}`, "info"); })}
                        style={c.selectionType === s ? { background: "#4A56E2", color: "#FFF" } : { background: "transparent" }}>
                        {SEL_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </td>
                <td>
                  <Toggle defaultOn={c.isActive}
                          onChange={(v) => catalogApi.updateAddonCategory(c.id, { ...c, isActive: v })
                            .then(() => toast(v ? "Category active" : "Hidden from drink page", "info"))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      <div className="admin-panel" style={{ marginTop: 16 }}>
        <div className="admin-panel-head">
          <div className="admin-panel-title">Units</div>
          <button className="admin-btn sm" onClick={() => setUnitOpen(true)}>+ Unit</button>
        </div>
        <div className="admin-tablewrap"><table className="admin-table">
          <thead><tr><th>Code</th><th>Name</th></tr></thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.id}>
                <td><span className="admin-pill">{u.code}</span></td>
                <td>{u.name.ru ?? u.name.en ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      <Modal open={catOpen} title="New add-on category" onClose={() => setCatOpen(false)}
             onSubmit={async () => {
               await catalogApi.createAddonCategory({
                 name: { ru: nameRu, ...(nameAr.trim() ? { ar: nameAr.trim() } : {}) },
                 iconUrl: iconUrl || null, isActive: true, selectionType: selType });
               setCatOpen(false); setNameRu(""); setNameAr(""); load(); toast("Category created");
             }}
             submitDisabled={!nameRu.trim()} submitLabel="Create">
        <div className="admin-field">
          <label className="admin-label">Name (RU)</label>
          <input className="admin-input" autoFocus value={nameRu} onChange={(e) => setNameRu(e.target.value)} />
        </div>
        <div className="admin-field">
          <label className="admin-label">Name (AR)</label>
          <input className="admin-input" dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
        </div>
        <div className="admin-field">
          <label className="admin-label">Category icon</label>
          <MediaUpload accept="image" value={iconUrl} onChange={(url) => setIconUrl(url ?? "")} />
        </div>
        <div className="admin-field">
          <label className="admin-label">Selection type</label>
          <div style={{ display: "flex", gap: 6 }}>
            {(["single", "multi", "counter"] as const).map((s) => (
              <button key={s} className={`admin-btn ${selType === s ? "primary" : ""}`}
                      onClick={() => setSelType(s)}>
                {SEL_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      </Modal>

      <Modal open={unitOpen} title="New unit" onClose={() => setUnitOpen(false)}
             onSubmit={async () => {
               await catalogApi.createUnit({ code: unitCode,
                 name: { ru: unitName, ...(unitNameAr.trim() ? { ar: unitNameAr.trim() } : {}) } });
               setUnitOpen(false); setUnitCode(""); setUnitName(""); setUnitNameAr(""); load(); toast("Unit added");
             }}
             submitDisabled={!unitCode.trim() || !unitName.trim()} submitLabel="Add">
        <div className="admin-grid-2">
          <div className="admin-field">
            <label className="admin-label">Code (Latin)</label>
            <input className="admin-input mono" autoFocus value={unitCode}
                   onChange={(e) => setUnitCode(e.target.value)} placeholder="g · ml · pcs" />
          </div>
          <div className="admin-field">
            <label className="admin-label">Name (RU)</label>
            <input className="admin-input" value={unitName}
                   onChange={(e) => setUnitName(e.target.value)} placeholder="грамм" />
          </div>
          <div className="admin-field">
            <label className="admin-label">Name (AR)</label>
            <input className="admin-input" dir="rtl" value={unitNameAr}
                   onChange={(e) => setUnitNameAr(e.target.value)} placeholder="غرام" />
          </div>
        </div>
      </Modal>
    </>
  );
}

export default function GroupsPage() {
  return (
    <AdminShell title="Add-on categories & units"
                crumbs={[{ label: "Catalog" }, { label: "Add-on categories" }]}>
      <Inner />
    </AdminShell>
  );
}
