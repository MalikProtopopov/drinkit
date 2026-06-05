"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Modal, Toggle, useToast } from "@/components/admin/AdminUI";
import { catalogApi, type AddonCat, type Unit } from "@/lib/adminApi";

const SEL_LABEL = { single: "один", multi: "несколько", counter: "счётчик" } as const;

/** ADM-S-02: категории добавок (тип выбора на уровне категории) + ADM-S-04: единицы. */
function Inner() {
  const toast = useToast();
  const [cats, setCats] = useState<AddonCat[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [catOpen, setCatOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [nameRu, setNameRu] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [selType, setSelType] = useState<AddonCat["selectionType"]>("counter");
  const [unitCode, setUnitCode] = useState("");
  const [unitName, setUnitName] = useState("");

  const load = useCallback(() => {
    catalogApi.addonCategories().then(setCats).catch(() => {});
    catalogApi.units().then(setUnits).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">Категории добавок</div>
          <button className="admin-btn sm" onClick={() => setCatOpen(true)}>+ Категория</button>
        </div>
        <p className="admin-meta" style={{ padding: "0 16px 8px" }}>
          Тип выбора задаётся здесь (дефолт для всех напитков) и может быть переопределён
          в связке с конкретным напитком — вкладка «Добавки» в редакторе напитка.
        </p>
        <table className="admin-table">
          <thead>
            <tr><th>Название</th><th>Тип выбора</th><th>Активна</th></tr>
          </thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c.id} className={!c.isActive ? "muted" : ""}>
                <td><strong>{c.name.ru}</strong> <span className="admin-meta">{c.name.ar}</span></td>
                <td>
                  <div style={{ display: "inline-flex", gap: 2, padding: 3, background: "#F5EFE7", borderRadius: 999 }}>
                    {(["single", "multi", "counter"] as const).map((s) => (
                      <button key={s} className="admin-btn sm"
                        onClick={() => catalogApi.updateAddonCategory(c.id, { ...c, selectionType: s })
                          .then(() => { load(); toast(`Тип выбора → ${SEL_LABEL[s]}`, "info"); })}
                        style={c.selectionType === s ? { background: "#4A56E2", color: "#FFF" } : { background: "transparent" }}>
                        {SEL_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </td>
                <td>
                  <Toggle defaultOn={c.isActive}
                          onChange={(v) => catalogApi.updateAddonCategory(c.id, { ...c, isActive: v })
                            .then(() => toast(v ? "Категория активна" : "Скрыта с деталки напитка", "info"))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-panel" style={{ marginTop: 16 }}>
        <div className="admin-panel-head">
          <div className="admin-panel-title">Единицы измерения</div>
          <button className="admin-btn sm" onClick={() => setUnitOpen(true)}>+ Единица</button>
        </div>
        <table className="admin-table">
          <thead><tr><th>Код</th><th>Название</th></tr></thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.id}>
                <td><span className="admin-pill">{u.code}</span></td>
                <td>{u.name.ru}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={catOpen} title="Новая категория добавок" onClose={() => setCatOpen(false)}
             onSubmit={async () => {
               await catalogApi.createAddonCategory({ name: { ru: nameRu }, iconUrl: iconUrl || null,
                 isActive: true, selectionType: selType });
               setCatOpen(false); setNameRu(""); load(); toast("Категория создана");
             }}
             submitDisabled={!nameRu.trim()} submitLabel="Создать">
        <div className="admin-field">
          <label className="admin-label">Название (RU)</label>
          <input className="admin-input" autoFocus value={nameRu} onChange={(e) => setNameRu(e.target.value)} />
        </div>
        <div className="admin-field">
          <label className="admin-label">Фото для иконки (URL)</label>
          <input className="admin-input mono" value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} />
        </div>
        <div className="admin-field">
          <label className="admin-label">Тип выбора</label>
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

      <Modal open={unitOpen} title="Новая единица измерения" onClose={() => setUnitOpen(false)}
             onSubmit={async () => {
               await catalogApi.createUnit({ code: unitCode, name: { ru: unitName } });
               setUnitOpen(false); setUnitCode(""); setUnitName(""); load(); toast("Единица добавлена");
             }}
             submitDisabled={!unitCode.trim() || !unitName.trim()} submitLabel="Добавить">
        <div className="admin-grid-2">
          <div className="admin-field">
            <label className="admin-label">Код (латиницей)</label>
            <input className="admin-input mono" autoFocus value={unitCode}
                   onChange={(e) => setUnitCode(e.target.value)} placeholder="g · ml · pcs" />
          </div>
          <div className="admin-field">
            <label className="admin-label">Название</label>
            <input className="admin-input" value={unitName}
                   onChange={(e) => setUnitName(e.target.value)} placeholder="граммы" />
          </div>
        </div>
      </Modal>
    </>
  );
}

export default function GroupsPage() {
  return (
    <AdminShell title="Категории добавок и единицы"
                crumbs={[{ label: "Каталог" }, { label: "Категории добавок" }]}>
      <Inner />
    </AdminShell>
  );
}
