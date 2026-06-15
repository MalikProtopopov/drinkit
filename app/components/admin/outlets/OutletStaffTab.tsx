"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, useToast } from "@/components/admin/AdminUI";
import { adminApi, outletApi, type AdminOutlet, type Staff } from "@/lib/adminApi";
import { ERR_HUMAN, ROLE_LABEL } from "@/lib/outlets/format";

/* ---------------- STAFF ---------------- */
export function OutletStaffTab({ outlet, onChanged }: { outlet: AdminOutlet; onChanged: (o: AdminOutlet) => void }) {
  const router = useRouter();
  const toast = useToast();
  const [attachOpen, setAttachOpen] = useState(false);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [query, setQuery] = useState("");
  const managers = outlet.managers ?? [];
  const attachedIds = new Set(managers.map((m) => m.id));

  // подгружаем сотрудников при каждом открытии — чтобы видеть и только что созданных.
  // loadingStaff включаем в обработчике открытия (не синхронно в эффекте — иначе каскадный ререндер)
  useEffect(() => {
    if (!attachOpen) return;
    adminApi.managers()
      .then(setAllStaff)
      .catch(() => toast("Failed to load staff", "warn"))
      .finally(() => setLoadingStaff(false));
  }, [attachOpen, toast]);

  const q = query.trim().toLowerCase();
  // супер-админ не скоупится по точкам → в список не попадает; уже привязанных не показываем
  const candidates = allStaff
    .filter((s) => s.role !== "super_admin" && !attachedIds.has(s.id))
    .filter((s) => !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
    .slice(0, 12);

  const attach = async (staffId: number) => {
    try {
      const o = await outletApi.attachStaff(outlet.id, staffId);
      onChanged(o); setAttachOpen(false); setQuery("");
      toast("Staff attached");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      toast(ERR_HUMAN[msg] ?? msg, "warn");
    }
  };

  const detach = async (staffId: number) => {
    try {
      const o = await outletApi.detachStaff(outlet.id, staffId);
      onChanged(o);
      toast("Staff detached", "warn");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      toast(ERR_HUMAN[msg] ?? msg, "warn");
    }
  };

  return (
    <>
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">Staff at this outlet</div>
          <button className="admin-btn primary sm"
                  onClick={() => { setLoadingStaff(true); setAttachOpen(true); }}>+ Attach</button>
        </div>
        <div className="admin-tablewrap"><table className="admin-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Primary</th><th></th></tr></thead>
          <tbody>
            {managers.map((m) => (
              <tr key={m.id} className={m.disabled ? "muted" : ""}>
                <td><strong>{m.name}</strong></td>
                <td className="admin-mono admin-meta">{m.email}</td>
                <td><span className="admin-pill accent">{ROLE_LABEL[m.role] ?? m.role}</span></td>
                <td>{m.isPrimary ? <span className="admin-pill accent">yes</span> : <span className="admin-meta">—</span>}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="admin-btn ghost sm" onClick={() => router.push(`/admin/staff/${m.id}`)}>Staff card</button>
                  <button className="admin-btn ghost sm" style={{ color: "#A12822", marginLeft: 6 }}
                          onClick={() => detach(m.id)}>Detach</button>
                </td>
              </tr>
            ))}
            {managers.length === 0 && (
              <tr><td colSpan={5} className="admin-meta" style={{ padding: 16 }}>No one attached</td></tr>
            )}
          </tbody>
        </table></div>
      </div>

      <Modal open={attachOpen} title="Attach staff"
             subtitle="Start typing a name or email — pick from the list"
             onClose={() => { setAttachOpen(false); setQuery(""); }}>
        <div className="admin-field">
          <input className="admin-input" autoFocus placeholder="Name or email…"
                 value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto" }}>
          {candidates.map((s) => (
            <button key={s.id} type="button" onClick={() => attach(s.id)} className="admin-btn ghost"
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                             gap: 10, textAlign: "left", width: "100%", padding: "10px 12px" }}>
              <span style={{ minWidth: 0 }}>
                <strong>{s.name}</strong>
                <span className="admin-meta admin-mono" style={{ display: "block" }}>{s.email}</span>
              </span>
              <span className="admin-pill accent" style={{ flex: "none" }}>{ROLE_LABEL[s.role] ?? s.role}</span>
            </button>
          ))}
          {candidates.length === 0 && (
            <span className="admin-meta" style={{ padding: "8px 2px" }}>
              {loadingStaff ? "Loading…"
                : allStaff.length === 0 ? "No staff yet — create one in the “Staff” section."
                : q ? "Nothing found."
                : "All eligible staff are already attached. Super admins aren't attached — they see all outlets."}
            </span>
          )}
        </div>
      </Modal>
    </>
  );
}
