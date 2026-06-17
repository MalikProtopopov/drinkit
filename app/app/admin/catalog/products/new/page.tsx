"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { useToast } from "@/components/admin/AdminUI";
import { ProductMainTab } from "@/components/admin/product-editor/ProductMainTab";
import { PanelSkeleton } from "@/components/admin/Skeleton";
import { catalogApi, type AdminDrink, type DrinkCat } from "@/lib/adminApi";

const STATUSES = [["draft", "draft"], ["published", "published"], ["hidden", "hidden"]] as const;
const warn = { borderColor: "#B45309", background: "#FFF7E5" } as const;

const blank = (categoryId: number): AdminDrink => ({
  id: 0, slug: "", name: { en: "", ar: "" }, description: { en: "", ar: "" }, status: "draft",
  previewUrl: "", videoUrl: "", basePrice: 0, kcal: 0, protein: 0, fat: 0, carbs: 0,
  categoryId, bindings: [], sizes: [], descriptions: [],
});

function NewDrinkInner() {
  const router = useRouter();
  const toast = useToast();
  const [cats, setCats] = useState<DrinkCat[] | null>(null);
  const [drink, setDrink] = useState<AdminDrink | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const cs = await catalogApi.drinkCategories();
    setCats(cs);
    setDrink((d) => d ?? blank(cs[0]?.id ?? 0));
  }, []);
  useEffect(() => { load().catch(() => setCats([])); }, [load]);

  if (!cats || !drink) {
    return (
      <div className="admin-split" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}
           aria-busy="true">
        <PanelSkeleton height={320} /><PanelSkeleton height={220} />
      </div>
    );
  }
  if (!cats.length) {
    return (
      <div className="admin-panel"><div className="admin-panel-body">
        <p className="admin-meta">Create at least one drink category first.</p>
        <button className="admin-btn primary" style={{ marginTop: 10 }}
                onClick={() => router.push("/admin/catalog/categories")}>Go to categories</button>
      </div></div>
    );
  }

  // правка полей; имя EN авто-генерит slug, пока его не трогали вручную
  const set = (patch: Partial<AdminDrink>) => setDrink((d) => {
    const next = { ...d!, ...patch };
    if (patch.name && !slugTouched) {
      next.slug = (patch.name.en ?? "").toLowerCase()
        .replace(/[^a-z0-9\s-]/gi, "").trim().replace(/\s+/g, "-");
    }
    return next;
  });

  const nameOk = (drink.name.en ?? "").trim().length > 0;
  const slugOk = drink.slug.trim().length > 0;
  const canSave = nameOk && slugOk && !!drink.categoryId;

  const create = async () => {
    setSaving(true);
    try {
      const d = await catalogApi.createDrink(drink);
      toast(`Drink created (${d.status}) — fill in sizes & add-ons`);
      router.push(`/admin/catalog/products/${d.slug}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error", "warn");
      setSaving(false);
    }
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
        {/* slug */}
        <label className="admin-label" style={{ margin: 0 }}>Slug</label>
        <input className="admin-input mono" style={{ width: 220 }} value={drink.slug}
               placeholder="auto from name"
               onChange={(e) => { setSlugTouched(true); set({ slug: e.target.value.replace(/[^a-z0-9-]/g, "") }); }} />
        {/* статус */}
        <div style={{ display: "inline-flex", gap: 2, padding: 3, background: "#F5EFE7", borderRadius: 999 }}>
          {STATUSES.map(([v, l]) => (
            <button key={v} className="admin-btn sm" onClick={() => set({ status: v })}
                    style={drink.status === v ? { background: "#4A56E2", color: "#FFF" } : { background: "transparent" }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <button className="admin-btn" disabled={saving}
                  onClick={() => router.push("/admin/catalog/products")}>Cancel</button>
          <button className="admin-btn primary" disabled={!canSave || saving} onClick={create}>
            {saving ? "Creating…" : "Create drink"}
          </button>
        </div>
      </div>

      <p className="admin-meta" style={{ marginBottom: 14 }}>
        Set the basics here, then continue with sizes, description and add-ons on the next screen.
        You can save it as a draft and publish later.
      </p>

      <ProductMainTab drink={drink} cats={cats} set={set} warn={warn} />
    </>
  );
}

export default function NewDrinkPage() {
  return (
    <AdminShell title="New drink"
                crumbs={[{ label: "Catalog" }, { label: "Drinks", href: "/admin/catalog/products" },
                         { label: "New" }]}>
      <NewDrinkInner />
    </AdminShell>
  );
}
