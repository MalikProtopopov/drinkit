"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { Pager, Toggle, useToast } from "@/components/admin/AdminUI";
import { catalogApi, type AddonCat, type AdminAddon, type Unit } from "@/lib/adminApi";

/** ADM-S-03: список добавок — сгруппирован по категориям, поиск, переход в карточку. */
function Inner() {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState<AdminAddon[]>([]);
  const [cats, setCats] = useState<AddonCat[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(20);
  useEffect(() => { setOffset(0); }, [q, limit]); // фильтр/размер → на первую страницу

  const load = useCallback(() => {
    catalogApi.addons().then(setRows).catch(() => {});
    catalogApi.addonCategories().then(setCats).catch(() => {});
    catalogApi.units().then(setUnits).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const unitCode = (id: number) => units.find((u) => u.id === id)?.code ?? id;
  const catLabel = (c: AddonCat) => c.name.en ?? c.name.ru ?? "—";
  const addonName = (a: AdminAddon) => a.name.en ?? a.name.ru ?? `#${a.id}`;

  const query = q.trim().toLowerCase();
  const match = (a: AdminAddon) => !query
    || addonName(a).toLowerCase().includes(query) || (a.name.ar ?? "").includes(q.trim());

  // отфильтрованный и отсортированный по категории плоский список (для пагинации)
  const catOrder = (a: AdminAddon) => {
    const i = cats.findIndex((c) => c.id === a.categoryId);
    return i === -1 ? 9999 : i;
  };
  const filtered = rows.filter(match).sort((a, b) => catOrder(a) - catOrder(b) || a.id - b.id);
  const pageItems = filtered.slice(offset, offset + limit);

  // группировка уже на срезе текущей страницы (заголовки категорий внутри страницы)
  const groups = cats.map((c) => ({ cat: c as AddonCat | null, items: pageItems.filter((a) => a.categoryId === c.id) }));
  const orphan = pageItems.filter((a) => !cats.some((c) => c.id === a.categoryId));
  if (orphan.length) groups.push({ cat: null, items: orphan });
  const visible = groups.filter((g) => g.items.length > 0);

  const Row = (a: AdminAddon) => (
    <tr key={a.id} className={`admin-row-link ${!a.isActive ? "muted" : ""}`}
        style={{ cursor: "pointer" }} onClick={() => router.push(`/admin/catalog/addons/${a.id}`)}>
      <td>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, overflow: "hidden", flexShrink: 0,
                        background: "#F2ECE2", display: "grid", placeItems: "center", fontSize: 15 }}>
            {a.imageUrl ? <img src={a.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🧃"}
          </div>
          <div>
            <strong>{addonName(a)}</strong>{" "}
            {a.name.ar
              ? <span className="admin-meta">{a.name.ar}</span>
              : <span className="admin-pill warn">no AR</span>}
          </div>
        </div>
      </td>
      <td><span className="admin-pill">{unitCode(a.unitId)}</span></td>
      <td className="admin-num">{a.kcalPer100}</td>
      <td className="admin-num">{a.proteinPer100} / {a.fatPer100} / {a.carbsPer100}</td>
      <td className="admin-num">{a.basePrice} AED</td>
      <td onClick={(e) => e.stopPropagation()}>
        <Toggle defaultOn={a.isActive}
                onChange={(v) => catalogApi.updateAddon(a.id, { ...a, isActive: v })
                  .then(() => toast(v ? "Add-on active" : "Hidden from the builder", "info"))} />
      </td>
    </tr>
  );

  return (
    <div className="admin-panel">
      <div className="admin-panel-head">
        <div className="admin-panel-title">All add-ons</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="admin-meta">Total {rows.length}, active {rows.filter((a) => a.isActive).length}</span>
          <button className="admin-btn primary sm" onClick={() => router.push("/admin/catalog/addons/new")}>
            + New add-on
          </button>
        </div>
      </div>
      <div className="admin-panel-body" style={{ paddingBottom: 8 }}>
        <input className="admin-input" placeholder="Search add-on…" value={q}
               onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280 }} />
      </div>
      <div className="admin-tablewrap"><table className="admin-table">
        <thead>
          <tr>
            <th>Name</th><th>Unit</th><th>Kcal/100</th>
            <th>P / F / C per 100</th><th>Price per portion</th><th>Active</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((g) => (
            <Fragment key={g.cat ? g.cat.id : "orphan"}>
              <tr style={{ background: "#F2ECE2" }}>
                <td colSpan={6} style={{ fontWeight: 800 }}>
                  {g.cat ? catLabel(g.cat) : "No category"}
                  <span className="admin-meta" style={{ marginLeft: 8, fontWeight: 500 }}>{g.items.length}</span>
                </td>
              </tr>
              {g.items.map(Row)}
            </Fragment>
          ))}
          {visible.length === 0 && (
            <tr><td colSpan={6} className="admin-meta" style={{ padding: 16 }}>Nothing found</td></tr>
          )}
        </tbody>
      </table></div>
      <Pager total={filtered.length} limit={limit} offset={offset}
             onOffset={setOffset} onLimit={setLimit} />
    </div>
  );
}

export default function AddonsPage() {
  return (
    <AdminShell title="Add-ons" crumbs={[{ label: "Catalog" }, { label: "Add-ons" }]}>
      <Inner />
    </AdminShell>
  );
}
