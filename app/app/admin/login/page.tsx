"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi, setStaffToken } from "@/lib/adminApi";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(false);
    try {
      const r = await adminApi.login(email, password);
      setStaffToken(r.token);
      router.replace(r.staff.role === "super_admin" ? "/admin" : "/admin/orders");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#F5F2EA" }}>
      <form onSubmit={submit}
            style={{ width: 360, background: "#fff", padding: 28, borderRadius: 16,
                     boxShadow: "0 10px 40px rgba(14,14,16,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <span className="admin-brand-mark">J</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Juicy Admin</div>
            <div style={{ fontSize: 12, color: "#5A6172" }}>вход для персонала</div>
          </div>
        </div>
        <div className="admin-field">
          <label className="admin-label">Email</label>
          <input className="admin-input" type="email" autoFocus value={email}
                 onChange={(e) => setEmail(e.target.value)} placeholder="admin@juicy.ae" />
        </div>
        <div className="admin-field">
          <label className="admin-label">Пароль</label>
          <input className="admin-input" type="password" value={password}
                 onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && (
          <div style={{ color: "#A12822", fontSize: 13, marginBottom: 10 }}>
            Неверный email или пароль
          </div>
        )}
        <button className="admin-btn primary" type="submit" disabled={busy || !email || !password}
                style={{ width: "100%", justifyContent: "center", padding: 10 }}>
          {busy ? "Входим…" : "Войти"}
        </button>
        {process.env.NODE_ENV !== "production" && (
          <div style={{ fontSize: 11, color: "#8A8F9C", marginTop: 14 }}>
            dev-доступы: admin@juicy.ae / admin123 · manager@juicy.ae / manager123
          </div>
        )}
      </form>
    </div>
  );
}
