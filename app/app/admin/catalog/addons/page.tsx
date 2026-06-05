"use client";

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Modal, Toggle, useToast } from "@/components/admin/AdminUI";
import {
  adminAddons,
  adminAddonGroups,
  allergens as allAllergens,
  addonDoseLabel,
  addonKcalPerUnit,
  AdminAddon,
} from "@/lib/admin-mock";

export default function AddonsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<AdminAddon[]>(adminAddons);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState(adminAddonGroups[0]?.slug ?? "");

  const selected = rows.find((a) => a.id === selectedId);

  const createAddon = () => {
    if (!newName.trim()) return;
    const id = `a-${Date.now()}`;
    const item: AdminAddon = {
      id,
      name: newName.trim(),
      groupSlug: newGroup,
      unit: "ml",
      doseAmount: 10,
      doseUnit: "ml",
      kcalPer100: 0,
      proteinPer100: 0,
      fatPer100: 0,
      carbsPer100: 0,
      pricePerUnitAed: 0,
      allergens: [],
      visible: true,
    };
    setRows((r) => [item, ...r]);
    setNewOpen(false);
    setNewName("");
    setSelectedId(id);
    toast(`Создан доп «${item.name}»`);
  };

  return (
    <AdminShell
      title="Допы"
      crumbs={[{ label: "Каталог" }, { label: "Допы" }]}
      actions={<button className="admin-btn primary" onClick={() => setNewOpen(true)}>+ Новый доп</button>}
    >
      <div className="admin-panel">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 48 }}></th>
              <th>Название</th>
              <th>Группа</th>
              <th>Unit (клиент)</th>
              <th>Доза</th>
              <th>Ккал / 100</th>
              <th>Ккал / unit</th>
              <th>Б / Ж / У</th>
              <th>Цена / unit</th>
              <th>Аллергены</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const g = adminAddonGroups.find((x) => x.slug === a.groupSlug);
              return (
                <tr key={a.id}>
                  <td>
                    <button onClick={() => setSelectedId(a.id)} style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}>
                      <div className="admin-thumb">
                        <span className="admin-mono" style={{ fontSize: 9, color: "#5A6172" }}>PNG</span>
                      </div>
                    </button>
                  </td>
                  <td>
                    <button onClick={() => setSelectedId(a.id)} style={{ background: "none", border: 0, color: "#0F1115", fontWeight: 600, cursor: "pointer", padding: 0 }}>
                      {a.name}
                    </button>
                  </td>
                  <td>{g?.name}</td>
                  <td><span className="admin-pill">{a.unit}</span></td>
                  <td className="admin-num">{addonDoseLabel(a)}</td>
                  <td className="admin-num">{a.kcalPer100}</td>
                  <td className="admin-num"><strong>{addonKcalPerUnit(a)}</strong></td>
                  <td className="admin-num">{a.proteinPer100} / {a.fatPer100} / {a.carbsPer100}</td>
                  <td className="admin-num">{a.pricePerUnitAed} AED</td>
                  <td>
                    {a.allergens.length === 0 ? <span className="admin-meta">—</span> :
                      a.allergens.map((al) => (
                        <span key={al} className="admin-pill warn" style={{ marginRight: 4 }}>{al}</span>
                      ))}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="admin-btn sm" onClick={() => setSelectedId(a.id)}>Редактировать</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <AddonDrawer
          addon={selected}
          onClose={() => setSelectedId(null)}
          onSave={(updates) => {
            setRows((arr) => arr.map((x) => (x.id === selected.id ? { ...x, ...updates } : x)));
            setSelectedId(null);
            toast(`Доп «${selected.name}» обновлён`);
          }}
          onDelete={() => {
            setRows((arr) => arr.filter((x) => x.id !== selected.id));
            setSelectedId(null);
            toast(`Доп «${selected.name}» удалён`, "warn");
          }}
        />
      )}

      <Modal
        open={newOpen}
        title="Новый доп"
        onClose={() => setNewOpen(false)}
        onSubmit={createAddon}
        submitDisabled={!newName.trim()}
        submitLabel="Создать"
      >
        <div className="admin-field">
          <label className="admin-label">Название (RU)</label>
          <input
            className="admin-input"
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Например: Сироп клубника"
          />
        </div>
        <div className="admin-field">
          <label className="admin-label">Группа</label>
          <select className="admin-select" value={newGroup} onChange={(e) => setNewGroup(e.target.value)}>
            {adminAddonGroups.map((g) => (
              <option key={g.slug} value={g.slug}>{g.name}</option>
            ))}
          </select>
        </div>
        <p className="admin-meta">КБЖУ, цену, PNG и аллергены настроишь в редакторе после создания.</p>
      </Modal>
    </AdminShell>
  );
}

