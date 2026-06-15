"use client";

import { useEffect, useState } from "react";
import { outletApi, type OutletEventRow } from "@/lib/adminApi";
import { eventDetail, EVENT_LABEL, fmt } from "@/lib/outlets/format";

/* ---------------- AUDIT ---------------- */
export function OutletAuditTab({ outletId }: { outletId: number }) {
  const [events, setEvents] = useState<OutletEventRow[] | null>(null);
  useEffect(() => { outletApi.events(outletId).then(setEvents).catch(() => setEvents([])); }, [outletId]);

  return (
    <div className="admin-panel">
      <div className="admin-panel-head"><div className="admin-panel-title">Change history</div></div>
      <div className="admin-tablewrap"><table className="admin-table">
        <thead><tr><th>Event</th><th>Details</th><th>By</th><th>When</th></tr></thead>
        <tbody>
          {events === null ? (
            <tr><td colSpan={4} className="admin-meta" style={{ padding: 16 }}>Loading…</td></tr>
          ) : events.length === 0 ? (
            <tr><td colSpan={4} className="admin-meta" style={{ padding: 16 }}>No events</td></tr>
          ) : events.map((ev) => (
            <tr key={ev.id}>
              <td><strong>{EVENT_LABEL[ev.type] ?? ev.type}</strong></td>
              <td className="admin-meta">{eventDetail(ev) || "—"}</td>
              <td className="admin-meta">{ev.byStaffName ?? "system"}</td>
              <td className="admin-meta">{fmt(ev.at)}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}
