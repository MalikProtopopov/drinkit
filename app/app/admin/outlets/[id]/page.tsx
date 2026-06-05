"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { Modal, Toggle, ConfirmDialog, useToast } from "@/components/admin/AdminUI";
import { adminOutlets, staffUsers, adminProductRows } from "@/lib/admin-mock";

type Tab = "main" | "menu" | "staff" | "hours";

const DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

export default function OutletDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const outlet = adminOutlets.find((o) => o.id === id) ?? adminOutlets[0];
  const [tab, setTab] = useState<Tab>("main");
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const outletStaff = staffUsers.filter(
    (u) => u.outletScope === "*" || (Array.isArray(u.outletScope) && u.outletScope.includes(id))
  );

  return (
    <AdminShell
      title={outlet.name}
      crumbs={[{ label: "Сеть" }, { label: "Точки", href: "/admin/outlets" }, { label: outlet.name }]}
      actions={
        <>
          <button className="admin-btn danger" onClick={() => setConfirmClose(true)}>Закрыть точку</button>
          <button className="admin-btn primary" onClick={() => { setDirty(false); toast(`«${outlet.name}» сохранена`); }}>
            {dirty ? "● Сохранить" : "Сохранить"}
          </button>
        </>
      }
    >
      <div className="admin-tabs">
        {(["main", "menu", "staff", "hours"] as Tab[]).map((t) => (
          <button key={t} className="admin-tab" data-active={tab === t} onClick={() => setTab(t)}>
            {{ main: "Основное", menu: "Меню точки", staff: "Сотрудники", hours: "Расписание" }[t]}
          </button>
        ))}
      </div>

      {tab === "main" && (
        <div className="admin-grid-2">
          <div className="admin-panel">
            <div className="admin-panel-head"><div className="admin-panel-title">Адрес и координаты</div></div>
            <div className="admin-panel-body">
              <div className="admin-field">
                <label className="admin-label">Название</label>
                <input className="admin-input" defaultValue={outlet.name} onChange={() => setDirty(true)} />
              </div>
              <div className="admin-field">
                <label className="admin-label">Адрес</label>
                <input className="admin-input" defaultValue={outlet.address} onChange={() => setDirty(true)} />
              </div>
              <div className="admin-grid-2">
                <div className="admin-field">
                  <label className="admin-label">Город</label>
                  <select className="admin-select" defaultValue={outlet.city} onChange={() => setDirty(true)}>
                    <option>Dubai</option><option>Abu Dhabi</option><option>Sharjah</option>
                  </select>
                </div>
                <div className="admin-field">
                  <label className="admin-label">VAT TRN</label>
                  <input className="admin-input mono" defaultValue="100123456700003" onChange={() => setDirty(true)} />
                </div>
              </div>
              <div className="admin-grid-2">
                <div className="admin-field">
                  <label className="admin-label">Latitude</label>
                  <input className="admin-input mono" defaultValue="25.184500" onChange={() => setDirty(true)} />
                </div>
                <div className="admin-field">
                  <label className="admin-label">Longitude</label>
                  <input className="admin-input mono" defaultValue="55.265700" onChange={() => setDirty(true)} />
                </div>
              </div>
            </div>
          </div>
          <div className="admin-panel">
            <div className="admin-panel-head"><div className="admin-panel-title">Сводка</div></div>
            <div className="admin-panel-body">
              <div className="admin-grid-2">
                <div className="admin-stat"><div className="admin-stat-label">Сегодня</div><div className="admin-stat-value">42</div><div className="admin-stat-trend up">заказов</div></div>
                <div className="admin-stat"><div className="admin-stat-label">Выручка</div><div className="admin-stat-value">1.4k</div><div className="admin-stat-trend up">AED</div></div>
              </div>
              <div className="admin-divider" />
              <div className="admin-meta">
                <strong>Очередь сейчас:</strong> 2 заказа в работе, 1 готов к выдаче. <br />
                <strong>Принтер чеков:</strong> <span style={{ color: "#2D6A3E" }}>● online</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "menu" && <MenuTab onDirty={() => setDirty(true)} />}

      {tab === "staff" && (
        <div className="admin-panel">
          <div className="admin-panel-head">
            <div className="admin-panel-title">Сотрудники на этой точке</div>
            <button className="admin-btn sm" onClick={() => setAssignOpen(true)}>+ Назначить</button>
          </div>
          <table className="admin-table">
            <thead><tr><th>Имя</th><th>Email</th><th>Роли</th><th>Доступ</th><th>Последний вход</th><th></th></tr></thead>
            <tbody>
              {outletStaff.map((u) => (
                <tr key={u.id} className={u.disabled ? "muted" : ""}>
                  <td><strong>{u.name}</strong></td>
                  <td className="admin-mono admin-meta">{u.email}</td>
                  <td>{u.roles.map((r) => <span key={r} className="admin-pill accent" style={{ marginRight: 4 }}>{r}</span>)}</td>
                  <td>{u.outletScope === "*" ? <span className="admin-pill">все точки</span> : <span className="admin-pill">только эта</span>}</td>
                  <td className="admin-meta">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("ru-RU") : "никогда"}</td>
                  <td>
                    <button
                      className="admin-btn ghost sm"
                      onClick={() => router.push("/admin/staff")}
                    >
                      Открыть карточку
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "hours" && (
        <div className="admin-panel">
          <div className="admin-panel-head"><div className="admin-panel-title">Часы работы</div></div>
          <div className="admin-panel-body">
            {DAYS.map((d) => (
              <div key={d} style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr 60px", gap: 8, alignItems: "center", padding: "8px 0", borderBottom: "1px solid #EFEDE3" }}>
                <div style={{ fontWeight: 600 }}>{d}</div>
                <div>
                  <label className="admin-label">Открытие</label>
                  <input className="admin-input mono" defaultValue="07:00" onChange={() => setDirty(true)} />
                </div>
                <div>
                  <label className="admin-label">Закрытие</label>
                  <input className="admin-input mono" defaultValue="22:30" onChange={() => setDirty(true)} />
                </div>
                <Toggle defaultOn onChange={() => setDirty(true)} />
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmClose}
        title="Закрыть точку?"
        message="Все активные заказы продолжат готовиться, но новых клиент сделать не сможет. Точку можно открыть обратно в любой момент."
        confirmLabel="Закрыть"
        danger
        onCancel={() => setConfirmClose(false)}
        onConfirm={() => { setConfirmClose(false); toast(`«${outlet.name}» переведена в режим «закрыта»`, "warn"); }}
      />

      <Modal
        open={assignOpen}
        title="Назначить сотрудника"
        onClose={() => setAssignOpen(false)}
        onSubmit={() => { setAssignOpen(false); toast("Сотрудник назначен"); }}
        submitLabel="Назначить"
      >
        <div className="admin-field">
          <label className="admin-label">Сотрудник</label>
          <select className="admin-select">
            <option value="">— выбери —</option>
            {staffUsers.filter((u) => !u.disabled).map((u) => (
              <option key={u.id}>{u.name} · {u.roles.join(", ")}</option>
            ))}
          </select>
        </div>
        <p className="admin-meta">
          Добавит точку <strong>{outlet.name}</strong> в outletScope сотрудника.
        </p>
      </Modal>
    </AdminShell>
  );
}

function MenuTab({ onDirty }: { onDirty: () => void }) {
  const toast = useToast();
  const [confirmStopAll, setConfirmStopAll] = useState(false);

  return (
    <>
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">Меню в этой точке</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="admin-btn sm" onClick={() => toast("Все per-outlet override сброшены")}>Сбросить overrides</button>
            <button className="admin-btn sm" style={{ color: "#A12822", borderColor: "#E5C5C2" }} onClick={() => setConfirmStopAll(true)}>Массовый стоп</button>
          </div>
        </div>
        <table className="admin-table">
          <thead>
            <tr><th>Блюдо</th><th>Категория</th><th>В меню</th><th>В наличии</th><th>Кто менял</th><th>Когда</th></tr>
          </thead>
          <tbody>
            {adminProductRows.slice(0, 10).map((p, i) => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong></td>
                <td className="admin-meta">{p.category}</td>
                <td>
                  <Toggle defaultOn={i !== 5} onChange={(v) => { onDirty(); toast(`${p.name}: ${v ? "в меню" : "скрыто"}`, "info"); }} />
                </td>
                <td>
                  <Toggle defaultOn={i !== 2 && i !== 7} onChange={(v) => { onDirty(); toast(`${p.name}: ${v ? "в наличии" : "стоп"}`, v ? "ok" : "warn"); }} />
                </td>
                <td className="admin-meta">{i === 2 ? "Sergey M." : i === 5 ? "Sergey M." : i === 7 ? "Fatima H." : "—"}</td>
                <td className="admin-meta">{i === 2 ? "13:24" : i === 5 ? "вчера" : i === 7 ? "10:08" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={confirmStopAll}
        title="Массовый стоп?"
        message="Все блюда переводятся в стоп-лист точки. Можно снять отдельно по каждому или одной кнопкой «Сбросить overrides»."
        confirmLabel="Стопнуть всё"
        danger
        onCancel={() => setConfirmStopAll(false)}
        onConfirm={() => { setConfirmStopAll(false); toast("Все блюда в этой точке поставлены на стоп", "warn"); }}
      />
    </>
  );
}
