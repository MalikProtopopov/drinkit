"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { API_URL, api } from "@/lib/api";

const STATUS_COPY: Record<string, string> = {
  new: "Order received — barista will start soon",
  in_progress: "Making your drink",
  ready: "Ready — come on over",
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
  if (!order) return <Center><div className="skeleton" style={{ height: 120, width: 280 }} /></Center>;

  const paid = order.paymentStatus === "paid";
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 48 }}>{order.status === "ready" ? "✅" : order.status === "completed" ? "🎉" : "☕"}</div>
      <h1 style={{ fontSize: 24, marginBlock: 8 }}>Order #{order.number}</h1>
      <p style={{ fontSize: 18, color: "var(--color-muted)" }}>
        {!paid ? "Confirming your payment…" : STATUS_COPY[order.status] ?? order.status}
      </p>
      <p style={{ marginBlockStart: 8, fontWeight: 800 }}>AED {order.total}</p>

      {paid && !order.arrived && order.status !== "completed" && order.status !== "refund" && (
        <button className="btn-primary" onClick={imHere} style={{ marginBlockStart: 20 }}>I&apos;m here 🚗</button>
      )}
      {order.arrived && <p style={{ marginBlockStart: 16, color: "var(--color-teal)" }}>We know you&apos;re here</p>}

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
