"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminApi } from "@/lib/adminApi";

export default function PaymentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { adminApi.payments().then(setRows).catch(() => {}); }, []);

  return (
    <AdminShell title="Платежи" crumbs={[{ label: "Платежи" }]}>
      <div className="admin-panel">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th><th>Заказ</th><th>Клиент</th><th>Сумма</th>
              <th>Провайдер</th><th>Статус</th><th>Когда</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="admin-num">{p.id}</td>
                <td>
                  <Link href={`/admin/orders/${p.orderId}`}
                        style={{ fontWeight: 700, color: "#0E0E10", textDecoration: "none" }}>
                    #{p.orderNumber}
                  </Link>
                </td>
                <td className="admin-mono admin-meta">{p.customerPhone}</td>
                <td className="admin-num">{p.amount.toFixed(2)} {p.currency}</td>
                <td>
                  <span className="admin-pill">{p.provider}</span>{" "}
                  <span className="admin-mono admin-meta">{p.providerId}</span>
                </td>
                <td>
                  <span className={`admin-pill ${p.status === "succeeded" ? "accent" : p.status === "refunded" ? "danger" : ""}`}>
                    {p.status}
                  </span>
                </td>
                <td className="admin-meta">{p.createdAt ? new Date(p.createdAt).toLocaleString("ru-RU") : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "#5A6172" }}>Платежей нет</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
