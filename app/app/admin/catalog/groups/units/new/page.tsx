"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { useToast } from "@/components/admin/AdminUI";
import { UnitForm, type UnitDraft } from "@/components/admin/UnitForm";
import { catalogApi } from "@/lib/adminApi";

function Inner() {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const initial: UnitDraft = { code: "", name: { en: "", ar: "" } };

  const create = async (d: UnitDraft) => {
    setSaving(true);
    try {
      const u = await catalogApi.createUnit({ code: d.code.trim(), name: d.name });
      toast("Unit added");
      router.push(`/admin/catalog/groups/units/${u.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error", "warn");
      setSaving(false);
    }
  };

  return (
    <UnitForm initial={initial} mode="create" saving={saving}
              onSubmit={create} onCancel={() => router.push("/admin/catalog/groups")} />
  );
}

export default function NewUnitPage() {
  return (
    <AdminShell title="New unit"
                crumbs={[{ label: "Catalog" },
                         { label: "Units", href: "/admin/catalog/groups" },
                         { label: "New" }]}>
      <Inner />
    </AdminShell>
  );
}
