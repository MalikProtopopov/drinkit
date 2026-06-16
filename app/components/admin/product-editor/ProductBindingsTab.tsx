"use client";

import { Fragment } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { AddonCat, AdminAddon, Binding } from "@/lib/adminApi";
import { Toggle } from "@/components/admin/AdminUI";
import { NumInput } from "@/components/admin/NumInput";

export function ProductBindingsTab({
  addons, addonCats, addonQuery, setAddonQuery, bindings, setBindings, bound,
  addonName, addonBasePrice, addonUnit, addonCatName,
}: {
  addons: AdminAddon[];
  addonCats: AddonCat[];
  addonQuery: string;
  setAddonQuery: (q: string) => void;
  bindings: Binding[];
  setBindings: Dispatch<SetStateAction<Binding[]>>;
  bound: Set<number>;
  addonName: (id: number) => string;
  addonBasePrice: (id: number) => number;
  addonUnit: (id: number) => string;
  addonCatName: (c: AddonCat) => string;
}) {
  // строка таблицы напиток×добавка — общая для всех групп
  const bindingRow = (a: AdminAddon) => {
    const b = bindings.find((x) => x.addonId === a.id);
    return (
      <tr key={a.id} style={b ? undefined : { opacity: 0.5 }}>
        <td>
          <Toggle defaultOn={bound.has(a.id)}
                  onChange={(v) => setBindings((arr) => v
                    ? [...arr, { addonId: a.id, priceOverride: null, minPortions: 0,
                                 defaultPortions: 1, maxPortions: 3, portionAmount: 30,
                                 selectionTypeOverride: null }]
                    : arr.filter((x) => x.addonId !== a.id))} />
        </td>
        <td>
          <strong>{addonName(a.id)}</strong>
          <div className="admin-meta">base price {addonBasePrice(a.id)} AED</div>
        </td>
        {b ? (
          <>
            <td>
              <input className="admin-input mono" style={{ width: 90 }} placeholder="free"
                     value={b.priceOverride ?? ""}
                     onChange={(e) => setBindings((arr) => arr.map((x) => x.addonId === a.id
                       ? { ...x, priceOverride: e.target.value === "" ? null : +e.target.value } : x))} />
            </td>
            {(["minPortions", "defaultPortions", "maxPortions"] as const).map((k) => (
              <td key={k}>
                <NumInput value={b[k]} min={0} style={{ width: 64 }}
                          onChange={(n) => setBindings((arr) => arr.map((x) => x.addonId === a.id
                            ? { ...x, [k]: n } : x))} />
              </td>
            ))}
            <td>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <NumInput value={b.portionAmount} min={0} style={{ width: 64 }}
                          onChange={(n) => setBindings((arr) => arr.map((x) => x.addonId === a.id
                            ? { ...x, portionAmount: n } : x))} />
                <span className="admin-meta">{addonUnit(a.id) || "—"}</span>
              </span>
            </td>
          </>
        ) : (
          <td colSpan={5} className="admin-meta">not available in this drink</td>
        )}
      </tr>
    );
  };

  // активные добавки, сгруппированные по своей категории; поиск по названию.
  // CAT5: добавка из ВЫКЛЮЧЕННОЙ категории не предлагается в билдере напитка.
  const q = addonQuery.trim().toLowerCase();
  const inactiveCatIds = new Set(addonCats.filter((c) => c.isActive === false).map((c) => c.id));
  const active = addons.filter((a) => a.isActive && !inactiveCatIds.has(a.categoryId));
  const matches = (a: AdminAddon) => !q
    || addonName(a.id).toLowerCase().includes(q) || (a.name.ar ?? "").includes(addonQuery.trim());
  const groups = addonCats.map((c) => ({ cat: c as AddonCat | null,
    items: active.filter((a) => a.categoryId === c.id && matches(a)) }));
  const orphan = active.filter((a) => !addonCats.some((c) => c.id === a.categoryId) && matches(a));
  if (orphan.length) groups.push({ cat: null, items: orphan });
  const visible = groups.filter((g) => g.items.length > 0);
  return (
    <div className="admin-panel">
      <div className="admin-panel-head">
        <div className="admin-panel-title">Available add-ons</div>
        <span className="admin-meta">{bound.size} of {active.length} enabled · empty price = free</span>
      </div>
      <div className="admin-panel-body" style={{ paddingBottom: 8 }}>
        <input className="admin-input" placeholder="Search add-on…" value={addonQuery}
               onChange={(e) => setAddonQuery(e.target.value)} style={{ maxWidth: 280 }} />
      </div>
      <div className="admin-tablewrap"><table className="admin-table">
        <thead>
          <tr>
            <th>Available</th><th>Add-on</th><th>Price in this drink, AED</th>
            <th>Min</th><th>Default</th><th>Max</th><th>Portion size</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((g) => (
            <Fragment key={g.cat ? g.cat.id : "orphan"}>
              <tr style={{ background: "#F2ECE2" }}>
                <td colSpan={7} style={{ fontWeight: 800 }}>
                  {g.cat ? addonCatName(g.cat) : "No category"}
                  <span className="admin-meta" style={{ marginLeft: 8, fontWeight: 500 }}>
                    {g.items.filter((a) => bound.has(a.id)).length}/{g.items.length} enabled
                  </span>
                </td>
              </tr>
              {g.items.map(bindingRow)}
            </Fragment>
          ))}
          {visible.length === 0 && (
            <tr><td colSpan={7} className="admin-meta" style={{ padding: 16 }}>Nothing found</td></tr>
          )}
        </tbody>
      </table></div>
      <div className="admin-panel-body">
        <p className="admin-meta">
          Limits: 0 ≤ min ≤ default ≤ max (validated on the backend). Portion size is grams/ml
          per portion; nutrition on the site is recalculated to this amount.
        </p>
      </div>
    </div>
  );
}
