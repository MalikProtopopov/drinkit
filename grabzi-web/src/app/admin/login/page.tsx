"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { admin, ApiError } from "@/lib/api";

export default function StaffLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit() {
    setBusy(true); setErr("");
    try {
      await admin.login(email, password);
      router.push("/admin/kitchen");
    } catch (e) {
      setErr((e as ApiError).status === 401 ? "Wrong email or password." : "Can't sign in.");
    } finally { setBusy(false); }
  }

  return (
    <main style={{ maxWidth: 360, margin: "0 auto", padding: 24, display: "grid", gap: 12 }}>
      <h1 style={{ fontSize: 24 }}>Staff sign in</h1>
      <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inp} />
      <input placeholder="password" type="password" value={password}
        onChange={(e) => setPassword(e.target.value)} style={inp} />
      {err && <div className="badge badge--out" style={{ alignSelf: "start" }}>{err}</div>}
      <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? "…" : "Sign in"}</button>
    </main>
  );
}
const inp: React.CSSProperties = { padding: 12, borderRadius: 12, border: "1px solid var(--color-border)" };
