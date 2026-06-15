"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { Toggle, useToast } from "@/components/admin/AdminUI";
import { Stat } from "@/components/admin/Stat";
import { adminApi, outletApi, ADMIN_STATUS_LABEL,
  type Staff, type AdminOrder, type AdminOutlet, type I18n, type ManagerStats } from "@/lib/adminApi";

const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// метрики сотрудника + календарь смен (дни, когда вёл заказы)
function StaffStats({ staffId }: { staffId: number }) {
  const [stats, setStats] = useState<ManagerStats | null>(null);
  const [monthOffset, setMonthOffset] = useState(0); // 0 = текущий месяц, -1 = предыдущий

  useEffect(() => { adminApi.managerStats(staffId).then(setStats).catch(() => {}); }, [staffId]);

  if (!stats) return (
    <div className="admin-panel"><div className="admin-panel-body admin-meta">Loading metrics…</div></div>
  );

  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = base.getFullYear(), month = base.getMonth();
  const monthName = base.toLocaleString("en-GB", { month: "long", year: "numeric" });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Пн = 0
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const key = (d: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const maxCount = Math.max(1, ...Object.values(stats.perDay));

  return (
    <div className="admin-panel">
      <div className="admin-panel-head"><div className="admin-panel-title">Staff activity</div></div>
      <div className="admin-panel-body">
        <div className="admin-grid-3" style={{ marginBottom: 16 }}>
          <Stat label="Orders handled" value={stats.ordersHandled} />
          <Stat label="Today" value={stats.ordersToday} />
          <Stat label={`Shifts in ${stats.windowDays} d`} value={stats.activeDays} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <button className="admin-btn ghost sm" onClick={() => setMonthOffset((o) => o - 1)}>←</button>
          <strong style={{ textTransform: "capitalize" }}>{monthName}</strong>
          <button className="admin-btn ghost sm" disabled={monthOffset >= 0}
                  onClick={() => setMonthOffset((o) => Math.min(0, o + 1))}>→</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
          {WD.map((d) => <div key={d} className="admin-meta" style={{ textAlign: "center", fontSize: 11 }}>{d}</div>)}
          {cells.map((d, i) => {
            if (d === null) return <div key={`e${i}`} />;
            const c = stats.perDay[key(d)] ?? 0;
            const worked = c > 0;
            const isFuture = new Date(year, month, d) > now;
            const intensity = worked ? 0.28 + 0.6 * (c / maxCount) : 0;
            return (
              <div key={d} title={worked ? `${c} order(s)` : isFuture ? "" : "day off"}
                   style={{ aspectRatio: "1", borderRadius: 8, display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700,
                            background: worked ? `rgba(74,86,226,${intensity})` : isFuture ? "transparent" : "#F1F2F5",
                            color: worked && intensity > 0.55 ? "#FFF" : "#5A6172",
                            border: isFuture ? "1px dashed #E5E7EB" : "none" }}>
                <span>{d}</span>
                {worked && <span style={{ fontSize: 10, opacity: 0.9 }}>{c}</span>}
              </div>
            );
          })}
        </div>
        <div className="admin-meta" style={{ marginTop: 10 }}>
          Highlighted days are when the staff member took/handled orders (the number shows how many). Time — {stats.tz}.
          Logins aren’t tracked — this is activity by orders.
        </div>
      </div>
    </div>
  );
}

const oName = (n: I18n) => n.en ?? n.ru ?? n.ar ?? "—";

const fmt = (s?: string) =>
  s ? new Date(/[Z+]/.test(s) ? s : s + "Z").toLocaleString("en-GB",
    { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

function Inner({ id }: { id: number }) {
  const router = useRouter();
  const toast = useToast();
  const [me, setMe] = useState<Staff | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);

  // черновик формы редактирования
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [role, setRole] = useState("manager");
  const [disabled, setDisabled] = useState(false);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [outlets, setOutlets] = useState<AdminOutlet[]>([]);
  const [outletIds, setOutletIds] = useState<number[]>([]);

  const fill = (s: Staff) => {
    setStaff(s);
    setName(s.name); setEmail(s.email); setPhone(s.phone ?? "");
    setNote(s.note ?? ""); setRole(s.role); setDisabled(s.disabled); setPassword("");
    setOutletIds(s.outletIds ?? []);
  };

  useEffect(() => {
    adminApi.me().then(setMe).catch(() => {});
    outletApi.list(true).then(setOutlets).catch(() => {});
    adminApi.managers()
      .then((list) => {
        const s = list.find((x) => x.id === id);
        if (s) fill(s); else setNotFound(true);
      })
      .catch(() => setNotFound(true));
    adminApi.orders({ managerId: id }).then(setOrders).catch(() => setOrders([]));
  }, [id]);

  if (notFound) return <div className="admin-meta">Staff member not found</div>;
  if (!staff) return <div className="admin-meta">Loading…</div>;

  const canEdit = me?.role === "super_admin";
  const isSelf = me?.id === staff.id;
  const initials = (name || staff.name).split(/\s+/).filter(Boolean)
    .slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  const sortedIds = (a: number[]) => [...a].sort((x, y) => x - y);
  const outletsDirty = JSON.stringify(sortedIds(outletIds)) !== JSON.stringify(sortedIds(staff.outletIds ?? []));

  const dirty = canEdit && (
    name !== staff.name || email !== staff.email || (phone || "") !== (staff.phone ?? "")
    || (note || "") !== (staff.note ?? "") || role !== staff.role
    || disabled !== staff.disabled || password.length > 0 || outletsDirty);

  // экрану выдачи — ровно одна точка; супер-админу точки не нужны
  const onRole = (r: string) => {
    setRole(r);
    if (r === "super_admin") setOutletIds([]);
    else if (r === "screen") setOutletIds((arr) => arr.slice(0, 1));
  };
  const toggleOutlet = (oid: number) => {
    if (role === "screen") { setOutletIds([oid]); return; }
    setOutletIds((arr) => arr.includes(oid) ? arr.filter((x) => x !== oid) : [...arr, oid]);
  };

  const save = async () => {
    if (!name.trim()) { toast("Enter first and last name", "warn"); return; }
    if (password && password.length < 6) { toast("Password — at least 6 characters", "warn"); return; }
    setSaving(true);
    try {
      const upd = await adminApi.updateManager(staff.id, {
        name: name.trim(), email: email.trim(), role,
        phone: phone.trim() || null, note: note.trim() || null, disabled,
        ...(password ? { password } : {}),
        ...(role !== "super_admin" ? { outletIds } : {}),
      });
      fill(upd);
      toast("Staff details saved");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      const human: Record<string, string> = {
        EMAIL_TAKEN: "Email already used by another staff member",
        CANNOT_DEMOTE_SELF: "You can’t remove super admin rights from yourself",
        CANNOT_DISABLE_SELF: "You can’t disable your own account",
        PASSWORD_TOO_SHORT: "Password — at least 6 characters",
        OUTLET_REQUIRED: "Select at least one outlet",
        OUTLET_SCOPE_INVALID: "Invalid set of outlets for this role",
      };
      toast(human[msg] ?? msg, "warn");
    } finally { setSaving(false); }
  };

  const fieldLabel = (t: string) => <label className="admin-label">{t}</label>;

  return (
    <div className="admin-split" style={{ display: "grid", gridTemplateColumns: "1fr 1.7fr", gap: 16, alignItems: "start" }}>
      {/* профиль / редактор */}
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">{canEdit ? "Staff card" : "Staff profile"}</div>
          {canEdit && <span className="admin-meta">editing</span>}
        </div>
        <div className="admin-panel-body">
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
            <div className="admin-user" style={{ width: 54, height: 54, fontSize: 18 }}>{initials || "—"}</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{name || "—"}</div>
              <span className="admin-pill" style={{ marginTop: 4,
                     background: role === "super_admin" ? "#EFE6F0" : role === "screen" ? "#E6F0FA" : "#EEF0F4",
                     color: role === "super_admin" ? "#4A56E2" : role === "screen" ? "#2A43C2" : "#4B5563", fontWeight: 700 }}>
                {role === "super_admin" ? "Super admin" : role === "screen" ? "Pickup screen" : "Manager"}
              </span>
              {note && <span className="admin-meta" style={{ marginLeft: 8 }}>{note}</span>}
            </div>
          </div>

          {canEdit ? (
            <>
              <div className="admin-field">{fieldLabel("First and last name")}
                <input className="admin-input" value={name} onChange={(e) => setName(e.target.value)}
                       placeholder="John Smith" /></div>
              <div className="admin-field">{fieldLabel("Title / note")}
                <input className="admin-input" value={note} onChange={(e) => setNote(e.target.value)}
                       placeholder="Barista · shift A · Marina outlet" /></div>
              <div className="admin-field">{fieldLabel("Phone")}
                <input className="admin-input mono" value={phone} onChange={(e) => setPhone(e.target.value)}
                       placeholder="+971 50 000 0000" /></div>
              <div className="admin-field">{fieldLabel("Email (login)")}
                <input className="admin-input mono" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="admin-field">{fieldLabel("Role")}
                <div style={{ display: "inline-flex", gap: 2, padding: 3, background: "#F5EFE7", borderRadius: 999 }}>
                  {([["manager", "Manager"], ["super_admin", "Super admin"], ["screen", "Pickup screen"]] as const).map(([r, lbl]) => (
                    <button key={r} className="admin-btn sm"
                            disabled={isSelf && r !== "super_admin"}
                            onClick={() => onRole(r)}
                            style={role === r ? { background: "#4A56E2", color: "#FFF" } : { background: "transparent" }}>
                      {lbl}
                    </button>
                  ))}
                </div>
                {isSelf && <span className="admin-meta" style={{ marginLeft: 8 }}>you can’t demote yourself</span>}
              </div>
              {role !== "super_admin" && (
                <div className="admin-field">{fieldLabel(role === "screen" ? "Outlet (exactly one)" : "Staff outlets")}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {outlets.map((o) => {
                      const on = outletIds.includes(o.id);
                      return (
                        <button key={o.id} type="button" className="admin-btn sm" onClick={() => toggleOutlet(o.id)}
                                style={on ? { background: "#4A56E2", color: "#FFF" } : undefined}>
                          {oName(o.name)}
                        </button>
                      );
                    })}
                    {outlets.length === 0 && <span className="admin-meta">No active outlets</span>}
                  </div>
                  <span className="admin-meta" style={{ marginTop: 6, display: "block" }}>
                    {role === "screen"
                      ? "A pickup screen account is tied to exactly one outlet."
                      : "Multiple allowed. Empty — the staff member is on the only active outlet."}
                  </span>
                </div>
              )}
              <div className="admin-field">{fieldLabel("Admin access")}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Toggle defaultOn={!disabled} disabled={isSelf}
                          onChange={(v) => setDisabled(!v)} />
                  <span className="admin-meta">{disabled ? "disabled — login blocked" : "active"}</span>
                </div>
              </div>
              <div className="admin-field">{fieldLabel("New password (optional)")}
                <input className="admin-input mono" type="text" value={password}
                       onChange={(e) => setPassword(e.target.value)} placeholder="leave empty — no change" /></div>

              <button className="admin-btn primary" style={{ marginTop: 4 }}
                      onClick={save} disabled={!dirty || saving}>
                {saving ? "Saving…" : "Save"}
              </button>
              {dirty && !saving && <span className="admin-meta" style={{ marginLeft: 10 }}>● unsaved changes</span>}
            </>
          ) : (
            <>
              <div className="admin-field">{fieldLabel("Email")}
                <a href={`mailto:${staff.email}`} className="admin-mono"
                   style={{ color: "var(--a-accent)", textDecoration: "none", fontWeight: 600 }}>{staff.email}</a></div>
              {staff.phone && <div className="admin-field">{fieldLabel("Phone")}
                <div className="admin-mono">{staff.phone}</div></div>}
              {staff.note && <div className="admin-field">{fieldLabel("Title / note")}
                <div>{staff.note}</div></div>}
              <div className="admin-field">{fieldLabel("Access status")}
                <span className="admin-pill" style={staff.disabled
                  ? { background: "#FCEAEA", color: "#DC2626", fontWeight: 700 }
                  : { background: "#DDEDE0", color: "#166534", fontWeight: 700 }}>
                  {staff.disabled ? "disabled" : "active"}
                </span></div>
              {staff.role !== "super_admin" && (
                <div className="admin-field">{fieldLabel("Outlets")}
                  {(staff.outletIds ?? []).length === 0
                    ? <span className="admin-meta">not attached</span>
                    : <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {(staff.outletIds ?? []).map((oid) => (
                          <span key={oid} className="admin-pill accent">
                            {outlets.find((o) => o.id === oid) ? oName(outlets.find((o) => o.id === oid)!.name) : `#${oid}`}
                          </span>
                        ))}
                      </div>}
                </div>
              )}
            </>
          )}
          <div className="admin-field" style={{ marginTop: 12 }}>{fieldLabel("ID")}
            <div className="admin-mono admin-meta">#{staff.id}</div></div>
        </div>
      </div>

      {/* метрики + календарь смен + заказы, которые сотрудник вёл */}
      <div style={{ display: "grid", gap: 16 }}>
      {staff.role !== "super_admin" && <StaffStats staffId={staff.id} />}
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">Orders by this staff member</div>
          <span className="admin-meta">{orders ? `${orders.length} pcs` : "…"}</span>
        </div>
        <div className="admin-tablewrap"><table className="admin-table">
          <thead><tr><th>#</th><th>Status</th><th>Amount</th><th>Created</th></tr></thead>
          <tbody>
            {orders === null ? (
              <tr><td colSpan={4} className="admin-meta" style={{ padding: 16 }}>Loading…</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={4} className="admin-meta" style={{ padding: 16 }}>No orders handled yet</td></tr>
            ) : orders.map((o) => (
              <tr key={o.id} className="admin-row-link" style={{ cursor: "pointer" }}
                  onClick={() => router.push(`/admin/orders/${o.id}`)}>
                <td><strong>#{o.number}</strong></td>
                <td><span className={`admin-badge ${o.status}`}>{ADMIN_STATUS_LABEL[o.status]}</span></td>
                <td className="admin-num">{o.total.toFixed(2)}</td>
                <td className="admin-meta">{fmt(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
      </div>
    </div>
  );
}

export default function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AdminShell title="Staff member"
                crumbs={[{ label: "Staff", href: "/admin/staff" }, { label: `#${id}` }]}>
      <Inner id={Number(id)} />
    </AdminShell>
  );
}
