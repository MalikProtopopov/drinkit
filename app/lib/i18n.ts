"use client";
import { useStore } from "./store";

// Локали сайта: только английский и арабский (русский убран).
export type Locale = "en" | "ar";

export function resolveLocale(v: unknown): Locale {
  return v === "ar" ? "ar" : "en";
}

/** Хук перевода: t("English text", "النص العربي") — выбирает строку по текущей локали. */
export function useT() {
  const locale = resolveLocale(useStore((s) => s.user.preferredLocale));
  return {
    locale,
    t: (en: string, ar: string) => (locale === "ar" ? ar : en),
  };
}

// Локализованные подписи статусов заказа (цвета — в STATUS_LABELS, lib/api.ts).
const STATUS: Record<string, { en: string; ar: string }> = {
  new: { en: "Accepted, waiting for barista", ar: "تم الاستلام، بانتظار الباريستا" },
  in_progress: { en: "Preparing", ar: "قيد التحضير" },
  ready: { en: "Ready — come over", ar: "جاهز — يمكنك القدوم" },
  arrived: { en: "You're here, bringing it out", ar: "أنت هنا، نحضره" },
  completed: { en: "Picked up", ar: "تم الاستلام" },
  refund: { en: "Refund", ar: "استرداد" },
  unpaid: { en: "Awaiting payment", ar: "بانتظار الدفع" },
};
const STEP: Record<string, { en: string; ar: string }> = {
  new: { en: "Accepted", ar: "تم القبول" },
  in_progress: { en: "Preparing", ar: "نحضّر" },
  ready: { en: "Ready", ar: "جاهز" },
  completed: { en: "Picked up", ar: "استلمت" },
};

export function statusLabel(status: string, locale: Locale): string {
  const e = STATUS[status] ?? STATUS.new;
  return locale === "ar" ? e.ar : e.en;
}
export function stepLabel(step: string, locale: Locale): string {
  const e = STEP[step] ?? STEP.new;
  return locale === "ar" ? e.ar : e.en;
}
