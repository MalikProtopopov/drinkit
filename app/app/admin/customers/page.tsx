"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { Pager } from "@/components/admin/AdminUI";
import { adminApi } from "@/lib/adminApi";
import { usePaged } from "@/lib/usePaged";

export default function CustomersPage() {
  const router = useRouter();
  const fetcher = useCallback((p: { limit: number; offset: number }) => adminApi.customersPaged(p), []);
  const { items: rows, total, limit, offset, loading, setOffset, setLimit } =
    usePaged<any>(fetcher, [], 20);

  return (
    <AdminShell title="Customers" crumbs={[{ label: "Customers" }]}>
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">All customers</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="admin-meta">Total {total}</span>
            <button className="admin-btn primary sm" onClick={() => router.push("/admin/customers/new")}>
              + New customer
            </button>
          </div>
        </div>
        <div className="admin-tablewrap"><table className="admin-table">
          <thead>
            <tr><th>ID</th><th>Name</th><th>Phone</th><th>Car</th><th>Language</th><th>Registered</th></tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="admin-row-link" style={{ cursor: "pointer" }}
                  onClick={() => router.push(`/admin/customers/${u.id}`)}>
                <td className="admin-num">{u.id}</td>
                <td><strong>{u.name ?? "—"}</strong></td>
                <td className="admin-mono">{u.phone}</td>
                <td className="admin-mono">{u.carPlate ?? "—"}</td>
                <td><span className="admin-pill">{u.locale}</span></td>
                <td className="admin-meta">{u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-GB") : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="admin-meta" style={{ padding: 16 }}>
                {loading ? "Loading…" : "No customers"}</td></tr>
            )}
          </tbody>
        </table></div>
        <Pager total={total} limit={limit} offset={offset} loading={loading}
               onOffset={setOffset} onLimit={setLimit} />
      </div>
    </AdminShell>
  );
}
