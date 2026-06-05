"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Modal, Toggle, useToast } from "@/components/admin/AdminUI";
import { catalogApi, type AddonCat, type AdminAddon, type Unit } from "@/lib/adminApi";

/** ADM-S-03: добавки — КБЖУ на 100, цена, единица (привязка на деталке добавки), активность. */
function Inner() {
  const toast = useToast();
  const [rows, setRows] = useState<AdminAddon[]>([]);
  const [cats, setCats] = useState<AddonCat[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [edit, setEdit] = useState<AdminAddon | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [nameRu, setNameRu] = useState("");

  const load = useCallback(() => {
    catalogApi.addons().then(setRows).catch(() => {});
    catalogApi.addonCategories().then(setCats).catch(() => {});
    catalogApi.units().then(setUnits).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const catName = (id: number) => cats.find((c) => c.id === id)?.name.ru ?? id;
  const unitCode = (id: number) => units.find((u) => u.id === id)?.code ?? id;

  return (
    <>
      <div className="admin-panel">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Название</th><th>Категория</th><th>Ед.</th>
              <th>Ккал/100</th><th>Б/Ж/У на 100</th><th>Цена за порцию</th><th>Активна</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className={!a.isActive ? "muted" : ""}>
                <td><strong>{a.name.ru}</strong> <span className="admin-meta">{a.name.ar}</span></td>
                <td>{catName(a.categoryId)}</td>
                <td><span className="admin-pill">{unitCode(a.unitId)}</span></td>
                <td className="admin-num">{a.kcalPer100}</td>
                <td className="admin-num">{a.proteinPer100} / {a.fatPer100} / {a.carbsPer100}</td>
                <td className="admin-num">{a.basePrice} AED</td>
                <td>
                  <Toggle defaultOn={a.isActive}
                          onChange={(v) => catalogApi.updateAddon(a.id, { ...a, isActive: v })
                            .then(() => toast(v ? "Добавка активна" : "Скрыта из конструктора", "info"))} />
                </td>
                <td style={{ textAlign: "right" }}>
                  <button className="admin-btn sm" onClick={() => setEdit({ ...a })}>Редактировать</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="admin-btn primary" onClick={() => setCreateOpen(true)}>+ Новая добавка</button>
      </div>

      <Modal open={createOpen} title="Новая добавка" onClose={() => setCreateOpen(false)}
             onSubmit={async () => {
               const a = await catalogApi.createAddon({
                 name: { ru: nameRu }, categoryId: cats[0]?.id, unitId: units[0]?.id,
                 kcalPer100: 0, proteinPer100: 0, fatPer100: 0, carbsPer100: 0,
                 basePrice: 0, isActive: false,
               });
               setCreateOpen(false); setNameRu(""); load(); setEdit(a);
               toast("Создано — заполни КБЖУ и цену");
             }}
             submitDisabled={!nameRu.trim() || !cats.length || !units.length} submitLabel="Создать">
        <div className="admin-field">
          <label className="admin-label">Название (RU)</label>
          <input className="admin-input" autoFocus value={nameRu} onChange={(e) => setNameRu(e.target.value)} />
        </div>
        <p className="admin-meta">КБЖУ, цену, единицу и категорию заполнишь в редакторе после создания.</p>
      </Modal>

      {edit && (
        <>
          <div className="admin-drawer-backdrop" onClick={() => setEdit(null)} />
          <aside className="admin-drawer">
            <div className="admin-drawer-head">
              <div>
                <div className="admin-panel-title">Добавка</div>
                <div className="admin-mono admin-meta">#{edit.id}</div>
              </div>
              <button className="admin-btn ghost" onClick={() => setEdit(null)}>×</button>
            </div>
            <div className="admin-drawer-body">
              <div className="admin-grid-2">
                <div className="admin-field">
                  <label className="admin-label">Название (RU)</label>
                  <input className="admin-input" value={edit.name.ru ?? ""}
                         onChange={(e) => setEdit({ ...edit, name: { ...edit.name, ru: e.target.value } })} />
                </div>
                <div className="admin-field">
                  <label className="admin-label">Название (AR)</label>
                  <input className="admin-input" dir="rtl" value={edit.name.ar ?? ""}
                         onChange={(e) => setEdit({ ...edit, name: { ...edit.name, ar: e.target.value } })} />
                </div>
              </div>
              <div className="admin-grid-2">
                <div className="admin-field">
                  <label className="admin-label">Категория</label>
                  <select className="admin-select" value={edit.categoryId}
                          onChange={(e) => setEdit({ ...edit, categoryId: +e.target.value })}>
                    {cats.map((c) => <option key={c.id} value={c.id}>{c.name.ru}</option>)}
                  </select>
                </div>
                <div className="admin-field">
                  {/* ADM-S-04: единица привязывается на деталке добавки из справочника */}
                  <label className="admin-label">Единица измерения</label>
                  <select className="admin-select" value={edit.unitId}
                          onChange={(e) => setEdit({ ...edit, unitId: +e.target.value })}>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.code} — {u.name.ru}</option>)}
                  </select>
                </div>
              </div>
              <div className="admin-panel" style={{ marginBottom: 12 }}>
                <div className="admin-panel-head">
                  <div className="admin-panel-title">КБЖУ на 100 {unitCode(edit.unitId)}</div>
                  <span className="admin-meta">на сайте пересчитывается на объём порции</span>
                </div>
                <div className="admin-panel-body">
                  <div className="kbju-grid">
                    {([["kcalPer100", "Ккал"], ["proteinPer100", "Белки"],
                       ["fatPer100", "Жиры"], ["carbsPer100", "Углев."]] as const).map(([k, l]) => (
                      <div className="kbju-cell" key={k}>
                        <div className="kbju-cell-label">{l}</div>
                        <input className="admin-input mono" type="number" value={edit[k]}
                               onChange={(e) => setEdit({ ...edit, [k]: +e.target.value || 0 })}
                               style={{ marginTop: 4 }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="admin-grid-2">
                <div className="admin-field">
                  <label className="admin-label">Цена за порцию, AED</label>
                  <input className="admin-input mono" type="number" value={edit.basePrice}
                         onChange={(e) => setEdit({ ...edit, basePrice: +e.target.value || 0 })} />
                </div>
                <div className="admin-field">
                  <label className="admin-label">Активность</label>
                  <div style={{ marginTop: 6 }}>
                    <Toggle on={edit.isActive} onChange={(v) => setEdit({ ...edit, isActive: v })}
                            label={edit.isActive ? "видна" : "скрыта"} />
                  </div>
                </div>
              </div>
            </div>
            <div className="admin-drawer-foot">
              <button className="admin-btn ghost" onClick={() => setEdit(null)}>Отмена</button>
              <button className="admin-btn primary"
                      onClick={() => catalogApi.updateAddon(edit.id, edit)
                        .then(() => { setEdit(null); load(); toast("Добавка сохранена"); })
                        .catch((e) => toast(e.message, "warn"))}>
                Сохранить
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  );
}

export default function AddonsPage() {
  return (
    <AdminShell title="Добавки" crumbs={[{ label: "Каталог" }, { label: "Добавки" }]}>
      <Inner />
    </AdminShell>
  );
}
