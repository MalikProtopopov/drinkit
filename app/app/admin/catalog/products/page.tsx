"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { Modal, useToast } from "@/components/admin/AdminUI";
import { adminProductRows, ProductSummary } from "@/lib/admin-mock";

export default function ProductsListPage() {
  const toast = useToast();
  const [rows, setRows] = useState<ProductSummary[]>(adminProductRows);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Все");
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Кофе");

  const categories = ["Все", ...Array.from(new Set(rows.map((p) => p.category)))];

  const filtered = rows.filter(
    (p) =>
      (category === "Все" || p.category === category) &&
      (search === "" || p.name.toLowerCase().includes(search.toLowerCase()))
  );

  const createProduct = () => {
    if (!newName.trim()) return;
    const slug = newName.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "").slice(0, 30) || `p-${Date.now()}`;
    const item: ProductSummary = {
      id: `p-${Date.now()}`,
      slug,
      name: newName.trim(),
      category: newCategory,
      basePriceAed: 0,
      kcal: 0,
      variantCount: 1,
      addonGroupCount: 0,
      visible: false,
      inStock: true,
      hasVideo: false,
      posterUrl: "",
    };
    setRows((r) => [item, ...r]);
    setNewOpen(false);
    setNewName("");
    toast(`Создано черновое блюдо «${item.name}» — заполни детали`);
  };

  return (
    <AdminShell
      title="Блюда"
      crumbs={[{ label: "Каталог" }, { label: "Блюда" }]}
      actions={
        <>
          <button className="admin-btn" onClick={() => toast(`Экспортировано ${filtered.length} блюд в CSV`)}>
            Экспорт
          </button>
          <button className="admin-btn primary" onClick={() => setNewOpen(true)}>
            + Новое блюдо
          </button>
        </>
      }
    >
      <div className="admin-filter-row">
        <div className="admin-search">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5A6172" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" strokeLinecap="round" />
          </svg>
          <input
            placeholder="Найти по названию"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="admin-select" style={{ width: "auto" }} value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <span className="admin-meta" style={{ marginLeft: "auto", alignSelf: "center" }}>
          Показано <strong>{filtered.length}</strong> из <strong>{rows.length}</strong>
        </span>
      </div>

      <div className="admin-panel">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 48 }}></th>
              <th>Название</th>
              <th>Категория</th>
              <th>Варианты</th>
              <th>Группы допов</th>
              <th>Цена от</th>
              <th>КБЖУ</th>
              <th>Медиа</th>
              <th>Статус</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className={!p.visible ? "muted" : ""}>
                <td>
                  <div className="admin-thumb" style={{ background: "#F0EDE0" }}>
                    <span className="admin-mono" style={{ fontSize: 9, color: "#5A6172" }}>
                      {p.slug.slice(0, 3).toUpperCase()}
                    </span>
                  </div>
                </td>
                <td>
                  <Link href={`/admin/catalog/products/${p.slug}`} style={{ fontWeight: 600, color: "#0F1115", textDecoration: "none" }}>
                    {p.name}
                  </Link>
                  {p.badge && (
                    <span className="admin-pill accent" style={{ marginLeft: 6 }}>
                      {p.badge}
                    </span>
                  )}
                </td>
                <td>{p.category}</td>
                <td className="admin-num">{p.variantCount}</td>
                <td className="admin-num">{p.addonGroupCount}</td>
                <td className="admin-num">{p.basePriceAed} AED</td>
                <td className="admin-num">{p.kcal} ккал</td>
                <td>
                  {p.hasVideo ? (
                    <span className="admin-pill accent">video + poster</span>
                  ) : (
                    <span className="admin-pill warn">только poster</span>
                  )}
                </td>
                <td>
                  {!p.visible ? (
                    <span className="admin-pill">скрыто</span>
                  ) : !p.inStock ? (
                    <span className="admin-pill danger">стоп</span>
                  ) : (
                    <span className="admin-pill accent">активно</span>
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  <Link href={`/admin/catalog/products/${p.slug}`} className="admin-btn sm">
                    Открыть
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", padding: 40, color: "#5A6172" }}>
                  Ничего не найдено по фильтрам.{" "}
                  <button
                    className="admin-btn ghost sm"
                    onClick={() => { setSearch(""); setCategory("Все"); }}
                  >
                    Сбросить
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={newOpen}
        title="Новое блюдо"
        subtitle="Создадим черновик — остальные поля заполнишь в редакторе"
        onClose={() => setNewOpen(false)}
        onSubmit={createProduct}
        submitDisabled={!newName.trim()}
        submitLabel="Создать черновик"
      >
        <div className="admin-field">
          <label className="admin-label">Название (RU)</label>
          <input
            className="admin-input"
            autoFocus
            placeholder="Например: Капучино карамель"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label">Категория</label>
          <select className="admin-select" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
            {categories.filter((c) => c !== "Все").map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <p className="admin-meta">
          После создания откроется редактор — там добавишь варианты, медиа, КБЖУ и привяжешь группы допов.
        </p>
      </Modal>
    </AdminShell>
  );
}