function AddonDrawer({
  addon,
  onClose,
  onSave,
  onDelete,
}: {
  addon: AdminAddon;
  onClose: () => void;
  onSave: (updates: Partial<AdminAddon>) => void;
  onDelete: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(addon.name);
  const [groupSlug, setGroupSlug] = useState(addon.groupSlug);
  const [unit, setUnit] = useState<AdminAddon["unit"]>(addon.unit);
  const [doseAmount, setDoseAmount] = useState(addon.doseAmount);
  const [doseUnit, setDoseUnit] = useState<AdminAddon["doseUnit"]>(addon.doseUnit);
  const [kcalPer100, setKcal] = useState(addon.kcalPer100);
  const [proteinPer100, setProtein] = useState(addon.proteinPer100);
  const [fatPer100, setFat] = useState(addon.fatPer100);
  const [carbsPer100, setCarbs] = useState(addon.carbsPer100);
  const [pricePerUnitAed, setPrice] = useState(addon.pricePerUnitAed);
  const [visible, setVisible] = useState(addon.visible);
  const [addonAllergens, setAllergens] = useState<string[]>(addon.allergens);
  const [confirmDel, setConfirmDel] = useState(false);

  const previewAddon: AdminAddon = { ...addon, doseAmount, doseUnit, unit, kcalPer100 };
  const kcalPerUnitVal = addonKcalPerUnit(previewAddon);

  return (
    <>
      <div className="admin-drawer-backdrop" onClick={onClose} />
      <aside className="admin-drawer">
        <div className="admin-drawer-head">
          <div>
            <div className="admin-panel-title">Редактирование допа</div>
            <div className="admin-mono admin-meta">{addon.id}</div>
          </div>
          <button className="admin-btn ghost" onClick={onClose}>×</button>
        </div>
        <div className="admin-drawer-body">
          <div className="admin-field" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div className="admin-thumb" style={{ width: 72, height: 72 }}>
              <span className="admin-mono" style={{ fontSize: 12, color: "#5A6172" }}>PNG</span>
            </div>
            <div>
              <div className="admin-meta">Прозрачный PNG, ≤ 30 KB</div>
              <button className="admin-btn sm" style={{ marginTop: 6 }} onClick={() => toast("Открыт файл-пикер")}>Заменить</button>
            </div>
          </div>

          <div className="admin-grid-2">
            <div className="admin-field">
              <label className="admin-label">Название (RU)</label>
              <input className="admin-input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="admin-field">
              <label className="admin-label">Название (EN)</label>
              <input className="admin-input" defaultValue={`${name} en`} />
            </div>
          </div>

          <div className="admin-field">
            <label className="admin-label">Группа</label>
            <select className="admin-select" value={groupSlug} onChange={(e) => setGroupSlug(e.target.value)}>
              {adminAddonGroups.map((g) => (
                <option key={g.slug} value={g.slug}>{g.name}</option>
              ))}
            </select>
          </div>

          <div className="admin-grid-3">
            <div className="admin-field">
              <label className="admin-label">Unit (что выбирает клиент)</label>
              <select className="admin-select" value={unit} onChange={(e) => setUnit(e.target.value as AdminAddon["unit"])}>
                <option value="shot">shot</option>
                <option value="scoop">scoop</option>
                <option value="piece">piece</option>
                <option value="portion">portion</option>
                <option value="ml">ml</option>
                <option value="g">g</option>
              </select>
            </div>
            <div className="admin-field">
              <label className="admin-label">Доза, кол-во</label>
              <input className="admin-input mono" type="number" value={doseAmount} onChange={(e) => setDoseAmount(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="admin-field">
              <label className="admin-label">Доза, единица</label>
              <select className="admin-select" value={doseUnit} onChange={(e) => setDoseUnit(e.target.value as AdminAddon["doseUnit"])}>
                <option value="ml">мл</option>
                <option value="g">г</option>
              </select>
            </div>
          </div>
          <div className="admin-meta" style={{ marginTop: -4, marginBottom: 10 }}>
            Итог: 1 <strong>{unit}</strong> = <strong>{doseAmount} {doseUnit}</strong> ·{" "}
            <span className="admin-num">{kcalPerUnitVal} ккал/unit</span>
          </div>

          <div className="admin-panel" style={{ marginBottom: 12 }}>
            <div className="admin-panel-head">
              <div className="admin-panel-title">КБЖУ на 100 {doseUnit === "ml" ? "мл" : "г"}</div>
              <span className="admin-meta">бэк пересчитает на dose</span>
            </div>
            <div className="admin-panel-body">
              <div className="kbju-grid">
                <div className="kbju-cell">
                  <div className="kbju-cell-label">Ккал</div>
                  <input className="admin-input mono" type="number" value={kcalPer100} onChange={(e) => setKcal(parseFloat(e.target.value) || 0)} style={{ marginTop: 4 }} />
                </div>
                <div className="kbju-cell">
                  <div className="kbju-cell-label">Белки</div>
                  <input className="admin-input mono" type="number" value={proteinPer100} onChange={(e) => setProtein(parseFloat(e.target.value) || 0)} style={{ marginTop: 4 }} />
                </div>
                <div className="kbju-cell">
                  <div className="kbju-cell-label">Жиры</div>
                  <input className="admin-input mono" type="number" value={fatPer100} onChange={(e) => setFat(parseFloat(e.target.value) || 0)} style={{ marginTop: 4 }} />
                </div>
                <div className="kbju-cell">
                  <div className="kbju-cell-label">Углев.</div>
                  <input className="admin-input mono" type="number" value={carbsPer100} onChange={(e) => setCarbs(parseFloat(e.target.value) || 0)} style={{ marginTop: 4 }} />
                </div>
              </div>
            </div>
          </div>

          <div className="admin-grid-2">
            <div className="admin-field">
              <label className="admin-label">Цена за unit, AED</label>
              <input className="admin-input mono" type="number" value={pricePerUnitAed} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="admin-field">
              <label className="admin-label">Видимость</label>
              <div style={{ marginTop: 6 }}>
                <Toggle on={visible} onChange={setVisible} label={visible ? "видно" : "скрыто"} />
              </div>
            </div>
          </div>

          <div className="admin-field">
            <label className="admin-label">Аллергены</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {allAllergens.map((al) => {
                const on = addonAllergens.includes(al);
                return (
                  <button
                    key={al}
                    className="admin-btn sm"
                    onClick={() =>
                      setAllergens((arr) => (on ? arr.filter((x) => x !== al) : [...arr, al]))
                    }
                    style={on ? { background: "#FFF7E5", borderColor: "#B45309", color: "#B45309" } : {}}
                  >
                    {al}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="admin-divider" />

          <div className="admin-meta">
            Используется в <strong>5 блюдах</strong>. Изменение цены повлияет на новые заказы — снэпшоты в БД останутся прежними.
          </div>
        </div>
        <div className="admin-drawer-foot">
          <button className="admin-btn danger" style={{ marginRight: "auto" }} onClick={() => setConfirmDel(true)}>
            Удалить
          </button>
          <button className="admin-btn ghost" onClick={onClose}>Отмена</button>
          <button
            className="admin-btn primary"
            onClick={() => onSave({ name, groupSlug, unit, doseAmount, doseUnit, kcalPer100, proteinPer100, fatPer100, carbsPer100, pricePerUnitAed, visible, allergens: addonAllergens })}
          >
            Сохранить
          </button>
        </div>
      </aside>

      <Modal
        open={confirmDel}
        title={`Удалить доп «${addon.name}»?`}
        onClose={() => setConfirmDel(false)}
        onSubmit={() => { setConfirmDel(false); onDelete(); }}
        submitLabel="Удалить"
        danger
      >
        <p>Доп удалится из каталога. Заказы, где он использовался, сохранятся: цена и КБЖУ снэпшотятся.</p>
      </Modal>
    </>
  );
}
