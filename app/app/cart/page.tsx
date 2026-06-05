"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore, useCartTotal } from "@/lib/store";
import { getToken } from "@/lib/api";
import { TopBar } from "@/components/TopBar";
import { DrinkArt } from "@/components/DrinkArt";
import { StepperButton } from "@/components/StepperButton";

export default function CartPage() {
  const router = useRouter();
  const cart = useStore((s) => s.cart);
  const updateQty = useStore((s) => s.updateQty);
  const totals = useCartTotal();

  const goCheckout = () => {
    // PUB-G-04: вход требуется только при оформлении; корзина сохраняется
    if (!getToken()) router.push("/auth/phone");
    else router.push("/checkout");
  };

  if (cart.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <TopBar title="Корзина" back />
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="mb-6">
            <DrinkArt glass="smoothie" liquid="#D6E8D9" foam="#E8F0E9" garnish="mint" straw size={180} />
          </div>
          <div className="text-h2 mb-2">Корзина пуста</div>
          <div className="muted text-body mb-8">Загляни в меню, чтобы добавить любимый напиток</div>
          <Link href="/home" className="btn-pill btn-primary px-8">К меню</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Корзина" back />

      <div className="flex-1 overflow-y-auto px-4 pb-40">
        <div className="flex flex-col gap-3">
          {cart.map((item) => (
            <div key={item.lineId}
                 className="rounded-2xl bg-white border border-[var(--color-border)] p-3 flex gap-3">
              <div className="relative w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                   style={{ background: item.productBg }}>
                <DrinkArt glass="tall" liquid="#F0A340" size={70} showShadow={false} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-h3 leading-tight truncate">{item.customName || item.productName}</div>
                {item.customName && <div className="text-tiny muted truncate">{item.productName}</div>}
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

        <div className="mt-4 rounded-2xl bg-[#F4F4F7] p-4 space-y-2">
          <Row label={`Итого · ${totals.count} поз.`} value={`${totals.subtotal.toFixed(0)} AED`} big />
          <div className="text-tiny muted">Купон на бесплатный напиток можно применить на оформлении</div>
        </div>
      </div>

      <div className="sticky bottom-0 left-0 right-0 px-4 pt-3 pb-safe bg-gradient-to-t from-white via-white to-transparent">
        <button onClick={goCheckout} className="btn-pill btn-primary w-full">
          Оформить · {totals.subtotal.toFixed(0)} AED
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
