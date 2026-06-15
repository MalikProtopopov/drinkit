"use client";
import { useState, useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { api, getToken, setToken, type ApiOrder } from "@/lib/api";
import { normalizePhoneUAE } from "@/lib/masks";

const ORDERS_PAGE = 10; // последние 10, дальше — ленивая подгрузка
// «в работе» = открытые статусы (зеркало ACTIVE_STATUSES на бэке); остальное — закрытые → история
const ACTIVE_STATUSES = new Set(["new", "in_progress", "ready"]);

/**
 * Загрузка и ленивая подгрузка истории заказов профиля.
 * Возвращает заказы, sentinel-ref и количество видимых элементов истории.
 */
export function useMyOrders(open: boolean) {
  const [orders, setOrders] = useState<ApiOrder[] | null>(null);
  const [visibleCount, setVisibleCount] = useState(ORDERS_PAGE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setVisibleCount(ORDERS_PAGE);
    if (!getToken()) { setOrders([]); return; }
    api.myOrders().then(setOrders).catch(() => setOrders([]));
  }, [open]);

  // ленивая подгрузка истории: показываем по +10 при достижении конца списка
  useEffect(() => {
    if (!open || !orders) return;
    const historyLen = orders.filter((o) => !ACTIVE_STATUSES.has(o.status)).length;
    if (visibleCount >= historyLen) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setVisibleCount((c) => c + ORDERS_PAGE);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [open, orders, visibleCount]);

  return { orders, visibleCount, sentinelRef };
}

/**
 * Обновление профиля: переключение локали + сохранение имени/телефона и машины.
 * Инкапсулирует прямые вызовы api.updateMe() / requestCode / verify.
 */
export function useProfileUpdate() {
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);

  const setLocale = async (code: "en" | "ar") => {
    setUser({ preferredLocale: code });
    try { await api.updateMe({ locale: code }); } catch {}
  };

  const saveInfo = async (nameDraft: string, phoneDraft: string) => {
    const n = nameDraft.trim();
    const phone = normalizePhoneUAE(phoneDraft) || user.phone;
    setUser({ name: n, phone });
    try {
      // если ещё не авторизованы и указан телефон — входим по номеру (OTP сейчас выключен),
      // чтобы данные реально сохранялись на бэкенде, а не только локально
      if (!getToken() && phone) {
        const r = await api.requestCode(phone);
        if (r.otpRequired === false) {
          const loc = user.preferredLocale === "ar" ? "ar" : "en";
          const v = await api.verify(phone, "", n || undefined, loc);
          setToken(v.token);
          // подтянем уже сохранённые на бэке данные (если пользователь возвращается)
          setUser({
            name: n || v.user.name || undefined,
            defaultCarPlate: user.defaultCarPlate || v.user.carPlate || undefined,
            defaultEmirate: user.defaultEmirate || v.user.emirate || undefined,
          });
        }
      }
      // отправляем имя + уже сохранённые локально машину/эмират
      if (getToken()) await api.updateMe({
        name: n,
        carPlate: user.defaultCarPlate || undefined,
        emirate: user.defaultEmirate || undefined,
      });
    } catch {}
  };

  const saveCar = async (plate: string, emirate: string) => {
    const cp = plate.trim();
    setUser({ defaultCarPlate: cp, defaultEmirate: emirate });
    try {
      // если ещё не авторизованы, но телефон известен — входим по номеру, чтобы машина
      // реально сохранилась на бэкенде (а не только в локальном профиле)
      if (!getToken() && user.phone) {
        const r = await api.requestCode(user.phone);
        if (r.otpRequired === false) {
          const loc = user.preferredLocale === "ar" ? "ar" : "en";
          const v = await api.verify(user.phone, "", user.name || undefined, loc);
          setToken(v.token);
        }
      }
      if (getToken()) await api.updateMe({ carPlate: cp, emirate, name: user.name || undefined });
    } catch {}
  };

  return { setLocale, saveInfo, saveCar };
}
