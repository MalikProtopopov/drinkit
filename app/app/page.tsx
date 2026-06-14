"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { outlets } from "@/lib/data";

export default function Index() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (!hydrated) return;
    const s = useStore.getState();
    // Точка выбора аутлета скрыта — при входе всегда открываем главную,
    // дефолтная точка подставляется автоматически.
    if (!s.selectedOutletId) s.setOutlet(outlets[0].id);
    router.replace("/home");
  }, [hydrated, router]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="JOOZ" className="h-8 w-auto animate-breathe" />
      <div className="loader-ring" />
    </div>
  );
}
