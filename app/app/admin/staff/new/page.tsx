"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { useToast } from "@/components/admin/AdminUI";
import { adminApi, outletApi, type AdminOutlet, type I18n } from "@/lib/adminApi";

const oName = (n: I18n) => n.en ?? n.ru ?? n.ar ?? "—";

// генерация читаемого временного пароля (буквы+цифры, без похожих символов)
function genPassword() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ", b = "abcdefghijkmnpqrstuvwxyz", d = "23456789";
  const pick = (s: string, n: number) => Array.from({ length: n },
    () => s[Math.floor(Math.random() * s.length)]).join("");
  return `${pick(a, 1)}${pick(b, 5)}${pick(d, 3)}`;
}

function NewStaffInner() {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("manager");
  const [password, setPassword] = useState(genPassword());
  const [showPass, setShowPass] = useState(true);
  const [saving, setSaving] = useState(false);
  const [outlets, setOutlets] = useState<AdminOutlet[]>([]);
  const [outletIds, setOutletIds] = useState<number[]>([]);

  useEffect(() => { outletApi.list(true).then(setOutlets).catch(() => {}); }, []);

  // экрану выдачи — ровно одна точка; менеджеру допускается несколько (пусто → бэк сам привяжет единственную активную)
  const toggleOutlet = (oid: number) => {
    if (role === "screen") { setOutletIds([oid]); return; }
    setOutletIds((arr) => arr.includes(oid) ? arr.filter((x) => x !== oid) : [...arr, oid]);
  };
  const onRole = (r: string) => {
    setRole(r);
    if (r === "super_admin") setOutletIds([]);
    else if (r === "screen") setOutletIds((arr) => arr.slice(0, 1));
  };

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const outletsOk = role === "super_admin" || role === "manager" || (role === "screen" && outletIds.length === 1);
  const valid = name.trim().length > 0 && emailOk && password.length >= 6 && outletsOk;

  const create = async () => {
    if (!valid) { toast("Fill in the name, a valid email and a password ≥ 6 characters", "warn"); return; }
    setSaving(true);
    try {
      const s = await adminApi.createManager({
        name: name.trim(), email: email.trim(), role, password,
        phone: phone.trim() || null, note: note.trim() || null,
        ...(role !== "super_admin" ? { outletIds } : {}),
      });
      toast("Staff member created");
      router.push(`/admin/staff/${s.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      const human: Record<string, string> = {
        EMAIL_TAKEN: "Email already used by another staff member",
        PASSWORD_TOO_SHORT: "Password — at least 6 characters",
        NAME_REQUIRED: "Enter first and last name",
        OUTLET_REQUIRED: "Select at least one outlet",
        OUTLET_SCOPE_INVALID: "Invalid set of outlets for this role",
      };
      toast(human[msg] ?? msg, "warn");
    } finally { setSaving(false); }
  };

  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <div className="admin-split" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, alignItems: "start" }}>
      {/* форма */}
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">Staff card</div>
          <span className="admin-meta">new admin access</span>
        </div>
        <div className="admin-panel-body">
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
            <div className="admin-user" style={{ width: 54, height: 54, fontSize: 18 }}>{initials || "—"}</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{name || "Staff member name"}</div>
              <span className="admin-pill" style={{ marginTop: 4,
                     background: role === "super_admin" ? "#EFE6F0" : role === "screen" ? "#E6F0FA" : "#EEF0F4",
                     color: role === "super_admin" ? "#4A56E2" : role === "screen" ? "#2A43C2" : "#4B5563", fontWeight: 700 }}>
                {role === "super_admin" ? "Super admin" : role === "screen" ? "Pickup screen" : "Manager"}
              </span>
            </div>
          </div>

          <div className="admin-grid-2">
            <div className="admin-field">
              <label className="admin-label">First and last name *</label>
              <input className="admin-input" autoFocus value={name}
                     onChange={(e) => setName(e.target.value)} placeholder="John Smith" />
            </div>
            <div className="admin-field">
              <label className="admin-label">Title / note</label>
              <input className="admin-input" value={note}
                     onChange={(e) => setNote(e.target.value)} placeholder="Barista · shift A · Marina" />
            </div>
          </div>

          <div className="admin-grid-2">
            <div className="admin-field">
              <label className="admin-label">Phone</label>
              <input className="admin-input mono" value={phone}
                     onChange={(e) => setPhone(e.target.value)} placeholder="+971 50 000 0000" />
            </div>
            <div className="admin-field">
              <label className="admin-label">Email (login) *</label>
              <input className="admin-input mono" type="email" value={email}
                     onChange={(e) => setEmail(e.target.value)} placeholder="name@juicy.ae"
                     style={email && !emailOk ? { borderColor: "#B45309", background: "#FFF7E5" } : undefined} />
            </div>
          </div>

          <div className="admin-field">
            <label className="admin-label">Role</label>
            <div style={{ display: "inline-flex", gap: 2, padding: 3, background: "#F5EFE7", borderRadius: 999 }}>
              {([["manager", "Manager"], ["super_admin", "Super admin"], ["screen", "Pickup screen"]] as const).map(([r, lbl]) => (
                <button key={r} className="admin-btn sm" onClick={() => onRole(r)}
                        style={role === r ? { background: "#4A56E2", color: "#FFF" } : { background: "transparent" }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {role !== "super_admin" && (
            <div className="admin-field">
              <label className="admin-label">
                {role === "screen" ? "Outlet (exactly one)" : "Staff outlets"}
              </label>
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
                  : "Multiple allowed. If you select none, the staff member will be tied to the only active outlet."}
              </span>
            </div>
          )}

          <div className="admin-field">
            <label className="admin-label">Password * (min. 6)</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input className="admin-input mono" type={showPass ? "text" : "password"} value={password}
                     onChange={(e) => setPassword(e.target.value)} style={{ flex: 1 }}
                     placeholder="at least 6 characters" />
              <button className="admin-btn sm" type="button" onClick={() => setShowPass((v) => !v)}>
                {showPass ? "Hide" : "Show"}
              </button>
              <button className="admin-btn sm" type="button" onClick={() => { setPassword(genPassword()); setShowPass(true); }}>
                Generate
              </button>
            </div>
            <span className="admin-meta">Share the password with the staff member — they can change it if needed.</span>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button className="admin-btn primary" onClick={create} disabled={!valid || saving}>
              {saving ? "Creating…" : "Create staff member"}
            </button>
            <button className="admin-btn" onClick={() => router.push("/admin/staff")}>Cancel</button>
          </div>
        </div>
      </div>

      {/* памятка по ролям */}
      <div className="admin-panel">
        <div className="admin-panel-head"><div className="admin-panel-title">Role guide</div></div>
        <div className="admin-panel-body">
          <div className="admin-field">
            <span className="admin-pill" style={{ background: "#EEF0F4", color: "#4B5563", fontWeight: 700 }}>Manager</span>
            <p className="admin-meta" style={{ marginTop: 8 }}>
              Works with orders: takes orders, changes statuses (ready / handed over), issues refunds.
              Sees the catalog and customers. Doesn’t manage staff or settings.
            </p>
          </div>
          <div className="admin-field">
            <span className="admin-pill" style={{ background: "#EFE6F0", color: "#4A56E2", fontWeight: 700 }}>Super admin</span>
            <p className="admin-meta" style={{ marginTop: 8 }}>
              Full access: everything a manager can do, plus editing the catalog, the revenue dashboard
              and managing staff (creating, roles, access, password reset).
            </p>
          </div>
          <div className="admin-field">
            <span className="admin-pill" style={{ background: "#E6F0FA", color: "#2A43C2", fontWeight: 700 }}>Pickup screen</span>
            <p className="admin-meta" style={{ marginTop: 8 }}>
              An account for the public TV board at the counter. After login it opens a fullscreen
              “Ready / In progress” board straight away, updating in real time. No access to the admin itself.
            </p>
          </div>
          <p className="admin-meta" style={{ marginTop: 4 }}>
            The “Title / note” helps tell staff apart in the list and in the order status change history.
            After creation the card can be filled in and edited.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function NewStaffPage() {
  return (
    <AdminShell title="New staff member"
                crumbs={[{ label: "Staff", href: "/admin/staff" }, { label: "New" }]}>
      <NewStaffInner />
    </AdminShell>
  );
}
