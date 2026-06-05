"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

const SUGGESTIONS = ["Алекс", "Мак", "Сэм", "Дани", "Лина", "Кира"];

export default function NamePage() {
  const router = useRouter();
  const setUser = useStore((s) => s.setUser);
  const [name, setName] = useState("");

  const submit = async (n: string) => {
    setUser({ name: n });
    try {
      const { api } = await import("@/lib/api");
      await api.updateMe({ name: n });
    } catch {}
    const next = sessionStorage.getItem("juicy-auth-next");
    sessionStorage.removeItem("juicy-auth-next");
    router.replace(next || "/home");
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
      <header className="flex items-center justify-between px-4 pt-safe pb-2 h-16">
        <div className="w-10" />
        <div className="text-h3 font-semibold">Имя</div>
        <button
          onClick={() => submit("Гость")}
          className="text-caption font-semibold muted px-3"
        >
          Пропустить
        </button>
      </header>

      <div className="flex-1 flex flex-col px-6 pt-6">
        <div className="text-center muted text-body mb-8">
          Позовём по имени, когда заказ будет готов
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Как тебя зовут?"
          className="w-full h-14 px-5 rounded-2xl bg-[#F4F4F7] outline-none text-h3 mb-4 focus:ring-2 focus:ring-[var(--color-primary-500)]"
          autoFocus
        />

        <div className="flex flex-wrap gap-2 mb-8">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setName(s)}
              className="chip"
            >
              {s}
            </button>
          ))}
        </div>

        <div className="mt-auto pb-safe">
          <button
            onClick={() => submit(name.trim() || "Гость")}
            disabled={!name.trim()}
            className="btn-pill btn-primary w-full"
          >
            Зовите меня так
          </button>
        </div>
      </div>
    </div>
  );
}
