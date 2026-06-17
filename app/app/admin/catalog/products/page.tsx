"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { Pager } from "@/components/admin/AdminUI";
import { SkeletonRows } from "@/components/admin/Skeleton";
import { catalogApi, type AdminDrink, type DrinkCat } from "@/lib/adminApi";

const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  draft: { label: "draft", cls: "" },
  published: { label: "published", cls: "accent" },
  hidden: { label: "hidden", cls: "danger" },
};

/** ADM-S-05: напитки — статус черновик/опубликован/скрыт, цена базы, привязанные добавки. */
function Inner() {
  const router = useRouter();
  const [rows, setRows] = useState<AdminDrink[]>([]);
  const [cats, setCats] = useState<DrinkCat[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(20);
  useEffect(() => { setOffset(0); }, [q, limit]);

  const load = useCallback(() => {
    catalogApi.drinks().then(setRows).catch(() => {}).finally(() => setLoaded(true));
    catalogApi.drinkCategories().then(setCats).catch(() => {});
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
          <div className="admin-panel-title">All drinks</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="admin-meta">Total {rows.length}, published {rows.filter((d) => d.status === "published").length}</span>
            <button className="admin-btn primary sm"
                    onClick={() => router.push("/admin/catalog/products/new")}>+ New drink</button>
          </div>
        </div>
        <div className="admin-panel-body" style={{ paddingBottom: 8 }}>
          <input className="admin-input" placeholder="Search by name or slug…" value={q}
                 onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320 }} />
        </div>
        <div className="admin-tablewrap"><table className="admin-table">
          <thead>
            <tr>
              <th>Name</th><th>Slug</th><th>Category</th><th>Base price</th>
              <th>Kcal</th><th>Add-ons</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((d) => (
              <tr key={d.id} className={`admin-row-link ${d.status !== "published" ? "muted" : ""}`}
                  style={{ cursor: "pointer" }} onClick={() => router.push(`/admin/catalog/products/${d.slug}`)}>
                <td>
                  <strong>{drinkName(d)}</strong>
                  {!d.name.ar && <span className="admin-pill warn" style={{ marginLeft: 6 }}>no AR</span>}
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
                  <Link href={`/admin/catalog/products/${d.slug}`} className="admin-btn sm">Open</Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (!loaded
              ? <SkeletonRows rows={8} cols={8} />
              : <tr><td colSpan={8} className="admin-meta" style={{ padding: 16 }}>Nothing found</td></tr>
            )}
          </tbody>
        </table></div>
        <Pager total={filtered.length} limit={limit} offset={offset}
               onOffset={setOffset} onLimit={setLimit} />
      </div>
    </>
  );
}

export default function ProductsListPage() {
  return (
    <AdminShell title="Drinks" crumbs={[{ label: "Catalog" }, { label: "Drinks" }]}>
      <Inner />
    </AdminShell>
  );
}
