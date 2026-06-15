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

  if (!cats || !units) return <div className="admin-meta">Загрузка…</div>;

  if (!cats.length || !units.length) {
    return (
      <div className="admin-panel"><div className="admin-panel-body">
        <p className="admin-meta">
          Сначала заведите хотя бы одну категорию добавок и единицу измерения —
          без них добавку нельзя сохранить.
        </p>
        <button className="admin-btn primary" style={{ marginTop: 10 }}
                onClick={() => router.push("/admin/catalog/groups")}>
          Перейти к категориям и единицам
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
      toast("Добавка создана");
      router.push(`/admin/catalog/addons/${a.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ошибка", "warn");
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, alignItems: "start" }}>
      <AddonForm cats={cats} units={units} initial={initial} mode="create" saving={saving}
                 onSubmit={create} onCancel={() => router.push("/admin/catalog/addons")} />
      <div className="admin-panel">
        <div className="admin-panel-head"><div className="admin-panel-title">Как это работает</div></div>
        <div className="admin-panel-body">
          <p className="admin-meta">
            <strong>Категория</strong> задаёт, как добавку выбирают в конструкторе (один / несколько /
            счётчик) — тип выбора настраивается в разделе «Категории добавок».
          </p>
          <p className="admin-meta" style={{ marginTop: 10 }}>
            <strong>КБЖУ на 100</strong> единиц — эталон. На сайте калории пересчитываются под объём
            порции, который вы задаёте уже в конкретном напитке (вкладка «Доступные добавки»).
          </p>
          <p className="admin-meta" style={{ marginTop: 10 }}>
            <strong>Цена за порцию</strong> — базовая. Для отдельного напитка её можно переопределить
            или сделать бесплатной.
          </p>
          <p className="admin-meta" style={{ marginTop: 10 }}>
            После создания добавка станет доступна для подключения к напиткам.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function NewAddonPage() {
  return (
    <AdminShell title="Новая добавка"
                crumbs={[{ label: "Каталог" }, { label: "Добавки", href: "/admin/catalog/addons" },
                         { label: "Новая" }]}>
      <NewAddonInner />
    </AdminShell>
  );
}
