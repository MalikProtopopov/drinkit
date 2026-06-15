"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { API_URL, api } from "@/lib/api";

const STEPS = [
  { key: "new", label: "Received" },
  { key: "in_progress", label: "Making" },
  { key: "ready", label: "Ready" },
  { key: "completed", label: "Handed over" },
];
const STATUS_COPY: Record<string, string> = {
  new: "Order received — barista will start soon",
  in_progress: "Making your drink",
  ready: "Ready — come on over 🚗",
  completed: "Handed over. Enjoy!",
  refund: "Refunded",
};

type Order = { id: number; number: number; status: string; paymentStatus: string; arrived?: boolean; total: number };

export default function OrderStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const orderId = Number(id);
  const [order, setOrder] = useState<Order | null>(null);
  const [err, setErr] = useState(false);

  async function refresh() {
    try { setOrder(await api.order(orderId)); } catch { setErr(true); }
  }
  useEffect(() => {
    refresh();
    // realtime + polling-fallback (фронт-спека §1.6): WS со схемой ws://, ping игнорируем
    const wsUrl = `${API_URL.replace(/^http/, "ws")}/ws/orders/${orderId}?token=${
      typeof window !== "undefined" ? window.localStorage.getItem("grabzi_token") ?? "" : ""
    }`;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.type === "ping") return;
        refresh();
      };
    } catch { /* fallback to polling */ }
    const poll = setInterval(refresh, 20000);
    return () => { ws?.close(); clearInterval(poll); };
  }, [orderId]);

  async function imHere() {
    await fetch(`${API_URL}/api/orders/${orderId}/arrived`, {
      method: "POST",
      headers: { Authorization: `Bearer ${window.localStorage.getItem("grabzi_token") ?? ""}` },
    });
    refresh();
  }

  if (err) return <Center><p>Order not found.</p><Link href="/orders"><button className="btn-primary">My orders</button></Link></Center>;
  if (!order) return <Center><div className="skeleton" style={{ height: 160, width: 300 }} /></Center>;

  const paid = order.paymentStatus === "paid";
  const refunded = order.status === "refund";
  const activeIdx = STEPS.findIndex((s) => s.key === order.status);

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: 24, textAlign: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/ice.png" alt="" aria-hidden style={{ width: 56, height: 56, objectFit: "contain", margin: "0 auto" }} />
      <h1 className="display" style={{ fontSize: 30, marginBlock: 8 }}>Order #{order.number}</h1>
      <p style={{ fontSize: 17, color: "var(--color-muted)" }}>
        {refunded ? "Refunded" : !paid ? "Confirming your payment…" : STATUS_COPY[order.status] ?? order.status}
      </p>
      <p style={{ marginBlockStart: 8, fontWeight: 900, fontSize: 20, color: "var(--color-brand)" }}>AED {order.total}</p>

      {/* степпер прогресса */}
      {paid && !refunded && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBlock: 28, gap: 4 }}>
          {STEPS.map((s, i) => {
            const done = i <= activeIdx;
            const current = i === activeIdx;
            return (
              <div key={s.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
                {i > 0 && (
                  <div style={{
                    position: "absolute", insetBlockStart: 13, insetInlineEnd: "50%", width: "100%", height: 3,
                    background: i <= activeIdx ? "var(--color-brand)" : "var(--color-border)", zIndex: 0,
                  }} />
                )}
                <div style={{
                  width: 28, height: 28, borderRadius: 9999, zIndex: 1,
                  background: done ? "var(--color-brand)" : "var(--color-paper)",
                  border: `2px solid ${done ? "var(--color-brand)" : "var(--color-border)"}`,
                  color: "#fff", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 800,
                  boxShadow: current ? "0 0 0 4px rgba(196,68,41,.18)" : "none",
                }}>{done ? "✓" : ""}</div>
                <span style={{ fontSize: 11, marginBlockStart: 6, color: done ? "var(--color-brand)" : "var(--color-muted)", fontWeight: current ? 800 : 600 }}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {paid && !order.arrived && order.status !== "completed" && !refunded && (
        <button className="btn-primary" onClick={imHere} style={{ marginBlockStart: 8 }}>I&apos;m here 🚗</button>
      )}
      {order.arrived && <p style={{ marginBlockStart: 16, color: "var(--color-teal)", fontWeight: 700 }}>We know you&apos;re here ✓</p>}

      <div style={{ marginBlockStart: 28 }}>
        <Link href="/orders" style={{ color: "var(--color-muted)" }}>My orders</Link>
      </div>
    </main>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "70dvh", display: "grid", placeItems: "center", gap: 12, padding: 24 }}>
      {children}
    </main>
  );
}
