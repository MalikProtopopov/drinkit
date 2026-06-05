"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Modal, Toggle, useToast } from "@/components/admin/AdminUI";
import { catalogApi, type DrinkCat } from "@/lib/adminApi";

/** ADM-S-01: категории напитков — фото, видео, активность, название. */
function Inner() {
  const toast = useToast();
  const [rows, setRows] = useState<DrinkCat[]>([]);
  const [open, setOpen] = useState(false);
  const [nameRu, setNameRu] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [photo, setPhoto] = useState("");

  const load = useCallback(() => { catalogApi.drinkCategories().then(setRows).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    await catalogApi.createDrinkCategory({
      name: { ru: nameRu, ar: nameAr || undefined }, photoUrl: photo || null,
      isActive: true, sort: rows.length + 1,
    });
    setOpen(false); setNameRu(""); setNameAr(""); setPhoto("");
    load(); toast("Категория создана");
  };

  return (
    <>
      <div className="admin-panel">
        <table className="admin-table">
          <thead>
            <tr><th>Сорт.</th><th>Название (RU)</th><th>Название (AR)</th><th>Фото</th>
                <th>Активна (видна в каталоге)</th></tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className={!c.isActive ? "muted" : ""}>
                <td className="admin-num">{c.sort}</td>
                <td><strong>{c.name.ru}</strong></td>
                <td>{c.name.ar ?? <span className="admin-meta">нет перевода</span>}</td>
                <td className="admin-mono admin-meta">{c.photoUrl ?? "—"}</td>
                <td>
                  {/* тоггл скрывает категорию из переключателя каталога (PUB-G-01 AC3) */}
                  <Toggle defaultOn={c.isActive}
                          onChange={(v) => catalogApi.updateDrinkCategory(c.id, { ...c, isActive: v })
                            .then(() => toast(v ? "Видна в каталоге" : "Скрыта из каталога", "info"))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="admin-btn primary" onClick={() => setOpen(true)}>+ Новая категория</button>
      </div>

      <Modal open={open} title="Новая категория напитков" onClose={() => setOpen(false)}
             onSubmit={create} submitDisabled={!nameRu.trim()} submitLabel="Создать">
        <div className="admin-grid-2">
          <div className="admin-field">
            <label className="admin-label">Название (RU)</label>
            <input className="admin-input" autoFocus value={nameRu} onChange={(e) => setNameRu(e.target.value)} />
          </div>
          <div className="admin-field">
            <label className="admin-label">Название (AR)</label>
            <input className="admin-input" dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
          </div>
        </div>
        <div className="admin-field">
          <label className="admin-label">Фото (URL)</label>
          <input className="admin-input mono" value={photo} onChange={(e) => setPhoto(e.target.value)} />
        </div>
      </Modal>
    </>
  );
}

export default function DrinkCategoriesPage() {
  return (
    <AdminShell title="Категории напитков" crumbs={[{ label: "Каталог" }, { label: "Категории" }]}>
      <Inner />
    </AdminShell>
  );
}
