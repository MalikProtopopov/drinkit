"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Modal, useToast } from "@/components/admin/AdminUI";
import { adminApi, type Staff } from "@/lib/adminApi";

const ROLE_LABEL: Record<string, string> = { super_admin: "Супер-админ", manager: "Менеджер заказов" };

function StaffInner() {
  const toast = useToast();
  const [rows, setRows] = useState<Staff[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("manager");

  const load = useCallback(() => { adminApi.managers().then(setRows).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  const invite = async () => {
    try {
      await adminApi.createManager({ email, password, name, role });
      setInviteOpen(false);
      setName(""); setEmail(""); setPassword("");
      load();
      toast("Сотрудник добавлен");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ошибка", "warn");
    }
  };

  return (
    <>
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">Все сотрудники</div>
          <span className="admin-meta">Всего {rows.length}, активных {rows.filter((u) => !u.disabled).length}</span>
        </div>
        <table className="admin-table">
          <thead>
            <tr><th>Сотрудник</th><th>Email</th><th>Роль</th><th>Статус</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className={u.disabled ? "muted" : ""}>
                <td>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div className="admin-user" style={{ width: 32, height: 32, fontSize: 12 }}>
                      {u.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                    </div>
                    <strong>{u.name}</strong>
                  </div>
                </td>
                <td className="admin-mono admin-meta">{u.email}</td>
                <td><span className="admin-pill accent">{ROLE_LABEL[u.role] ?? u.role}</span></td>
                <td>
                  {u.disabled
                    ? <span className="admin-pill danger">отключён</span>
                    : <span className="admin-pill accent">активен</span>}
                </td>
                <td style={{ textAlign: "right" }}>
                  {!u.disabled && (
                    <button className="admin-btn ghost sm" style={{ color: "#A12822" }}
                            onClick={() => adminApi.deleteManager(u.id)
                              .then(() => { load(); toast("Учётка деактивирована", "warn"); })
                              .catch((e) => toast(e.message, "warn"))}>
                      Деактивировать
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={inviteOpen} title="Новый сотрудник" onClose={() => setInviteOpen(false)}
             onSubmit={invite} submitDisabled={!name || !email || password.length < 6}
             submitLabel="Создать">
        <div className="admin-grid-2">
          <div className="admin-field">
            <label className="admin-label">Имя</label>
            <input className="admin-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="admin-field">
            <label className="admin-label">Email</label>
            <input className="admin-input mono" type="email" value={email}
                   onChange={(e) => setEmail(e.target.value)} placeholder="name@juicy.ae" />
          </div>
        </div>
        <div className="admin-grid-2">
          <div className="admin-field">
            <label className="admin-label">Пароль (мин. 6)</label>
            <input className="admin-input mono" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="admin-field">
            <label className="admin-label">Роль</label>
            <select className="admin-select" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="manager">Менеджер заказов</option>
              <option value="super_admin">Супер-админ</option>
            </select>
          </div>
        </div>
      </Modal>

      <div style={{ marginTop: 12 }}>
        <button className="admin-btn primary" onClick={() => setInviteOpen(true)}>+ Добавить сотрудника</button>
      </div>
    </>
  );
}

export default function StaffPage() {
  return (
    <AdminShell title="Сотрудники" crumbs={[{ label: "Сотрудники" }]}>
      <StaffInner />
    </AdminShell>
  );
}
