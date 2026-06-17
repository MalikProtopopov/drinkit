"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { useToast } from "@/components/admin/AdminUI";
import { AddonCategoryForm, type AddonCatDraft } from "@/components/admin/AddonCategoryForm";
import { catalogApi } from "@/lib/adminApi";

function Inner() {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const initial: AddonCatDraft = {
    name: { en: "", ar: "" }, iconUrl: "", isActive: true, selectionType: "counter",
  };

  const create = async (d: AddonCatDraft) => {
    setSaving(true);
    try {
      const c = await catalogApi.createAddonCategory({
        name: d.name, iconUrl: d.iconUrl || null,
        isActive: d.isActive, selectionType: d.selectionType,
      });
      toast("Category created");
      router.push(`/admin/catalog/groups/categories/${c.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error", "warn");
      setSaving(false);
    }
  };

  return (
    <AddonCategoryForm initial={initial} mode="create" saving={saving}
                       onSubmit={create} onCancel={() => router.push("/admin/catalog/groups")} />
  );
}

export default function NewAddonCategoryPage() {
  return (
    <AdminShell title="New add-on category"
                crumbs={[{ label: "Catalog" },
                         { label: "Add-on categories", href: "/admin/catalog/groups" },
                         { label: "New" }]}>
      <Inner />
    </AdminShell>
  );
}
