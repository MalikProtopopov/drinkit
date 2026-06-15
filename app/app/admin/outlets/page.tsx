"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell, useAdmin } from "@/components/admin/AdminShell";
import { Modal, Pager, useToast } from "@/components/admin/AdminUI";
import { adminOrdersWs, outletApi, type AdminOutlet, type I18n } from "@/lib/adminApi";
import { usePaged } from "@/lib/usePaged";
import { useLiveReload } from "@/lib/useLiveReload";

// статус точки → подпись + класс пилюли
const STATUS_PILL: Record<AdminOutlet["status"], { label: string; cls: string }> = {
  open: { label: "open", cls: "accent" },
  paused: { label: "paused", cls: "warn" },
  closed: { label: "closed", cls: "warn" },
  inactive: { label: "disabled", cls: "danger" },
};

const oName = (n: I18n) => n.en ?? n.ru ?? n.ar ?? "—";

function OutletsInner() {
  const router = useRouter();
  const toast = useToast();
  const { staff } = useAdmin();
  const fetcher = useCallback((p: { limit: number; offset: number }) => outletApi.listPaged(p), []);
  const { items: rows, total, limit, offset, loading, setOffset, setLimit, reload } =
    usePaged<AdminOutlet>(fetcher, [], 20);

  // realtime: статусы/счётчики точек обновляются по событиям заказов (без поллинга)
  useLiveReload({ connect: adminOrdersWs, onMessage: () => reload(), onSync: () => reload() });

  const [open, setOpen] = useState(false);
  const [nameEn, setNameEn] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  if (staff?.role !== "super_admin") {
    return <div className="admin-panel"><div className="admin-panel-body admin-meta">
      This section is available to super admins only.</div></div>;
  }

  const create = async () => {
    if (!nameEn.trim()) { toast("Enter the outlet name", "warn"); return; }
    setSaving(true);
    try {
      const o = await outletApi.create({
        name: { en: nameEn.trim() },
        address: address.trim() || undefined,
      });
      toast(o.isActive ? "Outlet created" : "Outlet created (disabled — enable it in the outlet card)");
      router.push(`/admin/outlets/${o.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error", "warn");
    } finally { setSaving(false); }
  };

  return (
    <>
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">All outlets</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="admin-meta">Total {total}, active {rows.filter((o) => o.isActive).length}</span>
            <button className="admin-btn primary sm" onClick={() => setOpen(true)}>+ New outlet</button>
          </div>
        </div>
        <div className="admin-tablewrap"><table className="admin-table">
          <thead>
            <tr><th>Outlet</th><th>Address</th><th>Status</th><th>Drinks today</th><th>Active</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const st = STATUS_PILL[o.status];
              return (
                <tr key={o.id} className={`admin-row-link ${o.isActive ? "" : "muted"}`}
                    style={{ cursor: "pointer" }} onClick={() => router.push(`/admin/outlets/${o.id}`)}>
                  <td>
                    <strong>{oName(o.name)}</strong>
                    <div className="admin-meta admin-mono">{o.slug}</div>
                  </td>
                  <td className="admin-meta">{o.address || "—"}{o.emirate ? `, ${o.emirate}` : ""}</td>
                  <td><span className={`admin-pill ${st.cls}`}>{st.label}</span></td>
                  <td className="admin-num">
                    {o.drinksToday}
                    {o.dailyDrinkLimit != null && (
                      <span style={{ color: "#8A8F9C", fontWeight: 500 }}> / {o.dailyDrinkLimit}</span>
                    )}
                  </td>
                  <td>
                    {o.isActive
                      ? <span className="admin-pill accent">yes</span>
                      : <span className="admin-pill danger">no</span>}
                  </td>
                  <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                    <button className="admin-btn sm" onClick={() => router.push(`/admin/outlets/${o.id}`)}>Open</button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="admin-meta" style={{ padding: 16 }}>
                {loading ? "Loading…" : "No outlets"}</td></tr>
            )}
          </tbody>
        </table></div>
        <Pager total={total} limit={limit} offset={offset} loading={loading}
               onOffset={setOffset} onLimit={setLimit} />
      </div>

      <Modal open={open} title="New outlet"
             subtitle="A name is the minimum. Everything else (hours, coordinates, menu, staff) lives in the outlet card."
             onClose={() => setOpen(false)}
             onSubmit={create}
             submitDisabled={saving || !nameEn.trim()}
             submitLabel={saving ? "Creating…" : "Create"}>
        <div className="admin-field">
          <label className="admin-label">Name (EN) *</label>
          <input className="admin-input" autoFocus value={nameEn}
                 onChange={(e) => setNameEn(e.target.value)} placeholder="e.g. Marina" />
        </div>
        <div className="admin-field">
          <label className="admin-label">Address</label>
          <input className="admin-input" value={address}
                 onChange={(e) => setAddress(e.target.value)} placeholder="Dubai Marina, ..." />
        </div>
        <p className="admin-meta">
          A second outlet is created disabled. You can enable it in the outlet card.
        </p>
      </Modal>
    </>
  );
}

export default function OutletsPage() {
  return (
    <AdminShell title="Outlets" crumbs={[{ label: "Network" }, { label: "Outlets" }]}>
      <OutletsInner />
    </AdminShell>
  );
}
