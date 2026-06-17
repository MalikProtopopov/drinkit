"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { useToast } from "@/components/admin/AdminUI";
import { UnitForm, type UnitDraft } from "@/components/admin/UnitForm";
import { catalogApi, type Unit } from "@/lib/adminApi";

const draftOf = (u: Unit): UnitDraft => ({ code: u.code, name: u.name });

function Inner({ id }: { id: number }) {
  const router = useRouter();
  const toast = useToast();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rev, setRev] = useState(0);

  const load = useCallback(async () => {
    const us = await catalogApi.units();
    const u = us.find((x) => x.id === id);
    if (!u) { setNotFound(true); return; }
    setUnit(u);
  }, [id]);
  useEffect(() => { load().catch(() => setNotFound(true)); }, [load]);

  if (notFound) return <div className="admin-meta">Unit not found</div>;
  if (!unit) return <div className="admin-meta">Loading…</div>;

  const save = async (d: UnitDraft) => {
    setSaving(true);
    try {
      const u = await catalogApi.updateUnit(unit.id, { code: d.code.trim(), name: d.name });
      setUnit(u); setRev((r) => r + 1);
      toast("Unit saved");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error", "warn");
    } finally { setSaving(false); }
  };

  return (
    <UnitForm key={rev} initial={draftOf(unit)} mode="edit" saving={saving}
              onSubmit={save} onCancel={() => router.push("/admin/catalog/groups")} />
  );
}

export default function EditUnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AdminShell title="Unit"
                crumbs={[{ label: "Catalog" },
                         { label: "Units", href: "/admin/catalog/groups" },
                         { label: `#${id}` }]}>
      <Inner id={Number(id)} />
    </AdminShell>
  );
}
