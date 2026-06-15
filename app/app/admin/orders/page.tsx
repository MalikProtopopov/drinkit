"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { Pager } from "@/components/admin/AdminUI";
import { adminApi, adminOrdersWs, qs, ADMIN_STATUS_LABEL, type AdminOrder } from "@/lib/adminApi";
import { useAdmin } from "@/components/admin/AdminShell";
import { ExportButton } from "@/components/admin/ExportButton";
import { OutletFilter } from "@/components/admin/OutletFilter";
import { usePaged } from "@/lib/usePaged";
import { useLiveReload } from "@/lib/useLiveReload";

function OrdersInner() {
  const { staff } = useAdmin();
  const isSuper = staff?.role === "super_admin";
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "done">("active");
  const [managerFilter, setManagerFilter] = useState<"all" | "mine" | "unassigned">("all");
  // фильтр по точке — только супер-админу; менеджер/screen жёстко скоупятся бэкендом (REQ-7)
  const [outletFilter, setOutletFilter] = useState<number | "all">("all");

  const fetcher = useCallback((p: { limit: number; offset: number }) => adminApi.ordersPaged({
    ...p,
    active: activeFilter === "all" ? undefined : activeFilter === "active",
    managerId: managerFilter === "mine" ? staff?.id : undefined,
    unassigned: managerFilter === "unassigned",
    outletId: isSuper && outletFilter !== "all" ? outletFilter : undefined,
  }), [activeFilter, managerFilter, staff, isSuper, outletFilter]);

  const { items: rows, total, limit, offset, loading, setOffset, setLimit, reload } =
    usePaged<AdminOrder>(fetcher, [activeFilter, managerFilter, staff?.id, outletFilter], 20);

  // realtime-лента (ADM-M-03 AC2): новые заказы и смены статуса появляются сразу,
  // без обновления страницы; авто-reconnect + догон пропущенного при разрыве связи
  useLiveReload({
    connect: adminOrdersWs,
    onMessage: () => reload(),
    onSync: () => reload(),
    pollMs: 30000,
  });

  return (
    <>
      <div className="admin-filter-row">
        <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "#FFF", borderRadius: 999 }}>
          {([["active", "Active"], ["done", "Completed"], ["all", "All"]] as const).map(([v, l]) => (
            <button key={v} className="admin-btn sm" onClick={() => setActiveFilter(v)}
                    style={activeFilter === v ? { background: "#4A56E2", color: "#FFF" } : { background: "transparent" }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "#FFF", borderRadius: 999 }}>
          {([["all", "All managers"], ["mine", "Mine"], ["unassigned", "Unassigned"]] as const).map(([v, l]) => (
            <button key={v} className="admin-btn sm" onClick={() => setManagerFilter(v)}
                    style={managerFilter === v ? { background: "#4A56E2", color: "#FFF" } : { background: "transparent" }}>
              {l}
            </button>
          ))}
        </div>
        {isSuper && <OutletFilter value={outletFilter} onChange={setOutletFilter} />}
        <div style={{ marginLeft: "auto", display: "inline-flex", gap: 12, alignItems: "center" }}>
          {isSuper && (
            <ExportButton
              path={`/api/admin/exports/orders.xlsx${qs({ outlet_id: outletFilter === "all" ? undefined : outletFilter })}`}
              filename="orders.xlsx" label="Export orders" />
          )}
          <span className="admin-meta">Total <strong>{total}</strong></span>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-tablewrap"><table className="admin-table">
          <thead>
            <tr>
              <th>#</th><th>Customer</th><th>Car</th><th>Items</th>
              <th>Amount</th><th>Status</th><th>Rating</th><th></th>
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
                  {isSuper && o.outlet?.name && (
                    <div className="admin-meta">📍 {o.outlet.name}</div>
                  )}
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
                      🚗 customer arrived
                    </div>
                  )}
                </td>
                <td>{o.rating === "like" ? "👍" : o.rating === "dislike" ? "👎" : "—"}</td>
                <td style={{ textAlign: "right" }}>
                  {o.status === "new" ? (
                    <button className="admin-btn primary sm"
                            onClick={() => adminApi.take(o.id).then(reload)}>
                      Take
                    </button>
                  ) : (
                    <Link href={`/admin/orders/${o.id}`} className="admin-btn sm">Open</Link>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "#5A6172" }}>
                {loading ? "Loading…" : "No orders"}
              </td></tr>
            )}
          </tbody>
        </table></div>
        <Pager total={total} limit={limit} offset={offset} loading={loading}
               onOffset={setOffset} onLimit={setLimit} />
      </div>
    </>
  );
}

export default function OrdersListPage() {
  return (
    <AdminShell title="Orders" crumbs={[{ label: "Orders" }]}>
      <OrdersInner />
    </AdminShell>
  );
}
