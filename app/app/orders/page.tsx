"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { DrinkArt } from "@/components/DrinkArt";
import { api, getToken, STATUS_LABELS, type ApiOrder } from "@/lib/api";
import { useT } from "@/lib/i18n";

export default function OrdersPage() {
  // PUB-A-07: список заказов клиента с бэкенда
  const { t } = useT();
  const [orders, setOrders] = useState<ApiOrder[] | null>(null);
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    if (!getToken()) { setGuest(true); setOrders([]); return; }
    api.myOrders().then(setOrders).catch(() => setOrders([]));
  }, []);

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Заказы" showCart />

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {orders === null ? (
          <div className="text-center muted py-20">Загрузка…</div>
        ) : orders.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4">
              <DrinkArt glass="paper" liquid="#C2A07A" foam="#F5E8D0" size={140} />
            </div>
            <div className="text-h3 mb-1">Здесь будут твои заказы</div>
            <div className="muted text-body mb-4">
              {guest ? "Войди, чтобы видеть историю" : "Сделай первый — это быстро"}
            </div>
            {guest && (
              <Link href="/auth/phone" className="btn-pill btn-primary px-8">Войти</Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 mt-2">
            {orders.map((o) => {
              const st = STATUS_LABELS[o.status] ?? STATUS_LABELS.new;
              return (
                <Link key={o.id} href={`/orders/${o.id}`}
                      className="rounded-2xl bg-white border border-[var(--color-border)] p-4 flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0 bg-[#F4EEE4]">
                    <DrinkArt glass="tall" liquid="#F0A340" size={48} showShadow={false} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-body font-semibold leading-tight">№ {o.number}</div>
                    <div className="text-caption muted line-clamp-1">
                      {o.items.map((i) => i.name).join(", ")}
                    </div>
                    <div className="text-tiny font-semibold mt-1" style={{ color: st.color }}>
                      {o.paymentStatus !== "paid" ? t("status.unpaid") : t(`status.${o.status}`)}
                    </div>
                  </div>
                  <div className="text-h3 font-semibold">{o.total.toFixed(0)}</div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
