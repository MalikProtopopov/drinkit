"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { useToast } from "@/components/admin/AdminUI";
import { adminApi } from "@/lib/adminApi";

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

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const valid = name.trim().length > 0 && emailOk && password.length >= 6;

  const create = async () => {
    if (!valid) { toast("Заполните имя, корректный email и пароль ≥ 6 символов", "warn"); return; }
    setSaving(true);
    try {
      const s = await adminApi.createManager({
        name: name.trim(), email: email.trim(), role, password,
        phone: phone.trim() || null, note: note.trim() || null,
      });
      toast("Сотрудник создан");
      router.push(`/admin/staff/${s.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      const human: Record<string, string> = {
        EMAIL_TAKEN: "Email уже занят другим сотрудником",
        PASSWORD_TOO_SHORT: "Пароль — минимум 6 символов",
        NAME_REQUIRED: "Укажите имя и фамилию",
      };
      toast(human[msg] ?? msg, "warn");
    } finally { setSaving(false); }
  };

  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, alignItems: "start" }}>
      {/* форма */}
      <div className="admin-panel">
        <div className="admin-panel-head">
          <div className="admin-panel-title">Карточка сотрудника</div>
          <span className="admin-meta">новый доступ в админку</span>
        </div>
        <div className="admin-panel-body">
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
            <div className="admin-user" style={{ width: 54, height: 54, fontSize: 18 }}>{initials || "—"}</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{name || "Имя сотрудника"}</div>
              <span className="admin-pill" style={{ marginTop: 4,
                     background: role === "super_admin" ? "#EFE6F0" : role === "screen" ? "#E6F0FA" : "#EEF0F4",
                     color: role === "super_admin" ? "#4A56E2" : role === "screen" ? "#2A43C2" : "#4B5563", fontWeight: 700 }}>
                {role === "super_admin" ? "Супер-админ" : role === "screen" ? "Экран выдачи" : "Менеджер"}
              </span>
            </div>
          </div>

          <div className="admin-grid-2">
            <div className="admin-field">
              <label className="admin-label">Имя и фамилия *</label>
              <input className="admin-input" autoFocus value={name}
                     onChange={(e) => setName(e.target.value)} placeholder="Иван Петров" />
            </div>
            <div className="admin-field">
              <label className="admin-label">Должность / заметка</label>
              <input className="admin-input" value={note}
                     onChange={(e) => setNote(e.target.value)} placeholder="Бариста · смена А · Marina" />
            </div>
          </div>

          <div className="admin-grid-2">
            <div className="admin-field">
              <label className="admin-label">Телефон</label>
              <input className="admin-input mono" value={phone}
                     onChange={(e) => setPhone(e.target.value)} placeholder="+971 50 000 0000" />
            </div>
            <div className="admin-field">
              <label className="admin-label">Email (логин) *</label>
              <input className="admin-input mono" type="email" value={email}
                     onChange={(e) => setEmail(e.target.value)} placeholder="name@juicy.ae"
                     style={email && !emailOk ? { borderColor: "#B45309", background: "#FFF7E5" } : undefined} />
            </div>
          </div>

          <div className="admin-field">
            <label className="admin-label">Роль</label>
            <div style={{ display: "inline-flex", gap: 2, padding: 3, background: "#F5EFE7", borderRadius: 999 }}>
              {([["manager", "Менеджер"], ["super_admin", "Супер-админ"], ["screen", "Экран выдачи"]] as const).map(([r, lbl]) => (
                <button key={r} className="admin-btn sm" onClick={() => setRole(r)}
                        style={role === r ? { background: "#4A56E2", color: "#FFF" } : { background: "transparent" }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div className="admin-field">
            <label className="admin-label">Пароль * (мин. 6)</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input className="admin-input mono" type={showPass ? "text" : "password"} value={password}
                     onChange={(e) => setPassword(e.target.value)} style={{ flex: 1 }}
                     placeholder="минимум 6 символов" />
              <button className="admin-btn sm" type="button" onClick={() => setShowPass((v) => !v)}>
                {showPass ? "Скрыть" : "Показать"}
              </button>
              <button className="admin-btn sm" type="button" onClick={() => { setPassword(genPassword()); setShowPass(true); }}>
                Сгенерировать
              </button>
            </div>
            <span className="admin-meta">Передайте пароль сотруднику — он сможет сменить его при необходимости.</span>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button className="admin-btn primary" onClick={create} disabled={!valid || saving}>
              {saving ? "Создание…" : "Создать сотрудника"}
            </button>
            <button className="admin-btn" onClick={() => router.push("/admin/staff")}>Отмена</button>
          </div>
        </div>
      </div>

      {/* памятка по ролям */}
      <div className="admin-panel">
        <div className="admin-panel-head"><div className="admin-panel-title">Памятка по ролям</div></div>
        <div className="admin-panel-body">
          <div className="admin-field">
            <span className="admin-pill" style={{ background: "#EEF0F4", color: "#4B5563", fontWeight: 700 }}>Менеджер</span>
            <p className="admin-meta" style={{ marginTop: 8 }}>
              Работа с заказами: берёт заказы в работу, меняет статусы (готов / передан), оформляет возвраты.
              Видит каталог и клиентов. Не управляет персоналом и настройками.
            </p>
          </div>
          <div className="admin-field">
            <span className="admin-pill" style={{ background: "#EFE6F0", color: "#4A56E2", fontWeight: 700 }}>Супер-админ</span>
            <p className="admin-meta" style={{ marginTop: 8 }}>
              Полный доступ: всё, что может менеджер, плюс редактирование каталога, дашборд выручки
              и управление сотрудниками (создание, роли, доступ, сброс пароля).
            </p>
          </div>
          <div className="admin-field">
            <span className="admin-pill" style={{ background: "#E6F0FA", color: "#2A43C2", fontWeight: 700 }}>Экран выдачи</span>
            <p className="admin-meta" style={{ marginTop: 8 }}>
              Учётка публичного табло на ТВ у стойки. После входа сразу открывает полноэкранную доску
              «Готово / Готовится», которая обновляется в реальном времени. В саму админку доступа нет.
            </p>
          </div>
          <p className="admin-meta" style={{ marginTop: 4 }}>
            «Должность / заметка» помогает различать сотрудников в списке и в истории смены статусов заказа.
            После создания карточку можно дополнить и отредактировать.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function NewStaffPage() {
  return (
    <AdminShell title="Новый сотрудник"
                crumbs={[{ label: "Сотрудники", href: "/admin/staff" }, { label: "Новый" }]}>
      <NewStaffInner />
    </AdminShell>
  );
}
