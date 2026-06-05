"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { Modal, useToast } from "@/components/admin/AdminUI";
import { adminOutlets, adminProductRows, AdminOutlet } from "@/lib/admin-mock";

type MatrixState = "on" | "off" | "stop";

export default function OutletsPage() {
  const toast = useToast();
  const [outlets, setOutlets] = useState<AdminOutlet[]>(adminOutlets);
  const [matrix, setMatrix] = useState<Record<string, MatrixState>>(() => {
    const m: Record<string, MatrixState> = {};
    adminProductRows.forEach((p) => {
      adminOutlets.forEach((o) => {
        const seed = (p.id.charCodeAt(2) + o.id.length) % 20;
        m[`${p.id}|${o.id}`] = seed === 0 ? "stop" : seed === 1 ? "off" : "on";
      });
    });
    return m;
  });
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCity, setNewCity] = useState("Dubai");
  const [newAddress, setNewAddress] = useState("");

  const cycle = (s: MatrixState): MatrixState =>
    s === "on" ? "off" : s === "off" ? "stop" : "on";

  const createOutlet = () => {
    if (!newName.trim()) return;
    const id = newName.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
    const item: AdminOutlet = {
      id,
      name: newName.trim(),
      city: newCity,
      address: newAddress.trim() || "—",
      hours: "07:00 – 22:30",
      isOpen: false,
      productsLive: 0,
      productsTotal: adminProductRows.length,
      staffCount: 0,
    };
    setOutlets((arr) => [...arr, item]);
    setNewOpen(false);
    setNewName("");
    setNewAddress("");
    toast(`Точка «${item.name}» создана`);
  };

  return (
    <AdminShell
      title="Точки"
      crumbs={[{ label: "Сеть" }, { label: "Точки" }]}
      actions={<button className="admin-btn primary" onClick={() => setNewOpen(true)}>+ Новая точка</button>}
    >
      <div className="admin-grid-4" style={{ marginBottom: 18 }}>
        {outlets.map((o) => (
          <Link
            key={o.id}
            href={`/admin/outlets/${o.id}`}
            className="admin-panel"
            style={{ textDecoration: "none", color: "inherit", padding: 14, display: "block" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{o.name}</div>
                <div className="admin-meta">{o.city}</div>
              </div>
              <span className={`admin-pill ${o.isOpen ? "accent" : "danger"}`}>
                {o.isOpen ? "открыта" : "закрыта"}
              </span>
            </div>
            <div className="admin-divider" style={{ margin: "10px 0" }} />
            <div style={{ display: "flex", gap: 16 }}>
              <div>
                <div className="admin-label">Меню</div>
                <div className="admin-num" style={{ fontWeight: 700 }}>
                  {o.productsLive}<span style={{ color: "#8A8F9C", fontWeight: 500 }}>/{o.productsTotal}</span>
                </div>
              </div>
              <div>
                <div className="admin-label">Сотрудники</div>
                <div className="admin-num" style={{ fontWeight: 700 }}>{o.staffCount}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">Меню × Точки — матрица</div>
          <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
            <span>клик → циклически меняет состояние</span>
            <span>·</span>
            <span><span className="matrix-cell" data-state="on">✓</span> в меню</span>
            <span><span className="matrix-cell" data-state="off">·</span> скрыто</span>
            <span><span className="matrix-cell" data-state="stop">⛔</span> стоп</span>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table" style={{ minWidth: 600 }}>
            <thead>
              <tr>
                <th>Блюдо</th>
                <th>Категория</th>
                {outlets.map((o) => (
                  <th key={o.id} style={{ textAlign: "center", minWidth: 100 }}>{o.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {adminProductRows.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td className="admin-meta">{p.category}</td>
                  {outlets.map((o) => {
                    const key = `${p.id}|${o.id}`;
                    const state = matrix[key] ?? "on";
                    return (
                      <td
                        key={o.id}
                        className="matrix-cell"
                        data-state={state}
                        title={state === "on" ? "В меню" : state === "off" ? "Скрыто" : "Стоп-лист"}
                        onClick={() => {
                          const next = cycle(state);
                          setMatrix((m) => ({ ...m, [key]: next }));
                          toast(`${p.name} → ${o.name}: ${next === "on" ? "в меню" : next === "off" ? "скрыто" : "стоп"}`, "info");
                        }}
                      >
                        {state === "on" ? "✓" : state === "off" ? "·" : "⛔"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={newOpen}
        title="Новая точка"
        onClose={() => setNewOpen(false)}
        onSubmit={createOutlet}
        submitDisabled={!newName.trim()}
        submitLabel="Создать"
      >
        <div className="admin-field">
          <label className="admin-label">Название</label>
          <input className="admin-input" autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Например: Marina Mall" />
        </div>
        <div className="admin-grid-2">
          <div className="admin-field">
            <label className="admin-label">Город</label>
            <select className="admin-select" value={newCity} onChange={(e) => setNewCity(e.target.value)}>
              <option>Dubai</option>
              <option>Abu Dhabi</option>
              <option>Sharjah</option>
            </select>
          </div>
          <div className="admin-field">
            <label className="admin-label">Часы (по умолчанию)</label>
            <input className="admin-input mono" defaultValue="07:00 – 22:30" />
          </div>
        </div>
        <div className="admin-field">
          <label className="admin-label">Адрес</label>
          <input className="admin-input" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
        </div>
        <p className="admin-meta">
          Точка создаётся закрытой. Координаты, TRN, расписание и сотрудников добавишь в её карточке.
        </p>
      </Modal>
    </AdminShell>
  );
}
