"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminApi, adminOrdersWs, ADMIN_STATUS_LABEL, type AdminOrder, type Staff } from "@/lib/adminApi";
import { useAdmin } from "@/components/admin/AdminShell";

function OrdersInner() {
  const { staff } = useAdmin();
  const [rows, setRows] = useState<AdminOrder[]>([]);
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "done">("active");
  const [managerFilter, setManagerFilter] = useState<"all" | "mine" | "unassigned">("all");
  const [managers, setManagers] = useState<Staff[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const load = useCallback(() => {
    adminApi.orders({
      active: activeFilter === "all" ? undefined : activeFilter === "active",
      managerId: managerFilter === "mine" ? staff?.id : undefined,
      unassigned: managerFilter === "unassigned",
    }).then(setRows).catch(() => {});
  }, [activeFilter, managerFilter, staff]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    // realtime-лента заказов (ADM-M-03 AC2)
    try {
      const ws = adminOrdersWs();
      wsRef.current = ws;
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.type !== "ping") load();
      };
    } catch {}
    return () => wsRef.current?.close();
  }, [load]);

  return (
    <>
      <div className="admin-filter-row">
        <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "#FFF", borderRadius: 999 }}>
          {([["active", "Активные"], ["done", "Завершённые"], ["all", "Все"]] as const).map(([v, l]) => (
            <button key={v} className="admin-btn sm" onClick={() => setActiveFilter(v)}
                    style={activeFilter === v ? { background: "#4A56E2", color: "#FFF" } : { background: "transparent" }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "#FFF", borderRadius: 999 }}>
          {([["all", "Все менеджеры"], ["mine", "Мои"], ["unassigned", "Без менеджера"]] as const).map(([v, l]) => (
            <button key={v} className="admin-btn sm" onClick={() => setManagerFilter(v)}
                    style={managerFilter === v ? { background: "#4A56E2", color: "#FFF" } : { background: "transparent" }}>
              {l}
            </button>
          ))}
        </div>
        <span className="admin-meta" style={{ marginLeft: "auto", alignSelf: "center" }}>
          Показано <strong>{rows.length}</strong>
        </span>
      </div>

      <div className="admin-panel">
        <table className="admin-table">
          <thead>
            <tr>
              <th>№</th><th>Клиент</th><th>Машина</th><th>Состав</th>
              <th>Сумма</th><th>Статус</th><th>Оценка</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} style={o.arrived && o.status !== "completed" ? { background: "#FFF7E5" } : undefined}>
                <td>
                  <Link href={`/admin/orders/${o.id}`} className="admin-num"
                        style={{ color: "#0E0E10", fontWeight: 700, textDecoration: "none" }}>
                    #{o.number}
                  </Link>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{o.customerName ?? "—"}</div>
                  <div className="admin-mono admin-meta">{o.phone}</div>
                </td>
                <td><span className="admin-mono" style={{ fontWeight: 600 }}>{o.emirate} {o.carPlate}</span></td>
                <td style={{ fontSize: 12.5 }}>
                  {o.items.map((it, i) => <div key={i}>{it.quantity}× {it.name}</div>)}
                </td>
                <td className="admin-num">{o.total.toFixed(2)}</td>
                <td>
                  {/* статус готовки + независимый флаг прибытия (ADM-M-01 AC4) */}
                  <span className={`admin-badge ${o.status}`}>
                    {ADMIN_STATUS_LABEL[o.status] ?? o.status}
                  </span>
                  {o.arrived && o.status !== "completed" && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#B45309", marginTop: 4 }}>
                      🚗 клиент на месте
                    </div>
                  )}
                </td>
                <td>{o.rating === "like" ? "👍" : o.rating === "dislike" ? "👎" : "—"}</td>
                <td style={{ textAlign: "right" }}>
                  {o.status === "new" ? (
                    <button className="admin-btn primary sm"
                            onClick={() => adminApi.take(o.id).then(load)}>
                      Взять в работу
                    </button>
                  ) : (
                    <Link href={`/admin/orders/${o.id}`} className="admin-btn sm">Открыть</Link>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "#5A6172" }}>
                Заказов нет
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function OrdersListPage() {
  return (
    <AdminShell title="Заказы" crumbs={[{ label: "Заказы" }]}>
      <OrdersInner />
    </AdminShell>
  );
}
