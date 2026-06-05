"use client";
import { useStore } from "./store";

// PUB-A-09 AC7: системные UI-строки клиента в выбранной локали с fallback на RU.
// DECISION: словарь UI-строк живёт в коде (контент-переводы — в JSON-полях сущностей через API);
// управление UI-строками из админки (таблица ui_translations на бэке) — следующая итерация.
const DICT: Record<string, { ru: string; ar: string }> = {
  "nav.home": { ru: "Главная", ar: "الرئيسية" },
  "nav.menu": { ru: "Меню", ar: "القائمة" },
  "nav.orders": { ru: "Заказы", ar: "الطلبات" },
  "nav.profile": { ru: "Профиль", ar: "الملف" },
  "btn.addToCart": { ru: "В корзину", ar: "أضف إلى السلة" },
  "btn.checkout": { ru: "Оформить", ar: "إتمام الطلب" },
  "btn.pay": { ru: "Оплатить", ar: "ادفع" },
  "btn.arrived": { ru: "Прибыл, готов забрать", ar: "وصلت، جاهز للاستلام" },
  "btn.toMenu": { ru: "К меню", ar: "إلى القائمة" },
  "btn.rate": { ru: "Оценить заказ", ar: "قيّم الطلب" },
  "cart.empty": { ru: "Корзина пуста", ar: "السلة فارغة" },
  "cart.title": { ru: "Корзина", ar: "السلة" },
  "status.new": { ru: "принят, ждёт бариста", ar: "تم الاستلام، بانتظار الباريستا" },
  "status.in_progress": { ru: "готовим", ar: "قيد التحضير" },
  "status.ready": { ru: "готов — можно ехать", ar: "جاهز — يمكنك القدوم" },
  "status.arrived": { ru: "вы на месте, несём", ar: "أنت هنا، نحضره" },
  "status.completed": { ru: "получен", ar: "تم الاستلام" },
  "status.refund": { ru: "возврат", ar: "استرداد" },
  "status.unpaid": { ru: "ожидает оплаты", ar: "بانتظار الدفع" },
  "step.new": { ru: "Принят", ar: "تم القبول" },
  "step.in_progress": { ru: "Готовим", ar: "نحضّر" },
  "step.ready": { ru: "Готов", ar: "جاهز" },
  "step.arrived": { ru: "Вы на месте", ar: "وصلت" },
  "step.completed": { ru: "Получен", ar: "استلمت" },
};

export function tr(key: string, locale: "ru" | "ar"): string {
  const e = DICT[key];
  if (!e) return key;
  return locale === "ar" ? e.ar || e.ru : e.ru;
}

/** Хук: перевод по текущей локали пользователя. */
export function useT() {
  const locale = useStore((s) => s.user.preferredLocale) === "ar" ? "ar" : "ru";
  return { t: (key: string) => tr(key, locale as "ru" | "ar"), locale: locale as "ru" | "ar" };
}
