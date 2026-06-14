"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Flag } from "@/components/Flag";
import { useStore } from "@/lib/store";
import { api, getToken } from "@/lib/api";
import { uaeLocalDigits } from "@/lib/masks";
import { useT } from "@/lib/i18n";

/** Группировка локальной части номера ОАЭ: «50 123 4567». */
function groupLocal(digits: string) {
  const d = digits.slice(0, 9);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 9)].filter(Boolean).join(" ");
}

export default function PhonePage() {
  const router = useRouter();
  const { t } = useT();
  const setUser = useStore((s) => s.setUser);
  // префилл из профиля: если телефон уже вводили — подставляем его локальную часть
  const savedPhone = useStore((s) => s.user.phone);
  const [digits, setDigits] = useState(() => uaeLocalDigits(savedPhone ?? ""));
  const [agreed, setAgreed] = useState(true);
  const [sending, setSending] = useState(false);

  // если уже авторизованы — подставляем телефон с бэкенда (источник истины)
  useEffect(() => {
    if (!getToken()) return;
    api.me().then((u) => { if (u.phone) setDigits(uaeLocalDigits(u.phone)); }).catch(() => {});
  }, []);

  const valid = digits.length === 9;

  const submit = async () => {
    if (!valid || sending) return;
    // G02 (PUB-G-04 AC2): запоминаем, куда вернуть после входа (например /checkout)
    const next = new URLSearchParams(window.location.search).get("next");
    if (next) sessionStorage.setItem("juicy-auth-next", next);
    const phone = "+971" + digits;
    setSending(true);
    try {
      const { api, setToken } = await import("@/lib/api");
      const r = await api.requestCode(phone);
      setUser({ phone });
      if (r.otpRequired === false) {
        // OTP выключен (решение владельца): телефон — контакт для выдачи, входим сразу
        const locale = useStore.getState().user.preferredLocale;
        const v = await api.verify(phone, "", undefined, locale === "ar" ? "ar" : "en");
        setToken(v.token);
        useStore.getState().setUser({
          name: v.user.name ?? undefined,
          defaultCarPlate: v.user.carPlate ?? undefined,
          defaultEmirate: v.user.emirate ?? undefined,
          preferredLocale: v.user.locale === "ar" ? "ar" : "en",
        });
        // имя/машину больше не спрашиваем отдельным экраном — это поля /checkout
        const nextUrl = sessionStorage.getItem("juicy-auth-next");
        sessionStorage.removeItem("juicy-auth-next");
        router.push(nextUrl || "/home");
        return;
      }
      // OTP включён (когда подключим SMS-провайдера) — обычный флоу с кодом
      if (r.devCode) sessionStorage.setItem("juicy-dev-otp", r.devCode);
      router.push("/auth/otp");
    } catch {
      setUser({ phone });
      router.push("/auth/otp");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
      <header className="flex items-center justify-between px-4 pt-safe pb-2 h-16">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-[#F2F2F4] flex items-center justify-center"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="text-h3 font-semibold">{t("Phone number", "رقم الهاتف")}</div>
        <div className="w-10" />
      </header>

      <div className="flex-1 flex flex-col px-6 pt-6">
        <div className="text-center muted text-body mb-8">
          {t(
            "Enter your phone number — the barista will use it to hand over your paid order",
            "أدخل رقم هاتفك — سيستخدمه الباريستا لتسليم طلبك المدفوع"
          )}
        </div>

        <div className="bg-[#F4F4F7] rounded-2xl px-5 h-16 flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Flag code="ae" size={24} />
            <span className="text-h2 font-semibold leading-none">+971</span>
          </div>
          <div className="w-px h-6 bg-[var(--color-border)]" />
          <input
            value={groupLocal(digits)}
            onChange={(e) => setDigits(uaeLocalDigits(e.target.value))}
            inputMode="tel"
            type="tel"
            autoFocus
            placeholder="50 123 4567"
            className="flex-1 min-w-0 bg-transparent outline-none text-h2 font-semibold leading-none placeholder:text-[var(--color-text-muted)] placeholder:font-medium"
          />
        </div>

        <label className="flex items-start gap-3 text-caption muted px-2 mb-6">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 w-4 h-4 accent-[var(--color-primary-500)]"
          />
          <span>
            {t("I agree to the", "أوافق على")}{" "}
            <a className="text-[var(--color-primary-500)]">{t("offer", "العرض")}</a>{" "}
            {t("and the", "و")}{" "}
            <a className="text-[var(--color-primary-500)]">{t("data processing policy", "سياسة معالجة البيانات")}</a>
          </span>
        </label>

        <button
          onClick={submit}
          disabled={!valid || !agreed}
          className="btn-pill btn-primary w-full mb-6"
        >
          {t("Confirm", "تأكيد")}
        </button>
      </div>
    </div>
  );
}

