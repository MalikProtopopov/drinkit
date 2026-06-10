"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL, admin, type AdminOrder } from "@/lib/api";

/** Экран готовки заказа для менеджера (фронт-спека §6): канбан, панель остатка, live WS. */
const COLS: { status: string; title: string; next?: "ready" | "completed"; cta?: string; color: string }[] = [
  { status: "new", title: "NEW", cta: "TAKE ▶", color: "#4A56E2" },
  { status: "in_progress", title: "MAKING", next: "ready", cta: "READY ✓", color: "var(--color-lowstock)" },
  { status: "ready", title: "READY · HANDOUT", next: "completed", cta: "HANDED OVER ✓", color: "var(--color-instock)" },
  { status: "completed", title: "DONE", color: "var(--color-outofstock)" },
];

type Loc = { name: string; status: string; soldToday: number; limit: number | null; remaining: number | null } | null;

function timer(createdAt: string | null): string {
  if (!createdAt) return "";
  const s = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loc, setLoc] = useState<Loc>(null);
  const [authed, setAuthed] = useState(true);
  const [, tick] = useState(0); // перерисовка таймеров
  const router = useRouter();
  const seen = useRef<Set<number>>(new Set());

  const load = useCallback(async () => {
    try {
      const [list, ls] = await Promise.all([admin.orders(true), admin.locationStatus()]);
      // звук на новый оплаченный заказ (first-seen new) — стаб: можно подключить AudioContext
      for (const o of list) {
        if (!seen.current.has(o.id) && o.status === "new") { /* playChime() */ }
        seen.current.add(o.id);
      }
      setOrders(list);
      setLoc(ls as Loc);
    } catch {
      setAuthed(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && !window.localStorage.getItem("grabzi_staff_token")) {
      router.push("/admin/login"); return;
    }
    load();
    // realtime: WS админ-канал (ws://, ping игнорируем) + поллинг-фолбэк
    const token = window.localStorage.getItem("grabzi_staff_token") ?? "";
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(`${API_URL.replace(/^http/, "ws")}/ws/admin/orders?token=${token}`);
      ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type !== "ping") load(); };
    } catch { /* polling */ }
    const poll = setInterval(load, 10000);
    const clock = setInterval(() => tick((n) => n + 1), 1000);
    return () => { ws?.close(); clearInterval(poll); clearInterval(clock); };
  }, [load, router]);

  async function act(o: AdminOrder, col: typeof COLS[number]) {
    if (col.status === "new") await admin.take(o.id);
    else if (col.next) await admin.setStatus(o.id, col.next);
    load();
  }

  if (!authed) {
    return <main style={{ padding: 24, textAlign: "center" }}>
      <p>Session expired.</p>
      <button className="btn-primary" onClick={() => router.push("/admin/login")}>Sign in</button>
    </main>;
  }

  const pct = loc?.limit ? Math.min(100, Math.round((loc.soldToday / loc.limit) * 100)) : 0;

  return (
    <main style={{ padding: 16, fontFamily: "var(--font-sans)" }}>
      {/* шапка: панель остатка точки (§5.16) */}
      <header style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        gap: 16, padding: "10px 16px", background: "#fff",
        border: "1px solid var(--color-border)", borderRadius: 12, marginBlockEnd: 12,
        position: "sticky", insetBlockStart: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="GRABZI" style={{ height: 32, width: "auto" }} />
          <div style={{ fontWeight: 800, fontSize: 18 }}>
            {loc ? loc.name : "All points"} {loc && loc.status !== "open" && <span className="badge badge--paused">{loc.status}</span>}
          </div>
        </div>
        {loc && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 280 }}>
            <span style={{ fontWeight: 700 }}>
              {loc.limit === null ? `Sold ${loc.soldToday} · No limit`
                : `${loc.soldToday}/${loc.limit} · ${loc.remaining} left`}
            </span>
            {loc.limit !== null && (
              <div style={{ flex: 1, height: 8, background: "#eee", borderRadius: 9999 }}>
                <div style={{
                  width: `${pct}%`, height: "100%", borderRadius: 9999,
                  background: pct >= 100 ? "var(--color-danger)" : pct >= 80 ? "var(--color-lowstock)" : "var(--color-teal)",
                }} />
              </div>
            )}
          </div>
        )}
      </header>

      {/* канбан */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, alignItems: "start" }}>
        {COLS.map((col) => {
          const cards = orders.filter((o) => o.status === col.status)
            .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
          return (
            <section key={col.status}>
              <h2 style={{ fontSize: 14, color: col.color, marginBlockEnd: 8 }}>
                {col.title} · {cards.length}
              </h2>
              <div style={{ display: "grid", gap: 10 }}>
                {cards.length === 0 && <div style={{ color: "var(--color-muted)", fontSize: 13 }}>— empty —</div>}
                {cards.map((o) => (
                  <div key={o.id} className="card" style={{
                    padding: 12,
                    border: o.arrived ? "3px solid var(--color-brand)" : "1px solid var(--color-border)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                      <b>#{o.number}</b>
                      <span style={{ fontFamily: "monospace" }}>⏱ {timer(o.createdAt)}</span>
                    </div>
                    {o.arrived && <div style={{ color: "var(--color-brand)", fontWeight: 800, fontSize: 13 }}>🚗 HERE</div>}
                    <div style={{ fontWeight: 900, fontFamily: "monospace", fontSize: 18, marginBlock: 4 }}>
                      {o.emirate ? `${o.emirate} ` : ""}{o.carPlate}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--color-muted)" }}>
                      {o.items.map((i, n) => <div key={n}>{i.quantity}× {i.name}</div>)}
                    </div>
                    {col.cta && (
                      <button onClick={() => act(o, col)} style={{
                        marginBlockStart: 10, width: "100%", minHeight: 48, border: "none",
                        borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: 15,
                        background: col.color,
                      }}>{col.cta}</button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
