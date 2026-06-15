"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { Pager, useToast } from "@/components/admin/AdminUI";
import { adminApi, type Staff } from "@/lib/adminApi";
import { usePaged } from "@/lib/usePaged";

const ROLE_LABEL: Record<string, string> = { super_admin: "Супер-админ", manager: "Менеджер заказов", screen: "Экран выдачи" };

function StaffInner() {
  const router = useRouter();
  const toast = useToast();
  const fetcher = useCallback((p: { limit: number; offset: number }) => adminApi.managersPaged(p), []);
  const { items: rows, total, limit, offset, loading, setOffset, setLimit, reload } =
    usePaged<Staff>(fetcher, [], 20);

  return (
    <>
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">Все сотрудники</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="admin-meta">Всего {total}, активных {rows.filter((u) => !u.disabled).length}</span>
            <button className="admin-btn primary sm" onClick={() => router.push("/admin/staff/new")}>
              + Добавить сотрудника
            </button>
          </div>
        </div>
        <div className="admin-tablewrap"><table className="admin-table">
          <thead>
            <tr><th>Сотрудник</th><th>Email</th><th>Роль</th><th>Статус</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className={`admin-row-link ${u.disabled ? "muted" : ""}`}
                  style={{ cursor: "pointer" }} onClick={() => router.push(`/admin/staff/${u.id}`)}>
                <td>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div className="admin-user" style={{ width: 32, height: 32, fontSize: 12 }}>
                      {u.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <strong>{u.name}</strong>
                      {u.note && <div className="admin-meta">{u.note}</div>}
                    </div>
                  </div>
                </td>
                <td className="admin-mono admin-meta">{u.email}</td>
                <td><span className="admin-pill accent">{ROLE_LABEL[u.role] ?? u.role}</span></td>
                <td>
                  {u.disabled
                    ? <span className="admin-pill danger">отключён</span>
                    : <span className="admin-pill accent">активен</span>}
                </td>
                <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                  {!u.disabled && (
                    <button className="admin-btn ghost sm" style={{ color: "#A12822" }}
                            onClick={() => adminApi.deleteManager(u.id)
                              .then(() => { reload(); toast("Учётка деактивирована", "warn"); })
                              .catch((e) => toast(e.message, "warn"))}>
                      Деактивировать
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="admin-meta" style={{ padding: 16 }}>
                {loading ? "Загрузка…" : "Сотрудников нет"}</td></tr>
            )}
          </tbody>
        </table></div>
        <Pager total={total} limit={limit} offset={offset} loading={loading}
               onOffset={setOffset} onLimit={setLimit} />
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
