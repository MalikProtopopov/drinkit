"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore, useCartTotal } from "@/lib/store";
import { getToken } from "@/lib/api";
import { TopBar } from "@/components/TopBar";
import { DrinkArt } from "@/components/DrinkArt";
import { StepperButton } from "@/components/StepperButton";
import { IconBag, IconPlus } from "@/components/icons";
import { useT } from "@/lib/i18n";

export default function CartPage() {
  const { t } = useT();
  const router = useRouter();
  const cart = useStore((s) => s.cart);
  const updateQty = useStore((s) => s.updateQty);
  const totals = useCartTotal();

  const goCheckout = () => {
    // PUB-G-04: вход требуется только при оформлении; корзина сохраняется
    if (!getToken()) router.push("/auth/phone?next=/checkout");
    else router.push("/checkout");
  };

  if (cart.length === 0) {
    return (
      <div className="jooz-page flex-1 flex flex-col">
        <TopBar title={t("Cart", "السلة")} back />
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center -mt-10">
          {/* мягкий круг с иконкой корзины + бейдж «0» */}
          <div className="relative mb-7">
            <div className="w-40 h-40 rounded-full flex items-center justify-center"
                 style={{ background: "radial-gradient(circle at 50% 32%, var(--color-primary-100), #E7E9EF)" }}>
              <IconBag size={66} style={{ color: "var(--color-primary-500)" }} />
            </div>
            <span className="absolute top-1 right-1 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-[17px] font-extrabold"
                  style={{ color: "var(--color-primary-500)" }}>0</span>
          </div>

          <div className="font-black text-[24px]" style={{ color: "var(--jooz-ink)" }}>{t("Your cart is empty", "سلتك فارغة")}</div>
          <div className="text-[15px] mt-2 max-w-[260px] leading-snug" style={{ color: "var(--jooz-muted)" }}>
            {t("Add a fresh juice, smoothie or shot from the menu — it takes just a few seconds", "أضِف عصيرًا طازجًا أو سموذي أو شوت من القائمة — لن يستغرق سوى ثوانٍ معدودة")}
          </div>

          <Link href="/home" className="jooz-cta mt-7" style={{ width: "auto", paddingInline: 34 }}>
            {t("Browse drinks", "تصفّح المشروبات")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title={t("Cart", "السلة")} back />

      <div className="flex-1 overflow-y-auto px-4 pb-40">
        <div className="flex flex-col gap-3">
          {cart.map((item) => (
            <div key={item.lineId}
                 className="rounded-2xl bg-white border border-[var(--color-border)] p-3 flex gap-3">
              <div className="relative w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                   style={{ background: item.productBg }}>
                {item.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.previewUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <DrinkArt glass="tall" liquid="#F0A340" size={70} showShadow={false} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-h3 leading-tight truncate">{item.customName || item.productName}</div>
                {item.customName && <div className="text-tiny muted truncate">{item.productName}</div>}
                {item.sizeLabel && (
                  <div className="text-tiny font-semibold mt-0.5" style={{ color: "var(--color-primary-500)" }}>{item.sizeLabel}</div>
                )}
                {item.addonsLabel && (
                  <div className="text-tiny muted mt-1 line-clamp-2">{item.addonsLabel}</div>
                )}
                <div className="flex items-center justify-between mt-2">
                  <div className="text-[15px] font-semibold">
                    {(item.unitPriceAed * item.quantity).toFixed(0)} AED
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <StepperButton icon="minus" size={32} onClick={() => updateQty(item.lineId, -1)} />
                    <span className="min-w-[20px] text-center font-semibold">{item.quantity}</span>
                    <StepperButton icon="plus" size={32} variant="primary"
                                   onClick={() => updateQty(item.lineId, 1)} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* добавить ещё напитки из каталога */}
        <button onClick={() => router.push("/home")}
                className="mt-3 w-full h-12 rounded-2xl flex items-center justify-center gap-2 font-semibold text-[15px] active:scale-[0.99] transition"
                style={{ background: "#fff", border: "2px dashed var(--color-border)", color: "var(--color-primary-500)" }}>
          <IconPlus size={18} /> {t("Add more drinks", "أضِف مشروبات أخرى")}
        </button>

        <div className="mt-4 rounded-2xl bg-[#F4F4F7] p-4 space-y-2">
          <Row label={`${t("Total", "الإجمالي")} · ${totals.count} ${t("items", "عنصر")}`} value={`${totals.subtotal.toFixed(0)} AED`} big />
          <div className="text-tiny muted">{t("A free-drink coupon can be applied at checkout", "يمكن تطبيق قسيمة المشروب المجاني عند الدفع")}</div>
        </div>
      </div>

      <div className="sticky bottom-0 left-0 right-0 px-4 pt-3 pb-safe bg-gradient-to-t from-white via-white to-transparent">
        <button onClick={goCheckout} className="btn-pill btn-primary w-full">
          {t("Checkout", "الدفع")} · {totals.subtotal.toFixed(0)} AED
        </button>
      </div>
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
