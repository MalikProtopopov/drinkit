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
  const [slug, setSlug] = useState("");
  const [photo, setPhoto] = useState("");

  const load = useCallback(() => { catalogApi.drinkCategories().then(setRows).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    try {
      await catalogApi.createDrinkCategory({
        name: { ru: nameRu, ar: nameAr || undefined }, slug: slug || undefined, photoUrl: photo || null,
        isActive: true, sort: rows.length + 1,
      });
      setOpen(false); setNameRu(""); setNameAr(""); setSlug(""); setPhoto("");
      load(); toast("Категория создана");
    } catch (e) { toast(e instanceof Error ? e.message : "Ошибка", "warn"); }
  };

  return (
    <>
      <div className="admin-panel">
        <table className="admin-table">
          <thead>
            <tr><th>Сорт.</th><th>Название (RU)</th><th>Название (AR)</th><th>Slug</th><th>Медиа</th>
                <th>Активна / сохранить</th></tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <CategoryRow key={c.id} cat={c} onSaved={load} />
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
          <label className="admin-label">Slug (для фильтра в URL)</label>
          <input className="admin-input mono" value={slug} placeholder="например: fresh (пусто = из названия)"
                 onChange={(e) => setSlug(e.target.value)} />
        </div>
        <div className="admin-field">
          <label className="admin-label">Фото (URL)</label>
          <input className="admin-input mono" value={photo} onChange={(e) => setPhoto(e.target.value)} />
        </div>
      </Modal>
    </>
  );
}

function CategoryRow({ cat, onSaved }: { cat: DrinkCat; onSaved: () => void }) {
  // H04 (ADM-S-01 AC3): редактирование названия/фото/видео существующей категории
  const toast = useToast();
  const [c, setC] = useState<DrinkCat>(cat);
  const dirty = JSON.stringify(c) !== JSON.stringify(cat);
  return (
    <tr className={!c.isActive ? "muted" : ""}>
      <td className="admin-num">{c.sort}</td>
      <td>
        <input className="admin-input" value={c.name.ru ?? ""}
               onChange={(e) => setC({ ...c, name: { ...c.name, ru: e.target.value } })} />
      </td>
      <td>
        {/* H05 (ADM-S-11 AC4): индикатор непереведённого поля */}
        <input className="admin-input" dir="rtl" value={c.name.ar ?? ""}
               placeholder="нет перевода"
               style={!c.name.ar ? { borderColor: "#B45309", background: "#FFF7E5" } : {}}
               onChange={(e) => setC({ ...c, name: { ...c.name, ar: e.target.value } })} />
      </td>
      <td>
        <input className="admin-input mono" value={c.slug ?? ""} placeholder="slug"
               onChange={(e) => setC({ ...c, slug: e.target.value })} />
      </td>
      <td>
        <input className="admin-input mono" value={c.photoUrl ?? ""} placeholder="фото URL"
               onChange={(e) => setC({ ...c, photoUrl: e.target.value || null })} />
        <input className="admin-input mono" value={c.videoUrl ?? ""} placeholder="видео URL"
               style={{ marginTop: 4 }}
               onChange={(e) => setC({ ...c, videoUrl: e.target.value || null })} />
      </td>
      <td>
        <Toggle defaultOn={c.isActive}
                onChange={(v) => catalogApi.updateDrinkCategory(c.id, { ...c, isActive: v })
                  .then(() => toast(v ? "Видна в каталоге" : "Скрыта из каталога", "info"))} />
        {dirty && (
          <button className="admin-btn primary sm" style={{ marginTop: 6 }}
                  onClick={() => catalogApi.updateDrinkCategory(c.id, c)
                    .then(() => { onSaved(); toast("Категория сохранена"); })}>
            Сохранить
          </button>
        )}
      </td>
    </tr>
  );
}

export default function DrinkCategoriesPage() {
  return (
    <AdminShell title="Категории напитков" crumbs={[{ label: "Каталог" }, { label: "Категории" }]}>
      <Inner />
    </AdminShell>
  );
}
