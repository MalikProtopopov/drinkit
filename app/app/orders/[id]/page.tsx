"use client";
import { useCallback, useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { api, orderWs, STATUS_LABELS, type ApiOrder } from "@/lib/api";

// единая цепочка статусов (§0.1)
const STEPS = [
  { status: "new", label: "Принят" },
  { status: "in_progress", label: "Готовим" },
  { status: "ready", label: "Готов" },
  { status: "arrived", label: "Вы на месте" },
  { status: "completed", label: "Получен" },
];

export default function OrderStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const orderId = Number(id);

  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [couponToast, setCouponToast] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const load = useCallback(() => {
    api.order(orderId)
      .then((o) => {
        setOrder(o);
        // PUB-A-04 AC1: модалка по таймауту 15 минут после «прибыл»
        if (o.ratingPromptDue && !o.rating) setShowRating(true);
      })
      .catch(() => router.replace("/orders"));
  }, [orderId, router]);

  useEffect(() => { load(); }, [load]);

  // realtime по WebSocket (PUB-A-03 AC5)
  useEffect(() => {
    let alive = true;
    try {
      const ws = orderWs(orderId);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type !== "ping" && alive) load();
      };
    } catch {}
    // подстраховка для модалки таймаута
    const t = setInterval(load, 60_000);
    return () => { alive = false; wsRef.current?.close(); clearInterval(t); };
  }, [orderId, load]);

  if (!order) return <div className="flex-1 flex items-center justify-center muted">Загрузка…</div>;

  const currentIdx = Math.max(0, STEPS.findIndex((s) => s.status === order.status));
  const isRefund = order.status === "refund";
  const canArrive = order.status === "ready";
  const canRate = !order.rating && (order.status === "arrived" || order.status === "completed");
  const st = STATUS_LABELS[order.status] ?? STATUS_LABELS.new;

  const markArrived = async () => {
    try { setOrder(await api.arrived(order.id)); } catch {}
  };

  const rate = async (rating: "like" | "dislike") => {
    try {
      const r = await api.rate(order.id, rating);
      setShowRating(false);
      if (r.couponIssued) {
        setCouponToast("Нам жаль 😔 Дарим купон на бесплатный напиток — он появится при следующем заказе");
        setTimeout(() => setCouponToast(null), 5000);
      }
      load();
    } catch { setShowRating(false); }
  };

  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center justify-between px-4 pt-safe pb-2 h-16">
        <button onClick={() => router.push("/home")}
                className="w-10 h-10 rounded-full bg-[#F2F2F4] flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="text-caption muted">Заказ № {order.number}</div>
        <div className="w-10" />
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="rounded-3xl p-6 text-center mb-4" style={{ background: "#F4EEE4" }}>
          <div className="text-h1 mb-1" style={isRefund ? { color: "#DC2626" } : undefined}>
            {st.label}
          </div>
          <div className="muted text-body">
            {order.paymentStatus !== "paid" ? "заказ не оплачен" : `статус обновляется автоматически`}
          </div>
        </div>

        {!isRefund && (
          <div className="flex items-center justify-between mb-6 px-2">
            {STEPS.map((s, i) => {
              const reached = i <= currentIdx;
              return (
                <div key={s.status} className="flex-1 flex flex-col items-center relative">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-tiny font-bold ${i === currentIdx ? "animate-pulseRing" : ""}`}
                       style={{ background: reached ? "var(--color-primary-500)" : "#E5E7EB",
                                color: reached ? "#fff" : "var(--color-text-muted)" }}>
                    {reached ? "✓" : i + 1}
                  </div>
                  <div className="text-tiny mt-1 text-center"
                       style={{ color: reached ? "var(--color-text)" : "var(--color-text-muted)" }}>
                    {s.label}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="absolute top-3.5 left-1/2 w-full h-0.5"
                         style={{ background: i < currentIdx ? "var(--color-primary-500)" : "#E5E7EB", zIndex: -1 }} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* «Прибыл» — доступно только после ready (§0.1) */}
        <button onClick={markArrived} disabled={!canArrive}
                className={`btn-pill w-full mb-3 ${canArrive ? "btn-primary" : "btn-soft is-disabled"}`}>
          {order.status === "arrived" ? "✓ Бариста знает, что вы на месте"
            : order.status === "completed" ? "Заказ получен — приятного!"
            : "Прибыл, готов забрать"}
        </button>

        {canRate && (
          <button onClick={() => setShowRating(true)} className="btn-pill btn-soft w-full mb-3">
            Оценить заказ
          </button>
        )}
        {order.rating && (
          <div className="text-center text-caption muted mb-3">
            Ваша оценка: {order.rating === "like" ? "👍" : "👎"} — спасибо!
          </div>
        )}

        <div className="rounded-2xl bg-[#F4F4F7] p-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-h3">Состав</div>
            <div className="text-caption muted">{order.items.length} поз.</div>
          </div>
          {order.items.map((item) => (
            <div key={item.id} className="py-2 border-t border-[var(--color-border)] first:border-t-0 first:pt-0">
              <div className="flex justify-between gap-2">
                <div className="text-body font-semibold leading-tight">
                  {item.name} ×{item.quantity}
                  {item.paidByCoupon && (
                    <span className="ml-2 text-tiny font-semibold text-[var(--color-primary-500)]">
                      по купону
                    </span>
                  )}
                </div>
                <div className="text-body font-semibold">
                  {(item.unitPrice * item.quantity).toFixed(0)} AED
                </div>
              </div>
              {item.addons.length > 0 && (
                <div className="text-tiny muted mt-0.5">
                  {item.addons.map((a) =>
                    `${a.name}${a.portions > 1 ? ` ×${a.portions}` : ""} (${a.amount}${a.unit === "ml" ? " мл" : " г"})`
                  ).join(" • ")}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-[#F4F4F7] p-4 mb-3 space-y-2">
          <Row label="Подытог" value={`${order.subtotal.toFixed(0)} AED`} />
          {order.couponDiscount > 0 && <Row label="Купон" value={`−${order.couponDiscount.toFixed(0)} AED`} />}
          <div className="border-t border-[var(--color-border)] my-2" />
          <Row label="Итого" value={`${order.total.toFixed(0)} AED`} big />
          <div className="border-t border-[var(--color-border)] my-2" />
          <div className="text-caption muted">Машина · {order.emirate} {order.carPlate}</div>
          <div className="text-caption muted">Телефон · {order.phone}</div>
        </div>

        {/* история смен статусов (PUB-A-07 AC4) */}
        {order.events && order.events.length > 0 && (
          <div className="rounded-2xl bg-[#F4F4F7] p-4 mb-3">
            <div className="text-h3 mb-2">История</div>
            {order.events.map((e, i) => (
              <div key={i} className="flex justify-between text-caption py-1 border-t border-[var(--color-border)] first:border-t-0">
                <span>{eventLabel(e.type, e.status)}</span>
                <span className="muted">{new Date(e.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={() => router.push("/home")} className="btn-pill btn-soft btn-sm w-full">
          На главную
        </button>
      </div>

      {/* модалка оценки 👍/👎 (PUB-A-04) */}
      {showRating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
             style={{ background: "rgba(0,0,0,0.45)" }}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-[320px] text-center animate-fadeUp">
            <div className="text-h2 mb-2">Как вам заказ?</div>
            <div className="text-body muted mb-6">Оценка поможет нам стать лучше</div>
            <div className="flex gap-3 justify-center">
              <button onClick={() => rate("like")}
                      className="w-20 h-20 rounded-full bg-[#DDEDE0] text-4xl active:scale-95 transition">👍</button>
              <button onClick={() => rate("dislike")}
                      className="w-20 h-20 rounded-full bg-[#FBE3E0] text-4xl active:scale-95 transition">👎</button>
            </div>
            <button onClick={() => setShowRating(false)} className="text-caption muted mt-5">
              Позже
            </button>
          </div>
        </div>
      )}

      {couponToast && (
        <div className="fixed bottom-24 left-4 right-4 bg-[#0E0E10] text-white rounded-2xl px-4 py-3 z-50 text-body animate-fadeUp">
          {couponToast}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={big ? "text-h3" : "muted text-body"}>{label}</span>
      <span className={big ? "text-h3 font-semibold" : "text-body font-semibold"}>{value}</span>
    </div>
  );
}

function eventLabel(type: string, status?: string | null): string {
  if (type === "created") return "Заказ создан";
  if (type === "paid") return "Оплачен";
  if (type === "coupon_applied") return "Применён купон";
  if (type === "rated") return "Оставлена оценка";
  if (type === "refund") return "Оформлен возврат";
  const map: Record<string, string> = {
    new: "Принят", in_progress: "Начали готовить", ready: "Готов к выдаче",
    arrived: "Вы отметили прибытие", completed: "Передан", refund: "Возврат",
  };
  return map[status ?? ""] ?? type;
}
