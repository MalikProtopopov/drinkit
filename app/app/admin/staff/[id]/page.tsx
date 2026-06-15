"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { Toggle, useToast } from "@/components/admin/AdminUI";
import { adminApi, ADMIN_STATUS_LABEL, type Staff, type AdminOrder } from "@/lib/adminApi";

const fmt = (s?: string) =>
  s ? new Date(/[Z+]/.test(s) ? s : s + "Z").toLocaleString("ru-RU",
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

  const fill = (s: Staff) => {
    setStaff(s);
    setName(s.name); setEmail(s.email); setPhone(s.phone ?? "");
    setNote(s.note ?? ""); setRole(s.role); setDisabled(s.disabled); setPassword("");
  };

  useEffect(() => {
    adminApi.me().then(setMe).catch(() => {});
    adminApi.managers()
      .then((list) => {
        const s = list.find((x) => x.id === id);
        if (s) fill(s); else setNotFound(true);
      })
      .catch(() => setNotFound(true));
    adminApi.orders({ managerId: id }).then(setOrders).catch(() => setOrders([]));
  }, [id]);

  if (notFound) return <div className="admin-meta">Сотрудник не найден</div>;
  if (!staff) return <div className="admin-meta">Загрузка…</div>;

  const canEdit = me?.role === "super_admin";
  const isSelf = me?.id === staff.id;
  const initials = (name || staff.name).split(/\s+/).filter(Boolean)
    .slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  const dirty = canEdit && (
    name !== staff.name || email !== staff.email || (phone || "") !== (staff.phone ?? "")
    || (note || "") !== (staff.note ?? "") || role !== staff.role
    || disabled !== staff.disabled || password.length > 0);

  const save = async () => {
    if (!name.trim()) { toast("Укажите имя и фамилию", "warn"); return; }
    if (password && password.length < 6) { toast("Пароль — минимум 6 символов", "warn"); return; }
    setSaving(true);
    try {
      const upd = await adminApi.updateManager(staff.id, {
        name: name.trim(), email: email.trim(), role,
        phone: phone.trim() || null, note: note.trim() || null, disabled,
        ...(password ? { password } : {}),
      });
      fill(upd);
      toast("Данные сотрудника сохранены");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      const human: Record<string, string> = {
        EMAIL_TAKEN: "Email уже занят другим сотрудником",
        CANNOT_DEMOTE_SELF: "Нельзя снять супер-права с самого себя",
        CANNOT_DISABLE_SELF: "Нельзя отключить собственную учётку",
        PASSWORD_TOO_SHORT: "Пароль — минимум 6 символов",
      };
      toast(human[msg] ?? msg, "warn");
    } finally { setSaving(false); }
  };

  const fieldLabel = (t: string) => <label className="admin-label">{t}</label>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.7fr", gap: 16, alignItems: "start" }}>
      {/* профиль / редактор */}
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">{canEdit ? "Карточка сотрудника" : "Профиль сотрудника"}</div>
          {canEdit && <span className="admin-meta">редактирование</span>}
        </div>
        <div className="admin-panel-body">
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
            <div className="admin-user" style={{ width: 54, height: 54, fontSize: 18 }}>{initials || "—"}</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{name || "—"}</div>
              <span className="admin-pill" style={{ marginTop: 4,
                     background: role === "super_admin" ? "#EFE6F0" : role === "screen" ? "#E6F0FA" : "#EEF0F4",
                     color: role === "super_admin" ? "#4A56E2" : role === "screen" ? "#2A43C2" : "#4B5563", fontWeight: 700 }}>
                {role === "super_admin" ? "Супер-админ" : role === "screen" ? "Экран выдачи" : "Менеджер"}
              </span>
              {note && <span className="admin-meta" style={{ marginLeft: 8 }}>{note}</span>}
            </div>
          </div>

          {canEdit ? (
            <>
              <div className="admin-field">{fieldLabel("Имя и фамилия")}
                <input className="admin-input" value={name} onChange={(e) => setName(e.target.value)}
                       placeholder="Иван Петров" /></div>
              <div className="admin-field">{fieldLabel("Должность / заметка")}
                <input className="admin-input" value={note} onChange={(e) => setNote(e.target.value)}
                       placeholder="Бариста · смена А · точка Marina" /></div>
              <div className="admin-field">{fieldLabel("Телефон")}
                <input className="admin-input mono" value={phone} onChange={(e) => setPhone(e.target.value)}
                       placeholder="+971 50 000 0000" /></div>
              <div className="admin-field">{fieldLabel("Email (логин)")}
                <input className="admin-input mono" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="admin-field">{fieldLabel("Роль")}
                <div style={{ display: "inline-flex", gap: 2, padding: 3, background: "#F5EFE7", borderRadius: 999 }}>
                  {([["manager", "Менеджер"], ["super_admin", "Супер-админ"], ["screen", "Экран выдачи"]] as const).map(([r, lbl]) => (
                    <button key={r} className="admin-btn sm"
                            disabled={isSelf && r !== "super_admin"}
                            onClick={() => setRole(r)}
                            style={role === r ? { background: "#4A56E2", color: "#FFF" } : { background: "transparent" }}>
                      {lbl}
                    </button>
                  ))}
                </div>
                {isSelf && <span className="admin-meta" style={{ marginLeft: 8 }}>нельзя понизить себя</span>}
              </div>
              <div className="admin-field">{fieldLabel("Доступ в админку")}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Toggle defaultOn={!disabled} disabled={isSelf}
                          onChange={(v) => setDisabled(!v)} />
                  <span className="admin-meta">{disabled ? "отключён — вход запрещён" : "активен"}</span>
                </div>
              </div>
              <div className="admin-field">{fieldLabel("Новый пароль (необязательно)")}
                <input className="admin-input mono" type="text" value={password}
                       onChange={(e) => setPassword(e.target.value)} placeholder="оставьте пустым — без изменений" /></div>

              <button className="admin-btn primary" style={{ marginTop: 4 }}
                      onClick={save} disabled={!dirty || saving}>
                {saving ? "Сохранение…" : "Сохранить"}
              </button>
              {dirty && !saving && <span className="admin-meta" style={{ marginLeft: 10 }}>● есть несохранённые изменения</span>}
            </>
          ) : (
            <>
              <div className="admin-field">{fieldLabel("Email")}
                <a href={`mailto:${staff.email}`} className="admin-mono"
                   style={{ color: "var(--a-accent)", textDecoration: "none", fontWeight: 600 }}>{staff.email}</a></div>
              {staff.phone && <div className="admin-field">{fieldLabel("Телефон")}
                <div className="admin-mono">{staff.phone}</div></div>}
              {staff.note && <div className="admin-field">{fieldLabel("Должность / заметка")}
                <div>{staff.note}</div></div>}
              <div className="admin-field">{fieldLabel("Статус доступа")}
                <span className="admin-pill" style={staff.disabled
                  ? { background: "#FCEAEA", color: "#DC2626", fontWeight: 700 }
                  : { background: "#DDEDE0", color: "#166534", fontWeight: 700 }}>
                  {staff.disabled ? "отключён" : "активен"}
                </span></div>
            </>
          )}
          <div className="admin-field" style={{ marginTop: 12 }}>{fieldLabel("ID")}
            <div className="admin-mono admin-meta">#{staff.id}</div></div>
        </div>
      </div>

      {/* заказы, которые сотрудник вёл */}
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">Заказы сотрудника</div>
          <span className="admin-meta">{orders ? `${orders.length} шт` : "…"}</span>
        </div>
        <div className="admin-tablewrap"><table className="admin-table">
          <thead><tr><th>№</th><th>Статус</th><th>Сумма</th><th>Создан</th></tr></thead>
          <tbody>
            {orders === null ? (
              <tr><td colSpan={4} className="admin-meta" style={{ padding: 16 }}>Загрузка…</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={4} className="admin-meta" style={{ padding: 16 }}>Пока нет заказов в работе</td></tr>
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
  );
}

export default function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AdminShell title="Сотрудник"
                crumbs={[{ label: "Сотрудники", href: "/admin/staff" }, { label: `#${id}` }]}>
      <Inner id={Number(id)} />
    </AdminShell>
  );
}
