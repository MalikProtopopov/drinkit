"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { API_URL, api } from "@/lib/api";
import { Icon } from "@/components/Icon";
import { TopBrand } from "@/components/TopBrand";

const STEPS = [
  { key: "new", label: "Received" },
  { key: "in_progress", label: "Making" },
  { key: "ready", label: "Ready" },
  { key: "completed", label: "Handed over" },
];
const STATUS_COPY: Record<string, string> = {
  new: "Order received — barista will start soon",
  in_progress: "Making your drink",
  ready: "Ready — come on over",
  completed: "Handed over. Enjoy!",
  refund: "Refunded",
};

// контекст заказа приходит из самой ручки заказа (JOOZ order_payload: items + outlet)
type Order = {
  id: number; number: number; status: string; paymentStatus: string; arrived?: boolean; total: number;
  items?: { name: string; quantity: number }[]; outlet?: { name: string } | null;
};

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
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "0 24px 24px" }}>
      <TopBrand />

      <header style={{ textAlign: "center" }}>
        {/* брендовая иконка-плитка вместо тающего льда (медиа сейчас не рендерим) */}
        <div className="tile" style={{ width: 64, height: 64, margin: "0 auto" }}>
          <Icon name="cup" size={32} stroke={1.8} />
        </div>
        <h1 className="display" style={{ fontSize: 30, marginBlock: 10 }}>Order #{order.number}</h1>
        <p style={{ fontSize: 17, color: "var(--color-muted)" }}>
          {refunded ? "Refunded" : STATUS_COPY[order.status] ?? order.status}
        </p>
        <p style={{ marginBlockStart: 8, fontWeight: 900, fontSize: 20, color: "var(--color-brand)" }}>AED {order.total}</p>
      </header>

      {/* что в заказе: точка + позиции (напрямую из заказа JOOZ — надёжно, не из черновика) */}
      {((order.items?.length ?? 0) > 0 || order.outlet) && (
        <div className="card" style={{ marginBlock: 18, textAlign: "start" }}>
          {order.outlet && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBlockEnd: (order.items?.length ?? 0) ? 12 : 0, color: "var(--color-ink)" }}>
              <span style={{ color: "var(--color-brand)" }}><Icon name="pin" size={18} /></span>
              <span style={{ fontWeight: 800 }}>{order.outlet.name}</span>
            </div>
          )}
          {order.items?.map((l, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingBlock: 4 }}>
              <span className="display" style={{ fontSize: 16, textTransform: "uppercase" }}>{l.name}</span>
              <span style={{ color: "var(--color-muted)", fontWeight: 700 }}>× {l.quantity}</span>
            </div>
          ))}
        </div>
      )}

      {/* предупреждение об оплате — НЕ скрывает прогресс, показываем бейдж над степпером */}
      {!paid && !refunded && (
        <div style={{ display: "flex", justifyContent: "center", marginBlockStart: 18 }}>
          <span className="badge badge--paused">
            <Icon name="clock" size={15} stroke={2} /> Payment pending
          </span>
        </div>
      )}

      {/* степпер прогресса — виден всегда (кроме возврата) */}
      {!refunded && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBlock: 24, gap: 4 }}>
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
                  color: "#fff", display: "grid", placeItems: "center",
                  boxShadow: current ? "0 0 0 4px rgba(196,68,41,.18)" : "none",
                }}>{done ? <Icon name="check" size={16} stroke={2.4} /> : null}</div>
                <span style={{ fontSize: 11, marginBlockStart: 6, color: done ? "var(--color-brand)" : "var(--color-muted)", fontWeight: current ? 800 : 600 }}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ textAlign: "center" }}>
        {paid && !order.arrived && order.status !== "completed" && !refunded && (
          <button className="btn-primary" onClick={imHere} style={{ marginBlockStart: 8, display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon name="car" size={20} /> I&apos;m here
          </button>
        )}
        {order.arrived && (
          <p style={{ marginBlockStart: 16, color: "var(--color-teal)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon name="check" size={18} stroke={2.2} /> We know you&apos;re here
          </p>
        )}
      </div>

      <div style={{ marginBlockStart: 28, textAlign: "center" }}>
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
