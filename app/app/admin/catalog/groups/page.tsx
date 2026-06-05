"use client";

import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Modal, Toggle, useToast } from "@/components/admin/AdminUI";
import { adminAddonGroups, compatibilityRules, adminAddons, AdminAddonGroup } from "@/lib/admin-mock";

type Tab = "groups" | "rules";
type SelectionType = "single" | "multi" | "counter";
type Rule = {
  id: string;
  scope: "global" | "product";
  productSlug: string | null;
  when: { addonId: string; label: string }[];
  effect:
    | { type: "forbid"; addonId: string; label: string; message: string }
    | { type: "discount-percent"; percent: number; message: string };
  enabled: boolean;
};

export default function GroupsAndRulesPage() {
  const [tab, setTab] = useState<Tab>("groups");
  const toast = useToast();

  const [groups, setGroups] = useState<AdminAddonGroup[]>(adminAddonGroups);
  const [rules, setRules] = useState<Rule[]>(compatibilityRules as Rule[]);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newRuleOpen, setNewRuleOpen] = useState(false);
  const [compositionOpen, setCompositionOpen] = useState<string | null>(null);

  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupSelection, setNewGroupSelection] = useState<SelectionType>("single");

  const createGroup = () => {
    if (!newGroupName.trim()) return;
    const slug = newGroupName.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
    setGroups((g) => [
      ...g,
      { slug, name: newGroupName.trim(), selectionType: newGroupSelection, itemCount: 0, usedInProducts: 0 },
    ]);
    setNewGroupOpen(false);
    setNewGroupName("");
    toast(`Группа «${newGroupName}» создана`);
  };

  return (
    <AdminShell
      title="Группы и правила"
      crumbs={[{ label: "Каталог" }, { label: "Группы и правила" }]}
      actions={
        <button
          className="admin-btn primary"
          onClick={() => (tab === "groups" ? setNewGroupOpen(true) : setNewRuleOpen(true))}
        >
          + {tab === "groups" ? "Новая группа" : "Новое правило"}
        </button>
      }
    >
      <div className="admin-tabs">
        <button className="admin-tab" data-active={tab === "groups"} onClick={() => setTab("groups")}>Группы допов</button>
        <button className="admin-tab" data-active={tab === "rules"} onClick={() => setTab("rules")}>Правила комбинирования</button>
      </div>

      {tab === "groups" && (
        <GroupsTab
          groups={groups}
          setGroups={setGroups}
          onShowComposition={(slug) => setCompositionOpen(slug)}
        />
      )}
      {tab === "rules" && <RulesTab rules={rules} setRules={setRules} />}

      <Modal
        open={newGroupOpen}
        title="Новая группа допов"
        onClose={() => setNewGroupOpen(false)}
        onSubmit={createGroup}
        submitDisabled={!newGroupName.trim()}
        submitLabel="Создать"
      >
        <div className="admin-field">
          <label className="admin-label">Название</label>
          <input className="admin-input" autoFocus value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Например: Топпинги" />
        </div>
        <div className="admin-field">
          <label className="admin-label">Тип выбора</label>
          <div style={{ display: "flex", gap: 6 }}>
            {(["single", "multi", "counter"] as SelectionType[]).map((s) => (
              <button
                key={s}
                className={`admin-btn ${newGroupSelection === s ? "primary" : ""}`}
                onClick={() => setNewGroupSelection(s)}
              >
                {s === "single" ? "один" : s === "multi" ? "несколько" : "счётчик"}
              </button>
            ))}
          </div>
        </div>
        <p className="admin-meta">Состав (какие допы входят) добавишь после создания.</p>
      </Modal>

      <Modal
        open={newRuleOpen}
        title="Новое правило комбинирования"
        onClose={() => setNewRuleOpen(false)}
        onSubmit={() => {
          const id = `r-${Date.now()}`;
          setRules((r) => [
            ...r,
            {
              id,
              scope: "global",
              productSlug: null,
              when: [],
              effect: { type: "forbid", addonId: "", label: "", message: "" },
              enabled: false,
            },
          ]);
          setNewRuleOpen(false);
          toast("Черновик правила создан — настрой условие и эффект");
        }}
        submitLabel="Создать черновик"
      >
        <p className="admin-meta">
          После создания заполнишь поля «Когда» и «Эффект» в строке таблицы. Правило по умолчанию выключено.
        </p>
      </Modal>

      <Modal
        open={!!compositionOpen}
        title={`Состав группы: ${groups.find((g) => g.slug === compositionOpen)?.name ?? ""}`}
        onClose={() => setCompositionOpen(null)}
      >
        <p className="admin-meta" style={{ marginBottom: 12 }}>
          Допы, которые входят в эту группу. Управляется через карточки допов в разделе «Допы».
        </p>
        {adminAddons
          .filter((a) => a.groupSlug === compositionOpen)
          .map((a) => (
            <div
              key={a.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 0",
                borderBottom: "1px solid #EFEDE3",
              }}
            >
              <div>
                <strong>{a.name}</strong>
                <div className="admin-meta admin-num">{a.doseAmount} {a.doseUnit}/{a.unit} · {a.pricePerUnitAed} AED</div>
              </div>
              <Toggle defaultOn={a.visible} />
            </div>
          ))}
        {adminAddons.filter((a) => a.groupSlug === compositionOpen).length === 0 && (
          <div className="admin-meta">В группе пока нет допов</div>
        )}
      </Modal>
    </AdminShell>
  );
}

