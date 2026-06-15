"use client";
import { STATUS_LABELS, type ApiOrder } from "@/lib/api";
import { statusLabel } from "@/lib/i18n";

/** Карточка заказа в списках «в работе» / «история». */
export function OrderCard({
  order: o, locale, t, onOpen,
}: {
  order: ApiOrder;
  locale: "en" | "ar";
  t: (en: string, ar: string) => string;
  onOpen: (id: number) => void;
}) {
  const st = STATUS_LABELS[o.status] ?? STATUS_LABELS.new;
  const drinks = o.items.map((i) => i.name).join(", ");
  return (
    <button onClick={() => onOpen(o.id)}
            className="jooz-card w-full p-3.5 flex items-center gap-3 text-left active:scale-[0.99] transition">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-tiny font-bold px-2 py-0.5 rounded-full"
                style={{ color: st.color, background: `${st.color}1a` }}>{statusLabel(o.status, locale)}</span>
          <span className="text-tiny font-semibold" style={{ color: "var(--jooz-muted-2)" }}>{t("No.", "رقم")} {o.number}</span>
        </div>
        <div className="font-semibold text-[14px] truncate" style={{ color: "var(--jooz-ink)" }}>{drinks || "—"}</div>
      </div>
      <div className="flex items-center gap-2 flex-none">
        <span className="font-extrabold text-[15px]" style={{ color: "var(--jooz-ink)" }}>{o.total.toFixed(0)} AED</span>
        <span className="jooz-arrow">→</span>
      </div>
    </button>
  );
}
