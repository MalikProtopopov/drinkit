"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

export default function OtpPage() {
  const router = useRouter();
  const phone = useStore((s) => s.user.phone);
  const [code, setCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(55);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  // dev-режим: код пришёл в ответе request-code — автозаполняем как «SMS».
  // A5: только вне production, чтобы на проде поле никогда не самозаполнялось.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (code.length > 0) return;
    const dev = sessionStorage.getItem("juicy-dev-otp");
    if (!dev) return;
    const t = setTimeout(() => setCode(dev), 2200);
    return () => clearTimeout(t);
  }, [code.length]);

  const [error, setError] = useState(false);

  useEffect(() => {
    if (code.length !== 4 || !phone) return;
    const t = setTimeout(async () => {
      try {
        // PUB-G-04: верификация на бэке → JWT
        const { api, setToken } = await import("@/lib/api");
        const locale = useStore.getState().user.preferredLocale;
        const r = await api.verify(phone, code, undefined, locale);
        setToken(r.token);
        useStore.getState().setUser({
          name: r.user.name ?? undefined,
          defaultCarPlate: r.user.carPlate ?? undefined,
          defaultEmirate: r.user.emirate ?? undefined,
          // PUB-A-09 AC4: при входе применяется язык из профиля
          preferredLocale: (r.user.locale === "ar" ? "ar" : "ru"),
        });
        const next = sessionStorage.getItem("juicy-auth-next");
        if (r.created || !r.user.name) router.push("/auth/name");
        else {
          sessionStorage.removeItem("juicy-auth-next");
          router.push(next || "/home");
        }
      } catch {
        setError(true);
        setCode("");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [code, phone, router]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
    setCode(v);
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
      <header className="flex items-center justify-between px-4 pt-safe pb-2 h-16">
        <div className="w-10" />
        <div className="text-h3 font-semibold">Код из SMS</div>
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-[#F2F2F4] flex items-center justify-center"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </header>

      <div className="flex-1 flex flex-col px-6 pt-6 items-center">
        <div className="text-body text-center mb-1">
          Введи код, отправленный на
        </div>
        <div className="text-h3 font-semibold mb-1">{phone}</div>
        <button onClick={() => router.back()} className="text-[var(--color-primary-500)] text-caption font-semibold mb-6">
          Изменить номер
        </button>

        <div className="relative w-full mb-6">
          <input
            value={code}
            onChange={onChange}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            className="absolute inset-0 w-full h-full opacity-0"
          />
          <div className="flex justify-center gap-3 pointer-events-none">
            {[0, 1, 2, 3].map((i) => {
              const filled = code[i] !== undefined;
              const active = i === code.length;
              return (
                <div
                  key={i}
                  className="w-14 h-16 rounded-2xl flex items-center justify-center text-3xl font-semibold transition-all"
                  style={{
                    background: "#EDEEF1",
                    border: active
                      ? "2px solid var(--color-text)"
                      : "2px solid transparent",
                    color: filled ? "var(--color-text)" : "transparent",
                  }}
                >
                  {code[i] ?? "•"}
                </div>
              );
            })}
          </div>
          {/* SMS source hint */}
          <div className="text-center text-tiny muted mt-4">
            Источник · Telegram или SMS
          </div>
          {error && (
            <div className="text-center text-tiny mt-2" style={{ color: "var(--color-error)" }}>
              Неверный код — попробуй ещё раз
            </div>
          )}
        </div>

        {secondsLeft > 0 ? (
          <div className="muted text-body">
            Отправить снова через 0:{secondsLeft.toString().padStart(2, "0")}
          </div>
        ) : (
          <button
            onClick={() => setSecondsLeft(55)}
            className="text-[var(--color-primary-500)] text-body font-semibold"
          >
            Отправить ещё раз
          </button>
        )}
      </div>
    </div>
  );
}
