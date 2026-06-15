"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { Modal, Pager, useToast } from "@/components/admin/AdminUI";
import { catalogApi, type AdminDrink, type DrinkCat } from "@/lib/adminApi";

const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  draft: { label: "черновик", cls: "" },
  published: { label: "опубликован", cls: "accent" },
  hidden: { label: "скрыт", cls: "danger" },
};

/** ADM-S-05: напитки — статус черновик/опубликован/скрыт, цена базы, привязанные добавки. */
function Inner() {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState<AdminDrink[]>([]);
  const [cats, setCats] = useState<DrinkCat[]>([]);
  const [open, setOpen] = useState(false);
  const [nameEn, setNameEn] = useState("");
  const [slug, setSlug] = useState("");
  const [catId, setCatId] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(20);
  useEffect(() => { setOffset(0); }, [q, limit]);

  const load = useCallback(() => {
    catalogApi.drinks().then(setRows).catch(() => {});
    catalogApi.drinkCategories().then((c) => { setCats(c); setCatId((p) => p ?? c[0]?.id ?? null); })
      .catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const drinkName = (d: AdminDrink) => d.name.en ?? d.name.ru ?? d.slug;
  const catName = (id: number) => cats.find((c) => c.id === id)?.name.en ?? cats.find((c) => c.id === id)?.name.ru ?? "—";

  const query = q.trim().toLowerCase();
  const match = (d: AdminDrink) => !query
    || drinkName(d).toLowerCase().includes(query) || d.slug.includes(query) || (d.name.ar ?? "").includes(q.trim());
  const filtered = rows.filter(match);
  const pageItems = filtered.slice(offset, offset + limit);

  return (
    <>
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">Все напитки</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="admin-meta">Всего {rows.length}, опубликовано {rows.filter((d) => d.status === "published").length}</span>
            <button className="admin-btn primary sm" onClick={() => setOpen(true)}>+ Новый напиток</button>
          </div>
        </div>
        <div className="admin-panel-body" style={{ paddingBottom: 8 }}>
          <input className="admin-input" placeholder="Поиск по названию или slug…" value={q}
                 onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320 }} />
        </div>
        <div className="admin-tablewrap"><table className="admin-table">
          <thead>
            <tr>
              <th>Название</th><th>Slug</th><th>Категория</th><th>Цена базы</th>
              <th>Ккал</th><th>Добавок</th><th>Статус</th><th></th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((d) => (
              <tr key={d.id} className={`admin-row-link ${d.status !== "published" ? "muted" : ""}`}
                  style={{ cursor: "pointer" }} onClick={() => router.push(`/admin/catalog/products/${d.slug}`)}>
                <td>
                  <strong>{drinkName(d)}</strong>
                  {!d.name.ar && <span className="admin-pill warn" style={{ marginLeft: 6 }}>нет AR</span>}
                </td>
                <td><span className="admin-mono admin-meta">{d.slug}</span></td>
                <td>{catName(d.categoryId)}</td>
                <td className="admin-num">{d.basePrice} AED</td>
                <td className="admin-num">{d.kcal}</td>
                <td className="admin-num">{d.bindings.length}</td>
                <td>
                  <span className={`admin-pill ${STATUS_PILL[d.status]?.cls ?? ""}`}>
                    {STATUS_PILL[d.status]?.label ?? d.status}
                  </span>
                </td>
                <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                  <Link href={`/admin/catalog/products/${d.slug}`} className="admin-btn sm">Открыть</Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="admin-meta" style={{ padding: 16 }}>Ничего не найдено</td></tr>
            )}
          </tbody>
        </table></div>
        <Pager total={filtered.length} limit={limit} offset={offset}
               onOffset={setOffset} onLimit={setLimit} />
      </div>

      <Modal open={open} title="Новый напиток"
             subtitle="Создаётся черновиком — публикация после заполнения"
             onClose={() => setOpen(false)}
             onSubmit={async () => {
               try {
                 await catalogApi.createDrink({
                   slug: slug.trim(), name: { en: nameEn.trim() }, description: {},
                   status: "draft", basePrice: 0, kcal: 0, protein: 0, fat: 0, carbs: 0,
                   categoryId: catId!,
                 });
                 setOpen(false); setNameEn(""); setSlug(""); load();
                 toast("Черновик создан — открой и заполни");
               } catch (e) { toast(e instanceof Error ? e.message : "Ошибка", "warn"); }
             }}
             submitDisabled={!nameEn.trim() || !slug.trim() || !catId}
             submitLabel="Создать черновик">
        <div className="admin-grid-2">
          <div className="admin-field">
            <label className="admin-label">Название (EN)</label>
            <input className="admin-input" autoFocus value={nameEn}
                   onChange={(e) => {
                     setNameEn(e.target.value);
                     setSlug(e.target.value.toLowerCase()
                       .replace(/[^a-z0-9\s]/gi, "").trim().replace(/\s+/g, "-") || slug);
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
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name.en ?? c.name.ru}</option>)}
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
