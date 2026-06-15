"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { useToast } from "@/components/admin/AdminUI";
import { AddonForm, type AddonDraft } from "@/components/admin/AddonForm";
import { catalogApi, type AddonCat, type AdminAddon, type AdminDrink, type Unit } from "@/lib/adminApi";

const draftOf = (a: AdminAddon): AddonDraft => ({
  name: a.name, imageUrl: a.imageUrl ?? "", categoryId: a.categoryId, unitId: a.unitId,
  kcalPer100: a.kcalPer100, proteinPer100: a.proteinPer100, fatPer100: a.fatPer100,
  carbsPer100: a.carbsPer100, basePrice: a.basePrice, isActive: a.isActive,
});

function EditAddonInner({ id }: { id: number }) {
  const router = useRouter();
  const toast = useToast();
  const [addon, setAddon] = useState<AdminAddon | null>(null);
  const [cats, setCats] = useState<AddonCat[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [drinks, setDrinks] = useState<AdminDrink[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rev, setRev] = useState(0); // ремонт формы после сохранения — сброс «несохранённого»

  const load = useCallback(async () => {
    const [as_, cs, us, ds] = await Promise.all([
      catalogApi.addons(), catalogApi.addonCategories(), catalogApi.units(), catalogApi.drinks(),
    ]);
    const a = as_.find((x) => x.id === id);
    if (!a) { setNotFound(true); return; }
    setAddon(a); setCats(cs); setUnits(us); setDrinks(ds);
  }, [id]);
  useEffect(() => { load().catch(() => setNotFound(true)); }, [load]);

  if (notFound) return <div className="admin-meta">Добавка не найдена</div>;
  if (!addon) return <div className="admin-meta">Загрузка…</div>;

  const save = async (d: AddonDraft) => {
    setSaving(true);
    try {
      const a = await catalogApi.updateAddon(addon.id, d);
      setAddon(a); setRev((r) => r + 1);
      toast("Добавка сохранена");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ошибка", "warn");
    } finally { setSaving(false); }
  };

  // в каких напитках используется эта добавка (для оценки влияния правок)
  const usedIn = drinks
    .map((dr) => ({ dr, link: dr.bindings.find((b) => b.addonId === addon.id) }))
    .filter((x) => x.link);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, alignItems: "start" }}>
      <AddonForm key={rev} cats={cats} units={units} initial={draftOf(addon)} mode="edit" saving={saving}
                 onSubmit={save} onCancel={() => router.push("/admin/catalog/addons")} />

      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">Используется в напитках</div>
          <span className="admin-meta">{usedIn.length}</span>
        </div>
        <div className="admin-panel-body" style={{ paddingBottom: 6 }}>
          <p className="admin-meta">
            Здесь видно, на какие напитки повлияют правки цены/КБЖУ. Объём порции и переопределённая
            цена настраиваются в карточке самого напитка.
          </p>
        </div>
        {usedIn.length === 0 ? (
          <div className="admin-panel-body"><span className="admin-meta">
            Пока не подключена ни к одному напитку. Подключение — во вкладке «Доступные добавки» напитка.
          </span></div>
        ) : (
          <div className="admin-tablewrap"><table className="admin-table">
            <thead><tr><th>Напиток</th><th>Цена в напитке</th><th>Порций (деф.)</th><th>Объём</th></tr></thead>
            <tbody>
              {usedIn.map(({ dr, link }) => (
                <tr key={dr.id} className="admin-row-link" style={{ cursor: "pointer" }}
                    onClick={() => router.push(`/admin/catalog/products/${dr.slug}`)}>
                  <td><strong>{dr.name.en ?? dr.name.ru ?? dr.slug}</strong></td>
                  <td className="admin-num">
                    {link!.priceOverride == null
                      ? <span className="admin-meta">бесплатно</span>
                      : `${link!.priceOverride} AED`}
                  </td>
                  <td className="admin-num">{link!.defaultPortions}</td>
                  <td className="admin-num">{link!.portionAmount}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        <div className="admin-panel-body">
          <div className="admin-mono admin-meta">#{addon.id}</div>
        </div>
      </div>
    </div>
  );
}

export default function EditAddonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AdminShell title="Добавка"
                crumbs={[{ label: "Каталог" }, { label: "Добавки", href: "/admin/catalog/addons" },
                         { label: `#${id}` }]}>
      <EditAddonInner id={Number(id)} />
    </AdminShell>
  );
}
