"use client";
import { useCallback, useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { api, orderWs, STATUS_LABELS, type ApiOrder } from "@/lib/api";
import { IconBack, IconThumbDown, IconThumbUp } from "@/components/icons";
import { Loader } from "@/components/Loader";
import { useT, statusLabel, stepLabel, type Locale } from "@/lib/i18n";

// цепочка статусов готовки; «я на месте» — независимый флаг, не ступень
const STEPS = ["new", "in_progress", "ready", "completed"];

export default function OrderStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const orderId = Number(id);

  const { t, locale } = useT();
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
      .catch(() => router.replace("/home"));
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

  if (!order) return <Loader label={t("Loading order…", "جارٍ تحميل الطلب…")} />;

  const currentIdx = Math.max(0, STEPS.indexOf(order.status));
  const isRefund = order.status === "refund";
  // «я на месте» доступно сразу после оплаты — клиент мог заказать, уже стоя у точки
  const canArrive = order.paymentStatus === "paid" && !order.arrived
    && order.status !== "completed" && !isRefund;
  const canRate = !order.rating && (order.arrived || order.status === "completed");
  const st = STATUS_LABELS[order.status] ?? STATUS_LABELS.new;

  // оплата прямо отсюда (без отдельной страницы): Stripe-сессия → редирект/мок
  const payNow = async () => {
    try {
      const r = await api.checkout(order.id);
      if (r.mock) load();            // mock: бэкенд уже отметил оплату — обновляем статус
      else window.location.href = r.checkoutUrl;
    } catch {}
  };

  const markArrived = async () => {
    try { setOrder(await api.arrived(order.id)); } catch {}
  };

  const rate = async (rating: "like" | "dislike") => {
    try {
      const r = await api.rate(order.id, rating);
      setShowRating(false);
      if (r.couponIssued) {
        setCouponToast(t("We're sorry 😔 Here's a coupon for a free drink — it'll appear on your next order", "نأسف لذلك 😔 إليك قسيمة لمشروب مجاني — ستظهر في طلبك التالي"));
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
          <IconBack size={18} />
        </button>
        <div className="text-caption muted">{t("Order", "الطلب")} № {order.number}</div>
        <div className="w-10" />
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {(() => {
          const v = statusVisual(order, isRefund, t, locale);
          return (
            <div className="rounded-3xl p-5 mb-4 text-center" style={{ background: v.bg }}>
              <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: v.color }}>
                <StatusGlyph kind={v.icon} />
              </div>
              <div className="text-h1" style={{ color: v.color }}>{v.label}</div>
              <div className="muted text-body mt-1.5 max-w-[280px] mx-auto leading-snug">{v.hint}</div>
              <div className="flex items-center justify-center gap-2 mt-3 text-caption muted">
                <span>№ {order.number}</span>
                <span>·</span>
                <span>{new Date(order.createdAt).toLocaleString(locale === "ar" ? "ar" : "en-GB", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
          );
        })()}

        {!isRefund && (
          <div className="flex items-center justify-between mb-6 px-2">
            {STEPS.map((s, i) => {
              const reached = i <= currentIdx;
              return (
                <div key={s} className="flex-1 flex flex-col items-center relative">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-tiny font-bold ${i === currentIdx ? "animate-pulseRing" : ""}`}
                       style={{ background: reached ? "var(--color-primary-500)" : "#E5E7EB",
                                color: reached ? "#fff" : "var(--color-text-muted)" }}>
                    {reached ? "✓" : i + 1}
                  </div>
                  <div className="text-tiny mt-1 text-center"
                       style={{ color: reached ? "var(--color-text)" : "var(--color-text-muted)" }}>
                    {stepLabel(s, locale)}
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

        {/* выдача по номеру авто — показываем номер, который увидит бариста */}
        {order.carPlate && order.paymentStatus === "paid" && order.status !== "completed" && !isRefund && (
          <div className="rounded-2xl p-4 mb-3 flex items-center justify-between gap-3" style={{ background: "#F4F4F7" }}>
            <div className="min-w-0">
              <div className="text-body font-semibold">{t("Curbside pickup", "الاستلام من السيارة")}</div>
              <div className="text-tiny muted mt-0.5">{t("The barista will bring your order to this plate", "سيحضر الباريستا طلبك إلى هذه اللوحة")}</div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl px-3 py-2 flex-none" style={{ background: "#fcfcfa", border: "2.5px solid #15171c" }}>
              <div className="flex flex-col leading-[1.05]">
                <div className="text-[9px] font-black" style={{ color: "#c0392b" }}>{order.emirate || "Dubai"}</div>
                <div className="text-[8px] font-extrabold tracking-[1px] mt-0.5" style={{ color: "#15171c" }}>U.A.E</div>
              </div>
              <div className="w-[1.5px] h-7" style={{ background: "#dcdcd6" }} />
              <div className="font-black text-[22px] tracking-wide" style={{ color: "#15171c" }}>{order.carPlate}</div>
            </div>
          </div>
        )}

        {/* H01 (PUB-A-02 AC5): заказ не оплачен — можно повторить оплату */}
        {order.paymentStatus !== "paid" && order.status !== "refund" && (
          <button onClick={payNow} className="btn-pill btn-primary w-full mb-3">
            {t("Pay", "ادفع")} · {order.total.toFixed(0)} AED
          </button>
        )}

        {/* «Я на месте» — независимый флаг, доступен в любой момент после оплаты */}
        <button onClick={markArrived} disabled={!canArrive}
                className={`btn-pill w-full mb-3 ${canArrive ? "btn-primary" : "btn-soft is-disabled"}`}>
          {order.arrived && order.status !== "completed" ? t("✓ The barista knows you're here", "✓ الباريستا يعلم أنك هنا")
            : order.status === "completed" ? t("Order received — enjoy!", "تم استلام الطلب — بالهناء!")
            : t("I'm here — bring it to my car", "أنا هنا — أحضره إلى سيارتي")}
        </button>
        {order.arrived && order.status !== "completed" && !isRefund && (
          <div className="text-center text-caption muted mb-3">
            {order.status === "ready"
              ? t("Your drink is ready — the barista is on the way 🚗", "مشروبك جاهز — الباريستا في الطريق إليك 🚗")
              : t("Preparing your drink — we'll bring it out as soon as it's ready", "نحضّر مشروبك — سنحضره إليك حالما يجهز")}
          </div>
        )}

        {canRate && (
          <button onClick={() => setShowRating(true)} className="btn-pill btn-soft w-full mb-3">
            {t("Rate order", "قيّم الطلب")}
          </button>
        )}
        {order.rating && (
          <div className="text-center text-caption muted mb-3">
            {t("Your rating:", "تقييمك:")} {order.rating === "like" ? "👍" : "👎"} — {t("thank you!", "شكرًا لك!")}
          </div>
        )}

        <div className="rounded-2xl bg-[#F4F4F7] p-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-h3">{t("Items", "المكونات")}</div>
            <div className="text-caption muted">{order.items.length} {t("items", "عنصر")}</div>
          </div>
          {order.items.map((item) => (
            <div key={item.id} className="py-2 border-t border-[var(--color-border)] first:border-t-0 first:pt-0">
              <div className="flex justify-between gap-2">
                <div className="text-body font-semibold leading-tight">
                  {item.name} ×{item.quantity}
                  {item.sizeLabel && (
                    <span className="ml-2 text-tiny font-semibold muted">{item.sizeLabel}</span>
                  )}
                  {item.paidByCoupon && (
                    <span className="ml-2 text-tiny font-semibold text-[var(--color-primary-500)]">
                      {t("by coupon", "بالقسيمة")}
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
                    `${a.name}${a.portions > 1 ? ` ×${a.portions}` : ""} (${a.amount}${a.unit === "ml" ? t(" ml", " مل") : t(" g", " غ")})` +
                    (a.price > 0 ? ` +${(a.price * a.portions).toFixed(0)} AED` : "")
                  ).join(" • ")}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-[#F4F4F7] p-4 mb-3 space-y-2">
          <Row label={t("Subtotal", "المجموع الفرعي")} value={`${order.subtotal.toFixed(0)} AED`} />
          {order.couponDiscount > 0 && <Row label={t("Coupon", "القسيمة")} value={`−${order.couponDiscount.toFixed(0)} AED`} />}
          <div className="border-t border-[var(--color-border)] my-2" />
          <Row label={t("Total", "الإجمالي")} value={`${order.total.toFixed(0)} AED`} big />
          <div className="border-t border-[var(--color-border)] my-2" />
          <div className="text-caption muted">{t("Name", "الاسم")} · {order.customerName ?? "—"}</div>
          <div className="text-caption muted">{t("Car", "السيارة")} · {order.emirate} {order.carPlate}</div>
          <div className="text-caption muted">{t("Phone", "الهاتف")} · {order.phone}</div>
          <div className="text-caption muted">
            {t("Placed", "تم الطلب")} · {new Date(order.createdAt).toLocaleString(locale === "ar" ? "ar" : "en-GB", {
              day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>

        {/* история смен статусов (PUB-A-07 AC4) */}
        {order.events && order.events.length > 0 && (
          <div className="rounded-2xl bg-[#F4F4F7] p-4 mb-3">
            <div className="text-h3 mb-2">{t("History", "السجل")}</div>
            {order.events.map((e, i) => (
              <div key={i} className="flex justify-between text-caption py-1 border-t border-[var(--color-border)] first:border-t-0">
                <span>{eventLabel(e.type, e.status, locale)}</span>
                <span className="muted">{new Date(e.at).toLocaleString(locale === "ar" ? "ar" : "en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={() => router.push("/home")} className="btn-pill btn-soft btn-sm w-full">
          {t("Home", "الرئيسية")}
        </button>
      </div>

      {/* шторка оценки заказа (PUB-A-04) */}
      {showRating && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 animate-fadeIn" style={{ background: "rgba(0,0,0,0.45)" }}
               onClick={() => setShowRating(false)} />
          <div className="relative w-full max-w-[390px] bg-white rounded-t-[28px] px-6 pt-3 pb-8 animate-sheetUp">
            <div className="w-10 h-1.5 rounded-full mx-auto mb-5" style={{ background: "#E2E3E7" }} />
            <div className="text-center mb-6">
              <div className="text-h2">{t("How was your order?", "كيف كان طلبك؟")}</div>
              <div className="text-body muted mt-1.5">{t("Your feedback helps us improve", "ملاحظاتك تساعدنا على التحسّن")}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => rate("like")}
                      className="rounded-3xl py-5 flex flex-col items-center gap-2.5 active:scale-[0.97] transition"
                      style={{ background: "#E8F4EC" }}>
                <span className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm" style={{ color: "#15803D" }}>
                  <IconThumbUp size={30} />
                </span>
                <span className="font-semibold text-[15px]" style={{ color: "#15803D" }}>{t("Liked it", "أعجبني")}</span>
              </button>
              <button onClick={() => rate("dislike")}
                      className="rounded-3xl py-5 flex flex-col items-center gap-2.5 active:scale-[0.97] transition"
                      style={{ background: "#FCEDEA" }}>
                <span className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm" style={{ color: "#C0392B" }}>
                  <IconThumbDown size={30} />
                </span>
                <span className="font-semibold text-[15px]" style={{ color: "#C0392B" }}>{t("Could be better", "يمكن أن يكون أفضل")}</span>
              </button>
            </div>
            <button onClick={() => setShowRating(false)}
                    className="w-full text-center text-[15px] font-semibold muted py-4 mt-2">
              {t("Later", "لاحقًا")}
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

// визуальная схема статуса заказа: цвет/фон/иконка/подсказка
function statusVisual(order: ApiOrder, isRefund: boolean, t: (en: string, ar: string) => string, locale: Locale) {
  if (order.paymentStatus !== "paid")
    return { color: "#B45309", bg: "#FDF3E3", icon: "card" as const, label: statusLabel("unpaid", locale),
             hint: t("Order isn't paid — pay so we can start preparing", "الطلب غير مدفوع — ادفع لنبدأ بالتحضير") };
  if (isRefund)
    return { color: "#DC2626", bg: "#FCE9E9", icon: "refund" as const, label: statusLabel("refund", locale),
             hint: t("A refund has been issued for this order", "تم إصدار استرداد لهذا الطلب") };
  const map: Record<string, { color: string; bg: string; icon: "clock" | "check"; hint: string }> = {
    new: { color: "#3a3de0", bg: "#ECECFB", icon: "clock", hint: t("Order accepted — we'll start soon", "تم استلام الطلب — سنبدأ قريبًا") },
    in_progress: { color: "#3a3de0", bg: "#ECECFB", icon: "clock", hint: t("Already preparing your drink", "نحضّر مشروبك الآن") },
    ready: { color: "#15803D", bg: "#E6F4EA", icon: "check", hint: t("Your drink is ready — pick it up at the counter or we'll bring it to your car", "مشروبك جاهز — استلمه من المنضدة أو سنحضره إلى سيارتك") },
    completed: { color: "#15803D", bg: "#E6F4EA", icon: "check", hint: t("Order received — enjoy!", "تم استلام الطلب — بالهناء!") },
  };
  const m = map[order.status] ?? map.new;
  return { ...m, label: statusLabel(order.status, locale) };
}

// фирменные soft-filled глифы статуса (белые на цветном кружке)
function StatusGlyph({ kind }: { kind: "clock" | "check" | "card" | "refund" }) {
  if (kind === "check") // готов / получен — жирная округлая галочка
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.3 4.3L19 7" />
      </svg>
    );
  if (kind === "card") // не оплачен — soft-filled карта
    return (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff">
        <rect x="3" y="5.5" width="18" height="13" rx="2.6" />
        <rect x="3" y="9.2" width="18" height="2.4" fill="rgba(0,0,0,.28)" />
        <rect x="6" y="14.4" width="5" height="1.9" rx=".9" fill="rgba(0,0,0,.28)" />
      </svg>
    );
  if (kind === "refund") // возврат — округлая стрелка
    return (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 14l-4-4 4-4" /><path d="M5 10h9a5 5 0 0 1 0 10h-2" />
      </svg>
    );
  // готовим — фирменный стакан с трубочкой (soft-filled)
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff">
      <path d="M13 2.6l2.4 3.1" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M6.2 6.1h11.6a1 1 0 0 1 .99 1.16l-.13.8a.95.95 0 0 1-.94.8H6.28a.95.95 0 0 1-.94-.8l-.13-.8A1 1 0 0 1 6.2 6.1z" />
      <path d="M6.7 10.2h10.6l-1.05 8.5a2.1 2.1 0 0 1-2.08 1.84h-4.34a2.1 2.1 0 0 1-2.08-1.84L6.7 10.2z" />
    </svg>
  );
}

function eventLabel(type: string, status: string | null | undefined, locale: Locale): string {
  const ar = locale === "ar";
  if (type === "created") return ar ? "تم إنشاء الطلب" : "Order created";
  if (type === "paid") return ar ? "تم الدفع" : "Paid";
  if (type === "coupon_applied") return ar ? "تم تطبيق القسيمة" : "Coupon applied";
  if (type === "rated") return ar ? "تم التقييم" : "Rated";
  if (type === "refund") return ar ? "تم إصدار استرداد" : "Refund issued";
  if (type === "arrived") return ar ? "سجّلت وصولك" : "You marked arrival";
  const map: Record<string, { en: string; ar: string }> = {
    new: { en: "Accepted", ar: "تم القبول" },
    in_progress: { en: "Started preparing", ar: "بدأ التحضير" },
    ready: { en: "Ready for pickup", ar: "جاهز للاستلام" },
    arrived: { en: "You marked arrival", ar: "سجّلت وصولك" },
    completed: { en: "Handed over", ar: "تم التسليم" },
    refund: { en: "Refund", ar: "استرداد" },
  };
  const m = map[status ?? ""];
  if (m) return ar ? m.ar : m.en;
  return statusLabel(status ?? type, locale);
}
