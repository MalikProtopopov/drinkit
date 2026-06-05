"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { useToast } from "@/components/admin/AdminUI";
import { adminApi } from "@/lib/adminApi";

function CouponsInner() {
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const load = useCallback(() => { adminApi.coupons().then(setRows).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="admin-panel">
      <table className="admin-table">
        <thead>
          <tr>
            <th>№</th><th>Клиент</th><th>Выдан по заказу</th><th>Статус</th>
            <th>Использован</th><th>Списано</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td className="admin-num">{c.id}</td>
              <td className="admin-num">user #{c.userId}</td>
              <td>
                <Link href={`/admin/orders/${c.sourceOrderId}`} style={{ color: "#0E0E10", fontWeight: 600 }}>
                  заказ {c.sourceOrderId}
                </Link>{" "}
                <span className="admin-meta">👎 {c.issuedAt ? new Date(c.issuedAt).toLocaleDateString("ru-RU") : ""}</span>
              </td>
              <td>
                <span className={`admin-pill ${c.status === "active" ? "accent" : c.status === "void" ? "danger" : ""}`}>
                  {c.status}
                </span>
              </td>
              <td>
                {c.usedOrderId ? (
                  <Link href={`/admin/orders/${c.usedOrderId}`} style={{ color: "#0E0E10" }}>
                    заказ {c.usedOrderId} · позиция {c.usedItemId}
                  </Link>
                ) : <span className="admin-meta">—</span>}
              </td>
              <td className="admin-num">{c.discountAmount != null ? `${c.discountAmount.toFixed(0)} AED` : "—"}</td>
              <td style={{ textAlign: "right" }}>
                {c.status === "active" && (
                  <button className="admin-btn ghost sm" style={{ color: "#A12822" }}
                          onClick={() => adminApi.voidCoupon(c.id).then(() => { load(); toast("Купон аннулирован", "warn"); })}>
                    Аннулировать
                  </button>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: "#5A6172" }}>
              Купонов пока нет — они выдаются автоматически за оценку 👎
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function CouponsPage() {
  return (
    <AdminShell title="Купоны" crumbs={[{ label: "Купоны" }]}>
      <CouponsInner />
    </AdminShell>
  );
}
