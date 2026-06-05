"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { api } from "@/lib/api";

function PaymentInner() {
  const router = useRouter();
  const search = useSearchParams();
  const orderId = Number(search.get("orderId"));
  const total = search.get("total") ?? "—";

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    if (!orderId || processing) return;
    setProcessing(true);
    setError(null);
    try {
      // PUB-A-02: hosted-форма Stripe; в mock-режиме оплата подтверждается сразу
      const r = await api.checkout(orderId);
      if (r.mock) router.replace(`/orders/${orderId}`);
      else window.location.href = r.checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Оплата не прошла, попробуйте ещё раз");
      setProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Оплата" back />

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="text-center mt-4 mb-8">
          <div className="text-display">{total} AED</div>
          <div className="muted text-body mt-1">К оплате</div>
        </div>

        <button onClick={pay} disabled={processing}
                className="w-full h-16 rounded-2xl flex items-center justify-center gap-3 active:scale-[0.99] transition disabled:opacity-60 text-white text-h3 font-semibold"
                style={{ background: "#635BFF" }}>
          {processing ? "Открываем оплату…" : "Оплатить через Stripe"}
        </button>

        <div className="mt-3 text-tiny muted text-center">
          Карта · Apple Pay · Google Pay — на защищённой странице Stripe
        </div>

        {error && (
          <div className="mt-4 text-center text-caption" style={{ color: "var(--color-error)" }}>
            {error} — заказ не оплачен, можно повторить
          </div>
        )}

        <div className="mt-8 text-tiny muted text-center px-4 leading-relaxed">
          Оплата обрабатывается Stripe. Мы не храним данные карты. Заказ
          считается оплаченным после подтверждения платёжной системой.
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <PaymentInner />
    </Suspense>
  );
}
