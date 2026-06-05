"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { useStore, useCartTotal } from "@/lib/store";
import { emirates } from "@/lib/data";
import { api, type ApiCoupon, type ApiUser } from "@/lib/api";

export default function CheckoutPage() {
  const router = useRouter();
  const cart = useStore((s) => s.cart);
  const clearCart = useStore((s) => s.clearCart);
  const setUser = useStore((s) => s.setUser);
  const totals = useCartTotal();

  const [me, setMe] = useState<ApiUser | null>(null);
  const [name, setName] = useState("");
  const [emirate, setEmirate] = useState("Dubai");
  const [plate, setPlate] = useState("");
  const [coupons, setCoupons] = useState<ApiCoupon[]>([]);
  const [couponId, setCouponId] = useState<number | null>(null);
  const [couponLine, setCouponLine] = useState(0); // напиток выбирает клиент (PUB-A-05)
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PUB-A-01 AC4: предзаполнение из профиля отдельными запросами
  useEffect(() => {
    api.me()
      .then((u) => {
        setMe(u);
        setName(u.name ?? "");
        setPlate(u.carPlate ?? "");
        setEmirate(u.emirate ?? "Dubai");
      })
      .catch(() => router.replace("/auth/phone")); // route-guard (PUB-A-08)
    api.coupons().then((cs) => setCoupons(cs.filter((c) => c.status === "active"))).catch(() => {});
  }, [router]);

  const canSubmit = plate.trim().length >= 2 && name.trim().length >= 1 && cart.length > 0;

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const locale = useStore.getState().user.preferredLocale === "ar" ? "ar" : "ru";
      const order = await api.placeOrder({
        items: cart.map((i) => ({
          drinkId: i.drinkId!, quantity: i.quantity, customName: i.customName,
          addons: i.serverAddons ?? [],
        })),
        customerName: name.trim(), carPlate: plate.trim(), emirate,
        couponId: couponId ?? undefined,
        couponItemIndex: couponId != null ? couponLine : undefined,
      }, locale);
      setUser({ name: name.trim(), defaultCarPlate: plate.trim(), defaultEmirate: emirate });
      clearCart();
      router.push(`/payment?orderId=${order.id}&total=${order.total}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать заказ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col">
      <TopBar title="Оформление" back />

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-32">
        <Section title="Контакт">
          <div className="rounded-2xl bg-[#F4F4F7] px-4 h-14 flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-[var(--color-success)]/15 text-[var(--color-success)] flex items-center justify-center text-sm">✓</span>
            <div className="flex-1">
              <div className="text-body font-semibold">{me?.phone ?? "…"}</div>
              <div className="text-tiny muted">подтверждён</div>
            </div>
          </div>
        </Section>

        <Section title="Имя">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Как тебя зовут?"
                 className="w-full h-14 rounded-2xl bg-[#F4F4F7] px-4 text-body font-medium outline-none" />
        </Section>

        <Section title="Машина">
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <select value={emirate} onChange={(e) => setEmirate(e.target.value)}
                    className="min-w-0 h-14 rounded-2xl bg-[#F4F4F7] px-3 text-body font-medium outline-none truncate">
              {emirates.map((em) => <option key={em}>{em}</option>)}
            </select>
            <input value={plate}
                   onChange={(e) => setPlate(e.target.value.replace(/[^a-zA-Z0-9 ]/g, "").toUpperCase())}
                   placeholder="O 12345"
                   className="min-w-0 h-14 rounded-2xl bg-[#F4F4F7] px-4 text-h3 font-semibold tracking-wider outline-none" />
          </div>
          <div className="text-tiny muted mt-2 px-1">Бариста увидит номер и вынесет заказ к авто</div>
        </Section>

        {coupons.length > 0 && (
          <Section title="Купон на бесплатный напиток">
            <div className="rounded-2xl bg-[#F4F4F7] p-4 space-y-3">
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={couponId !== null}
                       onChange={(e) => setCouponId(e.target.checked ? coupons[0].id : null)}
                       className="w-5 h-5 accent-[var(--color-primary-500)]" />
                <span className="text-body font-medium">Применить купон №{coupons[0].id}</span>
              </label>
              {couponId !== null && (
                <div>
                  <div className="text-tiny muted mb-2">Какой напиток списать купоном:</div>
                  <div className="flex flex-col gap-1">
                    {cart.map((i, idx) => (
                      <label key={i.lineId} className="flex items-center gap-2 text-body">
                        <input type="radio" name="couponLine" checked={couponLine === idx}
                               onChange={() => setCouponLine(idx)}
                               className="accent-[var(--color-primary-500)]" />
                        {i.customName || i.productName} · {i.unitPriceAed.toFixed(0)} AED
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}

        <div className="mt-4 rounded-2xl bg-[#F4F4F7] p-4 space-y-2">
          <Row label={`Подытог · ${totals.count} поз.`} value={`${totals.subtotal.toFixed(0)} AED`} />
          {couponId !== null && cart[couponLine] && (
            <Row label="Купон" value={`−${cart[couponLine].unitPriceAed.toFixed(0)} AED`} />
          )}
          <div className="border-t border-[var(--color-border)] my-2" />
          <Row label="Итого"
               value={`${Math.max(0, totals.subtotal - (couponId !== null ? cart[couponLine]?.unitPriceAed ?? 0 : 0)).toFixed(0)} AED`}
               big />
        </div>

        {error && <div className="mt-3 text-center text-caption" style={{ color: "var(--color-error)" }}>{error}</div>}
      </div>

      <div className="sticky bottom-0 left-0 right-0 px-4 pt-3 pb-safe bg-gradient-to-t from-white via-white to-transparent">
        <button onClick={submit} disabled={!canSubmit || submitting} className="btn-pill btn-primary w-full">
          {submitting ? "Создаём заказ…" : "Перейти к оплате"}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="text-caption font-semibold muted uppercase tracking-wide mb-2 px-1">{title}</div>
      {children}
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
