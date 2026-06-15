"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { Pager } from "@/components/admin/AdminUI";
import { adminApi } from "@/lib/adminApi";
import { usePaged } from "@/lib/usePaged";

type SortKey = "id" | "name" | "orders" | "spent" | "registered" | "lastOrder";

// сортируемый заголовок колонки (на уровне модуля — не создаём компонент в рендере)
function SortableTh({ k, label, num, sort, dir, onToggle }: {
  k: SortKey; label: string; num?: boolean;
  sort: SortKey; dir: "asc" | "desc"; onToggle: (k: SortKey) => void;
}) {
  const active = k === sort;
  return (
    <th onClick={() => onToggle(k)} style={{ cursor: "pointer", userSelect: "none",
        textAlign: num ? "right" : "left", color: active ? "var(--a-accent)" : undefined }}>
      {label}{active ? (dir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );
}

export default function CustomersPage() {
  const router = useRouter();
  const [sort, setSort] = useState<SortKey>("registered");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const fetcher = useCallback(
    (p: { limit: number; offset: number }) => adminApi.customersPaged({ ...p, sort, dir }),
    [sort, dir],
  );
  const { items: rows, total, limit, offset, loading, setOffset, setLimit } =
    usePaged<any>(fetcher, [sort, dir], 20);

  // клик по заголовку: та же колонка — переключаем направление, иначе новая колонка (числа/даты — по убыванию)
  const toggle = (key: SortKey) => {
    if (key === sort) { setDir((d) => (d === "asc" ? "desc" : "asc")); return; }
    setSort(key);
    setDir(key === "name" ? "asc" : "desc");
  };

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
            <tr>
              <SortableTh k="id" label="ID" num sort={sort} dir={dir} onToggle={toggle} />
              <SortableTh k="name" label="Name" sort={sort} dir={dir} onToggle={toggle} />
              <th>Phone</th><th>Car</th><th>Language</th>
              <SortableTh k="orders" label="Orders" num sort={sort} dir={dir} onToggle={toggle} />
              <SortableTh k="spent" label="Total spent" num sort={sort} dir={dir} onToggle={toggle} />
              <SortableTh k="lastOrder" label="Last order" sort={sort} dir={dir} onToggle={toggle} />
              <SortableTh k="registered" label="Registered" sort={sort} dir={dir} onToggle={toggle} />
            </tr>
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
                <td className="admin-num">{u.orders ?? 0}</td>
                <td className="admin-num">{(u.spent ?? 0).toFixed(2)}</td>
                <td className="admin-meta">{u.lastOrderAt ? new Date(u.lastOrderAt).toLocaleDateString("en-GB") : "—"}</td>
                <td className="admin-meta">{u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-GB") : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="admin-meta" style={{ padding: 16 }}>
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
