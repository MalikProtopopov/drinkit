"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { Toggle, useToast } from "@/components/admin/AdminUI";
import { catalogApi, type AddonCat, type Unit } from "@/lib/adminApi";

const SEL_LABEL = { single: "single", multi: "multiple", counter: "counter" } as const;

/** ADM-S-02: категории добавок (тип выбора на уровне категории) + ADM-S-04: единицы.
 *  Создание и редактирование — на отдельных страницах (categories/* и units/*). */
function Inner() {
  const router = useRouter();
  const toast = useToast();
  const [cats, setCats] = useState<AddonCat[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

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
          <button className="admin-btn sm" onClick={() => router.push("/admin/catalog/groups/categories/new")}>
            + Category
          </button>
        </div>
        <p className="admin-meta" style={{ padding: "0 16px 8px" }}>
          The selection type is set here (default for all drinks) and can be overridden
          per drink — the “Add-ons” tab in the drink editor. Click a row to edit name, icon and type.
        </p>
        <div className="admin-tablewrap"><table className="admin-table">
          <thead>
            <tr><th>Name (EN)</th><th>Name (AR)</th><th>Selection type</th><th>Active</th></tr>
          </thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c.id} className={`admin-row-link ${!c.isActive ? "muted" : ""}`} style={{ cursor: "pointer" }}
                  onClick={() => router.push(`/admin/catalog/groups/categories/${c.id}`)}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {c.iconUrl && <img src={c.iconUrl} alt="" style={{ width: 24, height: 24, borderRadius: 6, objectFit: "cover" }} />}
                    <strong>{c.name.en ?? "—"}</strong>
                    {!c.name.en && <span className="admin-pill warn">no EN</span>}
                  </div>
                </td>
                <td dir="rtl">
                  {c.name.ar ? <span className="admin-meta">{c.name.ar}</span>
                             : <span className="admin-pill warn">no AR</span>}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
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
                <td onClick={(e) => e.stopPropagation()}>
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
          <button className="admin-btn sm" onClick={() => router.push("/admin/catalog/groups/units/new")}>
            + Unit
          </button>
        </div>
        <p className="admin-meta" style={{ padding: "0 16px 8px" }}>Click a row to edit the code or name.</p>
        <div className="admin-tablewrap"><table className="admin-table">
          <thead><tr><th>Code</th><th>Name (EN)</th><th>Name (AR)</th></tr></thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.id} className="admin-row-link" style={{ cursor: "pointer" }}
                  onClick={() => router.push(`/admin/catalog/groups/units/${u.id}`)}>
                <td><span className="admin-pill">{u.code}</span></td>
                <td>{u.name.en ?? <span className="admin-pill warn">no EN</span>}</td>
                <td dir="rtl">{u.name.ar
                  ? <span className="admin-meta">{u.name.ar}</span>
                  : <span className="admin-pill warn">no AR</span>}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
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
