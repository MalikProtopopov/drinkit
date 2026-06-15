"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Modal, Toggle, useToast } from "@/components/admin/AdminUI";
import { MediaUpload } from "@/components/admin/MediaUpload";
import { catalogApi, type DrinkCat } from "@/lib/adminApi";

/** ADM-S-01: категории напитков — фото, видео, активность, название. */
function Inner() {
  const toast = useToast();
  const [rows, setRows] = useState<DrinkCat[]>([]);
  const [open, setOpen] = useState(false);
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [slug, setSlug] = useState("");
  const [photo, setPhoto] = useState("");

  const load = useCallback(() => { catalogApi.drinkCategories().then(setRows).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    try {
      await catalogApi.createDrinkCategory({
        name: { en: nameEn, ar: nameAr || undefined }, slug: slug || undefined, photoUrl: photo || null,
        isActive: true, sort: rows.length + 1,
      });
      setOpen(false); setNameEn(""); setNameAr(""); setSlug(""); setPhoto("");
      load(); toast("Category created");
    } catch (e) { toast(e instanceof Error ? e.message : "Error", "warn"); }
  };

  return (
    <>
      <div className="admin-panel">
        <div className="admin-tablewrap"><table className="admin-table">
          <thead>
            <tr><th>Sort</th><th>Name (EN)</th><th>Name (AR)</th><th>Slug</th><th>Media</th>
                <th>Active / save</th></tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <CategoryRow key={c.id} cat={c} onSaved={load} />
            ))}
          </tbody>
        </table></div>
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="admin-btn primary" onClick={() => setOpen(true)}>+ New category</button>
      </div>

      <Modal open={open} title="New drink category" onClose={() => setOpen(false)}
             onSubmit={create} submitDisabled={!nameEn.trim()} submitLabel="Create">
        <div className="admin-grid-2">
          <div className="admin-field">
            <label className="admin-label">Name (EN)</label>
            <input className="admin-input" autoFocus value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          </div>
          <div className="admin-field">
            <label className="admin-label">Name (AR)</label>
            <input className="admin-input" dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
          </div>
        </div>
        <div className="admin-field">
          <label className="admin-label">Slug (for the URL filter)</label>
          <input className="admin-input mono" value={slug} placeholder="e.g. fresh (empty = from name)"
                 onChange={(e) => setSlug(e.target.value)} />
        </div>
        <div className="admin-field">
          <label className="admin-label">Category photo</label>
          <MediaUpload accept="image" value={photo} onChange={(url) => setPhoto(url ?? "")} />
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
        <input className="admin-input" value={c.name.en ?? ""}
               onChange={(e) => setC({ ...c, name: { ...c.name, en: e.target.value } })} />
      </td>
      <td>
        {/* H05 (ADM-S-11 AC4): индикатор непереведённого поля */}
        <input className="admin-input" dir="rtl" value={c.name.ar ?? ""}
               placeholder="no translation"
               style={!c.name.ar ? { borderColor: "#B45309", background: "#FFF7E5" } : {}}
               onChange={(e) => setC({ ...c, name: { ...c.name, ar: e.target.value } })} />
      </td>
      <td>
        <input className="admin-input mono" value={c.slug ?? ""} placeholder="slug"
               onChange={(e) => setC({ ...c, slug: e.target.value })} />
      </td>
      <td style={{ minWidth: 200 }}>
        <div className="admin-label" style={{ marginBottom: 4 }}>Photo</div>
        <MediaUpload accept="image" height={90} value={c.photoUrl}
                     onChange={(url) => setC({ ...c, photoUrl: url })} />
        <div className="admin-label" style={{ margin: "8px 0 4px" }}>Video</div>
        <MediaUpload accept="video" value={c.videoUrl}
                     onChange={(url) => setC({ ...c, videoUrl: url })} />
      </td>
      <td>
        <Toggle defaultOn={c.isActive}
                onChange={(v) => catalogApi.updateDrinkCategory(c.id, { ...c, isActive: v })
                  .then(() => toast(v ? "Visible in catalog" : "Hidden from catalog", "info"))} />
        {dirty && (
          <button className="admin-btn primary sm" style={{ marginTop: 6 }}
                  onClick={() => catalogApi.updateDrinkCategory(c.id, c)
                    .then(() => { onSaved(); toast("Category saved"); })}>
            Save
          </button>
        )}
      </td>
    </tr>
  );
}

export default function DrinkCategoriesPage() {
  return (
    <AdminShell title="Drink categories" crumbs={[{ label: "Catalog" }, { label: "Categories" }]}>
      <Inner />
    </AdminShell>
  );
}