function GroupsTab({
  groups,
  setGroups,
  onShowComposition,
}: {
  groups: AdminAddonGroup[];
  setGroups: React.Dispatch<React.SetStateAction<AdminAddonGroup[]>>;
  onShowComposition: (slug: string) => void;
}) {
  const toast = useToast();
  const updateSelection = (slug: string, sel: SelectionType) => {
    setGroups((arr) => arr.map((g) => (g.slug === slug ? { ...g, selectionType: sel } : g)));
    toast(`Тип выбора группы «${groups.find((g) => g.slug === slug)?.name}» → ${sel}`, "info");
  };
  return (
    <>
      <p className="admin-meta" style={{ marginBottom: 12 }}>
        Группа фиксирует <strong>тип выбора</strong> — он действует везде, где группа прикручена к блюду.
        Чтобы конкретное блюдо требовало выбор — настрой <strong>required / min / max</strong> в самом блюде на вкладке «Допы».
      </p>
      <div className="admin-panel">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Группа</th><th>Slug</th><th>Тип выбора</th>
              <th>Допов в группе</th><th>Используется в блюдах</th><th>Видимость</th><th></th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.slug}>
                <td><strong>{g.name}</strong></td>
                <td><span className="admin-mono admin-meta">{g.slug}</span></td>
                <td>
                  <SelectionPicker value={g.selectionType} onChange={(s) => updateSelection(g.slug, s)} />
                </td>
                <td className="admin-num">{g.itemCount}</td>
                <td className="admin-num">{g.usedInProducts}</td>
                <td><Toggle defaultOn /></td>
                <td style={{ textAlign: "right" }}>
                  <button className="admin-btn sm" onClick={() => onShowComposition(g.slug)}>Состав</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SelectionPicker({
  value,
  onChange,
}: {
  value: SelectionType;
  onChange: (s: SelectionType) => void;
}) {
  return (
    <div style={{ display: "inline-flex", gap: 2, padding: 3, background: "#F5EFE7", borderRadius: 999 }}>
      {[
        { v: "single" as SelectionType, l: "один" },
        { v: "multi" as SelectionType, l: "несколько" },
        { v: "counter" as SelectionType, l: "счётчик" },
      ].map((o) => (
        <button
          key={o.v}
          className="admin-btn sm"
          onClick={() => onChange(o.v)}
          style={
            value === o.v
              ? { background: "#4A56E2", color: "#FFFFFF" }
              : { background: "transparent" }
          }
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function RulesTab({
  rules,
  setRules,
}: {
  rules: Rule[];
  setRules: React.Dispatch<React.SetStateAction<Rule[]>>;
}) {
  const toast = useToast();
  const [sandboxOpen, setSandboxOpen] = useState(false);
  return (
    <>
      <p className="admin-meta" style={{ marginBottom: 12 }}>
        Правило срабатывает, когда выбраны все аддоны из «Когда», и применяет «Эффект».
        Глобальные действуют во всех блюдах; правила со scope=product — только в одном.
      </p>
      <div className="admin-panel">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th>Когда выбрано</th><th>→ Эффект</th><th>Scope</th>
              <th>Сообщение клиенту</th><th>Активно</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r, i) => (
              <tr key={r.id}>
                <td className="admin-num">{i + 1}</td>
                <td>
                  {r.when.length === 0 ? (
                    <span className="admin-meta">не задано</span>
                  ) : (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {r.when.map((w) => <span key={w.addonId} className="admin-pill">{w.label}</span>)}
                    </div>
                  )}
                </td>
                <td>
                  {r.effect.type === "forbid" && (
                    <>
                      <span className="admin-pill danger">запрет</span>{" "}
                      <span>{(r.effect as { label: string }).label || "—"}</span>
                    </>
                  )}
                  {r.effect.type === "discount-percent" && (
                    <>
                      <span className="admin-pill accent">скидка</span>{" "}
                      <span className="admin-num">{(r.effect as { percent: number }).percent}%</span>
                    </>
                  )}
                </td>
                <td>
                  {r.scope === "global" ? (
                    <span className="admin-pill">все блюда</span>
                  ) : (
                    <span className="admin-pill accent">{r.productSlug}</span>
                  )}
                </td>
                <td className="admin-meta" style={{ maxWidth: 240 }}>{r.effect.message}</td>
                <td>
                  <Toggle
                    defaultOn={r.enabled}
                    onChange={(on) => {
                      setRules((arr) => arr.map((x) => (x.id === r.id ? { ...x, enabled: on } : x)));
                      toast(on ? "Правило включено" : "Правило выключено", "info");
                    }}
                  />
                </td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <button className="admin-btn sm" onClick={() => toast("Открыт редактор правила")}>Редактировать</button>{" "}
                  <button
                    className="admin-btn ghost sm"
                    onClick={() => {
                      setRules((arr) => arr.filter((x) => x.id !== r.id));
                      toast("Правило удалено", "info");
                    }}
                    style={{ color: "#A12822" }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 30, color: "#5A6172" }}>Правил пока нет</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-panel" style={{ marginTop: 16 }}>
        <div className="admin-panel-head">
          <div className="admin-panel-title">Песочница правил (dry-run)</div>
          <button className="admin-btn sm" onClick={() => setSandboxOpen(true)}>Открыть</button>
        </div>
      </div>

      <Modal
        open={sandboxOpen}
        title="Песочница: что вернёт preview"
        onClose={() => setSandboxOpen(false)}
        onSubmit={() => toast("preview выполнен")}
        submitLabel="Прогнать"
      >
        <div className="admin-field">
          <label className="admin-label">Блюдо</label>
          <select className="admin-select" defaultValue="latte">
            <option>latte</option>
            <option>cappuccino</option>
            <option>raf-taro</option>
          </select>
        </div>
        <div className="admin-field">
          <label className="admin-label">Выбранные допы</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["овсяное молоко ×1", "обычный шот ×2", "сироп ваниль ×1"].map((t) => (
              <span key={t} className="admin-pill accent">{t}</span>
            ))}
          </div>
        </div>
        <pre style={{ background: "#0F1115", color: "#E8E6DE", padding: 12, fontSize: 12, lineHeight: 1.5, overflowX: "auto" }}>
{`{
  "allowedAddons": [...],
  "forbiddenAddons": [
    { "addonId": "milk-regular",
      "by": "rule:r-1",
      "message": "Нельзя комбинировать два вида молока" }
  ],
  "priceAed": "23.00",
  "nutrition": { "kcal": 185, ... }
}`}
        </pre>
      </Modal>
    </>
  );
}
