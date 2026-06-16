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
      router.replace(
        r.staff.role === "screen" ? "/admin/screen"
        : r.staff.role === "super_admin" ? "/admin"
        : "/admin/orders");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", width: "100%", display: "flex", alignItems: "center",
                  justifyContent: "center", padding: 24, background: "#F5F2EA" }}>
      <form onSubmit={submit}
            style={{ width: "100%", maxWidth: 380, background: "#fff", padding: 28, borderRadius: 16,
                     boxShadow: "0 10px 40px rgba(14,14,16,0.08)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
                      gap: 8, marginBottom: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="GRABZI" style={{ height: 56, width: "auto" }} />
          <div style={{ fontSize: 12, color: "#5A6172" }}>Admin · staff sign-in</div>
        </div>
        <div className="admin-field">
          <label className="admin-label">Email</label>
          <input className="admin-input" type="email" autoFocus value={email}
                 onChange={(e) => setEmail(e.target.value)} placeholder="admin@juicy.ae" />
        </div>
        <div className="admin-field">
          <label className="admin-label">Password</label>
          <input className="admin-input" type="password" value={password}
                 onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && (
          <div style={{ color: "#A12822", fontSize: 13, marginBottom: 10 }}>
            Wrong email or password
          </div>
        )}
        <button className="admin-btn primary" type="submit" disabled={busy || !email || !password}
                style={{ width: "100%", justifyContent: "center", padding: 10 }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {process.env.NODE_ENV !== "production" && (
          <div style={{ fontSize: 11, color: "#8A8F9C", marginTop: 14 }}>
            dev logins: admin@juicy.ae / admin123 · manager@juicy.ae / manager123
          </div>
        )}
      </form>
    </div>
  );
}
