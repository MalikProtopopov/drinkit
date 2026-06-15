"use client";
import { useState, useEffect } from "react";
import { useT } from "@/lib/i18n";

export function CouponsSection({ open }: { open: boolean }) {
  const { t } = useT();
  const [coupons, setCoupons] = useState<{ id: number; status: string }[]>([]);
  useEffect(() => {
    if (!open) return;
    import("@/lib/api").then(({ api }) => api.coupons().then(setCoupons).catch(() => {}));
  }, [open]);
  const active = coupons.filter((c) => c.status === "active");
  if (active.length === 0) return null;
  return (
    <>
      <div className="font-black text-[19px] mt-6 mb-3 px-1" style={{ color: "var(--jooz-ink)" }}>{t("Coupons", "الكوبونات")}</div>
      {active.map((c) => (
        <div key={c.id} className="jooz-card w-full p-4 flex items-center gap-3 mb-2">
          <span className="text-xl">🎁</span>
          <div className="flex-1">
            <div className="font-extrabold text-[16px]" style={{ color: "var(--jooz-ink)" }}>{t("Free drink", "مشروب مجاني")}</div>
            <div className="text-[12px] mt-0.5" style={{ color: "var(--jooz-muted)" }}>{t("applied at checkout", "يُطبّق عند إتمام الطلب")}</div>
          </div>
        </div>
      ))}
    </>
  );
}
