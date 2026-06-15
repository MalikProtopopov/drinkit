"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_URL, api } from "@/lib/api";
import { z } from "zod";

const ListSchema = z.array(z.object({
  id: z.number(), number: z.number(), status: z.string(),
  paymentStatus: z.string(), total: z.number(),
}));
type Row = z.infer<typeof ListSchema>[number];

export default function MyOrdersPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [authed, setAuthed] = useState<boolean>(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function load() {
    const token = window.localStorage.getItem("grabzi_token");
    if (!token) { setAuthed(false); setRows([]); return; }
    setAuthed(true);
    const res = await fetch(`${API_URL}/api/orders`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setRows(ListSchema.parse(await res.json()));
    else setRows([]);
  }
  useEffect(() => { load(); }, []);

  async function signIn() {
    if (!/^\+?\d{7,15}$/.test(phone)) return;
    setBusy(true);
    try {
      await api.login(phone.startsWith("+") ? phone : `+${phone}`); // авто-логин без OTP
      await load();
    } finally { setBusy(false); }
  }

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 26, marginBlockEnd: 16 }}>My orders</h1>

      {rows === null && <div className="skeleton" style={{ height: 64 }} />}

      {rows !== null && !authed && (
        <div className="card" style={{ textAlign: "center", display: "grid", gap: 12 }}>
          <p>Create your first order or sign in.</p>
          <input placeholder="Phone (+9715X XXX XXXX)" value={phone}
            onChange={(e) => setPhone(e.target.value)} inputMode="tel"
            style={{ padding: 12, borderRadius: 12, border: "1px solid var(--color-border)" }} />
          <button className="btn-primary" onClick={signIn} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <Link href="/locations" style={{ color: "var(--color-muted)" }}>Browse menu</Link>
        </div>
      )}

      {rows !== null && authed && rows.length === 0 && (
        <div className="card" style={{ textAlign: "center" }}>
          <p>No orders yet. Your first GRABZI is one tap away.</p>
          <Link href="/locations"><button className="btn-primary" style={{ marginBlockStart: 12 }}>Browse menu</button></Link>
        </div>
      )}

      {rows !== null && authed && rows.length > 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((o) => (
            <button key={o.id} className="card" onClick={() => router.push(`/orders/${o.id}`)}
              style={{ textAlign: "start", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 800 }}>#{o.number}</span>
              <span style={{ color: "var(--color-muted)" }}>{o.status}</span>
              <span style={{ fontWeight: 800 }}>AED {o.total}</span>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
