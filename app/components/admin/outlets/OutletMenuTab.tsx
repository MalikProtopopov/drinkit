"use client";

import { useEffect, useState } from "react";
import { Toggle, useToast } from "@/components/admin/AdminUI";
import {
  catalogApi, outletApi,
  type AdminAddon, type AdminDrink, type DrinkCat,
  type OutletPriority, type OutletStopList,
} from "@/lib/adminApi";
import { oName } from "@/lib/outlets/format";

/* ---------------- MENU (stop-list + priorities) ---------------- */
export function OutletMenuTab({ outletId }: { outletId: number }) {
  const toast = useToast();
  const [drinks, setDrinks] = useState<AdminDrink[]>([]);
  const [cats, setCats] = useState<DrinkCat[]>([]);
  const [addons, setAddons] = useState<AdminAddon[]>([]);
  const [stop, setStop] = useState<OutletStopList>({ drinks: [], categories: [], addons: [] });
  const [prio, setPrio] = useState<Record<number, OutletPriority>>({});
  const [loading, setLoading] = useState(true);
  const [savingPrio, setSavingPrio] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      catalogApi.drinks(), catalogApi.drinkCategories(), catalogApi.addons(),
      outletApi.stopList(outletId), outletApi.priorities(outletId),
    ]).then(([d, c, a, s, p]) => {
      if (!alive) return;
      setDrinks(d); setCats(c); setAddons(a); setStop(s);
      const map: Record<number, OutletPriority> = {};
      p.forEach((row) => { map[row.drinkId] = row; });
      setPrio(map);
    }).catch(() => {}).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [outletId]);

  const drinkName = (d: AdminDrink) => d.name.en ?? d.name.ru ?? d.slug;
  const catName = (id: number) => { const c = cats.find((x) => x.id === id); return c ? oName(c.name) : "—"; };
  const addonName = (a: AdminAddon) => oName(a.name);

  const toggle = async (entityType: "drink" | "drink_category" | "addon", entityId: number) => {
    try {
      const { stopped } = await outletApi.toggleStop(outletId, entityType, entityId);
      setStop((s) => {
        const key = entityType === "drink" ? "drinks" : entityType === "addon" ? "addons" : "categories";
        const set = new Set(s[key]);
        if (stopped) set.add(entityId); else set.delete(entityId);
        return { ...s, [key]: Array.from(set) };
      });
    } catch (e) { toast(e instanceof Error ? e.message : "Error", "warn"); }
  };

  const setPrioRow = (drinkId: number, patch: Partial<OutletPriority>) =>
    setPrio((m) => {
      const cur = m[drinkId] ?? { drinkId, sort: 0, pinned: false };
      return { ...m, [drinkId]: { ...cur, ...patch } };
    });

  const savePriorities = async () => {
    const rows = Object.values(prio).filter((r) => r.sort !== 0 || r.pinned);
    setSavingPrio(true);
    try {
      const saved = await outletApi.setPriorities(outletId, rows);
      const map: Record<number, OutletPriority> = {};
      saved.forEach((row) => { map[row.drinkId] = row; });
      setPrio(map);
      toast("Priorities saved");
    } catch (e) { toast(e instanceof Error ? e.message : "Error", "warn"); }
    finally { setSavingPrio(false); }
  };

  const catStop = new Set(stop.categories);
  const drinkStop = new Set(stop.drinks);
  const addonStop = new Set(stop.addons);
  const totalStopped = stop.drinks.length + stop.categories.length + stop.addons.length;

  const clearStopList = async () => {
    try {
      setStop(await outletApi.setStopList(outletId, { drinks: [], categories: [], addons: [] }));
      toast("Stop list cleared");
    } catch (e) { toast(e instanceof Error ? e.message : "Error", "warn"); }
  };

  if (loading) return <div className="admin-meta">Loading…</div>;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <p className="admin-meta">
        The stop list hides an item only at this outlet — the global catalog stays unchanged.
      </p>

      <div className="admin-panel">
        <div className="admin-panel-body" style={{ display: "flex", justifyContent: "space-between",
               alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className="admin-meta">
            {totalStopped === 0 ? "Nothing hidden — all catalog items are shown."
              : `Hidden at this outlet: ${stop.drinks.length} drinks · ${stop.categories.length} categories · ${stop.addons.length} add-ons`}
          </span>
          {totalStopped > 0 && (
            <button className="admin-btn sm" onClick={clearStopList}>Clear stop list</button>
          )}
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head"><div className="admin-panel-title">Drink categories</div></div>
        <div className="admin-tablewrap"><table className="admin-table">
          <thead><tr><th>Category</th><th style={{ width: 140 }}>In stop list</th></tr></thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c.id} className={catStop.has(c.id) ? "muted" : ""}>
                <td><strong>{oName(c.name)}</strong></td>
                <td><Toggle on={catStop.has(c.id)} onChange={() => toggle("drink_category", c.id)} /></td>
              </tr>
            ))}
            {cats.length === 0 && <tr><td colSpan={2} className="admin-meta" style={{ padding: 16 }}>No categories</td></tr>}
          </tbody>
        </table></div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">Drinks — stop list and priorities</div>
          <button className="admin-btn primary sm" onClick={savePriorities} disabled={savingPrio}>
            {savingPrio ? "Saving…" : "Save priorities"}
          </button>
        </div>
        <div className="admin-tablewrap"><table className="admin-table">
          <thead><tr>
            <th>Drink</th><th>Category</th><th style={{ width: 130 }}>In stop list</th>
            <th style={{ width: 110 }}>Sort</th><th style={{ width: 90 }}>Pinned</th>
          </tr></thead>
          <tbody>
            {drinks.map((d) => {
              const row = prio[d.id];
              return (
                <tr key={d.id} className={drinkStop.has(d.id) ? "muted" : ""}>
                  <td><strong>{drinkName(d)}</strong></td>
                  <td className="admin-meta">{catName(d.categoryId)}</td>
                  <td><Toggle on={drinkStop.has(d.id)} onChange={() => toggle("drink", d.id)} /></td>
                  <td>
                    <input className="admin-input mono" style={{ width: 80 }} inputMode="numeric"
                           value={row?.sort ?? 0}
                           onChange={(e) => setPrioRow(d.id, { sort: Number(e.target.value) || 0 })} />
                  </td>
                  <td>
                    <input type="checkbox" checked={row?.pinned ?? false}
                           onChange={(e) => setPrioRow(d.id, { pinned: e.target.checked })} />
                  </td>
                </tr>
              );
            })}
            {drinks.length === 0 && <tr><td colSpan={5} className="admin-meta" style={{ padding: 16 }}>No drinks</td></tr>}
          </tbody>
        </table></div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head"><div className="admin-panel-title">Add-ons</div></div>
        <div className="admin-tablewrap"><table className="admin-table">
          <thead><tr><th>Add-on</th><th style={{ width: 140 }}>In stop list</th></tr></thead>
          <tbody>
            {addons.map((a) => (
              <tr key={a.id} className={addonStop.has(a.id) ? "muted" : ""}>
                <td><strong>{addonName(a)}</strong></td>
                <td><Toggle on={addonStop.has(a.id)} onChange={() => toggle("addon", a.id)} /></td>
              </tr>
            ))}
            {addons.length === 0 && <tr><td colSpan={2} className="admin-meta" style={{ padding: 16 }}>No add-ons</td></tr>}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
