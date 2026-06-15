"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell, useAdmin } from "@/components/admin/AdminShell";
import { adminOrdersWs, outletApi, type AdminOutlet } from "@/lib/adminApi";
import { useLiveReload } from "@/lib/useLiveReload";
import { TAB_LABEL, type Tab } from "@/lib/outlets/format";
import { OutletStatusBanner } from "@/components/admin/outlets/OutletStatusBanner";
import { OutletMainTab } from "@/components/admin/outlets/OutletMainTab";
import { OutletHoursTab } from "@/components/admin/outlets/OutletHoursTab";
import { OutletStaffTab } from "@/components/admin/outlets/OutletStaffTab";
import { OutletMenuTab } from "@/components/admin/outlets/OutletMenuTab";
import { OutletAuditTab } from "@/components/admin/outlets/OutletAuditTab";

function Inner({ id }: { id: number }) {
  const { staff } = useAdmin();
  const [outlet, setOutlet] = useState<AdminOutlet | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>("main");

  const reload = useCallback(() => {
    outletApi.get(id).then(setOutlet).catch(() => setNotFound(true));
  }, [id]);
  useEffect(() => { reload(); }, [reload]);

  // realtime: счётчик «напитков сегодня», статус и авто-пауза обновляются по событиям заказов
  // этой точки (оплата/смена статуса) — без поллинга и кнопки «Обновить»
  useLiveReload({
    connect: adminOrdersWs,
    onMessage: (m) => {
      const e = m as { outletId?: number | null };
      if (e?.outletId == null || e.outletId === id) reload();
    },
    onSync: reload,
  });

  if (staff?.role !== "super_admin")
    return <div className="admin-panel"><div className="admin-panel-body admin-meta">
      This section is available to super admins only.</div></div>;
  if (notFound) return <div className="admin-meta">Outlet not found</div>;
  if (!outlet) return <div className="admin-meta">Loading…</div>;

  return (
    <>
      <OutletStatusBanner outlet={outlet} onSaved={setOutlet} onGotoTab={setTab} />

      <div className="admin-tabs">
        {(["main", "hours", "staff", "menu", "audit"] as Tab[]).map((t) => (
          <button key={t} className="admin-tab" data-active={tab === t} onClick={() => setTab(t)}>
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === "main" && <OutletMainTab outlet={outlet} onSaved={setOutlet} />}
      {tab === "hours" && <OutletHoursTab outlet={outlet} onSaved={setOutlet} />}
      {tab === "staff" && <OutletStaffTab outlet={outlet} onChanged={setOutlet} />}
      {tab === "menu" && <OutletMenuTab outletId={id} />}
      {tab === "audit" && <OutletAuditTab outletId={id} />}
    </>
  );
}

export default function OutletDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const numId = Number(id);
  const crumbs = useMemo(
    () => [{ label: "Network" }, { label: "Outlets", href: "/admin/outlets" }, { label: `#${id}` }],
    [id],
  );
  return (
    <AdminShell title="Outlet" crumbs={crumbs}>
      <Inner id={numId} />
    </AdminShell>
  );
}
