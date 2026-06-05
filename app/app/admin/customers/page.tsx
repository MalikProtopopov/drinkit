"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminApi, ADMIN_STATUS_LABEL } from "@/lib/adminApi";

export default function CustomersPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [detail, setDetail] = useState<any | null>(null);

  useEffect(() => { adminApi.customers().then(setRows).catch(() => {}); }, []);

  return (
    <AdminShell title="Клиенты" crumbs={[{ label: "Клиенты" }]}>
      <div className="admin-panel">
        <table className="admin-table">
          <thead>
            <tr><th>ID</th><th>Имя</th><th>Телефон</th><th>Машина</th><th>Язык</th><th>Регистрация</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td className="admin-num">{u.id}</td>
                <td><strong>{u.name ?? "—"}</strong></td>
                <td className="admin-mono">{u.phone}</td>
                <td className="admin-mono">{u.carPlate ?? "—"}</td>
                <td><span className="admin-pill">{u.locale}</span></td>
                <td className="admin-meta">{u.createdAt ? new Date(u.createdAt).toLocaleDateString("ru-RU") : "—"}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="admin-btn sm"
                          onClick={() => adminApi.customer(u.id).then(setDetail)}>
                    Деталка
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <>
          <div className="admin-drawer-backdrop" onClick={() => setDetail(null)} />
          <aside className="admin-drawer">
            <div className="admin-drawer-head">
              <div>
                <div className="admin-panel-title">{detail.name ?? detail.phone}</div>
                <div className="admin-mono admin-meta">{detail.phone}</div>
              </div>
              <button className="admin-btn ghost" onClick={() => setDetail(null)}>×</button>
            </div>
            <div className="admin-drawer-body">
              {/* ADM-S-08 AC2 / PUB-A-06 AC3: редактирование личных данных из админки */}
              <div className="admin-grid-2">
                <div className="admin-field">
                  <label className="admin-label">Имя</label>
                  <input className="admin-input" value={detail.name ?? ""}
                         onChange={(e) => setDetail({ ...detail, name: e.target.value })} />
                </div>
                <div className="admin-field">
                  <label className="admin-label">Номер машины</label>
                  <input className="admin-input mono" value={detail.carPlate ?? ""}
                         onChange={(e) => setDetail({ ...detail, carPlate: e.target.value.toUpperCase() })} />
                </div>
              </div>
              <button className="admin-btn primary sm" style={{ marginBottom: 14 }}
                      onClick={async () => {
                        const { adminApi } = await import("@/lib/adminApi");
                        await adminApi.updateCustomer(detail.id, {
                          name: detail.name, carPlate: detail.carPlate });
                        adminApi.customers().then(setRows);
                      }}>
                Сохранить данные клиента
              </button>
              <div className="admin-divider" />
              <div className="admin-label" style={{ marginBottom: 6 }}>Заказы ({detail.orders.length})</div>
              {detail.orders.map((o: any) => (
                <div key={o.id} style={{ padding: "8px 0", borderBottom: "1px solid #EFEDE3", fontSize: 13 }}>
                  <strong>#{o.number}</strong> · {o.total.toFixed(0)} AED ·{" "}
                  <span className="admin-meta">{ADMIN_STATUS_LABEL[o.status] ?? o.status}</span>
                  {o.rating && <span> · {o.rating === "like" ? "👍" : "👎"}</span>}
                </div>
              ))}
              <div className="admin-divider" />
              <div className="admin-label" style={{ marginBottom: 6 }}>Платежи ({detail.payments.length})</div>
              {detail.payments.map((p: any) => (
                <div key={p.id} style={{ padding: "6px 0", borderBottom: "1px solid #EFEDE3", fontSize: 13 }}>
                  {p.amount.toFixed(2)} {p.currency} · <span className="admin-pill">{p.status}</span>
                </div>
              ))}
              <div className="admin-divider" />
              <div className="admin-label" style={{ marginBottom: 6 }}>Купоны ({detail.coupons.length})</div>
              {detail.coupons.map((c: any) => (
                <div key={c.id} style={{ padding: "6px 0", fontSize: 13 }}>
                  №{c.id} · <span className="admin-pill">{c.status}</span>
                  {c.discountAmount != null && <span className="admin-meta"> · −{c.discountAmount} AED</span>}
                </div>
              ))}
            </div>
          </aside>
        </>
      )}
    </AdminShell>
  );
}
