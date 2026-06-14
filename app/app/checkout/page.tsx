"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { useStore, useCartTotal } from "@/lib/store";
import { emirates } from "@/lib/data";
import { api, type ApiCoupon, type ApiUser } from "@/lib/api";
import { maskName, maskPhoneUAE, maskPlate } from "@/lib/masks";
import { IconPhone } from "@/components/icons";
import { useT } from "@/lib/i18n";

export default function CheckoutPage() {
  const router = useRouter();
  const { t } = useT();
  // позиции без drinkId добавлены старым прототипом — заказать их нельзя (защита от 422)
  const rawCart = useStore((s) => s.cart);
  const cart = rawCart.filter((i) => typeof i.drinkId === "number");
  const legacyCount = rawCart.length - cart.length;
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

  // PUB-A-01 AC4: предзаполнение из профиля по JWT, с фолбэком на локальные данные ЛК
  useEffect(() => {
    api.me()
      .then((u) => {
        setMe(u);
        // источник истины — бэкенд; если там пусто, берём из локального профиля (ЛК)
        const local = useStore.getState().user;
        const name = u.name || local.name || "";
        const plate = u.carPlate || local.defaultCarPlate || "";
        const emirate = u.emirate || local.defaultEmirate || "Dubai";
        setName(maskName(name));
        setPlate(maskPlate(plate));
        setEmirate(emirate);
        // дозаписываем на бэкенд то, что было только локально (чтобы сохранилось в аккаунте)
        const patch: { name?: string; carPlate?: string; emirate?: string } = {};
        if (!u.name && name) patch.name = name;
        if (!u.carPlate && plate) patch.carPlate = plate;
        if (!u.emirate && emirate) patch.emirate = emirate;
        if (Object.keys(patch).length) api.updateMe(patch).catch(() => {});
      })
      .catch(() => router.replace("/auth/phone?next=/checkout")); // route-guard (PUB-A-08)
    api.coupons().then((cs) => setCoupons(cs.filter((c) => c.status === "active"))).catch(() => {});
  }, [router]);

  const plateClean = plate.replace(/\s/g, "");
  const nameOk = name.trim().length >= 1;
  const plateOk = plateClean.length >= 2;
  const phoneOk = Boolean(me?.phone);
  const canSubmit = nameOk && plateOk && phoneOk && cart.length > 0;

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const locale = useStore.getState().user.preferredLocale === "ar" ? "ar" : "en";
      const order = await api.placeOrder({
        items: cart.map((i) => ({
          drinkId: i.drinkId!, quantity: i.quantity, customName: i.customName,
          sizeId: i.sizeId, addons: i.serverAddons ?? [],
        })),
        customerName: name.trim(), carPlate: plate.trim(), emirate,
        couponId: couponId ?? undefined,
        couponItemIndex: couponId != null ? couponLine : undefined,
      }, locale);
      setUser({ name: name.trim(), defaultCarPlate: plate.trim(), defaultEmirate: emirate });
      clearCart();
      // сразу открываем оплату Stripe (без отдельной страницы /payment)
      const pay = await api.checkout(order.id);
      if (pay.mock) router.replace(`/orders/${order.id}`);
      else window.location.href = pay.checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Couldn’t place the order", "تعذّر إتمام الطلب"));
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col">
      <TopBar title={t("Checkout", "إتمام الطلب")} back />

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-32">
        {/* контакт: телефон по которому авторизованы; можно изменить (re-auth) */}
        <Section title={t("Phone", "الهاتف")} required>
          <div className="w-full h-14 rounded-2xl bg-[#F4F4F7] px-4 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <IconPhone size={18} className="flex-none" style={{ color: "var(--color-text-muted)" }} />
              <span className="text-body font-semibold truncate">{me?.phone ? maskPhoneUAE(me.phone) : "…"}</span>
            </div>
            <button onClick={() => router.push("/auth/phone?next=/checkout")}
                    className="text-caption font-semibold text-[var(--color-primary-500)] px-2 flex-none">
              {t("Change", "تغيير")}
            </button>
          </div>
        </Section>

        <Section title={t("Name", "الاسم")} required>
          <input value={name} onChange={(e) => setName(maskName(e.target.value))} placeholder={t("What’s your name?", "ما اسمك؟")}
                 className={inputCls} />
        </Section>

        <Section title={t("Car plate", "لوحة السيارة")} required>
          {/* превью номерного знака — как в профиле */}
          <div className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 mb-3" style={{ background: "#fcfcfa", border: "2.5px solid #15171c" }}>
            <div className="flex flex-col leading-[1.05]">
              <div className="text-[10px] font-black" style={{ color: "#c0392b" }}>{emirate}</div>
              <div className="text-[8.5px] font-extrabold tracking-[1px] mt-0.5" style={{ color: "#15171c" }}>U.A.E</div>
            </div>
            <div className="w-[1.5px] h-8" style={{ background: "#dcdcd6" }} />
            <div className="font-black text-[26px] tracking-wide flex-1 text-center" style={{ color: "#15171c" }}>{plate || "—"}</div>
          </div>
          {/* эмират — горизонтальный слайдер (скроллится влево/вправо) */}
          <div className="overflow-x-auto no-scrollbar -mx-4 px-4">
            <div className="flex gap-2 w-max">
              {emirates.map((em) => {
                const active = emirate === em;
                return (
                  <button key={em} onClick={() => setEmirate(em)}
                          className="flex-none whitespace-nowrap px-3.5 py-2 rounded-full font-extrabold text-[14px]"
                          style={{ background: active ? "var(--color-primary-500)" : "#f2f3f6", color: active ? "#fff" : "var(--jooz-ink)" }}>{em}</button>
                );
              })}
            </div>
          </div>
          <input value={plate}
                 onChange={(e) => setPlate(maskPlate(e.target.value))}
                 placeholder="A 82741" inputMode="text" autoCapitalize="characters"
                 className={`${inputCls} tracking-wider mt-3`} />
          <div className="text-tiny muted mt-2 px-1">{t("The barista will see the plate and bring your order to the car", "سيرى الباريستا اللوحة ويحضر طلبك إلى السيارة")}</div>
        </Section>

        {coupons.length > 0 && (
          <Section title={t("Free drink coupon", "قسيمة مشروب مجاني")}>
            <div className="rounded-2xl bg-[#F4F4F7] p-4 space-y-3">
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={couponId !== null}
                       onChange={(e) => setCouponId(e.target.checked ? coupons[0].id : null)}
                       className="w-5 h-5 accent-[var(--color-primary-500)]" />
                <span className="text-body font-medium">{t(`Apply coupon #${coupons[0].id}`, `تطبيق القسيمة رقم ${coupons[0].id}`)}</span>
              </label>
              {couponId !== null && (
                <div>
                  <div className="text-tiny muted mb-2">{t("Which drink to redeem with the coupon:", "أي مشروب تريد خصمه بالقسيمة:")}</div>
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
          <Row label={t(`Subtotal · ${totals.count} item${totals.count === 1 ? "" : "s"}`, `المجموع الفرعي · ${totals.count} عنصر`)} value={`${totals.subtotal.toFixed(0)} AED`} />
          {couponId !== null && cart[couponLine] && (
            <Row label={t("Coupon", "القسيمة")} value={`−${cart[couponLine].unitPriceAed.toFixed(0)} AED`} />
          )}
          <div className="border-t border-[var(--color-border)] my-2" />
          <Row label={t("Total", "الإجمالي")}
               value={`${Math.max(0, totals.subtotal - (couponId !== null ? cart[couponLine]?.unitPriceAed ?? 0 : 0)).toFixed(0)} AED`}
               big />
        </div>

        {legacyCount > 0 && (
          <div className="mt-3 text-center text-caption muted">
            {t(`${legacyCount} item${legacyCount === 1 ? "" : "s"} from the old cart version ${legacyCount === 1 ? "is" : "are"} unavailable and won’t be included in the order — add the drinks again from the menu`, `${legacyCount} عنصر من النسخة القديمة للسلة غير متاح ولن يُضاف إلى الطلب — أضف المشروبات مرة أخرى من القائمة`)}
          </div>
        )}

        {error && <div className="mt-3 text-center text-caption" style={{ color: "var(--color-error)" }}>{error}</div>}
      </div>

      <div className="sticky bottom-0 left-0 right-0 px-4 pt-3 pb-safe bg-gradient-to-t from-white via-white to-transparent">
        <button onClick={submit} disabled={!canSubmit || submitting}
                className="w-full h-14 rounded-full flex items-center justify-center gap-2 text-white text-h3 font-semibold active:scale-[0.99] transition disabled:opacity-50"
                style={{ background: "#635BFF" }}>
          {submitting ? t("Opening payment…", "جارٍ فتح الدفع…") : t(`Pay with Stripe · ${Math.max(0, totals.subtotal - (couponId !== null ? cart[couponLine]?.unitPriceAed ?? 0 : 0)).toFixed(0)} AED`, `الدفع عبر Stripe · ${Math.max(0, totals.subtotal - (couponId !== null ? cart[couponLine]?.unitPriceAed ?? 0 : 0)).toFixed(0)} AED`)}
        </button>
        <div className="mt-2 text-tiny muted text-center">{t("Card · Apple Pay · Google Pay — on the secure Stripe page", "بطاقة · Apple Pay · Google Pay — على صفحة Stripe الآمنة")}</div>
      </div>
    </div>
  );
}

// единый стиль полей ввода на оформлении (с фокус-кольцом)
const inputCls =
  "w-full h-14 rounded-2xl bg-[#F4F4F7] px-4 text-body font-medium outline-none " +
  "focus:bg-white focus:ring-2 focus:ring-[var(--color-primary-500)] transition";

function Section({ title, required, children }: { title: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="text-caption font-semibold muted uppercase tracking-wide mb-2 px-1">
        {title}{required && <span style={{ color: "var(--color-error)" }}> *</span>}
      </div>
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
