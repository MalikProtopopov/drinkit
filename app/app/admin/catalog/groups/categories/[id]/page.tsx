"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { useToast } from "@/components/admin/AdminUI";
import { AddonCategoryForm, type AddonCatDraft } from "@/components/admin/AddonCategoryForm";
import { catalogApi, type AddonCat } from "@/lib/adminApi";

const draftOf = (c: AddonCat): AddonCatDraft => ({
  name: c.name, iconUrl: c.iconUrl ?? "", isActive: c.isActive, selectionType: c.selectionType,
});

function Inner({ id }: { id: number }) {
  const router = useRouter();
  const toast = useToast();
  const [cat, setCat] = useState<AddonCat | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rev, setRev] = useState(0);

  const load = useCallback(async () => {
    const cs = await catalogApi.addonCategories();
    const c = cs.find((x) => x.id === id);
    if (!c) { setNotFound(true); return; }
    setCat(c);
  }, [id]);
  useEffect(() => { load().catch(() => setNotFound(true)); }, [load]);

  if (notFound) return <div className="admin-meta">Category not found</div>;
  if (!cat) return <div className="admin-meta">Loading…</div>;

  const save = async (d: AddonCatDraft) => {
    setSaving(true);
    try {
      const c = await catalogApi.updateAddonCategory(cat.id, {
        name: d.name, iconUrl: d.iconUrl || null,
        isActive: d.isActive, selectionType: d.selectionType,
      });
      setCat(c); setRev((r) => r + 1);
      toast("Category saved");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error", "warn");
    } finally { setSaving(false); }
  };

  return (
    <AddonCategoryForm key={rev} initial={draftOf(cat)} mode="edit" saving={saving}
                       onSubmit={save} onCancel={() => router.push("/admin/catalog/groups")} />
  );
}

export default function EditAddonCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AdminShell title="Add-on category"
                crumbs={[{ label: "Catalog" },
                         { label: "Add-on categories", href: "/admin/catalog/groups" },
                         { label: `#${id}` }]}>
      <Inner id={Number(id)} />
    </AdminShell>
  );
}
