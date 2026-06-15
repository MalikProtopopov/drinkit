"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell, useAdmin } from "@/components/admin/AdminShell";
import { Stat } from "@/components/admin/Stat";
import { adminApi, type ManagerStats } from "@/lib/adminApi";
import { api, type ApiOutlet } from "@/lib/api";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin", manager: "Manager", screen: "Pickup screen",
};
const ROLE_HINT: Record<string, string> = {
  super_admin: "Full access to all outlets and settings.",
  manager: "Orders for your outlet, working the shift.",
  screen: "Pickup board for a single outlet.",
};

function Inner() {
  const { staff, logout } = useAdmin();
  const [stats, setStats] = useState<ManagerStats | null>(null);
  const [outlets, setOutlets] = useState<ApiOutlet[]>([]);

  useEffect(() => {
    adminApi.meStats().then(setStats).catch(() => {});
    api.outlets("en").then(setOutlets).catch(() => {});  // публичный список — для названий точек
  }, []);

  if (!staff) return null;

  const initials = staff.name.split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]).join("").toUpperCase() || "—";
  const myOutlets = (staff.outletIds ?? []).map((id) => {
    const o = outlets.find((x) => x.id === id);
    return o ? { name: o.name, address: o.address } : { name: `Outlet #${id}`, address: null };
  });

  return (
    <div className="admin-split" style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr",
           gap: 16, alignItems: "start" }}>
      {/* профиль + выход */}
      <div className="admin-panel">
        <div className="admin-panel-body">
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <span className="admin-user" style={{ width: 56, height: 56, fontSize: 19 }}>{initials}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.1 }}>{staff.name}</div>
              <span className="admin-pill" style={{ marginTop: 6, display: "inline-block",
                     background: staff.role === "super_admin" ? "#EFE6F0" : staff.role === "screen" ? "#E6F0FA" : "#EEF0F4",
                     color: staff.role === "super_admin" ? "#4A56E2" : staff.role === "screen" ? "#2A43C2" : "#4B5563",
                     fontWeight: 700 }}>
                {ROLE_LABEL[staff.role] ?? staff.role}
              </span>
            </div>
          </div>
          <div className="admin-meta" style={{ marginBottom: 16 }}>{ROLE_HINT[staff.role] ?? ""}</div>

          <div className="admin-field">
            <label className="admin-label">Email (login)</label>
            <div className="admin-mono">{staff.email}</div>
          </div>
          {staff.phone && (
            <div className="admin-field">
              <label className="admin-label">Phone</label>
              <div className="admin-mono">{staff.phone}</div>
            </div>
          )}
          {staff.note && (
            <div className="admin-field">
              <label className="admin-label">Title / note</label>
              <div>{staff.note}</div>
            </div>
          )}

          {staff.role !== "super_admin" && (
            <div className="admin-field">
              <label className="admin-label">My outlets</label>
              {myOutlets.length === 0 ? (
                <span className="admin-meta">no outlet assigned — contact a super admin</span>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {myOutlets.map((o, i) => (
                    <div key={i} className="admin-pill accent" style={{ alignSelf: "flex-start" }}>
                      📍 {o.name}{o.address ? ` · ${o.address}` : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button className="admin-btn danger" onClick={logout}
                  style={{ width: "100%", marginTop: 18 }}>
            Log out
          </button>
        </div>
      </div>

      {/* работа: метрики + быстрые действия */}
      <div style={{ display: "grid", gap: 16 }}>
        <div className="admin-grid-3">
          <Stat label="Orders today" value={stats ? stats.ordersToday : "…"} />
          <Stat label="Total handled" value={stats ? stats.ordersHandled : "…"} />
          <Stat label={stats ? `Shifts in ${stats.windowDays} d` : "Shifts"} value={stats ? stats.activeDays : "…"} />
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head"><div className="admin-panel-title">Quick actions</div></div>
          <div className="admin-panel-body" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/admin/orders" className="admin-btn primary">Go to orders</Link>
            {staff.role === "super_admin" && (
              <>
                <Link href="/admin" className="admin-btn">Dashboard</Link>
                <Link href="/admin/outlets" className="admin-btn">Outlets</Link>
              </>
            )}
          </div>
          {staff.role === "manager" && (
            <div className="admin-panel-body" style={{ paddingTop: 0 }}>
              <span className="admin-meta">In the orders list you only see orders for your outlet.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AdminShell title="My account" crumbs={[{ label: "My account" }]}>
      <Inner />
    </AdminShell>
  );
}
