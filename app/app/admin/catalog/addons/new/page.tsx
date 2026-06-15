"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { useToast } from "@/components/admin/AdminUI";
import { AddonForm, type AddonDraft } from "@/components/admin/AddonForm";
import { catalogApi, type AddonCat, type Unit } from "@/lib/adminApi";

function NewAddonInner() {
  const router = useRouter();
  const toast = useToast();
  const [cats, setCats] = useState<AddonCat[] | null>(null);
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    catalogApi.addonCategories().then(setCats).catch(() => setCats([]));
    catalogApi.units().then(setUnits).catch(() => setUnits([]));
  }, []);

  if (!cats || !units) return <div className="admin-meta">Loading…</div>;

  if (!cats.length || !units.length) {
    return (
      <div className="admin-panel"><div className="admin-panel-body">
        <p className="admin-meta">
          First create at least one add-on category and one unit —
          an add-on cannot be saved without them.
        </p>
        <button className="admin-btn primary" style={{ marginTop: 10 }}
                onClick={() => router.push("/admin/catalog/groups")}>
          Go to categories and units
        </button>
      </div></div>
    );
  }

  const initial: AddonDraft = {
    name: { en: "", ar: "" }, imageUrl: "", categoryId: cats[0].id, unitId: units[0].id,
    kcalPer100: 0, proteinPer100: 0, fatPer100: 0, carbsPer100: 0, basePrice: 0, isActive: true,
  };

  const create = async (d: AddonDraft) => {
    setSaving(true);
    try {
      const a = await catalogApi.createAddon(d);
      toast("Add-on created");
      router.push(`/admin/catalog/addons/${a.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error", "warn");
      setSaving(false);
    }
  };

  return (
    <div className="admin-split" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, alignItems: "start" }}>
      <AddonForm cats={cats} units={units} initial={initial} mode="create" saving={saving}
                 onSubmit={create} onCancel={() => router.push("/admin/catalog/addons")} />
      <div className="admin-panel">
        <div className="admin-panel-head"><div className="admin-panel-title">How it works</div></div>
        <div className="admin-panel-body">
          <p className="admin-meta">
            <strong>Category</strong> defines how the add-on is selected in the builder (single / multiple /
            counter) — the selection type is configured in the “Add-on categories” section.
          </p>
          <p className="admin-meta" style={{ marginTop: 10 }}>
            <strong>Nutrition per 100</strong> units is the reference. On the site calories are recalculated
            to the portion size you set in the specific drink (the “Available add-ons” tab).
          </p>
          <p className="admin-meta" style={{ marginTop: 10 }}>
            <strong>Price per portion</strong> is the base. For an individual drink it can be overridden
            or made free.
          </p>
          <p className="admin-meta" style={{ marginTop: 10 }}>
            Once created, the add-on becomes available to connect to drinks.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function NewAddonPage() {
  return (
    <AdminShell title="New add-on"
                crumbs={[{ label: "Catalog" }, { label: "Add-ons", href: "/admin/catalog/addons" },
                         { label: "New" }]}>
      <NewAddonInner />
    </AdminShell>
  );
}
