"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { Modal, useToast } from "@/components/admin/AdminUI";
import { catalogApi, type AdminDrink, type DrinkCat } from "@/lib/adminApi";

const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  draft: { label: "черновик", cls: "" },
  published: { label: "опубликован", cls: "accent" },
  hidden: { label: "скрыт", cls: "danger" },
};

/** ADM-S-05: напитки — статус черновик/опубликован/скрыт, цена базы, привязанные добавки. */
function Inner() {
  const toast = useToast();
  const [rows, setRows] = useState<AdminDrink[]>([]);
  const [cats, setCats] = useState<DrinkCat[]>([]);
  const [open, setOpen] = useState(false);
  const [nameRu, setNameRu] = useState("");
  const [slug, setSlug] = useState("");
  const [catId, setCatId] = useState<number | null>(null);

  const load = useCallback(() => {
    catalogApi.drinks().then(setRows).catch(() => {});
    catalogApi.drinkCategories().then((c) => { setCats(c); setCatId((p) => p ?? c[0]?.id ?? null); })
      .catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="admin-panel">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Название</th><th>Slug</th><th>Категория</th><th>Цена базы</th>
              <th>Ккал</th><th>Добавок привязано</th><th>Статус</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className={d.status !== "published" ? "muted" : ""}>
                <td>
                  <Link href={`/admin/catalog/products/${d.slug}`}
                        style={{ fontWeight: 600, color: "#0F1115", textDecoration: "none" }}>
                    {d.name.ru}
                  </Link>
                </td>
                <td><span className="admin-mono admin-meta">{d.slug}</span></td>
                <td>{cats.find((c) => c.id === d.categoryId)?.name.ru ?? "—"}</td>
                <td className="admin-num">{d.basePrice} AED</td>
                <td className="admin-num">{d.kcal}</td>
                <td className="admin-num">{d.bindings.length}</td>
                <td>
                  <span className={`admin-pill ${STATUS_PILL[d.status]?.cls ?? ""}`}>
                    {STATUS_PILL[d.status]?.label ?? d.status}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <Link href={`/admin/catalog/products/${d.slug}`} className="admin-btn sm">Открыть</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="admin-btn primary" onClick={() => setOpen(true)}>+ Новый напиток</button>
      </div>

      <Modal open={open} title="Новый напиток"
             subtitle="Создаётся черновиком — публикация после заполнения"
             onClose={() => setOpen(false)}
             onSubmit={async () => {
               try {
                 await catalogApi.createDrink({
                   slug: slug.trim(), name: { ru: nameRu.trim() }, description: {},
                   status: "draft", basePrice: 0, kcal: 0, protein: 0, fat: 0, carbs: 0,
                   categoryId: catId!,
                 });
                 setOpen(false); setNameRu(""); setSlug(""); load();
                 toast("Черновик создан — открой и заполни");
               } catch (e) { toast(e instanceof Error ? e.message : "Ошибка", "warn"); }
             }}
             submitDisabled={!nameRu.trim() || !slug.trim() || !catId}
             submitLabel="Создать черновик">
        <div className="admin-grid-2">
          <div className="admin-field">
            <label className="admin-label">Название (RU)</label>
            <input className="admin-input" autoFocus value={nameRu}
                   onChange={(e) => {
                     setNameRu(e.target.value);
                     setSlug(e.target.value.toLowerCase()
                       .replace(/[^a-zа-яё0-9\s]/gi, "").trim().replace(/\s+/g, "-")
                       .replace(/[а-яё]/g, "") || slug);
                   }} />
          </div>
          <div className="admin-field">
            <label className="admin-label">Slug (латиницей)</label>
            <input className="admin-input mono" value={slug}
                   onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/g, ""))} />
          </div>
        </div>
        <div className="admin-field">
          <label className="admin-label">Категория</label>
          <select className="admin-select" value={catId ?? ""} onChange={(e) => setCatId(+e.target.value)}>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name.ru}</option>)}
          </select>
        </div>
      </Modal>
    </>
  );
}

export default function ProductsListPage() {
  return (
    <AdminShell title="Напитки" crumbs={[{ label: "Каталог" }, { label: "Напитки" }]}>
      <Inner />
    </AdminShell>
  );
}
