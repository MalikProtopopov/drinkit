"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { API_URL, api } from "@/lib/api";
import { TopBrand } from "@/components/TopBrand";
import { Icon } from "@/components/Icon";
import { maskPhoneUAE, normalizePhoneUAE, isPhoneComplete } from "@/lib/masks";
import { z } from "zod";

// список заказов клиента — бэкенд (full=false) отдаёт точку, позиции, время, статус оплаты
const ListSchema = z.array(z.object({
  id: z.number(), number: z.number(), status: z.string(),
  paymentStatus: z.string(), total: z.number(),
  createdAt: z.string().nullable().optional(),
  arrived: z.boolean().optional(),
  outlet: z.object({ name: z.string() }).nullable().optional(),
  items: z.array(z.object({ name: z.string(), quantity: z.number() })).optional().default([]),
}));
type Row = z.infer<typeof ListSchema>[number];

// человекочитаемый статус готовки + цвет (терракота → янтарь → лайм → приглушённый → данжер)
const STATUS: Record<string, { label: string; color: string }> = {
  new: { label: "Received", color: "var(--color-brand)" },
  in_progress: { label: "Making", color: "var(--color-lowstock)" },
  ready: { label: "Ready for pickup", color: "var(--color-instock)" },
  completed: { label: "Handed over", color: "var(--color-muted)" },
  refund: { label: "Refunded", color: "var(--color-danger)" },
};
function statusOf(s: string) { return STATUS[s] ?? { label: s, color: "var(--color-muted)" }; }

function fmtWhen(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}
function itemsSummary(items: Row["items"]): string {
  return (items ?? []).map((i) => `${i.name} ×${i.quantity}`).join(" · ");
}

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
    const res = await fetch(`${API_URL}/api/orders?locale=en`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setRows(ListSchema.parse(await res.json()));
    else setRows([]);
  }
  useEffect(() => { load(); }, []);

  async function signIn() {
    // PHONE-2: тот же канонический формат, что и при оформлении (+9715XXXXXXXX),
    // иначе вход по другому написанию телефона не находит заказы клиента.
    if (!isPhoneComplete(phone)) return;
    setBusy(true);
    try {
      await api.login(normalizePhoneUAE(phone)); // авто-логин без OTP
      await load();
    } finally { setBusy(false); }
  }

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: 20 }}>
      <TopBrand />
      <h1 className="display" style={{ fontSize: 30, marginBlockEnd: 16 }}>My orders</h1>

      {rows === null && (
        <div style={{ display: "grid", gap: 10 }}>
          {[0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 110, borderRadius: "var(--radius-card)" }} />)}
        </div>
      )}

      {rows !== null && !authed && (
        <div className="card" style={{ textAlign: "center", display: "grid", gap: 12 }}>
          <p>Create your first order or sign in.</p>
          <input placeholder="+971 50 123 4567" value={phone}
            onChange={(e) => setPhone(maskPhoneUAE(e.target.value))} inputMode="tel"
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
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((o) => {
            const st = statusOf(o.status);
            const when = fmtWhen(o.createdAt);
            const summary = itemsSummary(o.items);
            const unpaid = o.paymentStatus !== "paid" && o.status !== "refund";
            return (
              <button key={o.id} className="card" onClick={() => router.push(`/orders/${o.id}`)}
                style={{ textAlign: "start", display: "grid", gap: 9, width: "100%" }}>
                {/* строка 1: номер + время · статус готовки */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontWeight: 900, fontSize: 19 }}>#{o.number}</span>
                    {when && <span style={{ color: "var(--color-muted)", fontSize: 12.5 }}>{when}</span>}
                  </div>
                  <span className="badge" style={{ background: "transparent", color: st.color, border: `1.5px solid ${st.color}` }}>
                    <span className="dot" style={{ background: st.color }} /> {st.label}
                  </span>
                </div>

                {/* строка 2: позиции заказа */}
                {summary && (
                  <div style={{ color: "var(--color-ink)", fontSize: 14, fontWeight: 600,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {summary}
                  </div>
                )}

                {/* строка 3: точка + (оплата) · сумма */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <span style={{ display: "inline-flex", gap: 5, alignItems: "center", color: "var(--color-muted)", fontSize: 13, minWidth: 0 }}>
                    {o.outlet?.name && <><Icon name="pin" size={14} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.outlet.name}</span></>}
                  </span>
                  <span style={{ display: "inline-flex", gap: 10, alignItems: "center", whiteSpace: "nowrap" }}>
                    {unpaid && (
                      <span className="badge badge--paused" style={{ fontSize: 11 }}>
                        <Icon name="clock" size={12} stroke={2} /> Payment pending
                      </span>
                    )}
                    <span style={{ fontWeight: 800 }}>AED {o.total}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}
