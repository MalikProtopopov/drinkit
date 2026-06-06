"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { NumPad } from "@/components/NumPad";
import { Flag } from "@/components/Flag";
import { useStore } from "@/lib/store";

function formatPhone(digits: string) {
  // +971 XX XXX XX XX
  const d = digits.slice(0, 9);
  const parts = [
    d.slice(0, 2),
    d.slice(2, 5),
    d.slice(5, 7),
    d.slice(7, 9),
  ].filter(Boolean);
  return parts.join(" ");
}

export default function PhonePage() {
  const router = useRouter();
  const setUser = useStore((s) => s.setUser);
  const [digits, setDigits] = useState("");
  const [agreed, setAgreed] = useState(true);
  const [sending, setSending] = useState(false);

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
        const v = await api.verify(phone, "", undefined, locale === "ar" ? "ar" : "ru");
        setToken(v.token);
        useStore.getState().setUser({
          name: v.user.name ?? undefined,
          defaultCarPlate: v.user.carPlate ?? undefined,
          defaultEmirate: v.user.emirate ?? undefined,
          preferredLocale: v.user.locale === "ar" ? "ar" : "ru",
        });
        const nextUrl = sessionStorage.getItem("juicy-auth-next");
        if (v.created || !v.user.name) router.push("/auth/name");
        else {
          sessionStorage.removeItem("juicy-auth-next");
          router.push(nextUrl || "/home");
        }
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
        <div className="text-h3 font-semibold">Номер телефона</div>
        <div className="w-10" />
      </header>

      <div className="flex-1 flex flex-col px-6 pt-6">
        <div className="text-center muted text-body mb-8">
          Введи номер телефона — по нему бариста выдаст оплаченный заказ
        </div>

        <div className="bg-[#F4F4F7] rounded-2xl px-5 h-16 flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Flag code="ae" size={24} />
            <span className="text-h2 font-semibold leading-none">+971</span>
          </div>
          <div className="w-px h-6 bg-[var(--color-border)]" />
          <div className="text-h2 font-semibold flex-1 leading-none flex items-center">
            {digits ? (
              <span>{formatPhone(digits)}</span>
            ) : (
              <span className="muted">50 123 45 67</span>
            )}
            <span className="ml-1 inline-block w-[2px] h-6 bg-[var(--color-primary-500)] animate-pulse" />
          </div>
        </div>

        <label className="flex items-start gap-3 text-caption muted px-2 mb-6">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 w-4 h-4 accent-[var(--color-primary-500)]"
          />
          <span>
            Соглашаюсь с{" "}
            <a className="text-[var(--color-primary-500)]">офертой</a> и{" "}
            <a className="text-[var(--color-primary-500)]">политикой</a> обработки данных
          </span>
        </label>

        <button
          onClick={submit}
          disabled={!valid || !agreed}
          className="btn-pill btn-primary w-full mb-6"
        >
          Получить код
        </button>
      </div>

      <div className="px-4 pt-2">
        <NumPad
          onPress={(d) => setDigits((s) => (s + d).slice(0, 9))}
          onBackspace={() => setDigits((s) => s.slice(0, -1))}
        />
      </div>
    </div>
  );
}

